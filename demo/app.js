// ============================================================================
// Open Cameras Viewer — DEMO
// Reproduce streams HLS públicos (cámaras de tráfico de Caltrans / California
// DOT) directamente en el navegador con hls.js. No requiere go2rtc ni backend.
// La versión real del proyecto usa cámaras RTSP locales servidas por go2rtc.
// ============================================================================

// Cámaras de la demo: streams HLS públicos y en vivo de Caltrans.
// Se incluyen más de las necesarias por si algún nodo de Caltrans cae
// puntualmente; el usuario puede cambiar de cámara en cada slot.
const CAMERAS = [
  { id: 'la_419',    name: 'Los Ángeles · US-101',       url: 'https://wzmedia.dot.ca.gov/D7/CCTV-419.stream/playlist.m3u8' },
  { id: 'sd_i5',     name: 'San Diego · I-5 en Rte 94',  url: 'https://wzmedia.dot.ca.gov/D11/C020_SB_5_at_Rte_94.stream/playlist.m3u8' },
  { id: 'bay_i80',   name: 'Bay Area · I-80 Fremont St', url: 'https://wzmedia.dot.ca.gov/D4/W80_at_Fremont_St_Ofr.stream/playlist.m3u8' },
  { id: 'sb_us101',  name: 'Santa Bárbara · US-101',     url: 'https://wzmedia.dot.ca.gov/D5/101atCasitasPassRd.stream/playlist.m3u8' },
  { id: 'sac_us50',  name: 'Sacramento · US-50',         url: 'https://wzmedia.dot.ca.gov/D3/50_Ponderosa_Rd_ED50_WB_2.stream/playlist.m3u8' },
  { id: 'oc_sr55',   name: 'Orange County · SR-55',      url: 'https://wzmedia.dot.ca.gov/D12/SB55DELMAR.stream/playlist.m3u8' },
  { id: 'sd_sr67',   name: 'San Diego · SR-67 Poway',    url: 'https://wzmedia.dot.ca.gov/D11/C231_SB_67_at_Poway_Rd_Top.stream/playlist.m3u8' },
  { id: 'la_869',    name: 'Los Ángeles · CCTV-869',     url: 'https://wzmedia.dot.ca.gov/D7/CCTV-869.stream/playlist.m3u8' },
  { id: 'butte_sr99', name: 'Butte · SR-99 Skyway',      url: 'https://wzmedia.dot.ca.gov/D3/99_Skyway_JSO_BUT99_NB_1.stream/playlist.m3u8' },
  { id: 'sbd_i15',   name: 'San Bernardino · I-15',      url: 'https://wzmedia.dot.ca.gov/D8/LB-8_15_399.stream/playlist.m3u8' },
  { id: 'sbd_sr60',  name: 'San Bernardino · SR-60',     url: 'https://wzmedia.dot.ca.gov/D8/LB-8_60_149.stream/playlist.m3u8' }
];

const PREFS_KEY = 'open-cameras-viewer-demo';

// State
let currentLayout = 4;
let slotAssignments = [];   // Qué cámara hay en cada slot
let selectedSlot = null;
let enabledCameras = {};    // Qué cámaras están activadas
const hlsInstances = {};    // Instancias de hls.js por slot

// DOM
const grid = document.getElementById('camera-grid');
const layoutSelect = document.getElementById('layout-select');
const cameraToggles = document.getElementById('camera-toggles');
const cameraSelector = document.getElementById('camera-selector');
const cameraList = document.getElementById('camera-list');
const closeSelector = document.getElementById('close-selector');
const backdrop = document.getElementById('backdrop');

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  loadPreferences();
  if (Array.isArray(slotAssignments) && slotAssignments.length) {
    applyOrder(slotAssignments);
  }
  renderToggles();
  setupEventListeners();
  renderGrid();
  renderCameraList();
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const prefs = raw ? JSON.parse(raw) : {};
    currentLayout = prefs.layout || 4;
    slotAssignments = prefs.assignments || [];
    enabledCameras = prefs.enabledCameras || {};
  } catch (error) {
    console.warn('No se pudieron cargar preferencias, usando valores por defecto', error);
    currentLayout = 4;
    slotAssignments = [];
    enabledCameras = {};
  }

  // Por defecto: primeras 7 cámaras activadas, el resto disponibles pero off
  CAMERAS.forEach((camera, i) => {
    if (enabledCameras[camera.id] === undefined) {
      enabledCameras[camera.id] = i < 7;
    }
  });

  // Asignaciones por defecto si no hay guardadas
  if (slotAssignments.length === 0) {
    slotAssignments = CAMERAS.map(c => c.id);
  }

  layoutSelect.value = currentLayout;
}

