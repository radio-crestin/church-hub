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
 * GET /signal/:secret/check
 * Listener checks if the room is active (host connected).
 */
signal.get('/signal/:secret/check', async (c) => {
  const secret = c.req.param('secret')
  const room = await c.env.SIGNALING_KV.get(`room:${secret}`)
  return c.json({ active: !!room })
})

/**
 * GET /listen/:secret
 * Serve the standalone listener HTML page.
 */
signal.get('/listen/:secret', async (c) => {
  const secret = c.req.param('secret')
  const baseUrl = new URL(c.req.url).origin

  // STUN is always available; TURN (needed for cellular/symmetric-NAT phones)
  // is added from the optional TURN_SERVERS env var.
  const iceServers: Array<{
    urls: string
    username?: string
    credential?: string
  }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
  if (c.env.TURN_SERVERS) {
    try {
      const turn = JSON.parse(c.env.TURN_SERVERS)
      if (Array.isArray(turn)) iceServers.push(...turn)
    } catch {
      // ignore malformed env
    }
  }

  return c.html(getListenerPageHtml(secret, baseUrl, JSON.stringify(iceServers)))
})

function getListenerPageHtml(
  secret: string,
  baseUrl: string,
  iceServersJson: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>Live Translation</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; }
  body {
    background: #000;
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    overflow: hidden;
  }

  /* Transcript: large captions, bottom-anchored, oldest lines fade out */
  .transcript {
    position: fixed; inset: 0; bottom: 0;
    display: flex; flex-direction: column; justify-content: flex-end;
    overflow: hidden;
    padding: 8vh 1.25rem calc(8.5rem + env(safe-area-inset-bottom));
  }
  .lines { width: 100%; max-width: 42rem; margin: 0 auto; }
  .lines p {
    font-size: 1.7rem; line-height: 1.38; font-weight: 500;
    margin: 0 0 1.05rem; color: #fafafa; word-wrap: break-word; overflow-wrap: break-word;
    opacity: .32; transform: translateY(4px);
    transition: opacity .3s ease, transform .3s ease;
  }
  .lines p.in { transform: translateY(0); }
  .lines p:nth-last-child(4) { opacity: .4; }
  .lines p:nth-last-child(3) { opacity: .55; }
  .lines p:nth-last-child(2) { opacity: .78; }
  .lines p:last-child { opacity: 1; }
  @media (max-width: 480px) { .lines p { font-size: 1.35rem; } }
  .placeholder { color: #52525b; font-size: 1.1rem; font-weight: 500; }

  /* Bottom dock */
  .dock {
    position: fixed; left: 0; right: 0; bottom: 0;
    display: flex; flex-direction: column; align-items: center;
    pointer-events: none;
  }
  .dock-grad {
    position: absolute; inset: 0; top: auto; height: 9rem;
    background: linear-gradient(to top, #000 30%, transparent);
  }
  .dock-inner {
    position: relative; width: 100%; max-width: 30rem;
    padding: 0 .75rem;
    padding-bottom: calc(.75rem + env(safe-area-inset-bottom));
    pointer-events: none;
  }

  .pill {
    pointer-events: auto;
    display: flex; align-items: center; gap: .25rem;
    background: rgba(24,24,27,.72); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 9999px; height: 3.5rem; padding: 0 .45rem 0 1.1rem;
  }
  .pill-info { flex: 1; min-width: 0; }
  .pill-title { margin: 0; font-size: .82rem; font-weight: 600; color: #fafafa; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pill-status { margin: .12rem 0 0; font-size: .72rem; color: #a1a1aa; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: .35rem; }
  .dot { width: .45rem; height: .45rem; border-radius: 50%; background: #71717a; flex-shrink: 0; }
  .s-connected .dot { background: #22c55e; }
  .s-connecting .dot, .s-waiting .dot { background: #3b82f6; animation: pulse 1.4s ease-in-out infinite; }
  .s-error .dot { background: #ef4444; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

  .pill-btn {
    pointer-events: auto;
    display: inline-flex; align-items: center; gap: .35rem;
    border: none; background: transparent; color: #e4e4e7;
    cursor: pointer; font-family: inherit; font-size: .85rem; font-weight: 600;
    border-radius: 9999px; transition: background .15s, color .15s, transform .1s;
  }
  .pill-btn:active { transform: scale(.95); }
  .lang-btn { height: 2.6rem; padding: 0 .5rem 0 .85rem; max-width: 9rem; }
  .lang-btn:hover { background: rgba(255,255,255,.06); }
  .lang-btn span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lang-btn svg { flex-shrink: 0; }
  .audio-btn { width: 2.7rem; height: 2.7rem; padding: 0; justify-content: center; color: #a1a1aa; }
  .audio-btn:hover { background: rgba(255,255,255,.06); color: #fafafa; }
  .audio-btn.on { background: #2563eb; color: #fff; }
  .audio-btn.on:hover { background: #1d4ed8; }

  /* Language chooser panel (above the pill) */
  .lang-panel {
    pointer-events: auto;
    margin-bottom: .55rem;
    background: rgba(24,24,27,.94); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 1.1rem; padding: .4rem; max-height: 52vh; overflow-y: auto;
  }
  .lang-head { font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; color: #71717a; font-weight: 700; padding: .5rem .75rem .35rem; }
  .lang-opt {
    display: flex; align-items: center; gap: .7rem; width: 100%;
    padding: .75rem .8rem; border: none; background: transparent; cursor: pointer;
    color: #e4e4e7; font-family: inherit; font-size: .95rem; font-weight: 500;
    border-radius: .7rem; text-align: left; transition: background .12s;
  }
  .lang-opt:hover { background: rgba(255,255,255,.05); }
  .lang-opt.selected { background: rgba(37,99,235,.22); color: #fff; }
  .lang-opt .code { font-size: .65rem; font-weight: 700; letter-spacing: .04em; padding: .2rem .45rem; border-radius: .4rem; background: rgba(255,255,255,.08); color: #a1a1aa; }
  .lang-opt.selected .code { background: rgba(255,255,255,.18); color: #fff; }
  .lang-empty { padding: .9rem .8rem; color: #71717a; font-size: .85rem; }

  .powered { text-align: center; color: #3f3f46; font-size: .68rem; font-weight: 500; margin: .55rem 0 0; pointer-events: auto; }

  .reconnect {
    position: fixed; top: 0; left: 50%; transform: translateX(-50%);
    margin-top: calc(.75rem + env(safe-area-inset-top));
    display: flex; align-items: center; gap: .5rem;
    background: rgba(24,24,27,.92); backdrop-filter: blur(10px);
    color: #a1a1aa; border-radius: 9999px; padding: .35rem .9rem;
    font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    z-index: 30; transition: opacity .25s, transform .25s;
  }
  .spinner { width: .85rem; height: .85rem; border: 2px solid rgba(255,255,255,.2); border-top-color: #a1a1aa; border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hidden { display: none !important; }
</style>
</head>
<body>
<div id="reconnecting" class="reconnect hidden"><span class="spinner"></span><span>Reconnecting</span></div>

<main id="transcript" class="transcript">
  <div id="lines" class="lines">
    <div id="placeholder" class="placeholder">Waiting for the host to start…</div>
  </div>
</main>

<div class="dock">
  <div class="dock-grad"></div>
  <div class="dock-inner">
    <div id="langPanel" class="lang-panel hidden"></div>
    <div class="pill">
      <div class="pill-info">
        <p class="pill-title">Live Translation</p>
        <p id="status" class="pill-status s-connecting"><span class="dot"></span><span id="statusText">Connecting…</span></p>
      </div>
      <button id="langBtn" class="pill-btn lang-btn" type="button" aria-haspopup="true">
        <span id="langBtnLabel">Language</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <button id="audioBtn" class="pill-btn audio-btn" type="button" aria-pressed="false" title="Turn audio on">
        <svg id="audioOffIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>
        <svg id="audioOnIcon" class="hidden" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>
      </button>
    </div>
    <p class="powered">Powered by Church Hub</p>
  </div>
</div>

<script>
(function(){
  var SECRET = ${JSON.stringify(secret)};
  var BASE = ${JSON.stringify(baseUrl)};
  var ICE_SERVERS = ${iceServersJson};

  var statusEl = document.getElementById('status');
  var statusText = document.getElementById('statusText');
  var reconnectEl = document.getElementById('reconnecting');
  var linesEl = document.getElementById('lines');
  var placeholder = document.getElementById('placeholder');
  var langPanel = document.getElementById('langPanel');
  var langBtn = document.getElementById('langBtn');
  var langBtnLabel = document.getElementById('langBtnLabel');
  var audioBtn = document.getElementById('audioBtn');
  var audioOnIcon = document.getElementById('audioOnIcon');
  var audioOffIcon = document.getElementById('audioOffIcon');

  var audioCtx = null;
  var nextPlayTime = 0;
  var currentPc = null;
  var currentDc = null;
  var selectedTargetId = null;
  var availableLanguages = [];
  var lastConnectedAt = 0;
  var currentStatus = 'connecting';
  var DISCONNECT_RELOAD_MS = 45000;

  // Audio is OFF by default; text streams regardless. The choice is persisted,
  // but a fresh visitor always starts muted.
  var AUDIO_PREF = 'churchhub-audio';
  var audioEnabled = (function(){ try { return localStorage.getItem(AUDIO_PREF) === 'on'; } catch(_) { return false; } })();

  var LANG_NAMES = {
    ro:'Română', en:'English', de:'Deutsch', fr:'Français', es:'Español',
    it:'Italiano', hu:'Magyar', pt:'Português', ru:'Русский', uk:'Українська',
    pl:'Polski', nl:'Nederlands', ar:'العربية', zh:'中文', ja:'日本語', ko:'한국어'
  };
  function langName(code){ return LANG_NAMES[code] || String(code || '').toUpperCase(); }

  // ---- Status -------------------------------------------------------------
  function setStatus(cls, text){
    statusEl.className = 'pill-status s-' + cls;
    statusText.textContent = text;
    currentStatus = cls;
    if (cls === 'connected') lastConnectedAt = Date.now();
    var reconnecting = (cls === 'connecting' || cls === 'waiting' || cls === 'error');
    reconnectEl.classList.toggle('hidden', !(reconnecting && lastConnectedAt > 0));
  }

  // ---- Transcript (one line per utterance, oldest fade out) ---------------
  var MAX_LINES = 12;
  var lineEls = {};
  var lineOrder = [];

  function hidePlaceholder(){
    if (placeholder && placeholder.parentNode) { placeholder.parentNode.removeChild(placeholder); placeholder = null; }
  }
  function scrollToNewest(){ document.getElementById('transcript').scrollTop = 1e9; }

  function pushText(entryId, text, action){
    if (!text) return;
    hidePlaceholder();
    var el = lineEls[entryId];
    if (action === 'add' || !el) {
      el = document.createElement('p');
      el.textContent = text;
      linesEl.appendChild(el);
      lineEls[entryId] = el;
      lineOrder.push(entryId);
      requestAnimationFrame(function(){ el.classList.add('in'); });
      while (lineOrder.length > MAX_LINES) {
        var oldId = lineOrder.shift();
        if (lineEls[oldId]) { try { linesEl.removeChild(lineEls[oldId]); } catch(_){} delete lineEls[oldId]; }
      }
    } else {
      el.textContent += text;
    }
    scrollToNewest();
  }

  function clearTranscript(){
    while (linesEl.firstChild) linesEl.removeChild(linesEl.firstChild);
    lineEls = {}; lineOrder = [];
    placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Translated text will appear here…';
    linesEl.appendChild(placeholder);
  }

  // ---- Languages ----------------------------------------------------------
  function updateLangButton(){
    var lang = availableLanguages.find(function(l){ return l.targetId === selectedTargetId; });
    langBtnLabel.textContent = lang ? langName(lang.code) : 'Language';
  }

  function renderLanguages(){
    while (langPanel.firstChild) langPanel.removeChild(langPanel.firstChild);
    var head = document.createElement('div');
    head.className = 'lang-head';
    head.textContent = 'Select your language';
    langPanel.appendChild(head);

    if (!availableLanguages.length) {
      var empty = document.createElement('div');
      empty.className = 'lang-empty';
      empty.textContent = 'Waiting for the host to publish languages…';
      langPanel.appendChild(empty);
      updateLangButton();
      return;
    }

    if (availableLanguages.length === 1 && !selectedTargetId) {
      selectedTargetId = availableLanguages[0].targetId;
      sendLanguageSelection();
    }
    if (selectedTargetId && !availableLanguages.find(function(l){ return l.targetId === selectedTargetId; })) {
      selectedTargetId = null;
    }

    availableLanguages.forEach(function(lang){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-opt' + (selectedTargetId === lang.targetId ? ' selected' : '');
      var code = document.createElement('span');
      code.className = 'code';
      code.textContent = String(lang.code || '').toUpperCase();
      var name = document.createElement('span');
      name.textContent = langName(lang.code);
      btn.appendChild(code); btn.appendChild(name);
      btn.addEventListener('click', function(){
        if (selectedTargetId !== lang.targetId) clearTranscript();
        selectedTargetId = lang.targetId;
        renderLanguages();
        sendLanguageSelection();
        langPanel.classList.add('hidden');
      });
      langPanel.appendChild(btn);
    });
    updateLangButton();
  }

  function sendLanguageSelection(){
    if (!currentDc || currentDc.readyState !== 'open' || !selectedTargetId) return;
    try { currentDc.send(JSON.stringify({ type: 'select_language', targetId: selectedTargetId })); } catch(e) {}
  }

  langBtn.addEventListener('click', function(){ langPanel.classList.toggle('hidden'); });
  document.addEventListener('click', function(e){
    if (langPanel.classList.contains('hidden')) return;
    if (!langPanel.contains(e.target) && !langBtn.contains(e.target)) langPanel.classList.add('hidden');
  });

  // ---- Audio (off by default) --------------------------------------------
  function initAudio(){
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 }); } catch(_) { return; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function applyAudioState(){
    audioBtn.classList.toggle('on', audioEnabled);
    audioBtn.setAttribute('aria-pressed', audioEnabled ? 'true' : 'false');
    audioBtn.title = audioEnabled ? 'Turn audio off' : 'Turn audio on';
    audioOnIcon.classList.toggle('hidden', !audioEnabled);
    audioOffIcon.classList.toggle('hidden', audioEnabled);
  }
  function setAudio(on){
    audioEnabled = on;
    try { localStorage.setItem(AUDIO_PREF, on ? 'on' : 'off'); } catch(_) {}
    applyAudioState();
    if (on) initAudio();
    else { try { if (audioCtx) audioCtx.suspend(); } catch(_) {} }
  }
  audioBtn.addEventListener('click', function(){ setAudio(!audioEnabled); });
  // A persisted "on" needs a user gesture after load to actually resume audio.
  document.addEventListener('pointerdown', function(){
    if (audioEnabled && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }, { passive: true });

  function playPcm(base64){
    if (!audioEnabled) return;
    if (!audioCtx || audioCtx.state !== 'running') return;
    var raw = atob(base64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    var int16 = new Int16Array(bytes.buffer);
    var float32 = new Float32Array(int16.length);
    for (var j = 0; j < int16.length; j++) float32[j] = int16[j] / 32768;
    var buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    var source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    var now = audioCtx.currentTime;
    if (nextPlayTime < now) nextPlayTime = now;
    source.start(nextPlayTime);
    nextPlayTime += buffer.duration;
  }

  // ---- WebRTC connection --------------------------------------------------
  function waitForRoom(){
    setStatus('waiting', 'Waiting for host…');
    function checkRoom(){
      fetch(BASE + '/signal/' + SECRET + '/check')
        .then(function(res){ return res.json(); })
        .then(function(data){ if (data.active) connect(); else setTimeout(checkRoom, 500); })
        .catch(function(){ setTimeout(checkRoom, 2000); });
    }
    checkRoom();
  }

  function connect(){
    setStatus('connecting', 'Connecting…');

    var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    currentPc = pc;
    var dc = pc.createDataChannel('audio');
    currentDc = dc;

    dc.onopen = function(){
      setStatus('connected', 'Live');
      sendLanguageSelection();
    };
    dc.onclose = function(){ currentDc = null; pc.close(); waitForRoom(); };
    dc.onmessage = function(evt){
      try {
        var msg = JSON.parse(evt.data);
        if (msg.type === 'audio') playPcm(msg.data);
        else if (msg.type === 'text') pushText(msg.entryId, msg.text, msg.action);
        else if (msg.type === 'ping') dc.send(JSON.stringify({ type: 'pong' }));
        else if (msg.type === 'available_languages') {
          availableLanguages = Array.isArray(msg.languages) ? msg.languages : [];
          renderLanguages();
        }
        else if (msg.type === 'secret_reset') { setStatus('error', 'Link expired'); pc.close(); }
      } catch(e) {}
    };

    pc.oniceconnectionstatechange = function(){
      var s = pc.iceConnectionState;
      if (s === 'checking') setStatus('connecting', 'Connecting…');
      else if (s === 'disconnected') setStatus('connecting', 'Reconnecting…');
      else if (s === 'failed') setStatus('error', 'Could not connect - network may be blocking it');
      if (s === 'disconnected' || s === 'failed') { pc.close(); waitForRoom(); }
    };

    pc.createOffer().then(function(offer){
      return pc.setLocalDescription(offer);
    }).then(function(){
      // STUN candidates arrive fast; cap the wait so first text isn't delayed.
      return new Promise(function(resolve){
        if (pc.iceGatheringState === 'complete') return resolve();
        var done = false;
        var finish = function(){ if (done) return; done = true; resolve(); };
        pc.onicegatheringstatechange = function(){ if (pc.iceGatheringState === 'complete') finish(); };
        setTimeout(finish, 1500);
      });
    }).then(function(){
      return fetch(BASE + '/signal/' + SECRET + '/offer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer: pc.localDescription.sdp })
      });
    }).then(function(res){
      if (res.status === 404) { pc.close(); waitForRoom(); return; }
      if (!res.ok) throw new Error('offer failed');
      return res.json();
    }).then(function(data){
      if (!data || !data.sessionId) return;
      var sessionId = data.sessionId, attempts = 0, maxAttempts = 60;
      function pollAnswer(){
        fetch(BASE + '/signal/' + SECRET + '/answer/' + sessionId)
          .then(function(res){ return res.json(); })
          .then(function(data){
            if (data.answer) pc.setRemoteDescription({ type: 'answer', sdp: data.answer });
            else if (++attempts < maxAttempts) setTimeout(pollAnswer, 200);
            else { pc.close(); waitForRoom(); }
          })
          .catch(function(){ pc.close(); waitForRoom(); });
      }
      pollAnswer();
    }).catch(function(){ pc.close(); waitForRoom(); });
  }

  // Watchdog: a hard reload recovers from any stuck WebRTC state.
  function startReloadWatchdog(){
    setInterval(function(){
      if (currentStatus === 'connected') return;
      if (!lastConnectedAt) { lastConnectedAt = Date.now(); return; }
      if (Date.now() - lastConnectedAt > DISCONNECT_RELOAD_MS) window.location.reload();
    }, 5000);
  }

  // ---- Start (auto-connect, text streams immediately) ---------------------
  applyAudioState();
  if (audioEnabled) initAudio();
  renderLanguages();
  waitForRoom();
  startReloadWatchdog();
})();
</script>
</body>
</html>`;
}

export default signal
