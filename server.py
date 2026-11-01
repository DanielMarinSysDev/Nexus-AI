import os
import uuid
import subprocess
import time
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image, ImageOps
import numpy as np
import cv2
from rembg import remove as remove_bg, new_session
import dtf_engine
import hardware_detector

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
BIN_DIR = BASE_DIR / "bin" / "realesrgan"
EXECUTABLE = BIN_DIR / "realesrgan-ncnn-vulkan.exe"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Detección dinámica y caché de hardware
HW_CONFIG = hardware_detector.detect_hardware()
DEFAULT_TILE_SIZE = HW_CONFIG["optimal_tile"]
THREAD_CONFIG = HW_CONFIG["thread_config"]

# Sesión persistente y ligera para remoción de fondo (43MB, ultra veloz)
# Soporte para silueta.onnx en carpeta local bin/models si existe, o en ~/.rembg por defecto
LOCAL_SILUETA = BASE_DIR / "bin" / "models" / "silueta.onnx"
if LOCAL_SILUETA.exists():
    os.environ["U2NET_HOME"] = str(BASE_DIR / "bin")

print("Inicializando modelo de remoción de fondo rápido (silueta)...")
BG_SESSION = new_session("silueta")
print("Modelo de remoción de fondo listo.")

# Modelos validados en disco
MODELS = {
    "realesrgan-x4plus": {"name": "Foto Real / Reconstrucción HD", "desc": "Máximo detalle y nitidez para fotografías y rostros"},
    "realesrgan-x4plus-anime": {"name": "Anime / Arte Digital", "desc": "Trazos definidos sin artefactos"},
    "realesr-animevideov3": {"name": "Ultra Rápido / Animación", "desc": "Velocidad máxima (ligero y óptimo para K620)"}
}

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

@app.route("/")
def index():
    return send_from_directory(BASE_DIR / "static", "index.html")

@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory(BASE_DIR / "static", filename)

@app.route("/media/upload/<filename>")
def get_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route("/media/output/<filename>")
def get_output(filename):
    as_download = request.args.get("download", "0") == "1"
    return send_from_directory(OUTPUT_DIR, filename, as_attachment=as_download)

@app.route("/api/system_info", methods=["GET"])
def system_info():
    return jsonify({
        "gpu": f"{HW_CONFIG['gpu_name']} ({HW_CONFIG['vram_gb']}GB VRAM)",
        "cpu": f"{HW_CONFIG['cpu_name']} ({HW_CONFIG['cpu_threads']} hilos)",
        "engine": "Real-ESRGAN NCNN Vulkan",
        "models": MODELS,
        "default_tile": HW_CONFIG["optimal_tile"],
        "max_tile": HW_CONFIG["max_tile"],
        "tile_tip": HW_CONFIG["tile_tip"],
        "hardware": HW_CONFIG
    })

