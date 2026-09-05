const video = document.getElementById('video');
const canvas = document.getElementById('photoCanvas');
const ctx = canvas.getContext('2d');
const startCameraBtn = document.getElementById('startCamera');
const switchCameraBtn = document.getElementById('switchCamera');
const capturePhotoBtn = document.getElementById('capturePhoto');
const timestampOverlay = document.getElementById('timestampOverlay');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const statusMessage = document.getElementById('statusMessage');
const capturedImage = document.getElementById('capturedImage');
const downloadPhoto = document.getElementById('downloadPhoto');
const retakePhoto = document.getElementById('retakePhoto');
const resultCard = document.getElementById('resultCard');
const dateFormat = document.getElementById('dateFormat');
const timestampPosition = document.getElementById('timestampPosition');
const showSeconds = document.getElementById('showSeconds');

let stream = null;
let facingMode = 'environment';
let lastPhotoUrl = null;

function formatTimestamp(date = new Date()) {
  let dateText = '';

  if (dateFormat.value === 'id-long') {
    dateText = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } else if (dateFormat.value === 'iso') {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    dateText = `${y}-${m}-${d}`;
  } else {
    dateText = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  const timeText = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds.checked ? '2-digit' : undefined,
    hour12: false
  }).format(date).replaceAll('.', ':');

  return `${dateText}\n${timeText}`;
}

function updateOverlayPosition() {
  const pos = timestampPosition.value;
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
  timestampOverlay.textContent = formatTimestamp(new Date());
}

setInterval(updateTimestamp, 250);
updateTimestamp();
updateOverlayPosition();

async function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  video.srcObject = null;
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser ini tidak mendukung akses kamera.');
    }

    await stopCamera();

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();

    cameraPlaceholder.classList.add('hidden');
    capturePhotoBtn.disabled = false;
    startCameraBtn.textContent = 'Restart Kamera';
    statusMessage.textContent = `Kamera aktif (${facingMode === 'environment' ? 'belakang' : 'depan'}). Foto diproses langsung di perangkat.`;
    statusMessage.className = 'status success';
  } catch (error) {
    capturePhotoBtn.disabled = true;
    cameraPlaceholder.classList.remove('hidden');
    statusMessage.textContent = `Kamera tidak dapat dibuka: ${error.message}. Pastikan izin kamera aktif dan website dibuka melalui HTTPS.`;
    statusMessage.className = 'status error';
  }
}

async function switchCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
}

function getCanvasTimestampMetrics(timestamp, width, height) {
  const scale = Math.max(1, width / 1080);
  const fontSize = Math.round(Math.max(28, Math.min(52 * scale, width * 0.055)));
  const lineHeight = Math.round(fontSize * 1.35);
  const paddingX = Math.round(fontSize * 0.7);
  const paddingY = Math.round(fontSize * 0.55);
  const margin = Math.round(Math.max(22, width * 0.025));

  ctx.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  const lines = timestamp.split('\n');
  const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 1.5;

  return { fontSize, lineHeight, paddingX, paddingY, margin, lines, boxWidth, boxHeight, width, height };
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

function drawTimestampOnCanvas(timestamp) {
  const m = getCanvasTimestampMetrics(timestamp, canvas.width, canvas.height);
  let x = m.margin;
  let y = m.margin;

  if (timestampPosition.value.includes('right')) x = canvas.width - m.boxWidth - m.margin;
  if (timestampPosition.value.includes('bottom')) y = canvas.height - m.boxHeight - m.margin;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  drawRoundedRect(x, y, m.boxWidth, m.boxHeight, Math.round(m.fontSize * .35));
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${m.fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = Math.round(m.fontSize * .18);
  ctx.shadowOffsetY = 2;

  m.lines.forEach((line, index) => {
    ctx.fillText(line, x + m.paddingX, y + m.paddingY + index * m.lineHeight);
  });

  ctx.restore();
}

function capturePhoto() {
  if (!stream || !video.videoWidth || !video.videoHeight) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Mirror front camera capture to match preview expectation.
  if (facingMode === 'user') {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  const timestamp = formatTimestamp(new Date());
  drawTimestampOnCanvas(timestamp);

  canvas.toBlob(blob => {
    if (!blob) return;
    if (lastPhotoUrl) URL.revokeObjectURL(lastPhotoUrl);
    lastPhotoUrl = URL.createObjectURL(blob);
    capturedImage.src = lastPhotoUrl;
    downloadPhoto.href = lastPhotoUrl;

    const stamp = new Date();
    const filename = `timestamp-${stamp.getFullYear()}${String(stamp.getMonth()+1).padStart(2,'0')}${String(stamp.getDate()).padStart(2,'0')}-${String(stamp.getHours()).padStart(2,'0')}${String(stamp.getMinutes()).padStart(2,'0')}${String(stamp.getSeconds()).padStart(2,'0')}.jpg`;
    downloadPhoto.download = filename;

    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 'image/jpeg', 0.94);
}

startCameraBtn.addEventListener('click', startCamera);
switchCameraBtn.addEventListener('click', switchCamera);
capturePhotoBtn.addEventListener('click', capturePhoto);
retakePhoto.addEventListener('click', () => {
  resultCard.classList.add('hidden');
  document.querySelector('.camera-card').scrollIntoView({ behavior: 'smooth' });
});

dateFormat.addEventListener('change', updateTimestamp);
showSeconds.addEventListener('change', updateTimestamp);
timestampPosition.addEventListener('change', updateOverlayPosition);

window.addEventListener('beforeunload', stopCamera);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && stream) {
    // Kamera tetap dipertahankan agar cepat kembali ke halaman.
  }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
