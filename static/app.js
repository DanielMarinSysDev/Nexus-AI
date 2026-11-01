document.addEventListener("DOMContentLoaded", () => {
  // Desactivar menu contextual del navegador para sensacion 100% nativa
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  // Navigation Tabs
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabUpscale = document.getElementById("tab-controls-upscale");
  const tabDtf = document.getElementById("tab-controls-dtf");

  // Common UI Elements
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const processingView = document.getElementById("processing-view");
  const processingTitle = document.getElementById("processing-title-text");
  const processingSubtitle = document.getElementById("processing-subtitle-text");
  
  // Results Containers
  const resultUpscale = document.getElementById("result-view-upscale");
  const resultDtf = document.getElementById("result-view-dtf");
  const resetBtns = document.querySelectorAll(".btn-reset-action");

  // Upscale controls
  const btnProcessUpscale = document.getElementById("btn-process-upscale");
  const scaleBtns = document.querySelectorAll("#scale-selector .seg-btn");
  const modelCards = document.querySelectorAll(".model-card");
  const tileSlider = document.getElementById("tile-slider");
  const tileSizeVal = document.getElementById("tile-size-val");
  const imgOriginal = document.getElementById("img-original");
  const imgUpscaled = document.getElementById("img-upscaled");
  const btnDownloadUpscaled = document.getElementById("btn-download-upscaled");
  const labelScale = document.getElementById("label-scale");

  // DTF controls
  const btnProcessDtf = document.getElementById("btn-process-dtf");
  const dtfBgBtns = document.querySelectorAll("#dtf-bg-selector .seg-btn");
  const dtfColorKeyOptions = document.getElementById("dtf-color-key-options");
  const btnPickEyedropper = document.getElementById("btn-pick-eyedropper");
  const dtfColorKey = document.getElementById("dtf-color-key");
  const dtfColorKeyHex = document.getElementById("dtf-color-key-hex");
  const dtfColorTolSlider = document.getElementById("dtf-color-tol-slider");
  const dtfColorTolVal = document.getElementById("dtf-color-tol-val");
  const dtfColorFeatherSlider = document.getElementById("dtf-color-feather-slider");
  const dtfColorFeatherVal = document.getElementById("dtf-color-feather-val");
  const dtfColorContiguous = document.getElementById("dtf-color-contiguous");

  const dtfChokeBtns = document.querySelectorAll("#dtf-choke-selector .seg-btn");
  const dtfHalftoneBtns = document.querySelectorAll("#dtf-halftone-toggle .seg-btn");
  const dtfModeBtns = document.querySelectorAll("#dtf-mode-selector .seg-btn");
  const dtfDotSlider = document.getElementById("dtf-dot-slider");
  const dtfDotSizeVal = document.getElementById("dtf-dot-size-val");
  const dtfAngleBtns = document.querySelectorAll("#dtf-angle-selector .seg-btn");
  const dtfTintColor = document.getElementById("dtf-tint-color");
  const dtfColorPickerGroup = document.getElementById("dtf-color-picker-group");
  const dtfPaletteGroup = document.getElementById("dtf-palette-group");
  const paletteChipsContainer = document.getElementById("palette-chips-container");
  const dtfNewPaletteColor = document.getElementById("dtf-new-palette-color");
  const btnAddPaletteColor = document.getElementById("btn-add-palette-color");
  const dtfHalftoneOptions = document.getElementById("dtf-halftone-options");
  const dtfPreviewContainer = document.getElementById("dtf-preview-container");
  const imgDtfProcessed = document.getElementById("img-dtf-processed");
  const dtfZoomLevel = document.getElementById("dtf-zoom-level");
  const btnDownloadDtf = document.getElementById("btn-download-dtf");

  // Metrics
  const processMetrics = document.getElementById("process-metrics");
  const metricTime = document.getElementById("metric-time");
  const metricOrigDim = document.getElementById("metric-orig-dim");
  const metricNewDim = document.getElementById("metric-new-dim");

  // Comparison slider
  const comparisonBox = document.getElementById("comparison-box");
  const compSliderMask = document.getElementById("comp-slider-mask");
  const sliderHandle = document.getElementById("slider-handle");

  // State
  const API_BASE = window.location.origin.includes(":5050") ? "" : "http://127.0.0.1:5050";
  let currentTab = "upscale";
  let selectedFile = null;
  let selectedScale = 4;
  let selectedModel = "realesrgan-x4plus";
  
  // DTF State
  let dtfBgMethod = "ai"; // "ai", "color", "none"
  let dtfChokePx = 2;
  let dtfApplyHalftone = true;
  let dtfMode = "color";
  let dtfPaletteColors = ["#ff3b30", "#34c759", "#007aff", "#ffcc00", "#ffffff"];
  let dtfDotSize = 6;
  let dtfAngle = 45.0;
  let isDraggingSlider = false;

  // Zoom y Pan para DTF Preview
  let dtfZoom = 1.0;
  let dtfPanX = 0;
  let dtfPanY = 0;
  let isPanningDtf = false;
  let panStartX = 0;
  let panStartY = 0;

  // Cargar información de hardware dinámica al iniciar con reintentos hasta que server.py esté listo
  async function loadSystemHardwareInfo(retries = 15, delay = 600) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(`${API_BASE}/api/system_info`);
        if (res.ok) {
          const info = await res.json();
          const hudGpu = document.getElementById("hud-gpu-val");
          const hudCpu = document.getElementById("hud-cpu-val");
          if (hudGpu) hudGpu.textContent = info.gpu || "GPU DETECTADA";
          if (hudCpu) hudCpu.textContent = info.cpu ? info.cpu.split("CPU")[0].replace("Intel(R) Core(TM)", "").replace("AMD Ryzen", "").trim() : "--";
          
          // Calibrar slider de tile automáticamente según la VRAM real
          if (info.default_tile !== undefined && tileSlider) {
            tileSlider.value = info.default_tile;
            tileSizeVal.textContent = `${info.default_tile} px`;
          }
          return; // Conexión y carga exitosa
        }
      } catch (e) {
        // Backend aún inicializando, reintentar tras espera
      }
      await new Promise(r => setTimeout(r, delay));
    }
  }
  loadSystemHardwareInfo();

  // Tab switching
  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      navTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;

      tabUpscale.style.display = currentTab === "upscale" ? "block" : "none";
      tabDtf.style.display = currentTab === "dtf" ? "block" : "none";

      updateProcessButtonsState();
    });
  });

  function updateProcessButtonsState() {
    const hasFile = selectedFile !== null;
    btnProcessUpscale.disabled = !hasFile;
    if (btnProcessDtf) btnProcessDtf.disabled = !hasFile;
  }

  // Upscale Params
  scaleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      scaleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedScale = parseInt(btn.dataset.scale);
      labelScale.textContent = selectedScale;
    });
  });

  modelCards.forEach(card => {
    card.addEventListener("click", () => {
      modelCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      const radio = card.querySelector("input[type='radio']");
      radio.checked = true;
      selectedModel = radio.value;
    });
  });

  tileSlider.addEventListener("input", (e) => {
    tileSizeVal.textContent = `${e.target.value} px`;
  });

  // DTF Params
  dtfBgBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      dtfBgBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dtfBgMethod = btn.dataset.bg;
      dtfColorKeyOptions.style.display = dtfBgMethod === "color" ? "block" : "none";
    });
  });

  dtfColorKey.addEventListener("input", (e) => {
    dtfColorKeyHex.textContent = e.target.value.toUpperCase();
  });

  dtfColorTolSlider.addEventListener("input", (e) => {
    dtfColorTolVal.textContent = e.target.value;
  });

  dtfColorFeatherSlider.addEventListener("input", (e) => {
    dtfColorFeatherVal.textContent = `${e.target.value} px`;
  });

  // Selector Cuentagotas Nativo (EyeDropper API de Chrome / WebView2)
  let isEyedropperSampling = false;
  if (btnPickEyedropper) {
    btnPickEyedropper.addEventListener("click", async () => {
      if (window.EyeDropper) {
        try {
          const eyeDropper = new window.EyeDropper();
          const result = await eyeDropper.open();
          if (result && result.sRGBHex) {
            dtfColorKey.value = result.sRGBHex;
            dtfColorKeyHex.textContent = result.sRGBHex.toUpperCase();
          }
        } catch (e) {
          console.warn("EyeDropper cancelado:", e);
        }
      } else {
        // Fallback: activar muestreo por clic en la imagen cargada
        isEyedropperSampling = !isEyedropperSampling;
        btnPickEyedropper.classList.toggle("active", isEyedropperSampling);
        btnPickEyedropper.textContent = isEyedropperSampling ? "Haz clic en la imagen..." : "Pipeta (Pantalla)";
      }
    });
  }

  dtfChokeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      dtfChokeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dtfChokePx = parseInt(btn.dataset.choke);
    });
  });

  dtfHalftoneBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      dtfHalftoneBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dtfApplyHalftone = btn.dataset.halftone === "true";
      dtfHalftoneOptions.style.display = dtfApplyHalftone ? "block" : "none";
    });
  });

  dtfModeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      dtfModeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dtfMode = btn.dataset.mode;
      dtfColorPickerGroup.style.display = dtfMode === "mono" ? "block" : "none";
      dtfPaletteGroup.style.display = dtfMode === "palette" ? "block" : "none";
    });
  });

  // Gestión de Paleta de Colores
  function renderPaletteChips() {
    paletteChipsContainer.innerHTML = "";
    dtfPaletteColors.forEach((colorHex, idx) => {
      const chip = document.createElement("div");
      chip.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border-dim);
        border-radius: 12px; padding: 2px 8px; font-size: 11px;
      `;
      chip.innerHTML = `
        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${colorHex}; border: 1px solid rgba(255,255,255,0.4);"></span>
        <span>${colorHex.toUpperCase()}</span>
        <span style="cursor: pointer; margin-left: 4px; color: var(--text-dim); font-weight: bold;">&times;</span>
      `;
      chip.querySelector("span:last-child").addEventListener("click", () => {
        dtfPaletteColors.splice(idx, 1);
        renderPaletteChips();
      });
      paletteChipsContainer.appendChild(chip);
    });
  }
  renderPaletteChips();

  btnAddPaletteColor.addEventListener("click", () => {
    const val = dtfNewPaletteColor.value.toLowerCase();
    if (!dtfPaletteColors.includes(val)) {
      dtfPaletteColors.push(val);
      renderPaletteChips();
    }
  });

  // Zoom & Pan Interactivo sobre el Preview DTF
  function updateDtfTransform() {
    imgDtfProcessed.style.transform = `translate(${dtfPanX}px, ${dtfPanY}px) scale(${dtfZoom})`;
    dtfZoomLevel.textContent = `${Math.round(dtfZoom * 100)}%`;
  }

  dtfPreviewContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.4, Math.min(8.0, dtfZoom * zoomFactor));
    dtfZoom = newZoom;
    updateDtfTransform();
  });

  dtfPreviewContainer.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isPanningDtf = true;
    panStartX = e.clientX - dtfPanX;
    panStartY = e.clientY - dtfPanY;
    dtfPreviewContainer.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanningDtf) return;
    dtfPanX = e.clientX - panStartX;
    dtfPanY = e.clientY - panStartY;
    updateDtfTransform();
  });

  window.addEventListener("mouseup", () => {
    isPanningDtf = false;
    dtfPreviewContainer.style.cursor = "grab";
  });

  dtfPreviewContainer.addEventListener("dblclick", () => {
    dtfZoom = 1.0;
    dtfPanX = 0;
    dtfPanY = 0;
    updateDtfTransform();
  });

  dtfDotSlider.addEventListener("input", (e) => {
    dtfDotSize = parseInt(e.target.value);
    dtfDotSizeVal.textContent = `${dtfDotSize} px`;
  });

  dtfAngleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      dtfAngleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dtfAngle = parseFloat(btn.dataset.angle);
    });
  });

  // File Selection & Drag & Drop
  const dropzoneContent = document.getElementById("dropzone-content");

  // Prevenir que el navegador intente navegar/abrir el archivo si se suelta fuera
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  // Escuchar evento nativo de drop emitido directamente desde Rust / Windows
  if (window.__TAURI__ && window.__TAURI__.event) {
    window.__TAURI__.event.listen("file-dropped", async (event) => {
      const filePath = event.payload;
      if (filePath) {
        await loadFileFromPath(filePath);
      }
    });
  }

  async function openNativeFileDialog() {
    if (window.__TAURI__ && window.__TAURI__.dialog) {
      try {
        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp", "jfif"] }]
        });
        if (selected) {
          await loadFileFromPath(selected);
          return;
        }
      } catch (err) {
        console.warn("Fallo dialogo nativo Tauri, recurriendo a input HTML:", err);
      }
    }
    fileInput.value = "";
    fileInput.click();
  }

  async function loadFileFromPath(filePath) {
    try {
      const fileName = filePath.split(/[/\\]/).pop();
      const ext = fileName.split(".").pop().toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg" || ext === "jfif" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
      
      let uint8Array;
      if (window.__TAURI__ && window.__TAURI__.core) {
        uint8Array = await window.__TAURI__.core.invoke("read_binary_file", { path: filePath });
      } else if (window.__TAURI__ && window.__TAURI__.fs) {
        uint8Array = await window.__TAURI__.fs.readFile(filePath);
      }

      if (uint8Array) {
        const blob = new Blob([new Uint8Array(uint8Array)], { type: mime });
        const file = new File([blob], fileName, { type: mime });
        handleFileSelected(file);
      }
    } catch (e) {
      console.error("Error al leer archivo local:", e);
    }
  }

  dropzone.addEventListener("click", (e) => {
    if (e.target === fileInput) return;
    openNativeFileDialog();
  });

  fileInput.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("drag-over");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const isImage = (file.type && file.type.startsWith("image/")) || ["png", "jpg", "jpeg", "webp", "jfif"].includes(ext);
    if (!file || !isImage) {
      alert("Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP, JFIF).");
      return;
    }
    selectedFile = file;
    updateProcessButtonsState();

    const reader = new FileReader();
    reader.onload = (e) => {
      dropzoneContent.innerHTML = `
        <img id="preview-sample-img" src="${e.target.result}" style="max-height: 220px; border: 1px solid var(--border-neon); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,120,212,0.3); margin-bottom: 12px; object-fit: contain; cursor: crosshair;">
        <h3>${file.name}</h3>
        <p>${(file.size / (1024 * 1024)).toFixed(2)} MB • Archivo listo para procesar</p>
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-cyan);">Haz clic sobre la imagen para tomar un color de muestra con la pipeta</span>
      `;

      // Habilitar toma de color por clic directo sobre la imagen
      const sampleImg = document.getElementById("preview-sample-img");
      if (sampleImg) {
        sampleImg.addEventListener("click", (evt) => {
          evt.stopPropagation();
          const canvas = document.createElement("canvas");
          canvas.width = sampleImg.naturalWidth;
          canvas.height = sampleImg.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(sampleImg, 0, 0);

          const rect = sampleImg.getBoundingClientRect();
          const scaleX = sampleImg.naturalWidth / rect.width;
          const scaleY = sampleImg.naturalHeight / rect.height;
          const clickX = Math.floor((evt.clientX - rect.left) * scaleX);
          const clickY = Math.floor((evt.clientY - rect.top) * scaleY);

          const pixel = ctx.getImageData(clickX, clickY, 1, 1).data;
          const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1).toUpperCase();
          
          dtfColorKey.value = hex;
          dtfColorKeyHex.textContent = hex;

          // Seleccionar automáticamente el modo de extracción por color
          dtfBgBtns.forEach(b => b.classList.remove("active"));
          const colorBtn = Array.from(dtfBgBtns).find(b => b.dataset.bg === "color");
          if (colorBtn) colorBtn.classList.add("active");
          dtfBgMethod = "color";
          dtfColorKeyOptions.style.display = "block";
        });
      }
    };
    reader.readAsDataURL(file);
  }

  // --- EXECUTE 1: UPSCALE ---
  btnProcessUpscale.addEventListener("click", async () => {
    if (!selectedFile) return;

    hideAllResults();
    processingTitle.textContent = "ESCALANDO CON INTELIGENCIA ARTIFICIAL...";
    processingSubtitle.textContent = `Procesando tiles en GPU NVIDIA Quadro K620 (${selectedScale}x)`;
    processingView.style.display = "flex";

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("scale", selectedScale);
    formData.append("model", selectedModel);
    formData.append("tile_size", tileSlider.value);

    try {
      const res = await fetch(`${API_BASE}/api/upscale`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Fallo en escalado.");

      processingView.style.display = "none";
      resultUpscale.style.display = "flex";

      processMetrics.style.display = "flex";
      metricTime.textContent = `${data.elapsed_seconds}s`;
      metricOrigDim.textContent = data.original_dimensions;
      metricNewDim.textContent = data.new_dimensions;

      imgOriginal.src = `${API_BASE}${data.original_url}`;
      imgUpscaled.src = `${API_BASE}${data.upscaled_url}`;
      btnDownloadUpscaled.dataset.url = `${API_BASE}${data.upscaled_url}`;
      btnDownloadUpscaled.dataset.filename = data.filename;

      imgUpscaled.onload = () => {
        syncComparisonImages();
        setSliderPosition(50);
      };
      imgOriginal.onload = () => {
        syncComparisonImages();
      };

    } catch (err) {
      alert("Error: " + err.message);
      processingView.style.display = "none";
      dropzone.style.display = "flex";
    }
  });

  // --- EXECUTE 2: DTF TEXTIL HALFTONE ---
  btnProcessDtf.addEventListener("click", async () => {
    if (!selectedFile) return;

    hideAllResults();
    processingTitle.textContent = "PROCESANDO DTF TEXTIL...";
    processingSubtitle.textContent = dtfBgMethod === "ai" 
      ? "Extrayendo fondo con IA y generando semitonos..." 
      : dtfBgMethod === "color" 
        ? "Eliminando color seleccionado y generando semitonos..." 
        : "Generando semitonos y limpiando bordes...";
    processingView.style.display = "flex";

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("bg_method", dtfBgMethod);
    formData.append("color_key", dtfColorKey.value);
    formData.append("color_tolerance", dtfColorTolSlider.value);
    formData.append("color_feather", dtfColorFeatherSlider.value);
    formData.append("color_contiguous", dtfColorContiguous.checked);
    formData.append("apply_halftone", dtfApplyHalftone);
    formData.append("choke_px", dtfChokePx);
    formData.append("dot_size", dtfDotSize);
    formData.append("angle", dtfAngle);
    formData.append("mode", dtfMode);
    formData.append("tint_color", dtfTintColor.value);
    formData.append("palette_colors", dtfPaletteColors.join(","));

    try {
      const res = await fetch(`${API_BASE}/api/dtf_process`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Fallo en procesamiento DTF.");

      processingView.style.display = "none";
      resultDtf.style.display = "flex";

      processMetrics.style.display = "flex";
      metricTime.textContent = `${data.elapsed_seconds}s`;
      metricOrigDim.textContent = data.dimensions;
      metricNewDim.textContent = data.dimensions;

      // Resetear zoom y posición al cargar nueva imagen
      dtfZoom = 1.0;
      dtfPanX = 0;
      dtfPanY = 0;
      updateDtfTransform();

      imgDtfProcessed.src = `${API_BASE}${data.processed_url}`;
      btnDownloadDtf.dataset.url = `${API_BASE}${data.processed_url}`;
      btnDownloadDtf.dataset.filename = data.filename;

    } catch (err) {
      alert("Error: " + err.message);
      processingView.style.display = "none";
      dropzone.style.display = "flex";
    }
  });

  function hideAllResults() {
    dropzone.style.display = "none";
    resultUpscale.style.display = "none";
    resultDtf.style.display = "none";
  }

  function resetDropzoneUI() {
    selectedFile = null;
    fileInput.value = "";
    updateProcessButtonsState();
    hideAllResults();
    processMetrics.style.display = "none";
    dropzone.style.display = "flex";
    
    // Restaurar contenido interior sin perder listeners principales del dropzone
    dropzoneContent.innerHTML = `
      <div class="reticle">
        <div class="reticle-corner top-left"></div>
        <div class="reticle-corner top-right"></div>
        <div class="reticle-corner bottom-left"></div>
        <div class="reticle-corner bottom-right"></div>
        <svg class="upload-icon" viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>
      <h3 id="dropzone-title">HAZ CLIC O ARRASTRA TU IMAGEN AQUÍ</h3>
      <p id="dropzone-subtitle">Explorar archivos de imagen (PNG, JPG, WEBP, JFIF)</p>
      <div class="drop-specs">
        <span>ESCALADO IA</span> • <span>DTF TEXTIL // SEMITONOS</span>
      </div>
    `;
  }

  // Reset Actions (permite procesar infinitas imágenes consecutivas sin colgarse)
  resetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      resetDropzoneUI();
    });
  });

  // Direct blob download without page navigation
  async function triggerDownload(url, filename) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "imagen.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (e) {
      console.error("Fallo descarga blob, usando fallback:", e);
      window.location.href = `${url}?download=1`;
    }
  }

  btnDownloadUpscaled.addEventListener("click", (e) => {
    e.preventDefault();
    const url = btnDownloadUpscaled.dataset.url;
    const filename = btnDownloadUpscaled.dataset.filename || "escalada.png";
    if (url) triggerDownload(url, filename);
  });

  btnDownloadDtf.addEventListener("click", (e) => {
    e.preventDefault();
    const url = btnDownloadDtf.dataset.url;
    const filename = btnDownloadDtf.dataset.filename || "dtf_textil.png";
    if (url) triggerDownload(url, filename);
  });

  // Slider Logic for Upscale
  function setSliderPosition(percentage) {
    percentage = Math.max(0, Math.min(100, percentage));
    compSliderMask.style.width = `${percentage}%`;
    sliderHandle.style.left = `${percentage}%`;
  }

  function syncComparisonImages() {
    if (!imgUpscaled.complete || imgUpscaled.naturalWidth === 0) return;
    const boxRect = comparisonBox.getBoundingClientRect();
    const upRect = imgUpscaled.getBoundingClientRect();
    
    // Forzar que la imagen original coincida píxel a píxel en tamaño y coordenadas relativas al contenedor
    imgOriginal.style.width = `${upRect.width}px`;
    imgOriginal.style.height = `${upRect.height}px`;
    imgOriginal.style.top = `${upRect.top - boxRect.top}px`;
    imgOriginal.style.left = `${upRect.left - boxRect.left}px`;
  }

  window.addEventListener("resize", () => {
    if (resultUpscale.style.display !== "none") {
      syncComparisonImages();
    }
  });

  comparisonBox.addEventListener("mousedown", (e) => {
    isDraggingSlider = true;
    updateSlider(e);
  });

  window.addEventListener("mouseup", () => isDraggingSlider = false);
  window.addEventListener("mousemove", (e) => {
    if (!isDraggingSlider) return;
    updateSlider(e);
  });

  function updateSlider(e) {
    const rect = comparisonBox.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(percentage);
  }
});