# --- 1. UPSCALE ENDPOINT ---
@app.route("/api/upscale", methods=["POST", "OPTIONS"])
def upscale_image():
    if request.method == "OPTIONS":
        return "", 204

    if "image" not in request.files:
        return jsonify({"error": "No se recibió ninguna imagen"}), 400

    file = request.files["image"]
    scale = int(request.form.get("scale", 4))
    model = request.form.get("model", "realesrgan-x4plus")
    tile_size = int(request.form.get("tile_size", DEFAULT_TILE_SIZE))

    if model not in MODELS:
        model = "realesrgan-x4plus"

    ext = Path(file.filename).suffix.lower()
    job_id = str(uuid.uuid4())[:8]

    # Estandarizar formatos a PNG para garantizar compatibilidad con Vulkan (incluye JFIF)
    if ext in [".jfif", ".jpeg", ".jpg", ".webp", ".bmp"]:
        input_filename = f"input_{job_id}.png"
        input_path = UPLOAD_DIR / input_filename
        with Image.open(file) as raw_img:
            raw_img = ImageOps.exif_transpose(raw_img)
            raw_img.convert("RGB").save(input_path, "PNG")
    else:
        input_filename = f"input_{job_id}.png"
        input_path = UPLOAD_DIR / input_filename
        file.save(input_path)

    try:
        with Image.open(input_path) as img:
            orig_w, orig_h = img.size
    except Exception as e:
        return jsonify({"error": f"Formato de imagen inválido: {str(e)}"}), 400

    output_filename = f"upscaled_{job_id}_x{scale}.png"
    output_path = OUTPUT_DIR / output_filename

    start_time = time.time()

    # Prevenir saturación de VRAM en modelos pesados (x4plus) limitando tile a 128
    if model in ["realesrgan-x4plus", "realesrgan-x4plus-anime"] and tile_size > 128:
        tile_size = 128

    try:
        if scale == 1:
            # Modo 1x Restauración: Escalar en GPU y reducir a dimensiones originales con Lanczos
            temp_path = OUTPUT_DIR / f"temp_{job_id}_x2.png"
            # Si el modelo solo soporta 4x, usamos 4x para generar el temp
            model_scale = "4" if model in ["realesrgan-x4plus", "realesrgan-x4plus-anime"] else "2"
            cmd = [
                str(EXECUTABLE),
                "-i", str(input_path),
                "-o", str(temp_path),
                "-s", model_scale,
                "-n", model,
                "-t", str(tile_size),
                "-j", THREAD_CONFIG,
                "-g", "0"
            ]
            subprocess.run(cmd, capture_output=True, text=True, check=True)

            with Image.open(temp_path) as rec_img:
                restored = rec_img.resize((orig_w, orig_h), Image.Resampling.LANCZOS)
                restored.save(output_path, "PNG")

            if temp_path.exists():
                temp_path.unlink()

        elif scale == 2:
            if model in ["realesrgan-x4plus", "realesrgan-x4plus-anime"]:
                # Estos modelos solo computan x4; escalamos a x4 y bajamos a x2 limpiamente
                temp_path = OUTPUT_DIR / f"temp_{job_id}_x4.png"
                cmd = [
                    str(EXECUTABLE),
                    "-i", str(input_path),
                    "-o", str(temp_path),
                    "-s", "4",
                    "-n", model,
                    "-t", str(tile_size),
                    "-j", THREAD_CONFIG,
                    "-g", "0"
                ]
                subprocess.run(cmd, capture_output=True, text=True, check=True)
                with Image.open(temp_path) as rec_img:
                    scaled2x = rec_img.resize((orig_w * 2, orig_h * 2), Image.Resampling.LANCZOS)
                    scaled2x.save(output_path, "PNG")
                if temp_path.exists():
                    temp_path.unlink()
            else:
                # realesr-animevideov3 tiene binario nativo x2
                cmd = [
                    str(EXECUTABLE),
                    "-i", str(input_path),
                    "-o", str(output_path),
                    "-s", "2",
                    "-n", model,
                    "-t", str(tile_size),
                    "-j", THREAD_CONFIG,
                    "-g", "0"
                ]
                subprocess.run(cmd, capture_output=True, text=True, check=True)

        elif scale == 4:
            cmd = [
                str(EXECUTABLE),
                "-i", str(input_path),
                "-o", str(output_path),
                "-s", "4",
                "-n", model,
                "-t", str(tile_size),
                "-j", THREAD_CONFIG,
                "-g", "0"
            ]
            subprocess.run(cmd, capture_output=True, text=True, check=True)

        elif scale == 8:
            temp_path = OUTPUT_DIR / f"temp_{job_id}_x4.png"
            cmd1 = [
                str(EXECUTABLE),
                "-i", str(input_path),
                "-o", str(temp_path),
                "-s", "4",
                "-n", model,
                "-t", str(tile_size),
                "-j", THREAD_CONFIG,
                "-g", "0"
            ]
            subprocess.run(cmd1, capture_output=True, text=True, check=True)

            # Para la segunda pasada 2x:
            cmd2 = [
                str(EXECUTABLE),
                "-i", str(temp_path),
                "-o", str(output_path),
                "-s", "2" if model == "realesr-animevideov3" else "4",
                "-n", model,
                "-t", str(tile_size),
                "-j", THREAD_CONFIG,
                "-g", "0"
            ]
            subprocess.run(cmd2, capture_output=True, text=True, check=True)

            if model in ["realesrgan-x4plus", "realesrgan-x4plus-anime"]:
                with Image.open(output_path) as rec_img:
                    scaled8x = rec_img.resize((orig_w * 8, orig_h * 8), Image.Resampling.LANCZOS)
                    scaled8x.save(output_path, "PNG")

            if temp_path.exists():
                temp_path.unlink()
        else:
            return jsonify({"error": "Factor de escala no soportado (usar 1, 2, 4 u 8)"}), 400

        elapsed = round(time.time() - start_time, 2)

        with Image.open(output_path) as out_img:
            new_w, new_h = out_img.size

        return jsonify({
            "success": True,
            "job_id": job_id,
            "original_url": f"/media/upload/{input_filename}",
            "upscaled_url": f"/media/output/{output_filename}",
            "filename": output_filename,
            "original_dimensions": f"{orig_w}x{orig_h}",
            "new_dimensions": f"{new_w}x{new_h}",
            "scale": f"x{scale}",
            "model_used": MODELS[model]["name"],
            "elapsed_seconds": elapsed
        })

    except subprocess.CalledProcessError as err:
        return jsonify({
            "error": "Error durante el procesamiento en la GPU",
            "details": err.stderr or err.stdout
        }), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 2. DTF TEXTIL / BACKGROUND REMOVAL & HALFTONE ENDPOINT ---
