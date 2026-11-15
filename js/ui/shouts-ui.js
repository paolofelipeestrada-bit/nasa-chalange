/* =====================================================================
 * ui/shouts-ui.js — GRITOS DA EQUIPE na tela (só no modo equipe)
 *
 *   - Botão "Gritar" (canto de baixo): pedir a peça que falta para quem
 *     cuida dela, avisar de um recurso no vermelho, frases rápidas e
 *     "Todos prontos para lançar?".
 *   - Quem recebe vê um alerta GRANDE com o nome e a cor de quem gritou,
 *     ouve um bipe e a tela treme. Se o pedido é para o seu papel, o
 *     alerta fica vermelho com "PARA VOCÊ".
 *   - "Todos prontos?": cada um responde Pronto/Espera; a contagem aparece
 *     para todos (não bloqueia o lançamento: é conversa de equipe).
 * Regras: js/net/shouts.js · rede: js/net/room.js · frases: js/data/shouts.js
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
  var t = MS.i18n.t, L = MS.i18n.L;
  var local = ui.local;
  var MUTE_KEY = 'missionSim.shoutMute';
  if (!('shoutOpen' in local)) local.shoutOpen = false;
  try { local.shoutMute = root.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { local.shoutMute = false; }

  function rerender() { if (MS.store.state) ui.render(MS.store.state); }
  function sc() { var s = MS.store.state; return MS.levels ? MS.levels.scenario(s) : MS.data.scenarios[s.scenarioId]; }
  function info() { return MS.net ? MS.net.info() : { inRoom: false }; }
  function memberRole(members, id) {
    var m = (members || []).filter(function (x) { return x.id === id; })[0];
    var r = m && m.roles && m.roles.length ? MS.team.role(sc(), m.roles[0]) : null;
    return r;
  }

  // ------------------------------------------------------------- Painel
  function readyBar(inf) {
    var rd = inf.ready;
    if (!rd) return '';
    var ans = rd.answers || {}, members = inf.members || [];
    var yes = members.filter(function (m) { return ans[m.id] === true; }).length;
    var who = members.map(function (m) {
      var a = ans[m.id], cls = a === true ? 'ok' : a === false ? 'no' : 'wait';
      return '<span class="rd-p rd-' + cls + '" title="' + h.esc(m.name) + '">' + h.icon(a === true ? 'ok' : a === false ? 'warn' : 'pending', { size: 13, stroke: 2.6 }) + h.esc(m.name) + '</span>';
    }).join('');
    var mine = ans[inf.me];
    var btns = mine === undefined
      ? '<button type="button" class="btn small primary" data-action="ready-yes">' + h.esc(L(MS.data.shouts.ready.yes)) + '</button>' +
        '<button type="button" class="btn small" data-action="ready-no">' + h.esc(L(MS.data.shouts.ready.no)) + '</button>'
      : '';
    return '<div class="rd-bar' + (yes === members.length ? ' all' : '') + '"><b>' + h.esc(L(MS.data.shouts.ready.ask)) + '</b>' +
      '<span class="rd-count">' + h.esc(t('shout.readyCount', { n: yes, total: members.length })) + '</span>' +
      '<span class="rd-people">' + who + '</span>' + btns + '</div>';
  }

  function shoutBtn(o, label, extra) {
    var s = o.shout;
    return '<button type="button" class="sh-b' + (extra || '') + '" data-action="shout" data-sid="' + h.esc(s.id) + '"' +
      (s.to ? ' data-to="' + h.esc(s.to) + '" data-slot="' + h.esc(s.slot) + '"' : '') + '>' + label + '</button>';
  }

  ui.shoutDock = function (state, result) {
    if (!MS.net || !MS.net.active() || !MS.shouts || (MS.tutorial && MS.tutorial.active)) return '';
    var inf = info(), s = sc();
    var panel = '';
    if (local.shoutOpen) {
      var opts = MS.shouts.options(s, state, result, inf.members, inf.me);
      var asks = opts.filter(function (o) { return o.kind === 'ask'; }).map(function (o) {
        var r = MS.team.role(s, o.shout.to), holder = MS.team.holder(inf.members, o.shout.to);
        var col = MS.shouts.roleColor(r);
        return shoutBtn(o, '<span class="sh-dot r-' + col + '">' + h.icon(col, { size: 14 }) + '</span>' + h.esc(MS.shouts.text(s, o.shout)) +
          (holder ? '' : ' <span class="muted small">(' + h.esc(t('ui.free')) + ')</span>'), ' sh-ask');
      }).join('');
      var alerts = opts.filter(function (o) { return o.kind === 'alert'; }).map(function (o) {
        return shoutBtn(o, h.icon('warn', { size: 15 }) + h.esc(MS.shouts.text(s, o.shout)), o.hot ? ' sh-hot' : ' sh-warm');
      }).join('');
      var team = opts.filter(function (o) { return o.kind === 'team'; }).map(function (o) {
        return shoutBtn(o, h.icon(o.icon || 'team', { size: 15 }) + h.esc(MS.shouts.text(s, o.shout)), '');
      }).join('');
      var launchSoon = state.phase === 'build';
      panel = '<div class="sh-panel" role="dialog" aria-label="' + h.esc(t('shout.title')) + '">' +
        '<div class="sh-head"><b>' + h.esc(t('shout.title')) + '</b><button type="button" class="sh-mute" data-action="shout-mute" title="' + h.esc(t(local.shoutMute ? 'shout.soundOn' : 'shout.soundOff')) + '">' + (local.shoutMute ? '🔇' : '🔊') + '</button></div>' +
        '<button type="button" class="sh-b sh-ready' + (launchSoon ? ' soon' : '') + '" data-action="ready-ask">' + h.icon('rocket', { size: 16 }) + h.esc(L(MS.data.shouts.ready.ask)) + '</button>' +
        (asks ? '<h4>' + h.esc(t('shout.ask')) + '</h4><div class="sh-list">' + asks + '</div>' : '') +
        (alerts ? '<h4>' + h.esc(t('shout.alerts')) + '</h4><div class="sh-list">' + alerts + '</div>' : '') +
        '<h4>' + h.esc(t('shout.team')) + '</h4><div class="sh-list sh-grid">' + team + '</div></div>';
    }
    return '<div class="sh-dock">' + readyBar(inf) + panel +
      '<button type="button" class="sh-main' + (local.shoutOpen ? ' on' : '') + '" data-action="shout-toggle" aria-expanded="' + !!local.shoutOpen + '">' +
      '<span aria-hidden="true">📣</span>' + h.esc(t(local.shoutOpen ? 'shout.close' : 'shout.open')) + '</button></div>';
  };

  Object.assign(ui.actions, {
    'shout-toggle': function () { local.shoutOpen = !local.shoutOpen; unlockAudio(); rerender(); },
    'shout-mute': function () {
      local.shoutMute = !local.shoutMute;
      try { root.localStorage.setItem(MUTE_KEY, local.shoutMute ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
      rerender();
    },
    shout: function (d) {
      unlockAudio();
      var sh = { id: d.sid };
      if (d.to) { sh.to = d.to; sh.slot = d.slot; }
      if (MS.net.shout(sh)) { ui.toast('📣 ' + t('shout.sent', { text: MS.shouts.text(sc(), sh) })); local.shoutOpen = false; rerender(); }
      else ui.toast(t('shout.slow'));
    },
    'ready-ask': function () { unlockAudio(); MS.net.askReady(); local.shoutOpen = false; rerender(); },
    'ready-yes': function () { MS.net.answerReady(true); },
    'ready-no': function () { MS.net.answerReady(false); }
  });

  // --------------------------------------------------- Alerta grande
  var audio = null;
  function unlockAudio() {
    if (audio || local.shoutMute) return;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try { audio = new AC(); } catch (e) { audio = null; }
  }
  // Bipe de rádio: 2 notas (3 e mais alto quando é para você).
  function beep(strong) {
    if (local.shoutMute) return;
    unlockAudio();
    if (!audio) return;
    try {
      if (audio.state === 'suspended') audio.resume();
      var notes = strong ? [880, 660, 880] : [660, 880], t0 = audio.currentTime;
      notes.forEach(function (f, i) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + i * 0.13);
        g.gain.exponentialRampToValueAtTime(strong ? 0.12 : 0.07, t0 + i * 0.13 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.13 + 0.11);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + i * 0.13); o.stop(t0 + i * 0.13 + 0.12);
      });
    } catch (e) { /* sem som */ }
  }
  function shake() {
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !document.body) return;
    document.body.classList.remove('sh-shake'); void document.body.offsetWidth;
    document.body.classList.add('sh-shake');
    setTimeout(function () { document.body.classList.remove('sh-shake'); }, 500);
  }
  function stack() {
    var box = document.getElementById('shouts');
    if (!box) { box = document.createElement('div'); box.id = 'shouts'; box.setAttribute('aria-live', 'assertive'); document.body.appendChild(box); }
    return box;
  }
  function banner(opts) {
    if (!document.body) return null;
    var box = stack(), el = document.createElement('div');
    el.className = 'sh-alert' + (opts.forMe ? ' for-me' : '') + (opts.ready ? ' is-ready' : '');
    el.innerHTML = '<span class="sh-av r-' + opts.color + '">' + h.icon(opts.color, { size: 26 }) + '</span>' +
      '<div class="sh-body"><span class="sh-who">' + h.esc(opts.who) + (opts.forMe ? ' <em>' + h.esc(t('shout.forYou')) + '</em>' : '') + '</span>' +
      '<span class="sh-text">' + h.esc(opts.text) + '</span>' + (opts.extra || '') + '</div>' +
      '<button type="button" class="sh-x" aria-label="' + h.esc(t('ui.close')) + '">×</button>';
    el.querySelector('.sh-x').addEventListener('click', function () { el.remove(); });
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { el.remove(); }, opts.ms || 5000);
    return el;
  }

  function onShout(msg) {
    var inf = info(), s = sc(), sh = MS.shouts.clean(s, msg.s);
    if (!sh) return;
    var r = memberRole(inf.members, msg.byId), color = MS.shouts.roleColor(r);
    var me = MS.shouts.forMe(s, sh, inf.members, inf.me);
    banner({ who: t('shout.yelled', { name: msg.by }) + (r ? ' · ' + L(r.name) : ''), text: MS.shouts.text(s, sh), color: color, forMe: me, ms: me ? 7000 : 5000 });
    beep(me); shake();
  }

  var lastRound = 0;
  function onReady(rd) {
    if (!rd) { lastRound = 0; return; }
    if (rd.round === lastRound) return;
    lastRound = rd.round;
    var inf = info();
    if (rd.byId === inf.me) return;
    var r = memberRole(inf.members, rd.byId), el;
    el = banner({ who: t('shout.yelled', { name: rd.by }) + (r ? ' · ' + L(r.name) : ''), text: L(MS.data.shouts.ready.ask), color: MS.shouts.roleColor(r), ready: true, ms: 12000,
      extra: '<span class="sh-acts"><button type="button" class="btn small primary" data-r="1">' + h.esc(L(MS.data.shouts.ready.yes)) + '</button>' +
        '<button type="button" class="btn small" data-r="0">' + h.esc(L(MS.data.shouts.ready.no)) + '</button></span>' });
    if (el) el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]');
      if (!b) return;
      MS.net.answerReady(b.dataset.r === '1');
      el.remove();
    });
    beep(true); shake();
  }

  // O primeiro clique na página libera o som (regra dos navegadores).
  if (root.document) document.addEventListener('pointerdown', function first() { unlockAudio(); document.removeEventListener('pointerdown', first); });
  if (MS.net) { MS.net.onShout = onShout; MS.net.onReady = onReady; }
  ui.shoutBanner = banner; // usado nos testes da tela
})(globalThis);
