// ============================================= 
// daftarkan service worker (syarat wajib biar app bisa
// di-"Install" jadi PWA di HP, dan bisa jalan offline)
// ============================================= 
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("service-worker.js")
      .catch(err=>console.log("Gagal daftar service worker:", err));
  });
}

// Splash screen: tampil beberapa detik lalu hilang otomatis
window.addEventListener("load", ()=>{
  const splash=document.getElementById("splash");

  // animasi titik berulang di teks "Memuat..."
  const dotsEl = document.getElementById("loadingDots");
  let dotCount = 0;
  const dotsInterval = setInterval(()=>{
    dotCount = (dotCount+1) % 4; // 0,1,2,3 lalu ulang
    dotsEl.textContent = ".".repeat(dotCount);
  }, 400);

  setTimeout(()=>{
    clearInterval(dotsInterval);
    splash.classList.add("hide");
    setTimeout(()=>splash.remove(), 600); // hapus dari DOM setelah animasi fade selesai
  }, 3500); // splash tampil 3.5 detik, ubah angka ini kalau mau lebih lama/cepat
});

// Coba kunci layar ke landscape (hanya jalan di beberapa browser & butuh fullscreen/PWA)
function lockLandscape(){
  if(screen.orientation && screen.orientation.lock){
    screen.orientation.lock("landscape").catch(err=>{
      console.log("Gagal lock orientasi:", err.message);
    });
  }
}

// Coba saat halaman dimuat
window.addEventListener("load", lockLandscape);

// Coba lagi setiap kali user menyentuh layar (browser sering butuh interaksi user dulu)
document.addEventListener("click", lockLandscape, { once:true });

// =============================================
// Jaga tampilan drum kit tetap rasio 16:9, dipusatkan di layar,
// dengan bar hitam (letterbox) di sisi yang kelebihan, supaya
// tidak melar/kepotong di HP dengan rasio layar beda-beda
// (18:9, 19.5:9, 20:9, dll). Pakai pixel asli (bukan vh/vw)
// supaya tidak meleset akibat bug address bar Chrome di HP.
// =============================================
function layoutStage(){
  const body = document.body;
  const stage = document.getElementById("stage");
  const iw = window.innerWidth;
  const ih = window.innerHeight;

  let canvasW, canvasH;

  if(iw < ih){
    // HP posisi tegak -> paksa tampilan landscape via rotate
    body.classList.add("force-landscape");
    body.style.width = ih + "px";
    body.style.height = iw + "px";
    canvasW = ih;
    canvasH = iw;
  } else {
    body.classList.remove("force-landscape");
    body.style.width = "";
    body.style.height = "";
    canvasW = iw;
    canvasH = ih;
  }

  // hitung ukuran terbesar dengan rasio 16:9 yang muat di kanvas
  let stageW, stageH;
  if(canvasW / canvasH > 16/9){
    stageH = canvasH;
    stageW = stageH * (16/9);
  } else {
    stageW = canvasW;
    stageH = stageW * (9/16);
  }

  stage.style.width = stageW + "px";
  stage.style.height = stageH + "px";
  stage.style.left = ((canvasW - stageW)/2) + "px";
  stage.style.top = ((canvasH - stageH)/2) + "px";
}

window.addEventListener("load", layoutStage);
window.addEventListener("resize", layoutStage);
window.addEventListener("orientationchange", layoutStage);

// ============================================= 
// pengaturan suara: volume & preset
// pakai Web Audio API + preload buffer supaya
// ketukan langsung bunyi tanpa delay, dan beberapa
// ketukan barengan tetap presisi (tidak ada yang telat)
// ============================================= 
let currentVolume = 1;
let currentPreset = ""; // "" = folder assets/sounds/ langsung (standard)

// state rekam & putar ulang
let isRecording = false;
let recordedEvents = [];
let recordStartTime = 0;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = currentVolume;
masterGain.connect(audioCtx.destination);

const soundBuffers = {}; // cache: path -> decoded AudioBuffer
const soundFileNames = [
  "crash.mp3","ride.mp3","tom.mp3","snare.mp3",
  "floor_tom.mp3","kick.mp3","hihat_open.mp3","hihat_closed.mp3"
];

// decode 1 file dan simpan ke cache (kalau sudah ada, langsung pakai cache)
// sekaligus deteksi bagian "hening" di awal file (kalau ada) supaya
// pas diputar langsung ke bagian bunyinya, tidak kerasa delay
function loadSound(path){
  if(soundBuffers[path]) return soundBuffers[path];
  const promise = fetch(path)
    .then(res=>res.arrayBuffer())
    .then(data=>audioCtx.decodeAudioData(data))
    .then(buffer=>({
      buffer,
      offset: getLeadingSilenceOffset(buffer)
    }));
  soundBuffers[path] = promise;
  return promise;
}

// cari titik pertama di file yang sudah "berbunyi" (di atas ambang batas),
// dibatasi scan maksimal 2 detik pertama biar tetap ringan
function getLeadingSilenceOffset(buffer, threshold=0.02){
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const maxScan = Math.min(data.length, sampleRate*2);
  for(let i=0; i<maxScan; i++){
    if(Math.abs(data[i]) > threshold){
      return i/sampleRate;
    }
  }
  return 0;
}

