// Minimal app wiring — Web Audio + YouTube embed
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
    rain:    { el: null, gain: null, toggle: null, slider: null },
    ocean:   { el: null, gain: null, toggle: null, slider: null },
    city:    { el: null, gain: null, toggle: null, slider: null },
    youtube: { gain: null, toggle: null, slider: null }
  };

  

  function ensureAudioContext(){ if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; audioCtx = new AC(); } }
  function connectMediaEl(id){ const src = sources[id]; if (!src.el || src.gain) return; ensureAudioContext(); src.gain = audioCtx.createGain(); src.gain.gain.value = (parseInt(src.slider.value,10)||0)/100; const node = audioCtx.createMediaElementSource(src.el); node.connect(src.gain).connect(audioCtx.destination); }
  function updateStatus(){ const anyOn = Object.keys(sources).some(k => { if (k==='youtube') return sources.youtube.toggle.checked && ytPlayer && ytReady; return sources[k].toggle.checked; }); document.getElementById('audioStatus').textContent = anyOn ? 'Audio: playing' : 'Audio: stopped'; }
  function setupLocalSource(id){ const src = sources[id]; src.el = document.getElementById('audio-'+id); src.toggle = document.getElementById('toggle-'+id); src.slider = document.getElementById('vol-'+id);
    src.toggle.addEventListener('change', () => { ensureAudioContext(); connectMediaEl(id); if (src.toggle.checked) { try { src.el.play(); } catch(e) {} } else { src.el.pause(); } updateStatus(); });
    src.slider.addEventListener('input', () => { connectMediaEl(id); if (src.gain) src.gain.gain.value = clamp(parseInt(src.slider.value,10),0,100)/100; }); }

  window.onYouTubeIframeAPIReady = function(){ ytReady = true; ytPlayer = new YT.Player('yt-player', { height: '100%', width: '100%', videoId: '', playerVars: { playsinline: 1, autoplay: 0, controls: 1, rel: 0, modestbranding: 1 }, events: { onReady: () => { document.getElementById('yt-status').textContent = 'Ready'; document.getElementById('vol-youtube').dispatchEvent(new Event('input')); }, onStateChange: () => { updateStatus(); } } }); }

  function setupYouTube(){ const tgl = document.getElementById('toggle-youtube'); const vol = document.getElementById('vol-youtube'); const url = document.getElementById('yt-url'); const load = document.getElementById('yt-load'); const clear = document.getElementById('yt-clear'); const status = document.getElementById('yt-status'); sources.youtube.toggle = tgl; sources.youtube.slider = vol;
    load.addEventListener('click', () => { if (!ytReady || !ytPlayer) return; const id = parseYouTubeID(url.value||''); if (!id) { status.textContent='Invalid URL'; return; } status.textContent='Loading…'; ytPlayer.loadVideoById(id); tgl.checked = true; updateStatus(); });
    clear.addEventListener('click', () => { if (ytPlayer) { ytPlayer.stopVideo(); } url.value=''; status.textContent='Idle'; tgl.checked=false; updateStatus(); });
    tgl.addEventListener('change', () => { if (!ytPlayer) return; if (tgl.checked) { ytPlayer.playVideo(); } else { ytPlayer.pauseVideo(); } updateStatus(); });
    vol.addEventListener('input', () => { if (!ytPlayer || typeof ytPlayer.setVolume !== 'function') return; ytPlayer.setVolume(clamp(parseInt(vol.value,10),0,100)); }); }

  window.addEventListener('DOMContentLoaded', () => { ['rain','ocean','city'].forEach(setupLocalSource); setupYouTube(); });
  
})();