function savePreferences() {
  const payload = { layout: currentLayout, assignments: slotAssignments, enabledCameras };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('No se pudieron guardar las preferencias', err);
  }
}

// ---------------------------------------------------------------------------
// Toggles de cámaras
// ---------------------------------------------------------------------------
function renderToggles() {
  cameraToggles.innerHTML = '';

  CAMERAS.forEach(camera => {
    const toggle = document.createElement('label');
    toggle.className = 'camera-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabledCameras[camera.id];
    checkbox.dataset.cameraId = camera.id;

    checkbox.addEventListener('change', (e) => {
      enabledCameras[camera.id] = e.target.checked;
      savePreferences();
      renderGrid();
    });

    const switchEl = document.createElement('span');
    switchEl.className = 'toggle-switch';

    const label = document.createElement('span');
    label.textContent = camera.name;

    toggle.appendChild(checkbox);
    toggle.appendChild(switchEl);
    toggle.appendChild(label);
    cameraToggles.appendChild(toggle);
  });
}

function setupEventListeners() {
  layoutSelect.addEventListener('change', (e) => {
    currentLayout = parseInt(e.target.value);
    renderGrid();
    savePreferences();
  });

  closeSelector.addEventListener('click', closeCameraSelector);
  backdrop.addEventListener('click', closeCameraSelector);
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------
function renderGrid() {
  destroyAllPlayers();
  grid.innerHTML = '';

  const activeCameras = CAMERAS.filter(c => enabledCameras[c.id]);
  const activeLayout = Math.max(1, Math.min(currentLayout, activeCameras.length));

  grid.className = `grid layout-${activeLayout}`;

  for (let i = 0; i < activeLayout; i++) {
    const camera = activeCameras[i];
    const slot = createCameraSlot(i, camera);
    grid.appendChild(slot);
    if (camera) connectCamera(i, camera.id);
  }
}

function createCameraSlot(index, camera) {
  const slot = document.createElement('div');
  slot.className = 'camera-slot';
  slot.dataset.index = index;

  slot.innerHTML = `
    <video id="video-${index}" muted autoplay playsinline></video>
    <div class="stream-mode-badge hidden"><span class="mode-text">EN VIVO</span></div>
    <div class="connection-warning hidden">
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">Sin señal</span>
    </div>
    <div class="overlay">
      <span class="camera-name">${camera?.name || 'Sin cámara'}</span>
    </div>
    <button class="change-camera">Cambiar</button>
    <div class="loading"></div>
  `;

  const changeBtn = slot.querySelector('.change-camera');
  changeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCameraSelector(index);
  });

  return slot;
}

