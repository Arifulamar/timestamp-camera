'use strict';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('photoCanvas');
const ctx = canvas.getContext('2d');
const startCameraBtn = $('startCamera');
const switchCameraBtn = $('switchCamera');
const capturePhotoBtn = $('capturePhoto');
const timestampOverlay = $('timestampOverlay');
const cameraPlaceholder = $('cameraPlaceholder');
const statusMessage = $('statusMessage');
const capturedImage = $('capturedImage');
const downloadPhoto = $('downloadPhoto');
const sharePhotoBtn = $('sharePhoto');
const retakePhoto = $('retakePhoto');
const resultCard = $('resultCard');
const dateFormat = $('dateFormat');
const timestampPosition = $('timestampPosition');
const showSeconds = $('showSeconds');
const showGps = $('showGps');
const showIdentity = $('showIdentity');
const imageQuality = $('imageQuality');
const saveGallery = $('saveGallery');
const organization = $('organization');
const activity = $('activity');
const officer = $('officer');
const note = $('note');
const locationName = $('locationName');
const getLocationBtn = $('getLocation');
const watchLocationBtn = $('watchLocation');
const openMap = $('openMap');
const gpsBadge = $('gpsBadge');
const latitudeEl = $('latitude');
const longitudeEl = $('longitude');
const accuracyEl = $('accuracy');
const gpsUpdatedEl = $('gpsUpdated');
const logoInput = $('logoInput');
const logoPreview = $('logoPreview');
const flash = $('flash');
const gallery = $('gallery');
const emptyGallery = $('emptyGallery');
const clearGalleryBtn = $('clearGallery');
const installAppBtn = $('installApp');

let stream = null;
let facingMode = 'environment';
let lastPhotoUrl = null;
let lastPhotoBlob = null;
let lastFilename = 'timestamp-photo.jpg';
let currentLocation = null;
let watchId = null;
let logoImage = null;
let deferredInstallPrompt = null;
let dbPromise = null;

const PREF_KEYS = [
  'dateFormat', 'timestampPosition', 'showSeconds', 'showGps', 'showIdentity',
  'imageQuality', 'saveGallery', 'organization', 'activity', 'officer', 'note', 'locationName'
];

function formatDate(date = new Date()) {
  if (dateFormat.value === 'id-long') {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);
  }
  if (dateFormat.value === 'iso') {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(date);
}

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit',
    second: showSeconds.checked ? '2-digit' : undefined,
    hour12: false
  }).format(date).replaceAll('.', ':');
}

function safeLine(label, value) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean ? `${label}${clean}` : '';
}

function buildOverlayLines(date = new Date()) {
  const lines = [`${formatDate(date)} · ${formatTime(date)}`];

  if (showIdentity.checked) {
    const identity = [organization.value.trim(), activity.value.trim()].filter(Boolean).join(' · ');
    if (identity) lines.push(identity);
    if (officer.value.trim()) lines.push(safeLine('Petugas: ', officer.value));
  }

  if (locationName.value.trim()) lines.push(`📍 ${locationName.value.trim()}`);

  if (showGps.checked && currentLocation) {
    lines.push(`GPS ${currentLocation.lat.toFixed(6)}, ${currentLocation.lon.toFixed(6)} · ±${Math.round(currentLocation.accuracy)} m`);
  }

  if (note.value.trim()) lines.push(note.value.trim());
  return lines;
}

function updateOverlayPosition() {
  const pos = timestampPosition.value;
  logoPreview.style.left = 'auto';
  logoPreview.style.right = pos === 'top-right' ? 'auto' : '16px';
  if (pos === 'top-right') logoPreview.style.left = '16px';
  timestampOverlay.style.left = 'auto';
  timestampOverlay.style.right = 'auto';
  timestampOverlay.style.top = 'auto';
  timestampOverlay.style.bottom = 'auto';
  const space = '16px';
  if (pos.includes('left')) timestampOverlay.style.left = space;
  if (pos.includes('right')) timestampOverlay.style.right = space;
  if (pos.includes('top')) timestampOverlay.style.top = space;
  if (pos.includes('bottom')) timestampOverlay.style.bottom = space;
}

