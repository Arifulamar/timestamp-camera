'use strict';

const $ = (id) => document.getElementById(id);
const video = $('video');
const cameraStage = $('cameraStage');
const cameraPlaceholder = $('cameraPlaceholder');
const cameraState = $('cameraState');
const startCameraBtn = $('startCamera');
const capturePhotoBtn = $('capturePhoto');
const switchCameraBtn = $('switchCamera');
const heroCameraBtn = $('heroCamera');
const liveStamp = $('liveStamp');
const flash = $('flash');
const cameraTab = $('cameraTab');
const uploadTab = $('uploadTab');
const cameraMode = $('cameraMode');
const uploadMode = $('uploadMode');
const photoInput = $('photoInput');
const chooseFilesBtn = $('chooseFiles');
const addMorePhotosBtn = $('addMorePhotos');
const downloadSelectedBtn = $('downloadSelected');
const dropZone = $('dropZone');
const uploadPreviewWrap = $('uploadPreviewWrap');
const uploadCanvas = $('uploadCanvas');
const uploadCtx = uploadCanvas.getContext('2d');
const currentFileName = $('currentFileName');
const photoCounter = $('photoCounter');
const prevPhoto = $('prevPhoto');
const nextPhoto = $('nextPhoto');
const workCanvas = $('workCanvas');
const workCtx = workCanvas.getContext('2d');
const resultPanel = $('resultPanel');
const resultImage = $('resultImage');
const downloadCurrent = $('downloadCurrent');
const shareCurrent = $('shareCurrent');
const downloadAllBtn = $('downloadAll');
const batchCount = $('batchCount');
const capturedAt = $('capturedAt');
const clock24 = $('clock24');
const dateFormats = $('dateFormats');
const useLocationBtn = $('useLocation');
const address = $('address');
const latitude = $('latitude');
const longitude = $('longitude');
const gpsInfo = $('gpsInfo');
const showAddress = $('showAddress');
const showCoordinates = $('showCoordinates');
const jobNote = $('jobNote');
const showNote = $('showNote');
const accentBar = $('accentBar');
const stampSize = $('stampSize');
const watermark = $('watermark');
const positionGrid = $('positionGrid');
const saveDefaultsBtn = $('saveDefaults');
const resetDefaultsBtn = $('resetDefaults');
const installAppBtn = $('installApp');

let stream = null;
let facingMode = 'environment';
let mode = 'camera';
let dateFormat = 'dmy';
let stampColor = 'dark';
let stampPosition = 'bottom-left';
let uploads = [];
let currentUploadIndex = 0;
let lastResultBlob = null;
let lastResultUrl = null;
let lastResultName = 'timestamp-photo.jpg';
let deferredInstallPrompt = null;
let gpsAccuracy = null;
let manualTime = false;

const DEFAULTS_KEY = 'kameratimestamp-defaults-v1';
const PALETTES = {
  dark: { bg: 'rgba(0,0,0,.74)', text: '#ffffff', accent: '#d8ef72' },
  light: { bg: 'rgba(255,255,255,.88)', text: '#151515', accent: '#214f3b' },
  blue: { bg: 'rgba(22,73,101,.88)', text: '#ffffff', accent: '#a9ddff' },
  green: { bg: 'rgba(24,76,54,.9)', text: '#ffffff', accent: '#d8ef72' }
};

