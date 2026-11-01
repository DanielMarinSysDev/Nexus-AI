document.addEventListener("DOMContentLoaded", () => {
  // Navigation Tabs
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabUpscale = document.getElementById("tab-controls-upscale");
  const tabOutpaint = document.getElementById("tab-controls-outpaint");

  // Common UI Elements
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const processingView = document.getElementById("processing-view");
  const processingTitle = document.getElementById("processing-title-text");
  const processingSubtitle = document.getElementById("processing-subtitle-text");
  
  // Results Containers
  const resultUpscale = document.getElementById("result-view-upscale");
  const resultOutpaint = document.getElementById("result-view-outpaint");
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

  // Outpaint controls
  const btnProcessOutpaint = document.getElementById("btn-process-outpaint");
  const expandDirBtns = document.querySelectorAll("#expand-dir-selector .seg-btn");
  const expandRatioBtns = document.querySelectorAll("#expand-ratio-selector .seg-btn");
  const outpaintModeBtns = document.querySelectorAll("#outpaint-mode-selector .seg-btn");
  const imgExpanded = document.getElementById("img-expanded");
  const btnDownloadOutpaint = document.getElementById("btn-download-outpaint");

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
  let currentTab = "upscale";
  let selectedFile = null;
  let selectedScale = 4;
  let selectedModel = "realesrgan-x4plus";
  let selectedExpandDir = "horizontal";
  let selectedExpandRatio = 0.50;
  let selectedOutpaintMode = "local";
  let isDraggingSlider = false;

  // Tab switching
  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      navTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;

      tabUpscale.style.display = currentTab === "upscale" ? "block" : "none";
      tabOutpaint.style.display = currentTab === "outpaint" ? "block" : "none";

      updateProcessButtonsState();
    });
  });

  function updateProcessButtonsState() {
    const hasFile = selectedFile !== null;
    btnProcessUpscale.disabled = !hasFile;
    btnProcessOutpaint.disabled = !hasFile;
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

  // Vector Params
  vectorModeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      vectorModeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedVectorMode = btn.dataset.vmode;
    });
  });

  // Outpaint Params
  expandDirBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      expandDirBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedExpandDir = btn.dataset.dir;
    });
  });

  expandRatioBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      expandRatioBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedExpandRatio = parseFloat(btn.dataset.ratio);
    });
  });

  outpaintModeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      outpaintModeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedOutpaintMode = btn.dataset.opmode;
    });
  });

  // File Drag & Drop
  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("drag-over");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).");
      return;
    }
    selectedFile = file;
    updateProcessButtonsState();

    const reader = new FileReader();
    reader.onload = (e) => {
      dropzone.innerHTML = `
        <div class="dropzone-inner">
          <img src="${e.target.result}" style="max-height: 220px; border: 1px solid var(--border-neon); border-radius: 4px; box-shadow: 0 0 15px rgba(0,229,255,0.2); margin-bottom: 12px; object-fit: contain;">
          <h3>${file.name}</h3>
          <p>${(file.size / (1024 * 1024)).toFixed(2)} MB • Archivo cargado en memoria</p>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-cyan);">Selecciona tu herramienta y haz clic en Ejecutar</span>
        </div>
      `;
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
      const res = await fetch("/api/upscale", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Fallo en escalado.");

      processingView.style.display = "none";
      resultUpscale.style.display = "flex";

      processMetrics.style.display = "flex";
      metricTime.textContent = `${data.elapsed_seconds}s`;
      metricOrigDim.textContent = data.original_dimensions;
      metricNewDim.textContent = data.new_dimensions;

      imgOriginal.src = data.original_url;
      imgUpscaled.src = data.upscaled_url;
      btnDownloadUpscaled.href = data.upscaled_url;
      btnDownloadUpscaled.download = data.filename;

      imgUpscaled.onload = () => {
        syncComparisonImages();
        setSliderPosition(50);
      };

    } catch (err) {
      alert("Error: " + err.message);
      processingView.style.display = "none";
      dropzone.style.display = "flex";
    }
  });

  // --- EXECUTE 2: OUTPAINT ---
  btnProcessOutpaint.addEventListener("click", async () => {
    if (!selectedFile) return;

    hideAllResults();
    processingTitle.textContent = "EXPANDIENDO LÍMITES DEL LIENZO...";
    processingSubtitle.textContent = `Generando marco extendido (${selectedExpandDir})`;
    processingView.style.display = "flex";

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("direction", selectedExpandDir);
    formData.append("expand_ratio", selectedExpandRatio);
    formData.append("mode", selectedOutpaintMode);

    try {
      const res = await fetch("/api/outpaint", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Fallo en expansión.");

      processingView.style.display = "none";
      resultOutpaint.style.display = "flex";

      processMetrics.style.display = "flex";
      metricTime.textContent = `${data.elapsed_seconds}s`;
      metricOrigDim.textContent = data.original_dimensions;
      metricNewDim.textContent = data.new_dimensions;

      imgExpanded.src = data.expanded_url;
      btnDownloadOutpaint.href = data.expanded_url;
      btnDownloadOutpaint.download = data.filename;

    } catch (err) {
      alert("Error: " + err.message);
      processingView.style.display = "none";
      dropzone.style.display = "flex";
    }
  });

  function hideAllResults() {
    dropzone.style.display = "none";
    resultUpscale.style.display = "none";
    resultOutpaint.style.display = "none";
  }

  // Reset Actions
  resetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedFile = null;
      fileInput.value = "";
      updateProcessButtonsState();
      hideAllResults();
      processMetrics.style.display = "none";
      dropzone.style.display = "flex";
      dropzone.innerHTML = `
        <input type="file" id="file-input" accept="image/png, image/jpeg, image/webp" class="file-hidden">
        <div class="dropzone-inner">
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
          <h3 id="dropzone-title">ARRASTRA TU IMAGEN AQUÍ</h3>
          <p id="dropzone-subtitle">O haz clic para explorar tu equipo (PNG, JPG, WEBP)</p>
          <div class="drop-specs">
            <span>ESCALADO IA</span> • <span>EXPANSIÓN DE LIENZO</span>
          </div>
        </div>
      `;
      const newFileInput = document.getElementById("file-input");
      newFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFileSelected(e.target.files[0]);
        }
      });
    });
  });

  // Slider Logic for Upscale
  function setSliderPosition(percentage) {
    percentage = Math.max(0, Math.min(100, percentage));
    compSliderMask.style.width = `${percentage}%`;
    sliderHandle.style.left = `${percentage}%`;
  }

  function syncComparisonImages() {
    const boxRect = comparisonBox.getBoundingClientRect();
    const upRect = imgUpscaled.getBoundingClientRect();
    
    // Forzar que la imagen original coincida píxel a píxel en tamaño y coordenadas relativas al contenedor
    imgOriginal.style.width = `${upRect.width}px`;
    imgOriginal.style.height = `${upRect.height}px`;
    imgOriginal.style.top = `${upRect.top - boxRect.top + (upRect.height / 2)}px`;
    imgOriginal.style.left = `${upRect.left - boxRect.left + (upRect.width / 2)}px`;
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
