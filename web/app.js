// Camera configuration
const CAMERAS = [
  { id: 'room', name: 'Salón' },
  { id: 'door', name: 'Puerta' },
  { id: 'bedroom_out', name: 'Dormitorio - exterior' },
  { id: 'kitchen', name: 'Cocina' },
  { id: 'garage', name: 'Garaje' },
  { id: 'hall', name: 'Hall' },
  { id: 'dining_room', name: 'Comedor' }
  // bedroom removed - camera disconnected
];

const GO2RTC_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:1984'
  : 'https://open-cameras-go2rtc.onrender.com';
const PREFS_API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:9191/preferences'
  : 'https://open-cameras-preferences.onrender.com/preferences';

// State
let currentLayout = 4;
let slotAssignments = []; // Which camera is in each slot
let selectedSlot = null;
let enabledCameras = {}; // Which cameras are enabled
const streamModeMonitors = {}; // Track polling handles per slot

// DOM elements
const grid = document.getElementById('camera-grid');
const layoutSelect = document.getElementById('layout-select');
const cameraToggles = document.getElementById('camera-toggles');
const cameraSelector = document.getElementById('camera-selector');
const cameraList = document.getElementById('camera-list');
const closeSelector = document.getElementById('close-selector');
const backdrop = document.getElementById('backdrop');

// Initialize
async function init() {
  await loadPreferences();
  renderToggles();
  setupEventListeners();
  renderGrid();
  renderCameraList();
}

async function loadPreferences() {
  try {
    const response = await fetch(PREFS_API_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Respuesta inválida de preferencias');
    const prefs = await response.json();
    currentLayout = prefs.layout || 4;
    slotAssignments = prefs.assignments || [];
    enabledCameras = prefs.enabledCameras || {};
  } catch (error) {
    console.warn('No se pudieron cargar preferencias, usando valores por defecto', error);
    currentLayout = 4;
    slotAssignments = [];
    enabledCameras = {};
  }

  // Default: all cameras enabled
  CAMERAS.forEach(camera => {
    if (enabledCameras[camera.id] === undefined) {
      enabledCameras[camera.id] = true;
    }
  });

  // Default assignments if none saved
  if (slotAssignments.length === 0) {
    slotAssignments = CAMERAS.slice(0, 8).map(c => c.id);
  }

  layoutSelect.value = currentLayout;
}

function savePreferences() {
  const payload = {
    layout: currentLayout,
    assignments: slotAssignments,
    enabledCameras
  };

  fetch(PREFS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => {
    console.error('No se pudieron guardar las preferencias', err);
  });
}

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
    updateLayout();
    savePreferences();
  });

  closeSelector.addEventListener('click', closeCameraSelector);
  backdrop.addEventListener('click', closeCameraSelector);
}

function renderGrid() {
  clearAllStreamModeMonitors();
  grid.innerHTML = '';

  // Get only enabled cameras
  const activeCameras = CAMERAS.filter(c => enabledCameras[c.id]);
  const activeLayout = Math.min(currentLayout, activeCameras.length);

  grid.className = `grid layout-${activeLayout}`;

  for (let i = 0; i < activeLayout; i++) {
    const camera = activeCameras[i];

    const slot = createCameraSlot(i, camera);
    grid.appendChild(slot);

    if (camera) {
      connectCamera(i, camera.id);
    }
  }
}

function createCameraSlot(index, camera) {
  const slot = document.createElement('div');
  slot.className = 'camera-slot';
  slot.dataset.index = index;

  slot.innerHTML = `
    <iframe id="video-${index}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
    <div class="stream-mode-badge hidden">
      <span class="mode-text">...</span>
    </div>
    <div class="connection-warning hidden">
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">Modo WebRTC no disponible</span>
    </div>
    <div class="overlay">
      <span class="camera-name">${camera?.name || 'Sin cámara'}</span>
    </div>
    <button class="change-camera">Cambiar</button>
    <div class="loading">${camera ? '' : ''}</div>
  `;

  // Change camera button
  const changeBtn = slot.querySelector('.change-camera');
  changeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCameraSelector(index);
  });

  return slot;
}

function updateLayout() {
  renderGrid();
}

async function connectCamera(slotIndex, cameraId) {
  const iframe = document.getElementById(`video-${slotIndex}`);
  const slot = iframe.closest('.camera-slot');
  const loading = slot.querySelector('.loading');

  try {
    console.log(`[${cameraId}] Loading stream...`);

    // Use go2rtc's embedded player
    iframe.src = `${GO2RTC_URL}/stream.html?src=${cameraId}&mode=webrtc,mse,mp4,hls`;
    monitorStreamMode(slotIndex, cameraId);

    // Hide loading after iframe loads
    iframe.onload = () => {
      console.log(`[${cameraId}] Stream loaded`);
      setTimeout(() => {
        loading.style.display = 'none';
      }, 1000);
    };

    iframe.onerror = () => {
      console.error(`[${cameraId}] Failed to load`);
      showError(slot, 'Error de carga');
    };

  } catch (error) {
    console.error(`[${cameraId}] Error:`, error);
    showError(slot, error.message || 'Error de conexión');
  }
}