// preload semua suara standard begitu halaman dibuka
function preloadPreset(preset){
  soundFileNames.forEach(name=>{
    loadSound("assets/sounds/"+preset+name).catch(()=>{
      // biarkan gagal diam-diam kalau file preset belum ada,
      // nanti fallback otomatis ke standard saat diputar
    });
  });
}
preloadPreset(""); // preload preset standard dari awal

function playBuffer(sound){
  if(audioCtx.state==="suspended"){
    audioCtx.resume();
  }
  const source = audioCtx.createBufferSource();
  source.buffer = sound.buffer;
  source.connect(masterGain);
  source.start(0, sound.offset);
}

function play(file, elId){
  if(isRecording){
    recordedEvents.push({ file, elId, time: performance.now()-recordStartTime });
  }
  const path = "assets/sounds/"+currentPreset+file;
  loadSound(path).then(playBuffer).catch(()=>{
    // fallback: kalau file preset tidak ada, pakai suara standard
    if(currentPreset!==""){
      loadSound("assets/sounds/"+file).then(playBuffer);
    }
  });
}

// buka AudioContext begitu ada sentuhan pertama
// (browser mobile mewajibkan interaksi user dulu)
function unlockAudio(){
  if(audioCtx.state==="suspended"){
    audioCtx.resume();
  }
}
document.addEventListener("touchstart", unlockAudio, { once:true });
document.addEventListener("click", unlockAudio, { once:true });

// pakai touchstart supaya beberapa drum bisa diketuk bersamaan (multi-touch)
// fallback ke click untuk perangkat non-touch (misal testing di PC)
function tapEffect(el){
  el.classList.add("tapped");
  setTimeout(()=>el.classList.remove("tapped"), 100);
}

// ============================================= 
// getar saat ketuk (kalau didukung device & diaktifkan)
// ============================================= 
let vibrateEnabled = true;
function vibrateTap(){
  if(vibrateEnabled && navigator.vibrate){
    navigator.vibrate(15);
  }
}

function bindDrum(id, file){
  const el=document.getElementById(id);
  el.addEventListener("touchstart", (e)=>{
    e.preventDefault(); // cegah trigger click ganda setelah touch
    tapEffect(el);
    vibrateTap();
    play(file, id);
  }, { passive:false });
  el.addEventListener("click", ()=>{
    tapEffect(el);
    vibrateTap();
    play(file, id);
  });
}

bindDrum("crash", "crash.mp3");

bindDrum("ride", "ride.mp3");

bindDrum("tom1", "tom.mp3");

bindDrum("tom2", "tom.mp3");

bindDrum("snare", "snare.mp3");

bindDrum("floor", "floor_tom.mp3");

bindDrum("kick", "kick.mp3");

bindDrum("hihat", "hihat_closed.mp3");

bindDrum("hihatOpen", "hihat_open.mp3");

// ============================================= 
// hamburger menu / panel pengaturan
// ============================================= 
const menuIcon = document.getElementById("menuIcon");
const settingsPanel = document.getElementById("settingsPanel");
const overlay = document.getElementById("overlay");

function openSettings(){
  settingsPanel.classList.add("open");
  overlay.classList.add("show");
}
function closeSettings(){
  settingsPanel.classList.remove("open");
  overlay.classList.remove("show");
}

menuIcon.addEventListener("click", ()=>{
  if(settingsPanel.classList.contains("open")){
    closeSettings();
  } else {
    openSettings();
  }
});

overlay.addEventListener("click", closeSettings);

// volume slider
const volumeRange = document.getElementById("volumeRange");
volumeRange.addEventListener("input", (e)=>{
  currentVolume = parseFloat(e.target.value);
  masterGain.gain.value = currentVolume;
});

// toggle getar
const vibrateToggle = document.getElementById("vibrateToggle");
vibrateToggle.addEventListener("change", (e)=>{
  vibrateEnabled = e.target.checked;
});

// ============================================= 
// custom dropdown (bukan native <select>) supaya
// ikut ke-rotate saat mode landscape paksa
// ============================================= 
function initCustomSelect(id, onChange){
  const wrap = document.getElementById(id);
  const btn = wrap.querySelector(".select-btn");
  const optionsBox = wrap.querySelector(".select-options");
  const optionEls = wrap.querySelectorAll(".select-option");

  function toggleBtn(e){
    e.preventDefault();
    e.stopPropagation();
    closeAllSelects(wrap);
    optionsBox.classList.toggle("show");
  }
  btn.addEventListener("touchstart", toggleBtn, { passive:false });
  btn.addEventListener("click", toggleBtn);

  optionEls.forEach(opt=>{
    function selectOpt(e){
      e.preventDefault();
      e.stopPropagation();
      const val = opt.dataset.value;
      btn.textContent = opt.textContent;
      btn.dataset.value = val;
      optionEls.forEach(o=>o.classList.remove("selected"));
      opt.classList.add("selected");
      optionsBox.classList.remove("show");
      onChange(val);
    }
    opt.addEventListener("touchstart", selectOpt, { passive:false });
    opt.addEventListener("click", selectOpt);
  });
}

