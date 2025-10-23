from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from ultralytics import YOLO
import os
from fastapi.staticfiles import StaticFiles
import shutil
from typing import Optional
from pdf2image import convert_from_path

app = FastAPI()


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL_PATH = r"E:\internship\JS\backend\model\best.pt"
MODEL = YOLO(MODEL_PATH)


# store status/logs globally
processing_status = {"state": "idle", "logs": []}

# mount uploads/outputs so frontend can request images
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# ✅ single global variable for uploaded file info
last_uploaded_file = None  

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global last_uploaded_file
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    # Save file to disk
    with open(file_path, "wb") as f:
        contents = await file.read()
        f.write(contents)

    # Store info
    last_uploaded_file = {
        "filename": file.filename,
        "path": file_path,
        "ext": os.path.splitext(file.filename)[1].lower()
    }
    print(f"✅ Uploaded: {last_uploaded_file}")  # Confirm upload
    return {"status": "Complete", "message": "File uploaded successfully", "filename": file.filename}


# @app.get("/Processings")
# def processing():
#     global last_uploaded_file
#     if not last_uploaded_file:
#         print("No file uploaded yet")
#         return {"error": "No file uploaded yet"}

#     print("Processing file:", last_uploaded_file['filename'])

#     ext = last_uploaded_file["ext"]
#     path = last_uploaded_file["path"]

#     # Example of format handling
#     if ext in [".jpg", ".png"]:
#         print("🖼️ Image detected, running detection directly...")

#     elif ext == ".pdf":
#         print("📄 Converting PDF to DXF... (placeholder for your logic)")
#         pages = convert_from_path(path)
#         for i, page in enumerate(pages):
#             page.save(f'page_{i}.jpg', 'JPEG')

#     elif ext == ".dwg":
#         print("📐 Rendering DWG to image... (placeholder for your logic)")

#     print("🚀 Running detection...")
#     MODEL.predict(
#         source=path,
#         conf=0.10,
#         iou=0.20,
#         save=True,
#         save_txt=True,
#         save_conf=True,
#         project=OUTPUT_DIR,
#         name='run',
#         show_labels=True,
#         show_conf=True,
#         line_width=2,
#     )
#     return {"status": "completed", "filename": last_uploaded_file["filename"]}

@app.get("/Processings")
def processing():
    """Main processing route — handles image, PDF, DWG, etc."""
    global last_uploaded_file
    if not last_uploaded_file:
        return {"error": "No file uploaded yet"}

    filename = last_uploaded_file["filename"]
    ext = last_uploaded_file["ext"]
    path = last_uploaded_file["path"]

    print(f"Processing file: {filename}")

    # =============== PDF HANDLING ===============
    if ext == ".pdf":
        print("📄 PDF detected — converting to images...")
        pdf_output_dir = OUTPUT_DIR / "pdf_pages"
        pdf_output_dir.mkdir(exist_ok=True)

        pages = convert_from_path(path, dpi=200)
        page_paths = []

        for i, page in enumerate(pages):
            img_path = pdf_output_dir / f"page_{i+1}.jpg"
            page.save(img_path, "JPEG")
            page_paths.append(img_path)
            print(f"🖼️ Saved PDF page {i+1} -> {img_path}")

        # Run YOLO on each page
        for img_path in page_paths:
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

    # =============== IMAGE HANDLING ===============
    elif ext in [".jpg", ".jpeg", ".png"]:
        print("🖼️ Image detected, running YOLO detection...")
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

    # =============== DWG HANDLING (future) ===============
    elif ext == ".dwg":
        print("📐 DWG detected — convert to image (TODO)")

    print("🚀 Detection completed.")
    return {"status": "completed", "filename": filename}


@app.get("/load_model")
def load_model():
    return {"status": "model ready"}


@app.get("/results")
async def get_results():
    preview_url: Optional[str] = None
    total_detections = 0
    detection_details = []
    
    # Get all output images sorted by creation time
    all_images = sorted(list(OUTPUT_DIR.rglob("*.jpg")), key=os.path.getmtime)
    total_pages = len(all_images)
    
    if all_images:
        last_img = all_images[-1]
        rel_path = last_img.relative_to(OUTPUT_DIR)
        preview_url = f"/outputs/{rel_path.as_posix()}"
        
        # Create a list of all image URLs
        page_previews = [
            {
                "page": idx + 1,
                "url": f"/outputs/{img.relative_to(OUTPUT_DIR).as_posix()}"
            }
            for idx, img in enumerate(all_images)
        ]

    # ... existing detection processing code ...
    preview_url: Optional[str] = None
    total_detections = 0
    detection_details = []

    # Find latest output image
    imgs = sorted(list(OUTPUT_DIR.rglob("*.jpg")), key=os.path.getmtime)
    if imgs:
        last_img = imgs[-1]
        rel_path = last_img.relative_to(OUTPUT_DIR)
        preview_url = f"/outputs/{rel_path.as_posix()}"

    # Read YOLO detection label files
    label_files = list(OUTPUT_DIR.rglob("labels/*.txt"))
    print(label_files, flush=True)
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

    # Map class IDs to labels (replace with your actual YOLO names)
    class_names = [
        'Cove Light', 'Door', 'Downlight', 'Emergency Light Fitting',
        'Fluorescent Light', 'Socket Outlet', 'Exit Sign'
    ]
    for d in detection_details:
        d["class_name"] = class_names[d["class_id"]] if d["class_id"] < len(class_names) else "Unknown"


    summary = {
        "total_pages": total_pages,
        "items_found": len(set([d["class_name"] for d in detection_details])),
        "total_detections": total_detections,
        "pages": page_previews  # Add pages info
    }

    return {
        "summary": summary,
        "detections": detection_details,
        "preview": preview_url,
        "pages": page_previews  # Add to response
    }


@app.get("/reset")
def reset_storage():
    """
    Delete all files/folders inside UPLOAD_DIR and OUTPUT_DIR.
    Does NOT delete the directories themselves — only their contents.
    Call this from the frontend on page reload.
    """
    try:
        for d in (UPLOAD_DIR, OUTPUT_DIR):
            for item in d.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
        # reset in-memory state
        global last_uploaded_file
        last_uploaded_file = None
        return {"status": "ok", "message": "uploads and outputs cleared"}
    except Exception as e:
        return {"status": "error", "message": str(e)}