function showError(slot, message) {
  const loading = slot.querySelector('.loading, .error');
  if (loading) {
    loading.className = 'error';
    loading.textContent = '';
    loading.style.display = 'flex';
  }
}

function monitorStreamMode(slotIndex, cameraId) {
  clearStreamModeMonitor(slotIndex);
  setSlotWarning(slotIndex, false);

  const monitor = { timeout: null, interval: null };
  const runCheck = () => checkStreamMode(slotIndex, cameraId);

  monitor.timeout = setTimeout(() => {
    runCheck();
    monitor.interval = setInterval(runCheck, 15000);
  }, 2000);

  streamModeMonitors[slotIndex] = monitor;
}

async function checkStreamMode(slotIndex, cameraId) {
  const slot = document.querySelector(`.camera-slot[data-index="${slotIndex}"]`);
  if (!slot) return;

  try {
    const response = await fetch(`${GO2RTC_URL}/api/streams?src=${encodeURIComponent(cameraId)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Respuesta inválida de go2rtc');

    const streamInfo = await response.json();
    const consumersRaw = streamInfo?.consumers;
    const consumers = Array.isArray(consumersRaw)
      ? consumersRaw
      : consumersRaw
        ? Object.values(consumersRaw)
        : [];

    const hasConsumers = consumers.length > 0;
    const hasWebRTC = consumers.some(isWebRTCConsumer);
    const activeConsumer = consumers[0];
    const mode = activeConsumer ? formatConsumerMode(activeConsumer) : 'DESCONOCIDO';

    setSlotMode(slotIndex, mode);
    setSlotWarning(slotIndex, hasConsumers && !hasWebRTC, 'Sin WebRTC');
  } catch (error) {
    console.warn(`[${cameraId}] No se pudo comprobar el modo de reproducción`, error);
    setSlotMode(slotIndex, '?');
    setSlotWarning(slotIndex, true, 'Sin WebRTC');
  }
}

function isWebRTCConsumer(consumer) {
  const type = (consumer?.type || '').toLowerCase();
  const format = (consumer?.format_name || '').toLowerCase();
  const protocol = (consumer?.protocol || '').toLowerCase();
  return type.includes('webrtc') || format.includes('webrtc') || protocol.includes('webrtc');
}

function formatConsumerMode(consumer) {
  const label = consumer?.format_name || consumer?.protocol || consumer?.type || '';
  if (!label) return 'DESCONOCIDO';

  // Simplify format names for badge
  const upper = label.toUpperCase();
  if (upper.includes('WEBRTC')) return 'RTC';
  if (upper.includes('MSE')) return 'MSE';
  if (upper.includes('MP4')) return 'MP4';
  if (upper.includes('HLS')) return 'HLS';

  return upper.replace(/_/g, ' ').split('/')[0];
}

function setSlotMode(slotIndex, mode) {
  const slot = document.querySelector(`.camera-slot[data-index="${slotIndex}"]`);
  if (!slot) return;
  const badge = slot.querySelector('.stream-mode-badge');
  if (!badge) return;
  const modeText = badge.querySelector('.mode-text');
  if (modeText) {
    modeText.textContent = mode;
    badge.classList.remove('hidden');
  }
}

function setSlotWarning(slotIndex, visible, message = 'Modo WebRTC no disponible') {
  const slot = document.querySelector(`.camera-slot[data-index="${slotIndex}"]`);
  if (!slot) return;
  const warning = slot.querySelector('.connection-warning');
  if (!warning) return;
  warning.classList.toggle('hidden', !visible);
  if (visible) {
    const textEl = warning.querySelector('.warning-text');
    if (textEl) {
      textEl.textContent = message;
    }
  }
}

function clearStreamModeMonitor(slotIndex) {
  const monitor = streamModeMonitors[slotIndex];
  if (!monitor) return;
  if (monitor.timeout) clearTimeout(monitor.timeout);
  if (monitor.interval) clearInterval(monitor.interval);
  delete streamModeMonitors[slotIndex];
}

function clearAllStreamModeMonitors() {
  Object.keys(streamModeMonitors).forEach(clearStreamModeMonitor);
}

function renderCameraList() {
  cameraList.innerHTML = '';

  CAMERAS.forEach(camera => {
    const btn = document.createElement('button');
    btn.textContent = camera.name;
    btn.dataset.id = camera.id;

    btn.addEventListener('click', () => {
      selectCamera(camera.id);
    });

    cameraList.appendChild(btn);
  });
}

function openCameraSelector(slotIndex) {
  selectedSlot = slotIndex;
  cameraSelector.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  // Mark current camera as active
  const currentCameraId = slotAssignments[slotIndex];
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

  // Update assignment
  slotAssignments[selectedSlot] = cameraId;
  savePreferences();

  const slot = document.querySelector(`[data-index="${selectedSlot}"]`);
  const camera = CAMERAS.find(c => c.id === cameraId);

  // Update name
  slot.querySelector('.camera-name').textContent = camera.name;

  // Reset loading state
  const loading = slot.querySelector('.loading, .error');
  loading.className = 'loading';
  loading.textContent = '';
  loading.style.display = 'flex';

  // Connect new camera
  connectCamera(selectedSlot, cameraId);

  closeCameraSelector();
}

// Start app
init().catch(err => console.error('Fallo la inicialización', err));
