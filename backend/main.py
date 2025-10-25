from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pdf2image import convert_from_path
from ultralytics import YOLO
import shutil, os, time, traceback
import convertapi
from PIL import Image
import fitz, io
from dotenv import load_dotenv


load_dotenv()

# convertapi.api_secret = os.getenv("Convert_API_KEY")

# ---------------------------
# Setup
# ---------------------------
app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
MODEL_DIR = BASE_DIR / "model"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

# ---------------------------
# CORS Setup
# ---------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Static Files
# ---------------------------
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# ---------------------------
# Global Model
# ---------------------------
model = None


# ---------------------------
# Utility Functions
# ---------------------------

def clear_directory(path: Path):
    """Delete all contents of a directory"""
    if path.exists():
        for item in path.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)



def convert_dwf_to_pdf(dwf_file_path: str) -> str:
    """Convert DWF to PDF using ConvertAPI."""
    try:
        import convertapi
        convertapi.api_credentials = os.getenv("Convert_API_KEY")
        print(f"📐 Converting DWF file: {dwf_file_path}")

        dwf_file_path = os.path.abspath(dwf_file_path)
        output_dir = os.path.dirname(dwf_file_path) or os.getcwd()

        result = convertapi.convert("pdf", {"File": dwf_file_path}, from_format="dwf")
        saved_files = result.save_files(output_dir)

        if saved_files:
            pdf_path = saved_files[0]
            print(f"✅ DWF successfully converted to PDF: {pdf_path}")
            return pdf_path
        raise Exception("ConvertAPI did not return any files")
    except Exception as e:
        print(f"🚫 DWF to PDF conversion failed: {e}")
        print(traceback.format_exc())
        raise


def pdf_to_images(pdf_path, output_dir):
    """Convert PDF to images using PyMuPDF (fast + accurate)"""
    try:
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        print(f"📄 Processing PDF with {total_pages} pages...")

        output_dir.mkdir(exist_ok=True)
        for i in range(total_pages):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_path = output_dir / f"page_{i+1}.jpg"
            pix.save(str(img_path))
            print(f"🖼️ Saved page {i+1}: {img_path}")

        doc.close()
        print(f"✅ All {total_pages} pages converted successfully.")
        return True

    except Exception as e:
        print(f"Error converting PDF to images: {e}")
        raise



# ---------------------------
# Routes
# ---------------------------

