import numpy as np
import cv2
from PIL import Image

def remove_background_by_color(
    img_rgba: Image.Image,
    target_rgb: tuple = (0, 0, 0),
    tolerance: int = 25,
    feather: int = 2,
    contiguous: bool = True
) -> Image.Image:
    """
    Elimina fondo por color seleccionado (Cuentagotas):
    - tolerance: Distancia euclídea RGB (0 a 150).
    - feather: Suavizado antialiasing de borde para evitar dientes de sierra.
    - contiguous=True: Solo elimina el fondo exterior conectado a los bordes, protegiendo
      zonas oscuras/internas del personaje o ilustración.
    - contiguous=False: Elimina globalmente el color en toda la imagen.
    """
    arr = np.array(img_rgba)
    rgb = arr[:, :, :3]
    h, w = rgb.shape[:2]

    # Diferencia euclídea al color objetivo
    target_arr = np.array(target_rgb, dtype=np.float32)
    diff = np.linalg.norm(rgb.astype(np.float32) - target_arr, axis=2)

    # Máscara binaria inicial por tolerancia
    match_mask = (diff <= tolerance).astype(np.uint8) * 255

    if contiguous:
        # Inundación (Flood Fill) desde las esquinas y perímetro para detectar solo el fondo externo
        flood_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
        traversable = (255 - match_mask).astype(np.uint8)

        # Sembrar inundación en esquinas y centros de bordes
        points_to_seed = [
            (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
            (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)
        ]
        for sx, sy in points_to_seed:
            if match_mask[sy, sx] > 0:
                cv2.floodFill(traversable, flood_mask, (sx, sy), 128, flags=4 | (128 << 8))

        # El fondo exterior es el que se inundó con valor 128
        outer_bg = (traversable == 128).astype(np.uint8) * 255
        raw_alpha = 255 - outer_bg
    else:
        raw_alpha = 255 - match_mask

    # Aplicar suavizado de borde (feather) para transición natural
    if feather > 0:
        ksize = feather * 2 + 1
        blurred_alpha = cv2.GaussianBlur(raw_alpha.astype(np.float32), (ksize, ksize), 0)
        alpha_mask = np.clip(blurred_alpha, 0, 255).astype(np.uint8)
    else:
        alpha_mask = raw_alpha

    # Si la imagen ya tenía transparencia, respetar el alfa existente
    if arr.shape[2] == 4:
        alpha_mask = np.minimum(arr[:, :, 3], alpha_mask)

    result = np.dstack((rgb, alpha_mask))
    return Image.fromarray(result, "RGBA")
    return Image.fromarray(result, "RGBA")


def remove_white_halos(img_rgba: Image.Image, choke_pixels: int = 2) -> Image.Image:
    """
    Elimina halos blancos en bordes semitransparentes mediante:
    1. Choke (erosión controlada de la máscara alpha).
    2. Color decontamination (dilata el RGB de píxeles sólidos sobre los semitransparentes).
    """
    arr = np.array(img_rgba)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    if choke_pixels > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (choke_pixels * 2 + 1, choke_pixels * 2 + 1))
        alpha_choked = cv2.erode(alpha, kernel, iterations=1)
    else:
        alpha_choked = alpha

    # Píxeles con opacidad sólida
    solid_mask = (alpha_choked > 220).astype(np.uint8)
    
    if np.any(solid_mask):
        color_clean = cv2.inpaint(rgb, 255 - (solid_mask * 255), inpaintRadius=3, flags=cv2.INPAINT_TELEA)
    else:
        color_clean = rgb

    result = np.dstack((color_clean, alpha_choked))
    return Image.fromarray(result, "RGBA")