function updateTimestamp() {
  timestampOverlay.textContent = buildOverlayLines(new Date()).join('\n');
}

function savePrefs() {
  const prefs = {};
  PREF_KEYS.forEach((key) => {
    const el = $(key);
    if (!el) return;
    prefs[key] = el.type === 'checkbox' ? el.checked : el.value;
  });
  localStorage.setItem('timestamp-camera-prefs-v2', JSON.stringify(prefs));
}

function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem('timestamp-camera-prefs-v2') || '{}');
    PREF_KEYS.forEach((key) => {
      const el = $(key);
      if (!el || !(key in prefs)) return;
      if (el.type === 'checkbox') el.checked = Boolean(prefs[key]);
      else el.value = prefs[key];
    });
  } catch (_) {}
}

async function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser ini tidak mendukung akses kamera');
    await stopCamera();

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 2560 },
        height: { ideal: 1440 }
      }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();

    cameraPlaceholder.classList.add('hidden');
    capturePhotoBtn.disabled = false;
    startCameraBtn.textContent = 'Restart Kamera';
    statusMessage.textContent = `Kamera ${facingMode === 'environment' ? 'belakang' : 'depan'} aktif. Foto diproses langsung di perangkat.`;
    statusMessage.className = 'status success';
  } catch (error) {
    capturePhotoBtn.disabled = true;
    cameraPlaceholder.classList.remove('hidden');
    statusMessage.textContent = `Kamera tidak dapat dibuka: ${cameraErrorMessage(error)}.`;
    statusMessage.className = 'status error';
  }
}

function cameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') return 'izin kamera ditolak. Aktifkan izin kamera pada browser';
  if (error?.name === 'NotFoundError') return 'kamera tidak ditemukan pada perangkat';
  if (error?.name === 'NotReadableError') return 'kamera sedang digunakan aplikasi lain';
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return 'akses kamera membutuhkan HTTPS atau localhost';
  return error?.message || 'terjadi kesalahan yang tidak diketahui';
}

async function switchCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  if (stream) await startCamera();
  else statusMessage.textContent = `Kamera dipilih: ${facingMode === 'environment' ? 'belakang' : 'depan'}. Tekan Aktifkan Kamera.`;
}

function requestLocation(single = true) {
  if (!navigator.geolocation) {
    gpsBadge.textContent = 'GPS tidak didukung';
    return;
  }

  const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 };
  gpsBadge.textContent = 'Mencari GPS…';

  if (single) {
    navigator.geolocation.getCurrentPosition(handlePosition, handleLocationError, options);
  } else {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      watchLocationBtn.textContent = 'Pantau GPS';
      gpsBadge.textContent = currentLocation ? 'GPS tersimpan' : 'GPS belum aktif';
      return;
    }
    watchId = navigator.geolocation.watchPosition(handlePosition, handleLocationError, options);
    watchLocationBtn.textContent = 'Stop Pantau';
  }
}