function pad(n) { return String(n).padStart(2, '0'); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
function getStampDate() {
  if (!manualTime) return new Date();
  const d = capturedAt.value ? new Date(capturedAt.value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
function formatDate(date) {
  if (dateFormat === 'mdy') return `${pad(date.getMonth()+1)}/${pad(date.getDate())}/${String(date.getFullYear()).slice(-2)}`;
  if (dateFormat === 'iso') return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  if (dateFormat === 'long') return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(date);
  return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${String(date.getFullYear()).slice(-2)}`;
}
function formatTime(date) {
  if (clock24.checked) return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).format(date);
}
function numericCoord(value) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function buildStampLines() {
  const d = getStampDate();
  const lines = [`${formatDate(d)} · ${formatTime(d)}`];
  if (watermark.value.trim()) lines.push(watermark.value.trim());
  const lat = numericCoord(latitude.value);
  const lon = numericCoord(longitude.value);
  if (showCoordinates.checked && lat !== null && lon !== null) lines.push(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  if (showAddress.checked && address.value.trim()) lines.push(address.value.trim());
  if (showNote.checked && jobNote.value.trim()) lines.push(jobNote.value.trim());
  return lines;
}

function setMode(nextMode) {
  mode = nextMode;
  const cameraActive = nextMode === 'camera';
  cameraTab.classList.toggle('active', cameraActive);
  uploadTab.classList.toggle('active', !cameraActive);
  cameraMode.classList.toggle('hidden', !cameraActive);
  uploadMode.classList.toggle('hidden', cameraActive);
  if (cameraActive) updateLiveStamp();
  else renderUploadPreview();
}

async function stopCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
}
async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser tidak mendukung akses kamera');
    await stopCamera();
    stream = await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{facingMode:{ideal:facingMode},width:{ideal:2560},height:{ideal:1440}}
    });
    video.srcObject = stream;
    await video.play();
    cameraPlaceholder.classList.add('hidden');
    cameraState.textContent = facingMode === 'environment' ? 'KAMERA BELAKANG · LIVE' : 'KAMERA DEPAN · LIVE';
    capturePhotoBtn.disabled = false;
    startCameraBtn.textContent = 'Restart kamera';
    updateLiveStamp();
  } catch (err) {
    capturePhotoBtn.disabled = true;
    cameraPlaceholder.classList.remove('hidden');
    cameraState.textContent = err?.name === 'NotAllowedError' ? 'IZIN KAMERA DITOLAK' : 'KAMERA TIDAK TERSEDIA';
  }
}
async function switchCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  if (stream) await startCamera();
}
function drawVideoCover(ctx, targetW, targetH) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const sourceRatio = vw / vh, targetRatio = targetW / targetH;
  let sx=0, sy=0, sw=vw, sh=vh;
  if (sourceRatio > targetRatio) { sw = vh * targetRatio; sx = (vw - sw) / 2; }
  else { sh = vw / targetRatio; sy = (vh - sh) / 2; }
  ctx.save();
  if (facingMode === 'user') { ctx.translate(targetW,0); ctx.scale(-1,1); }
  ctx.drawImage(video,sx,sy,sw,sh,0,0,targetW,targetH);
  ctx.restore();
}
function flashNow() {
  flash.classList.remove('active'); void flash.offsetWidth; flash.classList.add('active');
}
async function capturePhoto() {
  if (!stream || !video.videoWidth) return;
  const rect = cameraStage.getBoundingClientRect();
  const ratio = rect.width / rect.height;
  const longSide = clamp(Math.max(video.videoWidth, video.videoHeight), 1280, 2560);
  if (ratio >= 1) { workCanvas.width = longSide; workCanvas.height = Math.round(longSide / ratio); }
  else { workCanvas.height = longSide; workCanvas.width = Math.round(longSide * ratio); }
  workCtx.clearRect(0,0,workCanvas.width,workCanvas.height);
  drawVideoCover(workCtx,workCanvas.width,workCanvas.height);
  drawStamp(workCtx,workCanvas.width,workCanvas.height,buildStampLines());
  flashNow();
  const blob = await canvasToBlob(workCanvas, .94);
  if (blob) showResult(blob, makeFilename('kamera'));
}

function updateLiveStamp() {
  const palette = PALETTES[stampColor];
  liveStamp.textContent = buildStampLines().join('\n');
  liveStamp.style.background = palette.bg;
  liveStamp.style.color = palette.text;
  liveStamp.style.borderLeft = accentBar.checked ? `3px solid ${palette.accent}` : '0';
  liveStamp.style.left = liveStamp.style.right = liveStamp.style.top = liveStamp.style.bottom = 'auto';
  const inset = '14px';
  if (stampPosition.includes('left')) liveStamp.style.left = inset; else liveStamp.style.right = inset;
  if (stampPosition.includes('top')) liveStamp.style.top = inset; else liveStamp.style.bottom = inset;
  const scale = Number(stampSize.value) / 85;
  const px = clamp(cameraStage.clientWidth * .022 * scale, 7, 15);
  liveStamp.style.fontSize = `${px}px`;
  liveStamp.style.padding = `${Math.round(6*scale)}px ${Math.round(8*scale)}px`;
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).trim().split(/\s+/);
  if (!words[0]) return [''];
  const lines = [];
  let line = words.shift();
  for (const word of words) {
    const test = `${line} ${word}`;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  lines.push(line);
  return lines;
}
function roundedRect(ctx,x,y,w,h,r) {
  const rr = Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath();
}
function getStampMetrics(ctx,w,h,lines) {
  const scale = Number(stampSize.value) / 85;
  const shortSide = Math.min(w,h);
  const fontSize = Math.round(clamp(shortSide * .022 * scale, 14, 50));
  const lineHeight = Math.round(fontSize * 1.22);
  const padX = Math.round(fontSize * .55), padY = Math.round(fontSize * .42);
  const margin = Math.round(clamp(shortSide * .02, 14, 44));
  const maxTextWidth = Math.min(w * .68, w - margin*2 - padX*2);
  ctx.font = `800 ${fontSize}px system-ui,-apple-system,Segoe UI,sans-serif`;
  const wrapped = lines.flatMap(line => wrapText(ctx,line,maxTextWidth));
  const textWidth = Math.max(1,...wrapped.map(line => ctx.measureText(line).width));
  const boxW = Math.min(w-margin*2,textWidth+padX*2+(accentBar.checked?Math.round(fontSize*.18):0));
  const boxH = wrapped.length*lineHeight+padY*2;
  return {fontSize,lineHeight,padX,padY,margin,wrapped,boxW,boxH};
}
function drawStamp(ctx,w,h,lines) {
  if (!lines.length) return;
  const palette = PALETTES[stampColor];
  const m = getStampMetrics(ctx,w,h,lines);
  let x=m.margin,y=m.margin;
  if (stampPosition.includes('right')) x=w-m.boxW-m.margin;
  if (stampPosition.includes('bottom')) y=h-m.boxH-m.margin;
  ctx.save();
  ctx.fillStyle=palette.bg; roundedRect(ctx,x,y,m.boxW,m.boxH,Math.round(m.fontSize*.22)); ctx.fill();
  let textX=x+m.padX;
  if (accentBar.checked) {
    const barW=Math.max(3,Math.round(m.fontSize*.12));
    ctx.fillStyle=palette.accent; ctx.fillRect(x,y,barW,m.boxH); textX+=barW;
  }
  ctx.fillStyle=palette.text; ctx.font=`800 ${m.fontSize}px system-ui,-apple-system,Segoe UI,sans-serif`; ctx.textBaseline='top';
  m.wrapped.forEach((line,i)=>ctx.fillText(line,textX,y+m.padY+i*m.lineHeight));
  ctx.restore();
}

function loadImageFile(file) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file); const img=new Image();
    img.onload=()=>resolve({file,img,url}); img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error(`Gagal membuka ${file.name}`));}; img.src=url;
  });
}
async function addFiles(fileList) {
  const files=[...fileList].filter(file=>/^image\/(jpeg|png|webp)$/.test(file.type));
  if (!files.length) return;
  const loaded=[];
  for (const file of files) { try { loaded.push(await loadImageFile(file)); } catch(_){} }
  uploads.push(...loaded); currentUploadIndex=Math.max(0,uploads.length-loaded.length);
  updateBatchUI(); renderUploadPreview();
}
function updateBatchUI() {
  batchCount.textContent=`(${uploads.length})`; downloadAllBtn.disabled=!uploads.length;
  if (!uploads.length) { uploadPreviewWrap.classList.add('hidden'); dropZone.classList.remove('hidden'); }
  else { uploadPreviewWrap.classList.remove('hidden'); dropZone.classList.add('hidden'); }
}
function renderImageToCanvas(img,canvas,ctx,maxSide=1800) {
  const ratio=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio)); canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); drawStamp(ctx,canvas.width,canvas.height,buildStampLines());
}
function renderUploadPreview() {
  if (mode !== 'upload' || !uploads.length) return;
  currentUploadIndex=clamp(currentUploadIndex,0,uploads.length-1);
  const item=uploads[currentUploadIndex];
  currentFileName.textContent=item.file.name; photoCounter.textContent=`${currentUploadIndex+1} / ${uploads.length}`;
  renderImageToCanvas(item.img,uploadCanvas,uploadCtx,1600);
}
async function makeStampedBlob(item) {
  const maxSide=3200; const ratio=Math.min(1,maxSide/Math.max(item.img.naturalWidth,item.img.naturalHeight));
  workCanvas.width=Math.max(1,Math.round(item.img.naturalWidth*ratio)); workCanvas.height=Math.max(1,Math.round(item.img.naturalHeight*ratio));
  workCtx.clearRect(0,0,workCanvas.width,workCanvas.height); workCtx.drawImage(item.img,0,0,workCanvas.width,workCanvas.height); drawStamp(workCtx,workCanvas.width,workCanvas.height,buildStampLines());
  return canvasToBlob(workCanvas,.94);
}
function canvasToBlob(canvas,quality=.94) { return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality)); }
function makeFilename(prefix='timestamp', original='') {
  const d=getStampDate(); const base=original?original.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').slice(0,45):prefix;
  return `${base || prefix}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
}
function revokeLastResult() { if(lastResultUrl) URL.revokeObjectURL(lastResultUrl); lastResultUrl=null; }
function showResult(blob,name) {
  revokeLastResult(); lastResultBlob=blob; lastResultName=name; lastResultUrl=URL.createObjectURL(blob);
  resultImage.src=lastResultUrl; downloadCurrent.href=lastResultUrl; downloadCurrent.download=name; resultPanel.classList.remove('hidden');
  resultPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function downloadCurrentUpload() {
  if (!uploads.length) return;
  const item=uploads[currentUploadIndex]; const blob=await makeStampedBlob(item); if(blob) showResult(blob,makeFilename('timestamp',item.file.name));
}
async function downloadAll() {
  if (!uploads.length) return;
  downloadAllBtn.disabled=true; downloadAllBtn.firstChild.textContent='Memproses... ';
  for (let i=0;i<uploads.length;i++) {
    const item=uploads[i]; const blob=await makeStampedBlob(item); if(!blob) continue;
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=makeFilename('timestamp',item.file.name); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000); await new Promise(r=>setTimeout(r,350));
  }
  downloadAllBtn.firstChild.textContent='Download semua '; downloadAllBtn.disabled=false;
}
async function shareCurrentResult() {
  if (!lastResultBlob) return;
  const file=new File([lastResultBlob],lastResultName,{type:'image/jpeg'});
  try {
    if(navigator.canShare?.({files:[file]})) await navigator.share({files:[file],title:'Foto Timestamp'});
    else if(navigator.share) await navigator.share({title:'Foto Timestamp',text:'Foto timestamp siap digunakan.'});
  } catch(err){ if(err?.name!=='AbortError') console.warn(err); }
}

async function useLocation() {
  if (!navigator.geolocation) { gpsInfo.textContent='GPS tidak didukung browser ini.'; return; }
  gpsInfo.textContent='Mencari lokasi…'; useLocationBtn.disabled=true;
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat=pos.coords.latitude, lon=pos.coords.longitude; gpsAccuracy=pos.coords.accuracy;
    latitude.value=lat.toFixed(6); longitude.value=lon.toFixed(6); gpsInfo.textContent=`GPS aktif · akurasi ±${Math.round(gpsAccuracy)} m`;
    updateAllPreviews();
    try {
      const url=`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=id`;
      const res=await fetch(url); if(res.ok){ const data=await res.json(); const parts=[data.locality||data.city,data.principalSubdivision,data.countryName].filter(Boolean); if(parts.length) address.value=[...new Set(parts)].join(', '); updateAllPreviews(); }
    } catch(_){}
    useLocationBtn.disabled=false;
  },err=>{ gpsInfo.textContent=err.code===1?'Izin lokasi ditolak.':'Lokasi tidak tersedia.'; useLocationBtn.disabled=false; },{enableHighAccuracy:true,timeout:15000,maximumAge:5000});
}

function collectDefaults() {
  return {dateFormat,clock24:clock24.checked,showAddress:showAddress.checked,showCoordinates:showCoordinates.checked,showNote:showNote.checked,accentBar:accentBar.checked,stampSize:stampSize.value,watermark:watermark.value,stampColor,stampPosition};
}
function applyDefaults(data={}) {
  dateFormat=data.dateFormat||'dmy'; clock24.checked=data.clock24!==false; showAddress.checked=data.showAddress!==false; showCoordinates.checked=data.showCoordinates!==false; showNote.checked=data.showNote!==false; accentBar.checked=data.accentBar!==false; stampSize.value=data.stampSize||85; watermark.value=data.watermark||''; stampColor=data.stampColor||'dark'; stampPosition=data.stampPosition||'bottom-left';
  syncControlStates(); updateAllPreviews();
}
function saveDefaults() { localStorage.setItem(DEFAULTS_KEY,JSON.stringify(collectDefaults())); saveDefaultsBtn.textContent='Tersimpan ✓'; setTimeout(()=>saveDefaultsBtn.textContent='Simpan default',1200); }
function resetDefaults() { localStorage.removeItem(DEFAULTS_KEY); applyDefaults({}); }
function loadDefaults() { try { applyDefaults(JSON.parse(localStorage.getItem(DEFAULTS_KEY)||'{}')); } catch(_) { applyDefaults({}); } }
function syncControlStates() {
  dateFormats.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.format===dateFormat));
  positionGrid.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.position===stampPosition));
  document.querySelectorAll('.color-dot').forEach(b=>b.classList.toggle('active',b.dataset.color===stampColor));
}
function updateAllPreviews() { updateLiveStamp(); renderUploadPreview(); }

