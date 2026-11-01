@echo off
title NEXUS_CORE Cyberpunk Scaler
color 0b
echo ========================================================
echo       NEXUS_CORE // AI UPSCALER & VECTOR STUDIO
echo ========================================================
echo  Iniciando servidor local en http://localhost:5000 ...
echo  (Manten esta ventana abierta mientras uses la aplicacion)
echo ========================================================
if exist ".\venv\Scripts\python.exe" (
    ".\venv\Scripts\python.exe" server.py
) else (
    python server.py
)
pause