function handlePosition(position) {
  currentLocation = {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp
  };
  latitudeEl.textContent = currentLocation.lat.toFixed(6);
  longitudeEl.textContent = currentLocation.lon.toFixed(6);
  accuracyEl.textContent = `±${Math.round(currentLocation.accuracy)} m`;
  gpsUpdatedEl.textContent = new Date(position.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replaceAll('.', ':');
  gpsBadge.textContent = currentLocation.accuracy <= 30 ? 'GPS akurat' : 'GPS aktif';
  gpsBadge.classList.add('active');
  openMap.href = `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lon}`;
  openMap.classList.remove('disabled-link');
  updateTimestamp();
}

function handleLocationError(error) {
  const messages = {
    1: 'Izin lokasi ditolak',
    2: 'Lokasi tidak tersedia',
    3: 'Pencarian GPS timeout'
  };
  gpsBadge.textContent = messages[error.code] || 'GPS gagal';
  gpsBadge.classList.remove('active');
}

function getCanvasMetrics(lines, width) {
  const scale = Math.max(1, width / 1080);
  const fontSize = Math.round(Math.max(24, Math.min(42 * scale, width * 0.042)));
  const lineHeight = Math.round(fontSize * 1.34);
  const paddingX = Math.round(fontSize * 0.66);
  const paddingY = Math.round(fontSize * 0.52);
  const margin = Math.round(Math.max(20, width * 0.024));
  const maxTextWidth = Math.min(width * 0.72, width - margin * 2 - paddingX * 2);

  ctx.font = `750 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  const wrapped = [];
  lines.forEach((line) => wrapped.push(...wrapText(line, maxTextWidth)));
  const textWidth = Math.max(1, ...wrapped.map((line) => ctx.measureText(line).width));
  const boxWidth = Math.min(width - margin * 2, textWidth + paddingX * 2);
  const boxHeight = wrapped.length * lineHeight + paddingY * 1.75;
  return { fontSize, lineHeight, paddingX, paddingY, margin, lines: wrapped, boxWidth, boxHeight };
}

function wrapText(text, maxWidth) {
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let line = words.shift() || '';
  words.forEach((word) => {
    const test = `${line} ${word}`;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  });
  lines.push(line);
  return lines;
}

function drawRoundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawWatermark(lines) {
  const m = getCanvasMetrics(lines, canvas.width);
  let x = m.margin;
  let y = m.margin;
  if (timestampPosition.value.includes('right')) x = canvas.width - m.boxWidth - m.margin;
  if (timestampPosition.value.includes('bottom')) y = canvas.height - m.boxHeight - m.margin;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  drawRoundedRect(x, y, m.boxWidth, m.boxHeight, Math.round(m.fontSize * .35));
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.font = `750 ${m.fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,.8)';
  ctx.shadowBlur = Math.round(m.fontSize * .16);
  ctx.shadowOffsetY = 2;

  m.lines.forEach((line, index) => {
    ctx.fillText(line, x + m.paddingX, y + m.paddingY + index * m.lineHeight);
  });
  ctx.restore();
}

function drawLogo() {
  if (!logoImage) return;
  const size = Math.round(Math.min(canvas.width, canvas.height) * 0.12);
  const margin = Math.round(Math.max(20, canvas.width * 0.025));
  const ratio = Math.min(size / logoImage.naturalWidth, size / logoImage.naturalHeight);
  const w = Math.round(logoImage.naturalWidth * ratio);
  const h = Math.round(logoImage.naturalHeight * ratio);
  const logoOnLeft = timestampPosition.value === 'top-right';
  const x = logoOnLeft ? margin : canvas.width - w - margin;
  const y = margin;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.42)';
  drawRoundedRect(x - 10, y - 10, w + 20, h + 20, 14);
  ctx.fill();
  ctx.drawImage(logoImage, x, y, w, h);
  ctx.restore();
}

function triggerFlash() {
  flash.classList.remove('active');
  void flash.offsetWidth;
  flash.classList.add('active');
}

function buildFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const slug = (activity.value || organization.value || 'timestamp').trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32) || 'timestamp';
  return `${slug}-${y}${m}${d}-${hh}${mm}${ss}.jpg`;
}

function capturePhoto() {
  if (!stream || !video.videoWidth || !video.videoHeight) return;
  const capturedAt = new Date();
  triggerFlash();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  if (facingMode === 'user') {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  drawWatermark(buildOverlayLines(capturedAt));
  drawLogo();

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    if (lastPhotoUrl) URL.revokeObjectURL(lastPhotoUrl);
    lastPhotoBlob = blob;
    lastPhotoUrl = URL.createObjectURL(blob);
    lastFilename = buildFilename(capturedAt);

    capturedImage.src = lastPhotoUrl;
    downloadPhoto.href = lastPhotoUrl;
    downloadPhoto.download = lastFilename;
    resultCard.classList.remove('hidden');

    if (saveGallery.checked) {
      try {
        await addPhotoToGallery({ blob, filename: lastFilename, createdAt: capturedAt.getTime() });
        await renderGallery();
      } catch (_) {}
    }

    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 'image/jpeg', Number(imageQuality.value));
}

