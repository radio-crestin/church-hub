import { Hono } from 'hono'
import type { Bindings } from '../types'

const signal = new Hono<{ Bindings: Bindings }>()

const OFFER_TTL = 60 // seconds - CF KV minimum is 60
const ANSWER_TTL = 60
const ROOM_TTL = 3600 // 1 hour - room registration

/**
 * POST /signal/register
 * Local app registers a room with its secret.
 * Body: { secret: string }
 */
signal.post('/signal/register', async (c) => {
  const { secret } = await c.req.json<{ secret: string }>()
  if (!secret) return c.json({ error: 'secret is required' }, 400)

  await c.env.SIGNALING_KV.put(`room:${secret}`, JSON.stringify({
    createdAt: Date.now(),
    active: true,
  }), { expirationTtl: ROOM_TTL })

  return c.json({ success: true })
})

/**
 * POST /signal/unregister
 * Local app unregisters a room.
 * Body: { secret: string }
 */
signal.post('/signal/unregister', async (c) => {
  const { secret } = await c.req.json<{ secret: string }>()
  if (!secret) return c.json({ error: 'secret is required' }, 400)

  await c.env.SIGNALING_KV.delete(`room:${secret}`)
  return c.json({ success: true })
})

/**
 * POST /signal/:secret/offer
 * Listener sends an SDP offer for the local app to answer.
 * Body: { offer: string }
 * Returns: { sessionId: string }
 */
signal.post('/signal/:secret/offer', async (c) => {
  const secret = c.req.param('secret')

  // Verify room exists
  const room = await c.env.SIGNALING_KV.get(`room:${secret}`)
  if (!room) return c.json({ error: 'Room not found or inactive' }, 404)

  const { offer } = await c.req.json<{ offer: string }>()
  if (!offer) return c.json({ error: 'offer is required' }, 400)

  const sessionId = crypto.randomUUID()

  await c.env.SIGNALING_KV.put(
    `offer:${secret}:${sessionId}`,
    JSON.stringify({ offer, createdAt: Date.now() }),
    { expirationTtl: OFFER_TTL },
  )

  // Add sessionId to the pending offers list for this room
  const pendingKey = `pending:${secret}`
  const existing = await c.env.SIGNALING_KV.get(pendingKey)
  const pendingList: string[] = existing ? JSON.parse(existing) : []
  pendingList.push(sessionId)
  await c.env.SIGNALING_KV.put(pendingKey, JSON.stringify(pendingList), {
    expirationTtl: OFFER_TTL,
  })

  return c.json({ sessionId })
})

/**
 * GET /signal/:secret/offers
 * Local app polls for pending SDP offers.
 * Returns: { offers: Array<{ sessionId: string, offer: string }> }
 */
signal.get('/signal/:secret/offers', async (c) => {
  const secret = c.req.param('secret')

  const pendingKey = `pending:${secret}`
  const existing = await c.env.SIGNALING_KV.get(pendingKey)
  if (!existing) return c.json({ offers: [] })

  const pendingList: string[] = JSON.parse(existing)
  const offers: Array<{ sessionId: string; offer: string }> = []

  for (const sessionId of pendingList) {
    const data = await c.env.SIGNALING_KV.get(`offer:${secret}:${sessionId}`)
    if (data) {
      const parsed = JSON.parse(data)
      offers.push({ sessionId, offer: parsed.offer })
      // Delete consumed offer
      await c.env.SIGNALING_KV.delete(`offer:${secret}:${sessionId}`)
    }
  }

  // Clear pending list
  await c.env.SIGNALING_KV.delete(pendingKey)

  return c.json({ offers })
})

/**
 * POST /signal/:secret/answer
 * Local app sends an SDP answer for a specific session.
 * Body: { sessionId: string, answer: string }
 */
