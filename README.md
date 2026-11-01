# Nexus AI // Suite de Escalado Vulkan y DTF Textil

Aplicación de escritorio de alto rendimiento para Windows construida con **Tauri v2 (Rust)** y backend local de visión por computador.

## Características
- **Super-Resolución Local Vulkan:** Optimizado para GPUs dedicadas (NVIDIA Quadro K620 / GeForce / Radeon) y CPU multinúcleo con Real-ESRGAN NCNN.
- **Suite DTF Textil:**
  - Remoción de fondos con IA (`silueta.onnx`) y extracción contigua por cuentagotas con tolerancia y feathering.
  - Corrección de sangrado / Choke (0–3 px) para suprimir halos blancos en impresión textil.
  - Tramado de semitonos (Halftone) con tramado de puntos personalizable (modo color, tinta blanca, monocromático continuo o paletas indexadas).
  - Previsualizador interactivo con zoom (rueda de ratón) y paneo (arrastre).
- **Detección Dinámica de Hardware:** Calibración automática de VRAM y paralelismo guardado en caché segura del sistema (`%LOCALAPPDATA%\NexusAI`).

---

## Modos de Distribución y Uso

### 1. Para Usuarios Finales (Sin dependencias ni Python)
Descargar el archivo comprimido `Nexus_AI_Portable.zip` desde la sección de [Releases de GitHub](https://github.com/).
1. Descomprimir la carpeta.
2. Hacer doble clic en `Nexus_AI.exe`.
3. Todo el entorno de inferencia (motor Vulkan, modelos ONNX y runtime) se ejecuta de forma 100% autónoma y offline sin requerir conexión a internet ni instalaciones previas.

### 2. Para Desarrolladores (Entorno de Código)
Si deseas compilar o modificar el código fuente:

```bash
# 1. Clonar el repositorio
git clone https://github.com/DanielMarinSysDev/Nexus-AI
cd Escalado

# 2. Crear y activar entorno virtual de Python
python -m venv venv
.\venv\Scripts\activate

# 3. Instalar librerías
pip install -r requirements.txt

# 4. Compilar la interfaz gráfica con Rust / Tauri
cd src-tauri
cargo build --release
```