// ---------------------------------------------------------------------------
// Reproducción HLS
// ---------------------------------------------------------------------------
function connectCamera(slotIndex, cameraId) {
  const camera = CAMERAS.find(c => c.id === cameraId);
  const video = document.getElementById(`video-${slotIndex}`);
  if (!camera || !video) return;

  const slot = video.closest('.camera-slot');
  destroyPlayer(slotIndex);
  setSlotState(slotIndex, 'loading');

  const onPlaying = () => setSlotState(slotIndex, 'live');
  video.addEventListener('playing', onPlaying, { once: true });

  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      lowLatencyMode: true,
      liveSyncDurationCount: 3,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 6
    });
    hlsInstances[slotIndex] = hls;

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (!data.fatal) return;
      console.warn(`[${cameraId}] Error HLS fatal:`, data.type, data.details);
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          destroyPlayer(slotIndex);
          setSlotState(slotIndex, 'error', 'Stream no disponible');
      }
    });

    hls.loadSource(camera.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {/* autoplay puede requerir gesto; está muteado */});
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / iOS: HLS nativo
    video.src = camera.url;
    video.addEventListener('loadedmetadata', () => {
      video.play().catch(() => {});
    });
    video.addEventListener('error', () => {
      setSlotState(slotIndex, 'error', 'Stream no disponible');
    }, { once: true });
  } else {
    setSlotState(slotIndex, 'error', 'HLS no soportado en este navegador');
  }
}

function destroyPlayer(slotIndex) {
  const hls = hlsInstances[slotIndex];
  if (hls) {
    try { hls.destroy(); } catch (_) {}
    delete hlsInstances[slotIndex];
  }
}

function destroyAllPlayers() {
  Object.keys(hlsInstances).forEach(destroyPlayer);
}

// state: 'loading' | 'live' | 'error'
function setSlotState(slotIndex, state, message) {
  const slot = document.querySelector(`.camera-slot[data-index="${slotIndex}"]`);
  if (!slot) return;
  const loading = slot.querySelector('.loading');
  const badge = slot.querySelector('.stream-mode-badge');
  const warning = slot.querySelector('.connection-warning');

  loading.classList.toggle('hidden', state !== 'loading');
  badge.classList.toggle('hidden', state !== 'live');
  warning.classList.toggle('hidden', state !== 'error');

  const existingError = slot.querySelector('.error');
  if (existingError) existingError.remove();

  if (state === 'error') {
    if (message) warning.querySelector('.warning-text').textContent = message;
    const err = document.createElement('div');
    err.className = 'error';
    err.textContent = message || 'Stream no disponible';
    slot.appendChild(err);
  }
}

// ---------------------------------------------------------------------------
// Selector de cámaras
// ---------------------------------------------------------------------------
function renderCameraList() {
  cameraList.innerHTML = '';
  CAMERAS.forEach(camera => {
    const btn = document.createElement('button');
    btn.textContent = camera.name;
    btn.dataset.id = camera.id;
    btn.addEventListener('click', () => selectCamera(camera.id));
    cameraList.appendChild(btn);
  });
}

function openCameraSelector(slotIndex) {
  selectedSlot = slotIndex;
  cameraSelector.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  const activeCameras = CAMERAS.filter(c => enabledCameras[c.id]);
  const currentCameraId = activeCameras[slotIndex]?.id;
  cameraList.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === currentCameraId);
  });
}

function closeCameraSelector() {
  cameraSelector.classList.add('hidden');
  backdrop.classList.add('hidden');
  selectedSlot = null;
}

function selectCamera(cameraId) {
  if (selectedSlot === null) return;

  // Aseguramos que la cámara elegida esté activada
  if (!enabledCameras[cameraId]) {
    enabledCameras[cameraId] = true;
    renderToggles();
  }

  // Reordenamos para que la cámara elegida ocupe el slot seleccionado
  const activeCameras = CAMERAS.filter(c => enabledCameras[c.id]);
  const order = activeCameras.map(c => c.id);
  const from = order.indexOf(cameraId);
  if (from > -1 && from !== selectedSlot && selectedSlot < order.length) {
    order.splice(from, 1);
    order.splice(selectedSlot, 0, cameraId);
  }
  // Persistimos el orden completo (activas primero) para estabilidad
  slotAssignments = order.concat(CAMERAS.filter(c => !enabledCameras[c.id]).map(c => c.id));

  savePreferences();
  applyOrder(order);
  renderGrid();
  closeCameraSelector();
}

// Reordena CAMERAS según el orden dado (solo afecta a las activas)
function applyOrder(order) {
  CAMERAS.sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Start
init();