def map_to_palette(rgb_img: np.ndarray, palette_rgb: list) -> np.ndarray:
    """
    Mapea cada píxel al color más cercano de una paleta definida por el usuario
    calculando la distancia euclidiana en el espacio RGB.
    """
    if not palette_rgb:
        return rgb_img

    h, w = rgb_img.shape[:2]
    flat_rgb = rgb_img.reshape(-1, 3).astype(np.float32)
    palette_arr = np.array(palette_rgb, dtype=np.float32)

    # Distancias a cada color de la paleta (N_pixels, N_colors)
    # (A - B)^2 = A^2 - 2AB + B^2
    diff = flat_rgb[:, np.newaxis, :] - palette_arr[np.newaxis, :, :]
    dist_sq = np.sum(diff ** 2, axis=2)
    nearest_idx = np.argmin(dist_sq, axis=1)

    mapped_flat = palette_arr[nearest_idx].astype(np.uint8)
    return mapped_flat.reshape(h, w, 3)


def generate_dtf_halftone(
    img_rgba: Image.Image,
    dot_size: int = 6,          # Tamaño de celda del tramado (en px)
    angle_deg: float = 45.0,    # Ángulo de trama
    mode: str = "color",        # "color", "mono", "palette", "white"
    tint_color: tuple = (255, 255, 255), # (R, G, B) para modo mono
    palette_colors: list = None,          # Lista de (R, G, B) para modo palette
    choke_pixels: int = 2
) -> Image.Image:
    """
    Convierte imagen con canal Alpha en tramado de semitonos (Halftone Screen)
    diseñado para DTF Textil:
    - Sin tinta blanca sólida que agriete la prenda.
    - Modo monocromático con preservación fiel de luces, sombras y matices.
    - Modo paleta multitono para DTF/serigrafía.
    """
    clean_img = remove_white_halos(img_rgba, choke_pixels=choke_pixels)
    arr = np.array(clean_img)
    h, w = arr.shape[:2]

    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3].astype(np.float32) / 255.0

    # Luminancia ponderada ITU-R BT.601
    luminance = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]) / 255.0

    # Determinar densidad del punto
    if mode == "white":
        density = luminance * alpha
    else:
        # La densidad responde a la combinación de opacidad y luminosidad para realzar matices
        density = alpha

    # Rotación para ángulo de trama
    rad = np.radians(angle_deg)
    cos_a, sin_a = np.cos(rad), np.sin(rad)

    y_indices, x_indices = np.indices((h, w))
    rot_x = cos_a * x_indices - sin_a * y_indices
    rot_y = sin_a * x_indices + cos_a * y_indices

    mod_x = (rot_x % dot_size) - (dot_size / 2.0)
    mod_y = (rot_y % dot_size) - (dot_size / 2.0)
    dist_to_center = np.sqrt(mod_x**2 + mod_y**2)

    max_radius = (dot_size / 2.0) * 1.05
    dot_radius = np.sqrt(np.clip(density, 0.0, 1.0)) * max_radius

    # Antialiasing en borde del punto
    halftone_mask = np.clip((dot_radius - dist_to_center) + 0.5, 0.0, 1.0)
    final_alpha = (halftone_mask * (alpha * 255.0)).astype(np.uint8)

    if mode == "color":
        out_rgb = rgb.astype(np.uint8)

    elif mode == "mono":
        # Preservar sombras, volumen y contraste modulando el color con la luminosidad original
        # lum_factor asegura que las zonas oscuras se vean oscuras y las claras brillantes
        lum_norm = np.clip(luminance[:, :, np.newaxis], 0.05, 1.0)
        tint_arr = np.array(tint_color, dtype=np.float32).reshape(1, 1, 3)
        out_rgb = np.clip(tint_arr * lum_norm, 0, 255).astype(np.uint8)

    elif mode == "palette":
        # Mapeo a paleta de colores personalizada
        if palette_colors and len(palette_colors) > 0:
            out_rgb = map_to_palette(rgb.astype(np.uint8), palette_colors)
        else:
            out_rgb = rgb.astype(np.uint8)

    else: # white
        out_rgb = np.ones_like(rgb, dtype=np.uint8) * 255

    result = np.dstack((out_rgb, final_alpha))
    return Image.fromarray(result, "RGBA")
