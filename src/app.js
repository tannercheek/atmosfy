// Minimal app wiring — Web Audio + YouTube embed with seamless looping
(function(){
  function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }
  function parseYouTubeID(url){
    try { const u = new URL(url.trim());
      if (u.hostname === 'youtu.be') return u.pathname.slice(1);
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const path = u.pathname.split('/');
      const idx = path.indexOf('embed');
      if (idx !== -1 && path[idx+1]) return path[idx+1];
    } catch(e) {}
    return (url || '').trim();
  }

  let ytPlayer = null; let ytReady = false; let audioCtx = null;
  const sources = {
    rain:    { buffer: null, source: null, gain: null, toggle: null, slider: null, isPlaying: false },
    ocean:   { buffer: null, source: null, gain: null, toggle: null, slider: null, isPlaying: false },
    city:    { buffer: null, source: null, gain: null, toggle: null, slider: null, isPlaying: false },
    tavern:  { buffer: null, source: null, gain: null, toggle: null, slider: null, isPlaying: false },
    youtube: { gain: null, toggle: null, slider: null }
  };

  function ensureAudioContext(){ 
    if (!audioCtx) { 
      const AC = window.AudioContext || window.webkitAudioContext; 
      audioCtx = new AC(); 
    } 
  }

  // Load audio file into buffer for seamless looping
  async function loadAudioBuffer(id) {
    const src = sources[id];
    const audioEl = document.getElementById('audio-'+id);
    const audioSrc = audioEl.querySelector('source').src;
    
    if (!audioSrc || src.buffer) return; // already loaded
    
    try {
      const response = await fetch(audioSrc);
      const arrayBuffer = await response.arrayBuffer();
      src.buffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch(e) {
      console.error('Error loading audio:', e);
    }
  }

  // Play audio with seamless looping
  function playSource(id) {
    const src = sources[id];
    if (!src.buffer || src.isPlaying) return;
    
    ensureAudioContext();
    
    // Create new source node
    src.source = audioCtx.createBufferSource();
    src.source.buffer = src.buffer;
    src.source.loop = true; // Seamless looping!
    
    // Create/connect gain node if needed
    if (!src.gain) {
      src.gain = audioCtx.createGain();
      src.gain.gain.value = (parseInt(src.slider.value,10)||0)/100;
      src.gain.connect(audioCtx.destination);
    }
    
    src.source.connect(src.gain);
    src.source.start(0);
    src.isPlaying = true;
  }

  // Stop audio
  function stopSource(id) {
    const src = sources[id];
    if (!src.isPlaying || !src.source) return;
    
    try {
      src.source.stop();
    } catch(e) {}
    
    src.source = null;
    src.isPlaying = false;
  }

  function updateStatus(){ 
    const anyOn = Object.keys(sources).some(k => { 
      if (k==='youtube') return sources.youtube.toggle.checked && ytPlayer && ytReady; 
      return sources[k].isPlaying; 
    }); 
    document.getElementById('audioStatus').textContent = anyOn ? 'Audio: playing' : 'Audio: stopped'; 
  }

  function setupLocalSource(id){ 
    const src = sources[id]; 
    src.toggle = document.getElementById('toggle-'+id); 
    src.slider = document.getElementById('vol-'+id);
    
    src.toggle.addEventListener('change', async () => { 
      ensureAudioContext(); 
      
      // Load buffer if not loaded
      if (!src.buffer) {
        await loadAudioBuffer(id);
      }
      
      if (src.toggle.checked) { 
        playSource(id);
      } else { 
        stopSource(id);
      } 
      updateStatus(); 
    });
    
    src.slider.addEventListener('input', () => { 
      if (src.gain) {
        src.gain.gain.value = clamp(parseInt(src.slider.value,10),0,100)/100; 
      }
    }); 
  }

  window.onYouTubeIframeAPIReady = function(){ 
    ytReady = true; 
    ytPlayer = new YT.Player('yt-player', { 
      height: '100%', width: '100%', videoId: '', 
      playerVars: { playsinline: 1, autoplay: 0, controls: 1, rel: 0, modestbranding: 1 }, 
      events: { 
        onReady: () => { 
          document.getElementById('yt-status').textContent = 'Ready'; 
          document.getElementById('vol-youtube').dispatchEvent(new Event('input')); 
        }, 
        onStateChange: (e) => {
          updateStatus(); 
          // Update status when video is loaded and ready
          const status = document.getElementById('yt-status');
          if (e.data === 1) { // Playing
            status.textContent = 'Playing';
          } else if (e.data === 2) { // Paused
            status.textContent = 'Paused';
          } else if (e.data === 5) { // Video cued (loaded and ready)
            status.textContent = 'Loaded';
          }
        }
      } 
    }); 
  }

  function setupYouTube(){ 
    const tgl = document.getElementById('toggle-youtube'); 
    const vol = document.getElementById('vol-youtube'); 
    const url = document.getElementById('yt-url'); 
    const load = document.getElementById('yt-load'); 
    const clear = document.getElementById('yt-clear'); 
    const status = document.getElementById('yt-status'); 
    sources.youtube.toggle = tgl; 
    sources.youtube.slider = vol;
    
    load.addEventListener('click', () => { 
      if (!ytReady || !ytPlayer) return; 
      const id = parseYouTubeID(url.value||''); 
      if (!id) { status.textContent='Invalid URL'; return; } 
      status.textContent='Loading…'; 
      ytPlayer.loadVideoById(id); 
      tgl.checked = true; 
      updateStatus(); 
    });
    
    clear.addEventListener('click', () => { 
      if (ytPlayer) { ytPlayer.stopVideo(); } 
      url.value=''; status.textContent='Idle'; 
      tgl.checked=false; updateStatus(); 
    });
    
    tgl.addEventListener('change', () => { 
      if (!ytPlayer) return; 
      if (tgl.checked) { ytPlayer.playVideo(); } 
      else { ytPlayer.pauseVideo(); } 
      updateStatus(); 
    });
    
    vol.addEventListener('input', () => { 
      if (!ytPlayer || typeof ytPlayer.setVolume !== 'function') return; 
      ytPlayer.setVolume(clamp(parseInt(vol.value,10),0,100)); 
    }); 
  }

  window.addEventListener('DOMContentLoaded', () => { 
    ['rain','ocean','city','tavern'].forEach(setupLocalSource); 
    setupYouTube(); 
  });
})();