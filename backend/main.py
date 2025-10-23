from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from typing import Optional
from ultralytics import YOLO
import os
import fitz  # PyMuPDF
import shutil
import traceback
from dotenv import load_dotenv


# ============================================================
# ⚙️ Setup
# ============================================================
app = FastAPI(title="Detection Backend", version="1.0")

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL_PATH = r"E:\internship\JS\backend\model\best.pt"
MODEL = YOLO(MODEL_PATH)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 🔄 Global Variables
# ============================================================
last_uploaded_file: Optional[dict] = None
processing_status = {"state": "idle", "logs": []}


# ============================================================
# 📄 Utility Functions
# ============================================================
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


def pdf_to_images(pdf_path: str):
    """Convert a PDF into JPEG images and run YOLO detection on each page."""
    try:
        pdf_output_dir = OUTPUT_DIR / "pdf_pages"
        pdf_output_dir.mkdir(exist_ok=True)

        doc = fitz.open(pdf_path)
        print(f"📄 Processing PDF with {len(doc)} pages")

        for i, page in enumerate(doc, start=1):
            mat = fitz.Matrix(2, 2)  # upscale for better resolution
            pix = page.get_pixmap(matrix=mat)
            img_path = pdf_output_dir / f"page_{i}.jpg"
            pix.save(img_path)
            print(f"✅ Saved page {i} -> {img_path}")

            MODEL.predict(
                source=str(img_path),
                conf=0.10,
                iou=0.20,
                save=True,
                save_txt=True,
                save_conf=True,
                project=OUTPUT_DIR,
                name="run",
                exist_ok=True,
                hide_labels=True
            )

        doc.close()
        print("🚀 PDF processing completed.")
        return True

    except Exception as e:
        print(f"❌ Error converting PDF to images: {e}")
        raise


# ============================================================
# 🧩 ROUTES
# ============================================================

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and save file to uploads directory."""
    global last_uploaded_file

    try:
        ext = Path(file.filename).suffix.lower()
        file_path = UPLOAD_DIR / file.filename

        # Save file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        last_uploaded_file = {
            "filename": file.filename,
            "path": str(file_path),
            "ext": ext,
        }

        print(f"✅ Uploaded: {last_uploaded_file}")
        return {"status": "Complete", "message": "File uploaded successfully", "filename": file.filename}

    except Exception as e:
        return {"status": "Error", "message": str(e)}


@app.get("/Processings")
def processing():
    """Detect file type and process accordingly."""
    global last_uploaded_file
    if not last_uploaded_file:
        return {"error": "No file uploaded yet"}

    filename = last_uploaded_file["filename"]
    ext = last_uploaded_file["ext"]
    path = last_uploaded_file["path"]

    print(f"🧠 Processing file: {filename}")

    try:
        if ext == ".pdf":
            print("📄 PDF detected — converting to images...")
            pdf_to_images(path)

        elif ext in [".jpg", ".jpeg", ".png"]:
            print("🖼️ Image detected — running YOLO...")
            MODEL.predict(
                source=path,
                conf=0.10,
                iou=0.20,
                save=True,
                save_txt=True,
                save_conf=True,
                project=OUTPUT_DIR,
                name="run",
                exist_ok=True,
                hide_labels=True
            )

        elif ext == ".dwf":
            print("📐 DWF detected — converting to PDF first...")
            pdf_path = convert_dwf_to_pdf(path)
            if pdf_path and os.path.exists(pdf_path):
                print("📄 Converting generated PDF to images...")
                pdf_to_images(pdf_path)
            else:
                raise Exception("PDF conversion failed — no file found")

        print("🚀 Processing completed.")
        return {"status": "success", "message": "Processing completed."}

    except Exception as e:
        print(f"❌ Error during processing: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/load_model")
def load_model():
    """Check if model is ready."""
    return {"status": "model ready"}


@app.get("/results")
async def get_results():
    """Return detection results and only YOLO inference images."""
    try:
        total_detections = 0
        detection_details = []
        preview_url = None

        # ✅ Only get images from YOLO inference folder (e.g., outputs/run/)
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

        # ✅ Parse YOLO label files only from outputs/run/labels/
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

        return {
            "summary": summary,
            "detections": detection_details,
            "preview": preview_url,
            "pages": page_previews
        }

    except Exception as e:
        return {"error": str(e)}



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