async function sharePhoto() {
  if (!lastPhotoBlob) return;
  const file = new File([lastPhotoBlob], lastFilename, { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Foto Timestamp', text: activity.value || organization.value || 'Foto dokumentasi' });
    } else if (navigator.share) {
      await navigator.share({ title: 'Foto Timestamp', text: 'Foto sudah tersimpan. Gunakan tombol Unduh Foto untuk membagikan file.' });
    } else {
      statusMessage.textContent = 'Fitur Bagikan tidak tersedia di browser ini. Gunakan tombol Unduh Foto.';
      statusMessage.className = 'status';
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      statusMessage.textContent = 'Foto belum dapat dibagikan. Silakan gunakan tombol Unduh Foto.';
    }
  }
}

function loadLogo(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      logoPreview.querySelector('img').src = reader.result;
      logoPreview.classList.remove('hidden');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('timestamp-camera-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function addPhotoToGallery(photo) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').add(photo);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  const photos = await getAllPhotos();
  if (photos.length > 12) {
    const excess = photos.sort((a, b) => a.createdAt - b.createdAt).slice(0, photos.length - 12);
    await Promise.all(excess.map((p) => deletePhoto(p.id)));
  }
}

async function getAllPhotos() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('photos', 'readonly').objectStore('photos').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deletePhoto(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('photos', 'readwrite').objectStore('photos').delete(id);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

async function clearGallery() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const req = db.transaction('photos', 'readwrite').objectStore('photos').clear();
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  await renderGallery();
}

async function renderGallery() {
  try {
    const photos = (await getAllPhotos()).sort((a, b) => b.createdAt - a.createdAt);
    gallery.innerHTML = '';
    emptyGallery.classList.toggle('hidden', photos.length > 0);

    photos.forEach((photo) => {
      const url = URL.createObjectURL(photo.blob);
      const item = document.createElement('article');
      item.className = 'gallery-item';
      item.innerHTML = `
        <img alt="Foto dokumentasi ${new Date(photo.createdAt).toLocaleString('id-ID')}" loading="lazy" />
        <div class="gallery-meta">
          <time>${new Date(photo.createdAt).toLocaleString('id-ID')}</time>
          <div class="gallery-actions">
            <a class="btn btn-secondary" download="${escapeHtml(photo.filename)}">Unduh</a>
            <button class="btn btn-secondary" type="button" aria-label="Hapus foto">×</button>
          </div>
        </div>`;
      item.querySelector('img').src = url;
      const link = item.querySelector('a');
      link.href = url;
      item.querySelector('button').addEventListener('click', async () => {
        URL.revokeObjectURL(url);
        await deletePhoto(photo.id);
        await renderGallery();
      });
      gallery.appendChild(item);
    });
  } catch (_) {
    emptyGallery.textContent = 'Galeri lokal tidak tersedia pada browser ini.';
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}

function bindPreferenceEvents() {
  PREF_KEYS.forEach((key) => {
    const el = $(key);
    if (!el) return;
    const event = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(event, () => {
      savePrefs();
      updateTimestamp();
      if (key === 'timestampPosition') updateOverlayPosition();
    });
  });
}

startCameraBtn.addEventListener('click', startCamera);
switchCameraBtn.addEventListener('click', switchCamera);
capturePhotoBtn.addEventListener('click', capturePhoto);
sharePhotoBtn.addEventListener('click', sharePhoto);
retakePhoto.addEventListener('click', () => {
  resultCard.classList.add('hidden');
  document.querySelector('.camera-card').scrollIntoView({ behavior: 'smooth' });
});
getLocationBtn.addEventListener('click', () => requestLocation(true));
watchLocationBtn.addEventListener('click', () => requestLocation(false));
logoInput.addEventListener('change', () => loadLogo(logoInput.files?.[0]));
clearGalleryBtn.addEventListener('click', clearGallery);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installAppBtn.classList.remove('hidden');
});
installAppBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installAppBtn.classList.add('hidden');
});
window.addEventListener('appinstalled', () => installAppBtn.classList.add('hidden'));

window.addEventListener('beforeunload', () => {
  stopCamera();
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  if (lastPhotoUrl) URL.revokeObjectURL(lastPhotoUrl);
});

loadPrefs();
bindPreferenceEvents();
updateOverlayPosition();
updateTimestamp();
setInterval(updateTimestamp, 500);
renderGallery();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