cameraTab.addEventListener('click',()=>setMode('camera'));
uploadTab.addEventListener('click',()=>setMode('upload'));
heroCameraBtn.addEventListener('click',async()=>{setMode('camera'); $('tool').scrollIntoView({behavior:'smooth'}); await startCamera();});
startCameraBtn.addEventListener('click',startCamera); switchCameraBtn.addEventListener('click',switchCamera); capturePhotoBtn.addEventListener('click',capturePhoto);
chooseFilesBtn.addEventListener('click',()=>photoInput.click()); addMorePhotosBtn.addEventListener('click',()=>photoInput.click()); photoInput.addEventListener('change',async()=>{await addFiles(photoInput.files); photoInput.value='';});
dropZone.addEventListener('click',e=>{if(e.target===dropZone||e.target.closest('.drop-icon,h3,p')) photoInput.click();});
dropZone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();photoInput.click();}});
['dragenter','dragover'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add('dragging');}));
['dragleave','drop'].forEach(ev=>dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.remove('dragging');}));
dropZone.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
prevPhoto.addEventListener('click',()=>{if(uploads.length){currentUploadIndex=(currentUploadIndex-1+uploads.length)%uploads.length;renderUploadPreview();}});
nextPhoto.addEventListener('click',()=>{if(uploads.length){currentUploadIndex=(currentUploadIndex+1)%uploads.length;renderUploadPreview();}});
uploadCanvas.addEventListener('click',downloadCurrentUpload); downloadSelectedBtn.addEventListener('click',downloadCurrentUpload);
downloadAllBtn.addEventListener('click',downloadAll); shareCurrent.addEventListener('click',shareCurrentResult); useLocationBtn.addEventListener('click',useLocation);
dateFormats.addEventListener('click',e=>{const b=e.target.closest('button[data-format]');if(!b)return;dateFormat=b.dataset.format;syncControlStates();updateAllPreviews();});
positionGrid.addEventListener('click',e=>{const b=e.target.closest('button[data-position]');if(!b)return;stampPosition=b.dataset.position;syncControlStates();updateAllPreviews();});
document.querySelectorAll('.color-dot').forEach(b=>b.addEventListener('click',()=>{stampColor=b.dataset.color;syncControlStates();updateAllPreviews();}));
capturedAt.addEventListener('input',()=>{manualTime=true;updateAllPreviews();});
[clock24,address,latitude,longitude,showAddress,showCoordinates,jobNote,showNote,accentBar,stampSize,watermark].forEach(el=>el.addEventListener(el.type==='range'?'input':'change',updateAllPreviews));
[address,latitude,longitude,jobNote,watermark].forEach(el=>el.addEventListener('input',updateAllPreviews));
saveDefaultsBtn.addEventListener('click',saveDefaults); resetDefaultsBtn.addEventListener('click',resetDefaults);
window.addEventListener('resize',updateLiveStamp);
window.addEventListener('beforeunload',()=>{stopCamera(); uploads.forEach(x=>URL.revokeObjectURL(x.url)); revokeLastResult();});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;installAppBtn.classList.remove('hidden');});
installAppBtn.addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;installAppBtn.classList.add('hidden');});

capturedAt.value=localDateTimeValue();
setInterval(()=>{if(!manualTime && !document.activeElement?.matches('#capturedAt')) capturedAt.value=localDateTimeValue(); updateLiveStamp();},1000);
loadDefaults(); setMode('camera'); updateBatchUI();
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