function closeAllSelects(exceptWrap){
  document.querySelectorAll(".select-options.show").forEach(el=>{
    if(!exceptWrap || el.closest(".custom-select")!==exceptWrap){
      el.classList.remove("show");
    }
  });
}

// tutup dropdown kalau tap/klik di luar area dropdown
document.addEventListener("click", ()=>closeAllSelects());

// ganti tema
initCustomSelect("themeSelect", (val)=>{
  if(val==="light"){
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
});

// pilih preset suara
// catatan: preset "electronic/" dan "acoustic/" butuh folder
// assets/sounds/electronic/ dan assets/sounds/acoustic/ berisi file
// dengan nama sama persis (crash.mp3, snare.mp3, dst). Kalau folder
// belum dibuat, otomatis fallback ke suara standard.
initCustomSelect("soundPreset", (val)=>{
  currentPreset = val;
  preloadPreset(val);
});

// ============================================= 
// tombol Record & Play (dengan pilihan mode: rekaman drum / musik HP)
// ============================================= 
const recordBtn = document.getElementById("recordBtn");
const playBtn = document.getElementById("playBtn");
const playModalOverlay = document.getElementById("playModalOverlay");
const playModal = document.getElementById("playModal");
const musicFileInput = document.getElementById("musicFileInput");

let playbackTimers = [];
let backingAudio = null;

function stopDrumPlayback(){
  playbackTimers.forEach(t=>clearTimeout(t));
  playbackTimers = [];
  playBtn.classList.remove("playing-drum");
}

function stopMusicPlayback(){
  if(backingAudio && !backingAudio.paused){
    backingAudio.pause();
  }
  playBtn.classList.remove("playing-music");
}

function toggleRecord(){
  stopDrumPlayback();
  stopMusicPlayback();

  if(isRecording){
    isRecording = false;
    recordBtn.classList.remove("recording");
  } else {
    recordedEvents = [];
    recordStartTime = performance.now();
    isRecording = true;
    recordBtn.classList.add("recording");
  }
}

function playDrumRecording(){
  stopMusicPlayback();

  // kalau lagi muter rekaman, tap lagi = berhenti
  if(playbackTimers.length>0){
    stopDrumPlayback();
    return;
  }
  if(recordedEvents.length===0) return;

  playBtn.classList.add("playing-drum");
  const lastTime = recordedEvents[recordedEvents.length-1].time;

  recordedEvents.forEach(ev=>{
    const timer = setTimeout(()=>{
      const el = document.getElementById(ev.elId);
      if(el){
        tapEffect(el);
        vibrateTap();
      }
      play(ev.file);
    }, ev.time);
    playbackTimers.push(timer);
  });

  const endTimer = setTimeout(stopDrumPlayback, lastTime+300);
  playbackTimers.push(endTimer);
}

function playMusicFromPhone(){
  stopDrumPlayback();

  // belum ada lagu dipilih -> buka pemilih file
  if(!backingAudio){
    musicFileInput.click();
    return;
  }
  // sudah ada lagu -> toggle play/pause
  if(backingAudio.paused){
    backingAudio.play();
  } else {
    backingAudio.pause();
  }
}

musicFileInput.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;

  if(backingAudio){
    backingAudio.pause();
    URL.revokeObjectURL(backingAudio.src);
  }

  const url = URL.createObjectURL(file);
  backingAudio = new Audio(url);
  backingAudio.loop = true;
  backingAudio.volume = currentVolume;
  backingAudio.play();

  backingAudio.addEventListener("play", ()=>playBtn.classList.add("playing-music"));
  backingAudio.addEventListener("pause", ()=>playBtn.classList.remove("playing-music"));

  musicFileInput.value = "";
});

// tombol record
recordBtn.addEventListener("click", toggleRecord);

// tombol play: tap buka popup pilihan mode di tengah layar
function openPlayModal(e){
  e.preventDefault();
  e.stopPropagation();
  playModalOverlay.classList.add("show");
  playModal.classList.add("show");
}
function closePlayModal(){
  playModalOverlay.classList.remove("show");
  playModal.classList.remove("show");
}
playBtn.addEventListener("touchstart", openPlayModal, { passive:false });
playBtn.addEventListener("click", openPlayModal);
playModalOverlay.addEventListener("click", closePlayModal);

// pilih mode dari popup
playModal.querySelectorAll(".play-modal-option").forEach(opt=>{
  function chooseMode(e){
    e.preventDefault();
    e.stopPropagation();
    closePlayModal();
    if(opt.dataset.mode==="record"){
      playDrumRecording();
    } else {
      playMusicFromPhone();
    }
  }
  opt.addEventListener("touchstart", chooseMode, { passive:false });
  opt.addEventListener("click", chooseMode);
});

// volume slider juga ikut atur volume backing track musik
volumeRange.addEventListener("input", ()=>{
  if(backingAudio) backingAudio.volume = currentVolume;
});
