/* =====================================================================
 * ui/sfx.js — SONS DO JOGO (gerados na hora com WebAudio, sem arquivos)
 *
 *   MS.sfx.play(nome)     toca um som:
 *     tap      toque leve em qualquer botão
 *     tick     um entalhe do botão giratório / alavanca (sobe com o índice)
 *     confirm  "tum" do CONFIRMAR
 *     flip     "whoosh" da carta virando
 *     phase    toque curto na abertura de cada fase
 *     warn     algo ficou vermelho no painel
 *     count    bipe da contagem regressiva (go = último, mais agudo)
 *     liftoff  ronco do motor crescendo e sumindo
 *     abort    sirene do lançamento cancelado
 *     star     "plim" de uma estrela (o 2º argumento sobe a nota)
 *     fanfare  3 estrelas
 *     fail     missão perdida (notas descendo)
 *     beep     bipe de rádio (frequência no 2º argumento)
 *   MS.sfx.muted() · MS.sfx.toggle()   um só botão 🔊/🔇 para o jogo todo
 *
 * O mudo é o mesmo de antes (ui.local.shoutMute, guardado no aparelho),
 * então os gritos da equipe e o alerta da missão obedecem ao mesmo botão.
 * O navegador só libera áudio depois do primeiro toque: o contexto é
 * criado nesse momento.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var MUTE_KEY = 'missionSim.shoutMute';
  var ac = null, master = null, noiseBuf = null;

  function local() { return (MS.ui && MS.ui.local) || {}; }
  (function initMute() {
    var l = local();
    if ('shoutMute' in l) return;
    try { l.shoutMute = root.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { l.shoutMute = false; }
  })();
  function muted() { return !!local().shoutMute; }

  function ctx() {
    if (muted()) return null;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!ac) {
        ac = new AC();
        master = ac.createGain(); master.gain.value = 0.9;
        var comp = ac.createDynamicsCompressor ? ac.createDynamicsCompressor() : null;
        if (comp) { master.connect(comp); comp.connect(ac.destination); } else master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
    return ac;
  }

  // Uma nota com envelope rápido (ataque → queda exponencial).
  function tone(f, opt) {
    var c = ctx(); if (!c) return;
    opt = opt || {};
    var t0 = c.currentTime + (opt.at || 0), len = opt.len || 0.08, vol = opt.vol || 0.06;
    var o = c.createOscillator(), g = c.createGain();
    o.type = opt.type || 'triangle';
    o.frequency.setValueAtTime(f, t0);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + len);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, len / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + len + 0.03);
  }
  function noise() {
    if (noiseBuf) return noiseBuf;
    var n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // ruído marrom
    return (noiseBuf = b);
  }
  // Ruído filtrado com envelope: whoosh e ronco do motor.
  function rush(opt) {
    var c = ctx(); if (!c) return;
    var t0 = c.currentTime + (opt.at || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noise(); src.loop = true;
    f.type = opt.filter || 'lowpass';
    f.frequency.setValueAtTime(opt.f0, t0);
    f.frequency.exponentialRampToValueAtTime(opt.f1 || opt.f0, t0 + (opt.sweep || opt.len));
    f.Q.value = opt.q || 0.8;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opt.vol, t0 + opt.up);
    if (opt.hold) g.gain.setValueAtTime(opt.vol, t0 + opt.up + opt.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.len);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + opt.len + 0.05);
  }

  var SOUNDS = {
    tap: function () { tone(1250, { len: 0.035, vol: 0.025, type: 'sine' }); },
    tick: function (i) { tone(520 + (i || 0) * 40, { len: 0.06 }); },
    confirm: function () { tone(180, { len: 0.2, vol: 0.09, to: 120 }); tone(660, { at: 0.06, len: 0.12, vol: 0.05 }); tone(990, { at: 0.13, len: 0.16, vol: 0.04, type: 'sine' }); },
    flip: function () { rush({ filter: 'bandpass', f0: 500, f1: 3200, q: 1.2, vol: 0.22, up: 0.12, len: 0.42, sweep: 0.35 }); tone(620, { at: 0.3, len: 0.07, vol: 0.03 }); },
    phase: function () { [523, 659, 784].forEach(function (f, k) { tone(f, { at: k * 0.1, len: 0.22, vol: 0.05, type: 'sine' }); }); },
    warn: function () { tone(440, { len: 0.12, vol: 0.05, type: 'square' }); tone(330, { at: 0.13, len: 0.18, vol: 0.05, type: 'square' }); },
    count: function (go) { tone(go ? 1180 : 740, { len: go ? 0.45 : 0.14, vol: 0.06, type: 'square' }); },
    liftoff: function () {
      rush({ f0: 120, f1: 520, vol: 0.5, up: 1.4, hold: 3.2, len: 8, sweep: 4 });
      rush({ filter: 'bandpass', f0: 900, f1: 2400, q: 0.6, vol: 0.08, up: 0.6, hold: 2, len: 5, sweep: 3 });
    },
    abort: function () { for (var k = 0; k < 3; k++) { tone(440, { at: k * 0.5, len: 0.24, vol: 0.06, type: 'sawtooth', to: 330 }); tone(330, { at: k * 0.5 + 0.25, len: 0.24, vol: 0.06, type: 'sawtooth', to: 260 }); } },
    star: function (k) { var f = 880 * Math.pow(1.26, k || 0); tone(f, { len: 0.5, vol: 0.06, type: 'sine' }); tone(f * 2, { len: 0.25, vol: 0.02, type: 'sine' }); },
    fanfare: function () { [523, 659, 784, 1047].forEach(function (f, k) { tone(f, { at: k * 0.12, len: k === 3 ? 0.7 : 0.18, vol: 0.06, type: 'triangle' }); }); },
    fail: function () { [392, 330, 262].forEach(function (f, k) { tone(f, { at: k * 0.22, len: 0.3, vol: 0.06, type: 'triangle' }); }); },
    beep: function (f) { tone(f || 880, { len: 0.14, vol: 0.08, type: 'square' }); }
  };

  function play(name, arg) {
    if (muted() || !SOUNDS[name]) return;
    try { SOUNDS[name](arg); } catch (e) { /* sem som */ }
  }
  function toggle() {
    var l = local();
    l.shoutMute = !l.shoutMute;
    try { root.localStorage.setItem(MUTE_KEY, l.shoutMute ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
    if (l.shoutMute && ac && ac.suspend) { try { ac.suspend(); } catch (e) { /* ok */ } }
    if (!l.shoutMute) play('tap');
    return !l.shoutMute;
  }

  // Depois de cada tela: alerta quando aumenta o vermelho no painel e
  // estrelas no relatório (uma vez por tentativa).
  var lastFail = null, lastPhase = null, starsKey = null;
  function after(rootEl, state) {
    if (!rootEl || !rootEl.querySelectorAll || !state) return;
    var fails = rootEl.querySelectorAll('.hud .hud-card.s-fail').length;
    if (lastPhase === state.phase && lastFail != null && fails > lastFail) play('warn');
    lastFail = fails; lastPhase = state.phase;
    var st = rootEl.querySelector('.rep-stars');
    var key = st ? state.scenarioId + '|' + state.attempt : null;
    if (st && key !== starsKey) {
      starsKey = key;
      var n = Number((st.className.match(/n-(\d)/) || [])[1]) || 0;
      if (!n) { setTimeout(function () { play('fail'); }, 400); return; }
      for (var k = 1; k <= n; k++) (function (k) { setTimeout(function () { play('star', k - 1); }, (0.25 + k * 0.3) * 1000 + 150); })(k);
      if (n === 3) setTimeout(function () { play('fanfare'); }, 1500);
    } else if (!st) starsKey = null;
  }

  // Toque leve em qualquer botão do jogo (os controles com som próprio ficam de fora).
  var OWN = { 'scene-turn': 1, 'scene-pick': 1, 'scene-confirm': 1, 'req-flip': 1, 'sfx-mute': 1, 'shout-mute': 1 };
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('button, [role="button"], summary');
      if (!b || b.disabled) return;
      if (b.dataset && OWN[b.dataset.action]) return;
      play('tap');
    }, true);
  }

  MS.sfx = { play: play, muted: muted, toggle: toggle, after: after };
})(globalThis);
