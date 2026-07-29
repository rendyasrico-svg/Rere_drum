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

  const dotsEl = document.getElementById("loadingDots");
  let dotCount = 0;
  const dotsInterval = setInterval(()=>{
    dotCount = (dotCount+1) % 4;
    dotsEl.textContent = ".".repeat(dotCount);
  }, 400);

  setTimeout(()=>{
    clearInterval(dotsInterval);
    splash.classList.add("hide");
    setTimeout(()=>splash.remove(), 600);
  }, 3500);
});

function lockLandscape(){
  if(screen.orientation && screen.orientation.lock){
    screen.orientation.lock("landscape").catch(err=>{
      console.log("Gagal lock orientasi:", err.message);
    });
  }
}

window.addEventListener("load", lockLandscape);
document.addEventListener("click", lockLandscape, { once:true });

function layoutStage(){
  const body = document.body;
  const stage = document.getElementById("stage");
  const iw = window.innerWidth;
  const ih = window.innerHeight;

  let canvasW, canvasH;

  if(iw < ih){
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

  stage.style.width = canvasW + "px";
  stage.style.height = canvasH + "px";
  stage.style.left = "0px";
  stage.style.top = "0px";
}

window.addEventListener("load", layoutStage);
window.addEventListener("resize", layoutStage);
window.addEventListener("orientationchange", layoutStage);

let currentVolume = 1;
let currentPreset = "";

let isRecording = false;
let recordedEvents = [];
let recordStartTime = 0;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = currentVolume;
masterGain.connect(audioCtx.destination);

const soundBuffers = {};
const soundFileNames = [
  "crash.mp3","ride.mp3","tom.mp3","snare.mp3",
  "floor_tom.mp3","kick.mp3","hihat_open.mp3","hihat_closed.mp3"
];

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

function preloadPreset(preset){
  soundFileNames.forEach(name=>{
    loadSound("assets/sounds/"+preset+name).catch(()=>{});
  });
}
preloadPreset("");

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
    if(currentPreset!==""){
      loadSound("assets/sounds/"+file).then(playBuffer);
    }
  });
}

function unlockAudio(){
  if(audioCtx.state==="suspended"){
    audioCtx.resume();
  }
}
document.addEventListener("touchstart", unlockAudio, { once:true });
document.addEventListener("click", unlockAudio, { once:true });
document.addEventListener("keydown", unlockAudio, { once:true });

function tapEffect(el){
  el.classList.add("tapped");
  setTimeout(()=>el.classList.remove("tapped"), 100);
}

let vibrateEnabled = false;
function vibrateTap(){
  if(vibrateEnabled && navigator.vibrate){
    navigator.vibrate(15);
  }
}

function bindDrum(id, file){
  const el=document.getElementById(id);
  el.addEventListener("touchstart", (e)=>{
    e.preventDefault();
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
// kontrol keyboard (buat main pakai laptop/komputer,
// nggak perlu klik mouse satu-satu)
// ============================================= 
const keyMap = {
  "q": { id:"crash",     file:"crash.mp3" },
  "w": { id:"ride",      file:"ride.mp3" },
  "e": { id:"tom1",      file:"tom.mp3" },
  "r": { id:"tom2",      file:"tom.mp3" },
  "c": { id:"hihat",     file:"hihat_closed.mp3" },
  "x": { id:"hihatOpen", file:"hihat_open.mp3" },
  "b": { id:"snare",     file:"snare.mp3" },
  "f": { id:"floor",     file:"floor_tom.mp3" },
  "v": { id:"kick",      file:"kick.mp3" }
};

document.addEventListener("keydown", (e)=>{
  if(e.repeat) return; // cegah nembak berkali-kali kalau tombol ditahan
  const tag = e.target.tagName;
  if(tag==="INPUT" || tag==="TEXTAREA") return; // biar gak ganggu slider/isian teks

  const mapped = keyMap[e.key.toLowerCase()];
  if(!mapped) return;

  const el = document.getElementById(mapped.id);
  if(el){
    tapEffect(el);
    vibrateTap();
  }
  play(mapped.file, mapped.id);
});

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

const volumeRange = document.getElementById("volumeRange");
volumeRange.addEventListener("input", (e)=>{
  currentVolume = parseFloat(e.target.value);
  masterGain.gain.value = currentVolume;
});

const vibrateToggle = document.getElementById("vibrateToggle");
vibrateToggle.addEventListener("change", (e)=>{
  vibrateEnabled = e.target.checked;
});

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

document.addEventListener("click", ()=>closeAllSelects());

initCustomSelect("themeSelect", (val)=>{
  if(val==="light"){
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
});

initCustomSelect("soundPreset", (val)=>{
  currentPreset = val;
  preloadPreset(val);
});

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

  if(!backingAudio){
    musicFileInput.click();
    return;
  }
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

recordBtn.addEventListener("click", toggleRecord);

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

volumeRange.addEventListener("input", ()=>{
  if(backingAudio) backingAudio.volume = currentVolume;
});