@app.get("/reset")
def reset_storage():
    """Clear all uploaded and output files."""
    try:
        for d in (UPLOAD_DIR, OUTPUT_DIR):
            for item in d.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

        global last_uploaded_file
        last_uploaded_file = None
        print("🧹 All files cleared successfully.")
        return {"status": "ok", "message": "uploads and outputs cleared"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Save uploaded file."""
    try:
        ext = Path(file.filename).suffix.lower()
        filename = f"file{ext}"
        file_path = UPLOAD_DIR / filename
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        print(f"✅ Uploaded: {filename}")
        return {"filename": filename, "path": str(file_path), "status": "Complete"}
    except Exception as e:
        return {"error": str(e), "status": "failed"}


@app.get("/preprocess")
async def preprocess_file():
    """Convert uploaded file (PDF/DWF/Image) to images in pdf_pages folder."""
    try:
        uploaded_files = list(UPLOAD_DIR.glob("file.*"))
        if not uploaded_files:
            return {"status": "failed", "error": "No uploaded file found"}

        input_path = uploaded_files[0]
        ext = input_path.suffix.lower()
        pdf_output_dir = OUTPUT_DIR / "pdf_pages"
        pdf_output_dir.mkdir(exist_ok=True)

        # Clear old pages first
        clear_directory(pdf_output_dir)
        pdf_output_dir.mkdir(exist_ok=True)

        if ext == ".pdf":
            pdf_to_images(input_path, pdf_output_dir)
        elif ext == ".dwf":
            pdf_path = convert_dwf_to_pdf(input_path)
            pdf_to_images(pdf_path, pdf_output_dir)
        elif ext in [".jpg", ".jpeg", ".png"]:
            dest = pdf_output_dir / "page_1.jpg"
            shutil.copy2(input_path, dest)
            print(f"🖼️ Image copied to {dest}")
        else:
            return {"status": "failed", "error": "Unsupported file format"}

        total_pages = len(list(pdf_output_dir.glob("*.jpg")))
        print(f"✅ Total pages extracted: {total_pages}")
        return {"status": "ok", "pages_dir": str(pdf_output_dir), "pages": total_pages}
    except Exception as e:
        traceback.print_exc()
        return {"status": "failed", "error": str(e)}


@app.get("/load_model")
async def load_model():
    """Load YOLO model once."""
    global model
    try:
        if model is None:
            model_path = MODEL_DIR / "best.pt"
            print(f"📦 Loading model from {model_path}")
            model = YOLO(str(model_path))
            print("✅ Model loaded.")
        else:
            print("⚡ Model already loaded.")
        return {"status": "ok"}
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e), "status": "failed"}


@app.get("/inference")
async def run_inference():
    """Run YOLO inference page-by-page and keep all runs."""
    global model
    try:
        if model is None:
            return {"status": "failed", "error": "Model not loaded"}

        images_dir = OUTPUT_DIR / "pdf_pages"
        image_files = sorted(images_dir.glob("*.jpg"), key=os.path.getmtime)
        if not image_files:
            return {"status": "failed", "error": "No images found for inference"}

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        run_dir = OUTPUT_DIR / "run" / f"run_{timestamp}"
        run_dir.mkdir(parents=True, exist_ok=True)

        print(f"🚀 Running inference page-by-page ({len(image_files)} pages)...")

        for i, img in enumerate(image_files, start=1):
            print(f"🧠 Inference on page {i}/{len(image_files)} → {img.name}")
            results = model.predict(
                source=str(img),
                project=str(run_dir.parent),
                name=run_dir.name,
                exist_ok=True,
                save=True,
                conf=0.10,
                iou=0.20,
                save_txt=True,
                save_conf=True,
                hide_labels=True
            )
            print(f"✅ Done page {i}")

        print("✅ Inference completed for all pages.")
        return {"status": "ok", "run_dir": str(run_dir)}

    except Exception as e:
        traceback.print_exc()
        return {"status": "failed", "error": str(e)}



# ---------------------------
# Results
# ---------------------------
@app.get("/results")
async def get_results():
    """Return detection results and only YOLO inference images."""
    try:
        total_detections = 0
        detection_details = []
        preview_url = None

        results_dir = OUTPUT_DIR / "run"
        all_images = sorted(list(results_dir.rglob("*.jpg")), key=os.path.getmtime)
        total_pages = len(all_images)

        if all_images:
            last_img = all_images[-1]
            rel_path = last_img.relative_to(OUTPUT_DIR)
            preview_url = f"/outputs/{rel_path.as_posix()}"
            page_previews = [
                {"page": idx + 1, "url": f"/outputs/{img.relative_to(OUTPUT_DIR).as_posix()}"}
                for idx, img in enumerate(all_images)
            ]
        else:
            page_previews = []

        label_files = list(results_dir.rglob("labels/*.txt"))
        for f in label_files:
            with open(f, "r") as lf:
                lines = lf.read().strip().splitlines()
                for line in lines:
                    total_detections += 1
                    parts = line.split()
                    if len(parts) >= 5:
                        cls_id = int(parts[0])
                        conf = float(parts[-1])
                        detection_details.append({
                            "class_id": cls_id,
                            "confidence": round(conf, 2)
                        })

        class_names = [
            "Cove Light", "Door", "Downlight", "Emergency Light Fitting",
            "Fluorescent Light", "Socket Outlet", "Exit Sign"
        ]
        for d in detection_details:
            d["class_name"] = class_names[d["class_id"]] if d["class_id"] < len(class_names) else "Unknown"

        summary = {
            "total_pages": total_pages,
            "items_found": len(set([d["class_name"] for d in detection_details])),
            "total_detections": total_detections,
            "pages": page_previews,
        }

        print(summary)

        return {
            "summary": summary,
            "detections": detection_details,
            "preview": preview_url,
            "pages": page_previews
        }

    except Exception as e:
        return {"error": str(e)}