signal.post('/signal/:secret/answer', async (c) => {
  const secret = c.req.param('secret')
  const { sessionId, answer } = await c.req.json<{
    sessionId: string
    answer: string
  }>()

  if (!sessionId || !answer) {
    return c.json({ error: 'sessionId and answer are required' }, 400)
  }

  await c.env.SIGNALING_KV.put(
    `answer:${secret}:${sessionId}`,
    JSON.stringify({ answer, createdAt: Date.now() }),
    { expirationTtl: ANSWER_TTL },
  )

  return c.json({ success: true })
})

/**
 * GET /signal/:secret/answer/:sessionId
 * Listener polls for an SDP answer from the local app.
 * Returns: { answer: string } or { pending: true }
 */
signal.get('/signal/:secret/answer/:sessionId', async (c) => {
  const secret = c.req.param('secret')
  const sessionId = c.req.param('sessionId')

  const data = await c.env.SIGNALING_KV.get(`answer:${secret}:${sessionId}`)
  if (!data) return c.json({ pending: true })

  const parsed = JSON.parse(data)
  // Clean up consumed answer
  await c.env.SIGNALING_KV.delete(`answer:${secret}:${sessionId}`)

  return c.json({ answer: parsed.answer })
})

/**
 * GET /listen/:secret
 * Serve the standalone listener HTML page.
 */
/**
 * GET /signal/:secret/check
 * Listener checks if the room is active (host connected).
 */
signal.get('/signal/:secret/check', async (c) => {
  const secret = c.req.param('secret')
  const room = await c.env.SIGNALING_KV.get(`room:${secret}`)
  return c.json({ active: !!room })
})

signal.get('/listen/:secret', async (c) => {
  const secret = c.req.param('secret')
  const baseUrl = new URL(c.req.url).origin

  return c.html(getListenerPageHtml(secret, baseUrl))
})

