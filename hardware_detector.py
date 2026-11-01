import json
import os
import subprocess
from pathlib import Path

def get_cache_path():
    """
    Ruta estándar para aplicaciones de escritorio en Windows (%LOCALAPPDATA%\\NexusAI\\hardware.cache).
    Aislada del repositorio/código fuente y protegida contra manipulaciones accidentales.
    """
    app_data = os.environ.get("LOCALAPPDATA")
    if app_data:
        nexus_dir = Path(app_data) / "NexusAI"
    else:
        nexus_dir = Path.home() / ".nexus_ai"
    
    nexus_dir.mkdir(parents=True, exist_ok=True)
    return nexus_dir / "hardware.cache"

CACHE_FILE = get_cache_path()

def detect_hardware():
    """
    Detecta automáticamente CPU, GPU y VRAM real del sistema en Windows
    y calcula la configuración óptima para evitar cuellos de botella y OOM.
    """
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "gpu_name" in data and "cpu_name" in data:
                    return data
        except Exception:
            pass

    # 1. Detección de CPU
    cpu_name = "Intel Core i3"
    cpu_threads = os.cpu_count() or 4
    try:
        cmd_cpu = "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name"
        res_cpu = subprocess.run(["powershell", "-NoProfile", "-Command", cmd_cpu], capture_output=True, text=True, timeout=5)
        if res_cpu.returncode == 0 and res_cpu.stdout.strip():
            cpu_name = res_cpu.stdout.strip().split("\n")[0].strip()
    except Exception:
        pass

    # 2. Detección de GPU y VRAM
    gpu_name = "GPU Dedicada (Vulkan)"
    vram_gb = 2.0
    try:
        cmd_gpu = 'Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 500000000 } | Select-Object Name, AdapterRAM | ConvertTo-Json'
        res_gpu = subprocess.run(["powershell", "-NoProfile", "-Command", cmd_gpu], capture_output=True, text=True, timeout=5)
        if res_gpu.returncode == 0 and res_gpu.stdout.strip():
            gpu_data = json.loads(res_gpu.stdout)
            if isinstance(gpu_data, list):
                # Tomar la primera dedicada no virtual
                gpu_data = [g for g in gpu_data if "Virtual" not in g.get("Name", "")][0]
            
            raw_name = gpu_data.get("Name", "NVIDIA GPU")
            raw_ram = gpu_data.get("AdapterRAM", 2147483648)
            gpu_name = raw_name
            vram_gb = round(raw_ram / (1024**3), 1)
    except Exception:
        pass

    # 3. Cálculo óptimo de configuración:
    # - Tile de seguridad GPU
    if vram_gb <= 2.5:
        optimal_tile = 128
        max_tile = 128
        tile_tip = "128 px (Óptimo para 2GB VRAM)"
    elif vram_gb <= 4.5:
        optimal_tile = 256
        max_tile = 256
        tile_tip = "256 px (Óptimo para 4GB VRAM)"
    elif vram_gb <= 8.5:
        optimal_tile = 400
        max_tile = 512
        tile_tip = "400 px (Rendimiento acelerado 8GB)"
    else:
        optimal_tile = 0  # Auto / Full image
        max_tile = 0
        tile_tip = "Tile Automático / VRAM Ilimitada"

    # - Thread pipeline de CPU para Real-ESRGAN (-j load:proc:save)
    # load: I/O de disco
    # proc: procesamiento exclusivo de GPU (siempre 1 o 2)
    # save: codificación PNG/JPG (utiliza hilos de CPU)
    if cpu_threads <= 4:
        # Core i3 (2C / 4T): dejar 1 load, 1 proc, 2 save para no congelar el sistema
        thread_config = "1:1:2"
    elif cpu_threads <= 8:
        # i5 / i7 (6-8 threads): 1 load, 1 proc, 4 save
        thread_config = "1:1:4"
    else:
        # Ryzen / i9 (12+ threads): 2 load, 2 proc, 4 save
        thread_config = "2:2:4"

    config = {
        "cpu_name": cpu_name,
        "cpu_threads": cpu_threads,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb,
        "optimal_tile": optimal_tile,
        "max_tile": max_tile,
        "tile_tip": tile_tip,
        "thread_config": thread_config,
        "vulkan_online": True
    }

    # Guardar en caché local
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception:
        pass

    return config