@app.route("/api/dtf_process", methods=["POST", "OPTIONS"])
def dtf_process_image():
    if request.method == "OPTIONS":
        return "", 204
    if "image" not in request.files:
        return jsonify({"error": "No se recibió ninguna imagen"}), 400

    file = request.files["image"]
    bg_method = request.form.get("bg_method", "ai")  # "none", "ai", "color"
    color_key_hex = request.form.get("color_key", "#000000")
    color_tolerance = int(request.form.get("color_tolerance", 25))
    color_feather = int(request.form.get("color_feather", 2))
    color_contiguous = request.form.get("color_contiguous", "true") == "true"

    apply_halftone = request.form.get("apply_halftone", "true") == "true"
    choke_px = int(request.form.get("choke_px", 2))
    dot_size = int(request.form.get("dot_size", 6))
    angle = float(request.form.get("angle", 45.0))
    mode = request.form.get("mode", "color")  # "color", "mono", "palette", "white"
    tint_hex = request.form.get("tint_color", "#FFFFFF")
    palette_raw = request.form.get("palette_colors", "")

    # Convertir tint_hex a RGB tuple
    hex_clean = tint_hex.lstrip("#")
    if len(hex_clean) == 6:
        tint_rgb = tuple(int(hex_clean[i:i+2], 16) for i in (0, 2, 4))
    else:
        tint_rgb = (255, 255, 255)

    # Convertir paleta múltiple (ej. "#ff0000,#00ff00,#0000ff")
    palette_rgb = []
    if palette_raw:
        for c in palette_raw.split(","):
            c_clean = c.strip().lstrip("#")
            if len(c_clean) == 6:
                palette_rgb.append(tuple(int(c_clean[i:i+2], 16) for i in (0, 2, 4)))

    # Convertir color_key_hex a RGB
    ck_clean = color_key_hex.lstrip("#")
    if len(ck_clean) == 6:
        color_key_rgb = tuple(int(ck_clean[i:i+2], 16) for i in (0, 2, 4))
    else:
        color_key_rgb = (0, 0, 0)

    job_id = str(uuid.uuid4())[:8]
    input_filename = f"dtf_in_{job_id}.png"
    input_path = UPLOAD_DIR / input_filename

    # Cargar y asegurar formato RGBA
    with Image.open(file) as raw_img:
        raw_img = ImageOps.exif_transpose(raw_img).convert("RGBA")
        raw_img.save(input_path, "PNG")
        orig_w, orig_h = raw_img.size

    output_filename = f"dtf_out_{job_id}.png"
    output_path = OUTPUT_DIR / output_filename
    start_time = time.time()

    try:
        # 1. Extracción de fondo según método seleccionado
        if bg_method == "ai":
            with Image.open(input_path) as src_img:
                working_img = remove_bg(src_img, session=BG_SESSION)
        elif bg_method == "color":
            with Image.open(input_path) as src_img:
                working_img = dtf_engine.remove_background_by_color(
                    src_img,
                    target_rgb=color_key_rgb,
                    tolerance=color_tolerance,
                    feather=color_feather,
                    contiguous=color_contiguous
                )
        else:
            working_img = Image.open(input_path)

        # 2. Tramado Halftone y Limpieza de bordes blancos para DTF
        if apply_halftone:
            processed_img = dtf_engine.generate_dtf_halftone(
                working_img,
                dot_size=dot_size,
                angle_deg=angle,
                mode=mode,
                tint_color=tint_rgb,
                palette_colors=palette_rgb,
                choke_pixels=choke_px
            )
        else:
            processed_img = dtf_engine.remove_white_halos(working_img, choke_pixels=choke_px)

        processed_img.save(output_path, "PNG")
        elapsed = round(time.time() - start_time, 2)

        return jsonify({
            "success": True,
            "processed_url": f"/media/output/{output_filename}",
            "filename": output_filename,
            "original_url": f"/media/upload/{input_filename}",
            "dimensions": f"{orig_w}x{orig_h}",
            "elapsed_seconds": elapsed
        })

    except Exception as e:
        return jsonify({"error": f"Fallo al procesar DTF: {str(e)}"}), 500

if __name__ == "__main__":
    print("Iniciando Cyber_Scale HUD en http://localhost:5050 ...")
    app.run(host="127.0.0.1", port=5050, debug=False)