function getListenerPageHtml(secret: string, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Translation Listener</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
.card{background:#1e293b;border-radius:16px;padding:2rem;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.4)}
h1{font-size:1.25rem;margin-bottom:.5rem}
.status{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:.8rem;font-weight:600;margin:1rem 0}
.status.idle{background:#334155;color:#94a3b8}
.status.waiting{background:#1e3a5f;color:#60a5fa}
.status.connecting{background:#1e3a5f;color:#60a5fa}
.status.connected{background:#14532d;color:#4ade80}
.status.error{background:#7f1d1d;color:#f87171}
.dot{width:8px;height:8px;border-radius:50%;animation:pulse 1.5s infinite}
.idle .dot{background:#94a3b8;animation:none}
.waiting .dot{background:#60a5fa}
.connecting .dot{background:#60a5fa}
.connected .dot{background:#4ade80}
.error .dot{background:#f87171;animation:none}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.volume{margin:1rem auto;width:200px;height:6px;background:#334155;border-radius:3px;overflow:hidden}
.volume-bar{height:100%;background:#4ade80;width:0%;transition:width 50ms}
p.info{font-size:.75rem;color:#64748b;margin-top:1rem;min-height:1.2em}
.join-btn{margin-top:1rem;padding:14px 32px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;transition:background .2s;width:100%}
.join-btn:hover:not(:disabled){background:#1d4ed8}
.join-btn:active:not(:disabled){background:#1e40af}
.join-btn:disabled{background:#334155;color:#64748b;cursor:not-allowed}
.lang-section{margin:1rem 0;text-align:left}
.lang-label{display:block;font-size:.75rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}
.lang-list{display:flex;flex-direction:column;gap:.5rem}
.lang-option{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:#334155;border:2px solid transparent;border-radius:10px;cursor:pointer;transition:all .15s;color:#e2e8f0;font-size:.9rem;font-weight:500;text-align:left}
.lang-option:hover{background:#3f4f6b}
.lang-option.selected{background:#1e3a5f;border-color:#3b82f6;color:#bfdbfe}
.lang-option .code{font-size:.7rem;font-weight:700;background:#1e293b;padding:2px 6px;border-radius:4px;letter-spacing:.05em}
.empty-langs{color:#64748b;font-size:.85rem;padding:1rem;text-align:center;background:#0f172a;border-radius:8px}
.mode-toggle{display:flex;gap:.4rem;margin-top:.75rem;background:#0f172a;border-radius:10px;padding:.25rem}
.mode-btn{flex:1;background:transparent;border:none;color:#94a3b8;padding:.55rem .5rem;border-radius:8px;cursor:pointer;font-weight:600;font-size:.8rem;transition:background .15s,color .15s;display:flex;align-items:center;justify-content:center;gap:.4rem}
.mode-btn:hover{color:#e2e8f0}
.mode-btn.active{background:#1e3a5f;color:#bfdbfe}
.mode-btn .icon{font-size:1rem;line-height:1}
.transcript{margin-top:1.25rem;text-align:left;background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:1.25rem 1.25rem;color:#f1f5f9;display:flex;flex-direction:column;gap:.6rem;min-height:9rem;overflow:hidden;position:relative}
.transcript-empty{color:#64748b;font-style:italic;font-size:.85rem;text-align:center;padding:1.5rem 0}
.transcript-line{font-size:1.45rem;line-height:1.35;font-weight:600;color:#f8fafc;word-break:break-word;opacity:0;transform:translateY(6px);transition:opacity .35s ease,transform .35s ease,color .8s ease}
.transcript-line.visible{opacity:1;transform:translateY(0)}
.transcript-line.previous{font-size:1.05rem;font-weight:500;color:#94a3b8;line-height:1.3}
@media (max-width:480px){.transcript-line{font-size:1.2rem}.transcript-line.previous{font-size:.95rem}}
.hidden{display:none}
</style>
</head>
<body>
<div class="card">
<h1>Live Translation</h1>
<div id="status" class="status idle"><span class="dot"></span><span id="statusText">Tap Join to start listening</span></div>
<button id="joinBtn" class="join-btn">Join</button>
<div id="langSection" class="lang-section hidden">
  <span class="lang-label">Select your language</span>
  <div id="langList" class="lang-list"></div>
  <div id="emptyLangs" class="empty-langs hidden">Waiting for the host to publish available languages…</div>
  <div id="modeToggle" class="mode-toggle hidden">
    <button id="modeAudioText" type="button" class="mode-btn active"><span class="icon">🔊</span><span>Audio + text</span></button>
    <button id="modeTextOnly" type="button" class="mode-btn"><span class="icon">📝</span><span>Text only</span></button>
  </div>
</div>
<div id="volumeWrap" class="volume hidden"><div id="volumeBar" class="volume-bar"></div></div>
<div id="transcript" class="transcript hidden">
  <div id="transcriptEmpty" class="transcript-empty">Translated text will appear here…</div>
</div>
<p id="info" class="info hidden"></p>
</div>
<script>
(function(){
  var SECRET = ${JSON.stringify(secret)};
  var BASE = ${JSON.stringify(baseUrl)};
  var statusEl = document.getElementById('status');
  var statusText = document.getElementById('statusText');
  var volumeBar = document.getElementById('volumeBar');
  var volumeWrap = document.getElementById('volumeWrap');
  var joinBtn = document.getElementById('joinBtn');
  var infoEl = document.getElementById('info');
  var langSection = document.getElementById('langSection');
  var langList = document.getElementById('langList');
  var emptyLangs = document.getElementById('emptyLangs');
  var transcriptEl = document.getElementById('transcript');
  var transcriptEmpty = document.getElementById('transcriptEmpty');
  var modeToggle = document.getElementById('modeToggle');
  var modeAudioTextBtn = document.getElementById('modeAudioText');
  var modeTextOnlyBtn = document.getElementById('modeTextOnly');

  var audioCtx = null;
  var nextPlayTime = 0;
  var currentDc = null;
  var selectedTargetId = null;
  var availableLanguages = [];
  // Two-line teleprompter style: current (large) + previous (smaller, dim).
  var MAX_TRANSCRIPT_LINES = 2;
  var lastConnectedAt = 0;
  var currentStatus = 'idle';
  // Reload the page if we've been disconnected for this long — a hard refresh
  // recovers from any stuck state and re-runs the WebRTC handshake cleanly.
  var DISCONNECT_RELOAD_MS = 45000;
  // Listener-side modality preference: persisted across reloads.
  var PREF_KEY = 'churchhub-listener-mode';
  var listenerMode = (function() {
    try {
      var v = localStorage.getItem(PREF_KEY);
      return v === 'text_only' ? 'text_only' : 'audio_text';
    } catch(_) { return 'audio_text'; }
  })();

  // Single-line streaming model:
  //  - every incoming delta is appended to the current line (which grows /
  //    wraps within its CSS box)
  //  - after IDLE_ROLLOVER_MS of no new deltas, the current line is demoted
  //    to "previous" and the next delta starts a fresh current line.
  var IDLE_ROLLOVER_MS = 1500;
  var currentLineEl = null;
  var idleTimer = null;

  function rolloverCurrentLine() {
    if (currentLineEl) currentLineEl.classList.add('previous');
    currentLineEl = null;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  function appendTranscriptLine(text) {
    if (!text) return;
    if (transcriptEmpty && transcriptEmpty.parentNode) {
      transcriptEmpty.parentNode.removeChild(transcriptEmpty);
      transcriptEmpty = null;
    }

    if (!currentLineEl) {
      var line = document.createElement('div');
      line.className = 'transcript-line';
      line.textContent = text;
      transcriptEl.appendChild(line);
      currentLineEl = line;
      while (transcriptEl.children.length > MAX_TRANSCRIPT_LINES) {
        transcriptEl.removeChild(transcriptEl.firstChild);
      }
      requestAnimationFrame(function() {
        line.classList.add('visible');
      });
    } else {
      currentLineEl.textContent += text;
    }

    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(rolloverCurrentLine, IDLE_ROLLOVER_MS);
  }

  function clearTranscript() {
    while (transcriptEl.firstChild) transcriptEl.removeChild(transcriptEl.firstChild);
    currentLineEl = null;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    transcriptEmpty = document.createElement('div');
    transcriptEmpty.id = 'transcriptEmpty';
    transcriptEmpty.className = 'transcript-empty';
    transcriptEmpty.textContent = 'Translated text will appear here…';
    transcriptEl.appendChild(transcriptEmpty);
  }

  var LANG_NAMES = {
    ro: 'Română',
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    it: 'Italiano',
    hu: 'Magyar',
    pt: 'Português',
    ru: 'Русский',
    uk: 'Українська',
    pl: 'Polski',
    nl: 'Nederlands',
    ar: 'العربية',
    zh: '中文',
    ja: '日本語',
    ko: '한국어'
  };

  function langName(code) {
    return LANG_NAMES[code] || String(code || '').toUpperCase();
  }

  function renderLanguages() {
    while (langList.firstChild) langList.removeChild(langList.firstChild);
    if (!availableLanguages.length) {
      emptyLangs.classList.remove('hidden');
      return;
    }
    emptyLangs.classList.add('hidden');

    if (availableLanguages.length === 1 && !selectedTargetId) {
      selectedTargetId = availableLanguages[0].targetId;
      sendLanguageSelection();
    }
    if (selectedTargetId && !availableLanguages.find(function(l){return l.targetId === selectedTargetId;})) {
      selectedTargetId = null;
    }

    availableLanguages.forEach(function(lang) {
      var btn = document.createElement('button');
      btn.className = 'lang-option' + (selectedTargetId === lang.targetId ? ' selected' : '');
      btn.type = 'button';
      var codeSpan = document.createElement('span');
      codeSpan.className = 'code';
      codeSpan.textContent = String(lang.code || '').toUpperCase();
      var nameSpan = document.createElement('span');
      nameSpan.textContent = langName(lang.code);
      btn.appendChild(codeSpan);
      btn.appendChild(nameSpan);
      btn.addEventListener('click', function() {
        if (selectedTargetId !== lang.targetId) clearTranscript();
        selectedTargetId = lang.targetId;
        renderLanguages();
        sendLanguageSelection();
      });
      langList.appendChild(btn);
    });
  }

  function sendLanguageSelection() {
    if (!currentDc || currentDc.readyState !== 'open' || !selectedTargetId) return;
    try {
      currentDc.send(JSON.stringify({ type: 'select_language', targetId: selectedTargetId }));
      var lang = availableLanguages.find(function(l){return l.targetId === selectedTargetId;});
      infoEl.classList.remove('hidden');
      infoEl.textContent = 'Listening in ' + (lang ? langName(lang.code) : '');
    } catch(e) {}
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function applyListenerMode() {
    if (listenerMode === 'text_only') {
      modeAudioTextBtn.classList.remove('active');
      modeTextOnlyBtn.classList.add('active');
      volumeWrap.classList.add('hidden');
      // Silence anything pending in the audio graph
      try { if (audioCtx) audioCtx.suspend(); } catch(_) {}
    } else {
      modeTextOnlyBtn.classList.remove('active');
      modeAudioTextBtn.classList.add('active');
      volumeWrap.classList.remove('hidden');
      try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(_) {}
    }
    try { localStorage.setItem(PREF_KEY, listenerMode); } catch(_) {}
  }

  modeAudioTextBtn.addEventListener('click', function() {
    if (listenerMode === 'audio_text') return;
    listenerMode = 'audio_text';
    applyListenerMode();
  });
  modeTextOnlyBtn.addEventListener('click', function() {
    if (listenerMode === 'text_only') return;
    listenerMode = 'text_only';
    applyListenerMode();
  });

  function playPcm(base64) {
    if (listenerMode === 'text_only') return;
    if (!audioCtx || audioCtx.state === 'suspended') return;
    var raw = atob(base64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    var int16 = new Int16Array(bytes.buffer);
    var float32 = new Float32Array(int16.length);
    for (var i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    var buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    var source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    var now = audioCtx.currentTime;
    if (nextPlayTime < now) nextPlayTime = now;
    source.start(nextPlayTime);
    nextPlayTime += buffer.duration;

    var sum = 0;
    for (var i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
    var rms = Math.sqrt(sum / float32.length);
    var level = Math.min(100, Math.max(0, (20 * Math.log10(Math.max(rms, 0.000001)) + 60) / 60 * 100));
    volumeBar.style.width = level + '%';
    setTimeout(function() { volumeBar.style.width = '0%'; }, 200);
  }

  function setStatus(cls, text) {
    statusEl.className = 'status ' + cls;
    statusText.textContent = text;
    currentStatus = cls;
    if (cls === 'connected') lastConnectedAt = Date.now();
  }

  // Watchdog: once the user has joined, if we stay non-connected long enough
  // do a full page reload. Cheaper than diagnosing every WebRTC failure mode.
  function startReloadWatchdog() {
    setInterval(function() {
      if (currentStatus === 'connected') return;
      if (currentStatus === 'idle') return;
      if (!lastConnectedAt) {
        // We've never connected yet; arm the timer relative to "now" once
        lastConnectedAt = Date.now();
        return;
      }
      if (Date.now() - lastConnectedAt > DISCONNECT_RELOAD_MS) {
        window.location.reload();
      }
    }, 5000);
  }

  joinBtn.addEventListener('click', function() {
    initAudio();
    joinBtn.classList.add('hidden');
    volumeWrap.classList.remove('hidden');
    langSection.classList.remove('hidden');
    modeToggle.classList.remove('hidden');
    transcriptEl.classList.remove('hidden');
    applyListenerMode();
    renderLanguages();
    waitForRoom();
    startReloadWatchdog();
  });

  function waitForRoom() {
    setStatus('waiting', 'Waiting for host...');
    infoEl.classList.remove('hidden');
    infoEl.textContent = 'The host has not started the translation yet. Please wait...';
    console.time('listener:waitForRoom');

    // Fast poll: 500ms while waiting. Each /check is a tiny JSON round-trip
    // — cheap. The 3 s wait used to be the dominant delay on first connect.
    function checkRoom() {
      fetch(BASE + '/signal/' + SECRET + '/check')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.active) {
            console.timeEnd('listener:waitForRoom');
            connect();
          } else {
            setTimeout(checkRoom, 500);
          }
        })
        .catch(function() {
          setTimeout(checkRoom, 2000);
        });
    }
    checkRoom();
  }

  function connect() {
    setStatus('connecting', 'Connecting...');
    infoEl.textContent = 'Audio will play automatically once you pick a language.';

    var pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    var dc = pc.createDataChannel('audio');
    currentDc = dc;

    dc.onopen = function() {
      setStatus('connected', 'Connected');
      // Re-send the previously chosen language if we already have one
      sendLanguageSelection();
    };

    dc.onclose = function() {
      currentDc = null;
      pc.close();
      waitForRoom();
    };

    dc.onmessage = function(evt) {
      try {
        var msg = JSON.parse(evt.data);
        if (msg.type === 'audio') playPcm(msg.data);
        else if (msg.type === 'text') appendTranscriptLine(msg.text);
        else if (msg.type === 'ping') dc.send(JSON.stringify({ type: 'pong' }));
        else if (msg.type === 'available_languages') {
          availableLanguages = Array.isArray(msg.languages) ? msg.languages : [];
          renderLanguages();
        }
        else if (msg.type === 'secret_reset') {
          setStatus('error', 'Link expired');
          pc.close();
        }
      } catch(e) {}
    };

    pc.oniceconnectionstatechange = function() {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        pc.close();
        waitForRoom();
      }
    };

    console.time('listener:iceGather');
    console.time('listener:postOffer');
    console.time('listener:waitAnswer');
    console.time('listener:totalConnect');
    pc.createOffer().then(function(offer) {
      return pc.setLocalDescription(offer);
    }).then(function() {
      // Bail out of ICE gathering after 1.5 s — STUN candidates land in
      // <500 ms in practice; waiting longer just stalls first audio.
      return new Promise(function(resolve) {
        if (pc.iceGatheringState === 'complete') return resolve();
        var done = false;
        var finish = function(){ if (done) return; done = true; resolve(); };
        pc.onicegatheringstatechange = function() {
          if (pc.iceGatheringState === 'complete') finish();
        };
        setTimeout(finish, 1500);
      });
    }).then(function() {
      console.timeEnd('listener:iceGather');
      return fetch(BASE + '/signal/' + SECRET + '/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer: pc.localDescription.sdp })
      });
    }).then(function(res) {
      console.timeEnd('listener:postOffer');
      if (res.status === 404) { pc.close(); waitForRoom(); return; }
      if (!res.ok) throw new Error('Failed to send offer');
      return res.json();
    }).then(function(data) {
      if (!data || !data.sessionId) return;
      var sessionId = data.sessionId;
      var attempts = 0;
      // 200 ms × 60 = 12 s budget for the host to come back with its answer.
      // Local app polls offers every 500 ms and ICE-gathers in <1 s, so the
      // answer usually lands within 1.5 s.
      var maxAttempts = 60;
      function pollAnswer() {
        fetch(BASE + '/signal/' + SECRET + '/answer/' + sessionId)
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data.answer) {
              console.timeEnd('listener:waitAnswer');
              console.timeEnd('listener:totalConnect');
              pc.setRemoteDescription({ type: 'answer', sdp: data.answer });
            } else if (++attempts < maxAttempts) {
              setTimeout(pollAnswer, 200);
            } else {
              pc.close();
              waitForRoom();
            }
          })
          .catch(function() {
            pc.close();
            waitForRoom();
          });
      }
      pollAnswer();
    }).catch(function(err) {
      console.error(err);
      pc.close();
      waitForRoom();
    });
  }
})();
</script>
</body>
</html>`;
}

export default signal
