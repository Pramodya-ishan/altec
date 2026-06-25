(() => {
  'use strict';

  /*
    recoding viwer local player - low CPU background analyzer
    Main video never gets fast-forwarded for scan.
    A hidden analyzer media element scans the same local file in the background,
    sends audio to WebAudio at zero gain, and stores silent segments for ETA + auto-skip.
  */

  const MAX_RATE = 100;
  const SMALL_STEP = 0.05;
  const BIG_STEP = 5;

  // Low CPU scan settings.
  // Higher values scan faster but use more CPU. 75x is requested for fastest background analysis.
  const ANALYZER_RATE = 75;
  const ANALYZER_INTERVAL_MS = 80;
  const SILENCE_RMS = 0.018;
  const MIN_SILENCE = 0.38;
  const MERGE_GAP = 0.22;
  const MAX_BRIDGE_SILENCE_GAP = 1.65;
  const ISOLATED_SILENCE_WINDOW = 0.42;

  const $ = sel => document.querySelector(sel);

  const video = $('#rv-video');
  const shell = $('#rv-player-shell');
  const fileInput = $('#rv-file-input');
  const dropZone = $('#rv-drop-zone');
  const empty = $('#rv-empty');
  const playlistEl = $('#rv-playlist');
  const scanBtn = $('#rv-scan-btn');
  const fsBtn = $('#rv-fullscreen-btn');
  const overlay = $('#rv-overlay');
  const etaEl = overlay.querySelector('.eta');
  const rateBtn = overlay.querySelector('.rate');
  const statusEl = $('#rv-status');
  const silenceCountEl = $('#rv-silence-count');
  const etaModeEl = $('#rv-eta-mode');

  let files = [];
  let activeIndex = -1;
  let objectUrl = '';
  // Force 1.0 by default, don't read from localStorage
  let rate = 1;

  let scanToken = 0;
  let scan = {
    ready: false,
    running: false,
    segments: [],
    progress: 0,
    mode: 'normal'
  };

  let audioCtx = null;
  let analyzerVideo = null;
  let analyzerNode = null;
  let analyzerSource = null;
  let analyzerGain = null;
  let analyzerTimer = 0;
  let supportedAnalyzerRate = 1;
  let uiRaf = 0;

  let drag = null;
  let overlayPos = loadOverlayPosition();

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '--:--';
    sec = Math.ceil(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function clampRate(n) { return Math.round(clamp(Number(n) || 1, 0.05, MAX_RATE) * 100) / 100; }

  function setMediaRateSafe(media, desired = ANALYZER_RATE) {
    const want = Number(desired) || 1;
    const candidates = [want, 64, 32, 16, 8, 4, 2, 1]
      .filter((value, index, arr) => value > 0 && arr.indexOf(value) === index);
    let lastError = null;
    for (const candidate of candidates) {
      try {
        media.defaultPlaybackRate = candidate;
        media.playbackRate = candidate;
        return Number(media.playbackRate) || candidate;
      } catch (err) {
        lastError = err;
      }
    }
    try {
      media.defaultPlaybackRate = 1;
      media.playbackRate = 1;
      return 1;
    } catch (_) {
      if (lastError) console.warn('Analyzer playbackRate clamp failed', lastError);
      return 1;
    }
  }

  function analyzerRateLabel() {
    return supportedAnalyzerRate >= ANALYZER_RATE - 0.01
      ? `${ANALYZER_RATE}x`
      : `${ANALYZER_RATE}x requested / ${supportedAnalyzerRate.toFixed(supportedAnalyzerRate >= 10 ? 0 : 1)}x actual`;
  }

  function stepFor(direction) {
    if (direction > 0) return rate >= 10 ? BIG_STEP : SMALL_STEP;
    return rate > 10 ? BIG_STEP : SMALL_STEP;
  }

  function setRate(next) {
    rate = clampRate(next);
    try {
      video.playbackRate = rate;
      video.defaultPlaybackRate = rate;
    } catch (_) {}
    rateBtn.textContent = `${rate.toFixed(rate >= 10 ? 0 : 2)}x`;
    updateEta();
  }

  function changeRate(direction) {
    setRate(rate + direction * stepFor(direction));
  }

  function setStatus(text) { statusEl.textContent = text; }
  function setMode(text) { etaModeEl.textContent = text; }
  function setCount() { silenceCountEl.textContent = String(scan.segments.length); }

  function clearObjectUrl() {
    if (objectUrl && !objectUrl.startsWith('localdb://')) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }

  function stopBackgroundScan() {
    scanToken++;
    if (analyzerTimer) clearInterval(analyzerTimer);
    analyzerTimer = 0;
    try { analyzerVideo && analyzerVideo.pause(); } catch (_) {}
    scan.running = false;
  }

  function resetScanState(mode = 'normal') {
    stopBackgroundScan();
    scan = { ready: false, running: false, segments: [], progress: 0, mode };
    setCount();
    setMode('Normal');
  }

  async function loadFile(index) {
    if (!files[index]) return;

    resetScanState('normal');
    activeIndex = index;
    clearObjectUrl();
    
    // Support indexedDB local files
    if (files[index].isLocalDbBlob) {
       objectUrl = URL.createObjectURL(files[index]);
    } else {
       objectUrl = URL.createObjectURL(files[index]);
    }

    video.src = objectUrl;
    video.load();

    shell.classList.add('has-video');
    if (empty) empty.style.display = 'none';
    scanBtn.disabled = false;
    fsBtn.disabled = false;
    overlay.hidden = false;
    applyOverlayPosition();

    document.title = `${files[index].name} – recoding viwer`;
    setStatus('Loaded. Auto analysis will start after metadata loads • 0%');
    renderPlaylist();
    setRate(rate);
  }

  function renderPlaylist() {
    playlistEl.innerHTML = '';
    files.forEach((file, idx) => {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'rv-file-row';

      const play = document.createElement('button');
      play.type = 'button';
      play.className = idx === activeIndex ? 'active' : '';
      play.textContent = file.name;
      play.addEventListener('click', () => loadFile(idx));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '×';
      remove.title = 'Remove file';
      remove.addEventListener('click', () => {
        files.splice(idx, 1);
        if (idx === activeIndex) {
          activeIndex = -1;
          resetScanState('normal');
          clearObjectUrl();
          try { video.pause(); } catch (_) {}
          video.removeAttribute('src');
          video.load();
          shell.classList.remove('has-video');
          overlay.hidden = true;
          scanBtn.disabled = true;
          fsBtn.disabled = true;
          setStatus('Waiting for file');
          if (empty) empty.style.display = '';
          if (files[0]) loadFile(0);
        } else {
          if (idx < activeIndex) activeIndex--;
          renderPlaylist();
        }
      });

      row.append(play, remove);
      li.append(row);
      playlistEl.append(li);
    });
  }

  function addFiles(list) {
    const incoming = Array.from(list || []).filter(file =>
      file.isLocalDbBlob ||
      /^(video|audio)\//i.test(file.type) ||
      /\.(mp4|mkv|webm|mov|m4v|mp3|wav|ogg|m4a)$/i.test(file.name)
    );
    if (!incoming.length) return;
    const shouldLoad = files.length === 0;
    files.push(...incoming);
    renderPlaylist();
    if (shouldLoad) loadFile(0);
  }

  function getDuration() {
    let d = Number(video.duration);
    if (!Number.isFinite(d) || d <= 0) {
      try {
        if (video.buffered.length) d = video.buffered.end(video.buffered.length - 1);
      } catch (_) {}
    }
    return Number.isFinite(d) && d > 0 ? d : NaN;
  }

  function waitForMediaReady(media) {
    if (media.readyState >= 1 && Number.isFinite(media.duration) && media.duration > 0) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => {
        media.removeEventListener('loadedmetadata', done);
        media.removeEventListener('durationchange', done);
        resolve();
      };
      media.addEventListener('loadedmetadata', done, { once: true });
      media.addEventListener('durationchange', done, { once: true });
      setTimeout(resolve, 2500);
    });
  }

  function ensureAnalyzerVideo() {
    if (!analyzerVideo) {
      analyzerVideo = document.createElement('video');
      analyzerVideo.preload = 'auto';
      analyzerVideo.playsInline = true;
      analyzerVideo.controls = false;
      analyzerVideo.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      // Keep false for audio data. Output is silenced by WebAudio gain=0.
      analyzerVideo.muted = false;
      analyzerVideo.volume = 1;
      document.body.appendChild(analyzerVideo);
    }
    return analyzerVideo;
  }

  function ensureAnalyzerGraph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('AudioContext is not available');
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const av = ensureAnalyzerVideo();
    if (!analyzerNode) {
      analyzerNode = audioCtx.createAnalyser();
      analyzerNode.fftSize = 1024;
      analyzerGain = audioCtx.createGain();
      analyzerGain.gain.value = 0;

      analyzerSource = audioCtx.createMediaElementSource(av);
      analyzerSource.connect(analyzerNode);
      analyzerNode.connect(analyzerGain);
      analyzerGain.connect(audioCtx.destination);
    }
    return { av, analyser: analyzerNode };
  }

  function getRms() {
    if (!analyzerNode) return 1;
    const data = new Uint8Array(analyzerNode.fftSize);
    analyzerNode.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const x = (data[i] - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / data.length);
  }

  function mergeSegment(start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    if (end <= start || end - start < MIN_SILENCE) return;

    const last = scan.segments[scan.segments.length - 1];
    if (last && start <= last.end + MERGE_GAP) {
      last.end = Math.max(last.end, end);
    } else {
      scan.segments.push({ start, end });
    }
  }

  function findSegment(t) {
    for (const seg of scan.segments) {
      if (t >= seg.start && t < seg.end) return seg;
      if (seg.start > t) break;
    }
    return null;
  }

  function silenceRemaining(from, duration) {
    if (!scan.segments.length || !Number.isFinite(duration)) return 0;
    let total = 0;
    for (const s of scan.segments) {
      if (s.end <= from) continue;
      if (s.start >= duration) break;
      const a = Math.max(from, s.start);
      const b = Math.min(duration, s.end);
      if (b > a) total += b - a;
    }
    return total;
  }

  function nonSilentRemaining(from, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return NaN;
    const raw = Math.max(0, duration - from);
    const silent = scan.ready || scan.running ? silenceRemaining(from, duration) : 0;
    return Math.max(0, raw - silent);
  }

  function scanProgressLabel(duration) {
    const av = analyzerVideo;
    const t = av ? (Number(av.currentTime) || 0) : (scan.progress / 100) * duration;
    const pct = Number.isFinite(duration) && duration > 0 ? clamp((t / duration) * 100, 0, 100) : scan.progress;
    return `${fmt(t)} / ${fmt(duration)} • ${Math.floor(pct)}%`;
  }

  function updateEta() {
    const duration = getDuration();
    const now = Number(video.currentTime) || 0;
    let rem = NaN;

    if (Number.isFinite(duration)) {
      const effectiveLeft = nonSilentRemaining(now, duration);
      rem = effectiveLeft / Math.max(0.05, rate);
    }

    etaEl.textContent = `ETA ${fmt(rem)}`;

    if (scan.running) {
      setMode(`Analyzing ${Math.floor(scan.progress)}%`);
    } else if (scan.ready) {
      setMode('Silent removed');
    } else {
      setMode('Normal');
    }

    setCount();
  }

  async function startBackgroundAudioScan({ restart = false } = {}) {
    if (!objectUrl || !video.src) return;
    if (scan.running && !restart) return;

    const duration = getDuration();
    if (!Number.isFinite(duration) || duration <= 0) {
      setStatus('Duration is not ready. Try again after the video metadata loads.');
      return;
    }

    stopBackgroundScan();

    const token = ++scanToken;
    scan = { ready: false, running: true, segments: [], progress: 0, mode: 'background' };
    setCount();
    setMode('Analyzing 0%');
    scanBtn.disabled = true;
    setStatus('Background audio analysis starting 0% • 0:00 / ' + fmt(duration) + ' • Main video stays normal.');

    let lastSampleTime = null;
    let lastSampleSilent = false;

    try {
      const { av } = ensureAnalyzerGraph();
      av.src = objectUrl;
      av.preload = 'auto';
      av.currentTime = 0;
      supportedAnalyzerRate = setMediaRateSafe(av, ANALYZER_RATE);
      // @ts-ignore
      av.preservesPitch = false; av.mozPreservesPitch = false; av.webkitPreservesPitch = false;
      av.volume = 1;
      av.muted = false;

      await waitForMediaReady(av);
      try { av.currentTime = 0; } catch (_) {}
      await sleep(80);

      await av.play();

      analyzerTimer = setInterval(() => {
        if (token !== scanToken) return;

        try {
          if (Math.abs((Number(av.playbackRate) || 1) - supportedAnalyzerRate) > 0.01) {
            supportedAnalyzerRate = setMediaRateSafe(av, ANALYZER_RATE);
          }
        } catch (_) {}
        const t = Number(av.currentTime) || 0;
        const rms = getRms();
        const isSilent = rms < SILENCE_RMS;

        if (isSilent) {
          if (lastSampleSilent && Number.isFinite(lastSampleTime) && t > lastSampleTime && (t - lastSampleTime) <= MAX_BRIDGE_SILENCE_GAP) {
            mergeSegment(lastSampleTime, t);
          } else {
            const half = ISOLATED_SILENCE_WINDOW / 2;
            mergeSegment(Math.max(0, t - half), Math.min(duration, t + half));
          }
        }
        lastSampleTime = t;
        lastSampleSilent = isSilent;

        scan.progress = clamp((t / duration) * 100, 0, 100);
        setStatus(`Background analyzing ${scanProgressLabel(duration)} • ${scan.segments.length} silent parts • ${analyzerRateLabel()}`);
        updateEta();

        if (av.ended || t >= duration - 0.08) {
          clearInterval(analyzerTimer);
          analyzerTimer = 0;
          try { av.pause(); } catch (_) {}
          scan.running = false;
          scan.ready = true;
          scan.progress = 100;
          scan.segments.sort((a, b) => a.start - b.start);
          setStatus(`Analysis complete • 100% • ${fmt(duration)} / ${fmt(duration)} • ${scan.segments.length} silent parts found`);
          setMode('Silent removed');
          setCount();
          scanBtn.disabled = false;
          updateEta();
        }
      }, ANALYZER_INTERVAL_MS);
    } catch (err) {
      clearInterval(analyzerTimer);
      analyzerTimer = 0;
      scan.running = false;
      scan.ready = false;
      scanBtn.disabled = false;
      const msg = err && err.message ? err.message : 'browser blocked background audio scan';
      setStatus(`Background analysis could not start yet: ${msg}. Press Play once, then click Analyze audio.`);
      setMode('Normal');
      updateEta();
    }
  }

  function startUiLoop() {
    cancelAnimationFrame(uiRaf);
    const tick = () => {
      if (!video.paused && scan.segments.length) {
        const seg = findSegment(video.currentTime);
        if (seg && seg.end > video.currentTime + 0.04) {
          video.currentTime = Math.min(seg.end + 0.03, getDuration() || seg.end);
        }
      }
      updateEta();
      uiRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  async function requestShellFullscreen() {
    try {
      if (shell.requestFullscreen) await shell.requestFullscreen({ navigationUI: 'hide' });
      else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
    } catch (_) {}
  }

  async function exitAnyFullscreen() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (_) {}
  }

  function toggleFullscreen() {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) {
      exitAnyFullscreen();
      return;
    }
    requestShellFullscreen();
  }

  function patchVideoFullscreen() {
    if (window.__rvVideoFullscreenPatched) return;
    window.__rvVideoFullscreenPatched = true;
    try {
      const nativeRequest = HTMLVideoElement.prototype.requestFullscreen;
      if (nativeRequest) {
        HTMLVideoElement.prototype.requestFullscreen = function(...args) {
          if (this === video || shell.contains(this)) return requestShellFullscreen() ;
          return nativeRequest.apply(this, args);
        };
      }
    } catch (_) {}
  }

  function syncFullscreenOverlay() {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;

    if (fs === video) {
      exitAnyFullscreen().then(() => setTimeout(requestShellFullscreen, 80));
      return;
    }

    if (!shell.contains(overlay)) shell.appendChild(overlay);
    overlay.hidden = !video.src;
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '2147483647';
    overlay.style.display = video.src ? 'flex' : '';
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
    applyOverlayPosition();

    setTimeout(() => {
      if (!shell.contains(overlay)) shell.appendChild(overlay);
      overlay.hidden = !video.src;
      applyOverlayPosition();
    }, 120);
  }

  function loadOverlayPosition() {
    try {
      const raw = localStorage.getItem('rvOverlayPosition');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) return parsed;
    } catch (_) {}
    return null;
  }

  function saveOverlayPosition(left, top) {
    overlayPos = { left: Math.round(left), top: Math.round(top) };
    try { localStorage.setItem('rvOverlayPosition', JSON.stringify(overlayPos)); } catch (_) {}
  }

  function constrainOverlay(left, top) {
    const parent = overlay.parentElement || shell;
    const pr = parent.getBoundingClientRect();
    const or = overlay.getBoundingClientRect();
    const maxLeft = Math.max(8, pr.width - or.width - 8);
    const maxTop = Math.max(8, pr.height - or.height - 8);
    return {
      left: clamp(left, 8, maxLeft),
      top: clamp(top, 8, maxTop)
    };
  }

  function applyOverlayPosition() {
    if (!overlayPos) {
      overlay.style.left = '18px';
      overlay.style.top = '';
      overlay.style.bottom = '18px';
      return;
    }
    const p = constrainOverlay(overlayPos.left, overlayPos.top);
    overlay.style.left = `${p.left}px`;
    overlay.style.top = `${p.top}px`;
    overlay.style.bottom = 'auto';
  }

  function setupOverlayDrag() {
    overlay.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button,.rate')) return;

      const parent = overlay.parentElement || shell;
      const pr = parent.getBoundingClientRect();
      const or = overlay.getBoundingClientRect();

      drag = {
        dx: e.clientX - or.left,
        dy: e.clientY - or.top,
        parentLeft: pr.left,
        parentTop: pr.top
      };

      overlay.classList.add('dragging');
      overlay.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    }, true);

    overlay.addEventListener('pointermove', e => {
      if (!drag) return;
      const rawLeft = e.clientX - drag.parentLeft - drag.dx;
      const rawTop = e.clientY - drag.parentTop - drag.dy;
      const p = constrainOverlay(rawLeft, rawTop);

      overlay.style.left = `${p.left}px`;
      overlay.style.top = `${p.top}px`;
      overlay.style.bottom = 'auto';
      e.preventDefault();
    }, true);

    const endDrag = e => {
      if (!drag) return;
      const left = parseFloat(overlay.style.left) || 18;
      const top = parseFloat(overlay.style.top) || 18;
      saveOverlayPosition(left, top);
      drag = null;
      overlay.classList.remove('dragging');
      try { overlay.releasePointerCapture?.(e.pointerId); } catch (_) {}
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    };

    overlay.addEventListener('pointerup', endDrag, true);
    overlay.addEventListener('pointercancel', endDrag, true);
    window.addEventListener('resize', applyOverlayPosition);
  }

  fileInput.addEventListener('change', e => addFiles(e.target.files));
  scanBtn.addEventListener('click', () => startBackgroundAudioScan({ restart: true }));
  fsBtn.addEventListener('click', toggleFullscreen);

  overlay.querySelector('.minus').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); changeRate(-1); });
  overlay.querySelector('.plus').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); changeRate(1); });
  rateBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); setRate(1); });

  ['dragenter', 'dragover'].forEach(type => {
    dropZone.addEventListener(type, e => {
      e.preventDefault();
      dropZone.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    dropZone.addEventListener(type, e => {
      e.preventDefault();
      dropZone.classList.remove('drag');
    });
  });
  dropZone.addEventListener('drop', e => addFiles(e.dataTransfer.files));

  video.addEventListener('loadedmetadata', () => {
    try { video.setAttribute('controlsList', 'nofullscreen nodownload'); } catch (_) {}
    patchVideoFullscreen();
    setRate(rate);
    updateEta();
    syncFullscreenOverlay();
    setTimeout(() => startBackgroundAudioScan({ restart: true }), 250);
  });
  video.addEventListener('ratechange', () => {
    if (!scan.running) setRate(video.playbackRate);
  });
  video.addEventListener('play', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    startUiLoop();
    if (!scan.ready && !scan.running) startBackgroundAudioScan({ restart: false });
  });
  video.addEventListener('timeupdate', updateEta);

  document.addEventListener('fullscreenchange', syncFullscreenOverlay);
  document.addEventListener('webkitfullscreenchange', syncFullscreenOverlay);

  patchVideoFullscreen();
  setupOverlayDrag();
  setRate(rate);
  startUiLoop();

  // indexedDB logic!
  const getDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('videostore', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const loadFromDBIfExists = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const blobUrl = params.get('blob');

    if (id) {
       try {
          const db = await getDB();
          const tx = db.transaction('videos', 'readonly');
          const store = tx.objectStore('videos');
          const req = store.get(id);
          req.onsuccess = () => {
             const file = req.result;
             if (file) {
                 file.isLocalDbBlob = true;
                 addFiles([file]);
             } else {
                 setStatus('File not found in local db. Please attach it first.');
                 document.getElementById('rv-empty-text').textContent = 'File not found locally';
                 document.getElementById('rv-empty-subtext').textContent = 'Please attach the downloaded file in the playlist view';
             }
          };
       } catch (err) {}
    } else if (blobUrl) {
       try {
          const res = await fetch(blobUrl);
          const blob = await res.blob();
          blob.name = "Local Media";
          blob.isLocalDbBlob = true;
          addFiles([blob]);
       } catch (e) {
          setStatus('Failed to load blob URL');
       }
    }
  };
  
  loadFromDBIfExists();

})();
