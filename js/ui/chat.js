/* =====================================================================
 * ui/chat.js — CHAT DE TEXTO DA EQUIPE (só quando há sala)
 *
 *   - Botão 💬 no canto de baixo à direita, com contador de novas.
 *   - Gaveta com as mensagens (cor e ícone do papel de quem escreveu) e a
 *     caixa de texto: Enter envia. Até 140 letras, 1 mensagem por segundo.
 *   - A gaveta vive FORA da tela que o jogo redesenha (#chat no body), para
 *     o texto que a pessoa está digitando não sumir quando o state muda.
 *   - Nada é salvo: as mensagens somem quando a sala fecha.
 * Rede: js/net/room.js (MS.net.chat / chatLog / onChat).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
  var t = MS.i18n.t, L = MS.i18n.L;
  var box = null, open = false, unread = 0, roomCode = null, lang = null;

  function info() { return MS.net ? MS.net.info() : { inRoom: false }; }
  function sc() { var s = MS.store.state; return MS.levels ? MS.levels.scenario(s) : MS.data.scenarios[s.scenarioId]; }
  function colorOf(members, id) {
    var m = (members || []).filter(function (x) { return x.id === id; })[0];
    var r = m && m.roles && m.roles.length ? MS.team.role(sc(), m.roles[0]) : null;
    return { color: MS.shouts ? MS.shouts.roleColor(r) : 'dir', role: r ? L(r.name) : '' };
  }
  function hhmm(at) {
    if (!at) return '';
    var d = new Date(at);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function build() {
    if (box || !root.document || !document.body) return box;
    box = document.createElement('div');
    box.id = 'chat';
    box.className = 'ct-wrap';
    box.hidden = true;
    box.innerHTML =
      '<section class="ct-panel" role="dialog" hidden>' +
        '<header class="ct-head"><b class="ct-title"></b><button type="button" class="ct-x"></button></header>' +
        '<ol class="ct-log" aria-live="polite"></ol>' +
        '<form class="ct-form" autocomplete="off"><input class="ct-in" type="text" enterkeyhint="send">' +
          '<button type="submit" class="btn primary ct-send"></button></form>' +
        '<p class="ct-note"></p>' +
      '</section>' +
      '<button type="button" class="ct-fab" aria-expanded="false"><span aria-hidden="true">💬</span><span class="ct-lbl"></span><span class="ct-badge" hidden></span></button>';
    document.body.appendChild(box);
    box.querySelector('.ct-fab').addEventListener('click', function () { setOpen(!open); });
    box.querySelector('.ct-x').addEventListener('click', function () { setOpen(false); });
    box.querySelector('.ct-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = box.querySelector('.ct-in'), v = inp.value;
      if (!MS.net.cleanChat(v)) return;
      if (MS.net.chat(v)) { inp.value = ''; if (MS.sfx) MS.sfx.play('tap'); }
      else if (ui.toast) ui.toast(t('chat.slow'));
      inp.focus();
    });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { setOpen(false); box.querySelector('.ct-fab').focus(); } });
    texts();
    return box;
  }
  // Textos no idioma atual (refeitos quando o idioma muda).
  function texts() {
    lang = MS.i18n.lang;
    var inp = box.querySelector('.ct-in');
    box.querySelector('.ct-panel').setAttribute('aria-label', t('chat.title'));
    box.querySelector('.ct-title').textContent = t('chat.title');
    box.querySelector('.ct-x').textContent = '×';
    box.querySelector('.ct-x').setAttribute('aria-label', t('chat.close'));
    inp.placeholder = t('chat.placeholder');
    inp.setAttribute('aria-label', t('chat.placeholder'));
    inp.maxLength = MS.net.CHAT_MAX || 140;
    box.querySelector('.ct-send').textContent = t('chat.send');
    box.querySelector('.ct-note').textContent = t('chat.note');
    box.querySelector('.ct-lbl').textContent = t('chat.open');
    drawLog();
  }

  function setOpen(v) {
    open = !!v;
    if (!box) return;
    box.querySelector('.ct-panel').hidden = !open;
    box.querySelector('.ct-fab').setAttribute('aria-expanded', String(open));
    box.classList.toggle('open', open);
    if (open) {
      unread = 0; badge();
      var log = box.querySelector('.ct-log'); log.scrollTop = log.scrollHeight;
      try { box.querySelector('.ct-in').focus({ preventScroll: true }); } catch (e) { /* ok */ }
    }
  }
  function badge() {
    var b = box.querySelector('.ct-badge');
    b.hidden = !unread;
    b.textContent = unread > 9 ? '9+' : String(unread);
    b.setAttribute('aria-label', t('chat.new', { n: unread }));
  }

  function drawLog() {
    if (!box) return;
    var inf = info(), list = MS.net.chatLog(), log = box.querySelector('.ct-log');
    var atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.innerHTML = list.length ? list.map(function (m) {
      var c = colorOf(inf.members, m.byId), mine = m.byId === inf.me;
      return '<li class="ct-m' + (mine ? ' mine' : '') + '"><span class="sh-av r-' + c.color + '">' + h.icon(c.color, { size: 16 }) + '</span>' +
        '<div class="ct-b"><span class="ct-who">' + h.esc(mine ? t('chat.you') : m.by) + (c.role ? ' · ' + h.esc(c.role) : '') + ' <time>' + hhmm(m.at) + '</time></span>' +
        '<span class="ct-x2">' + h.esc(m.x) + '</span></div></li>';
    }).join('') : '<li class="ct-empty">' + h.esc(t('chat.empty')) + '</li>';
    if (atEnd || !open) log.scrollTop = log.scrollHeight;
  }

  function onChat(m) {
    build();
    if (!box) return;
    drawLog();
    if (!m) return; // histórico ao entrar: não conta como novo
    var mine = m.byId === info().me;
    if (!mine) {
      if (MS.sfx) MS.sfx.play('chat');
      if (!open) { unread++; badge(); }
    }
  }

  // Depois de cada tela: mostra/esconde conforme a sala; zera ao trocar de sala.
  ui.chatAfter = function () {
    var on = !!(MS.net && MS.net.active() && !(MS.tutorial && MS.tutorial.active));
    if (!on && !box) return;
    build();
    if (!box) return;
    var code = on ? info().code : null;
    if (code !== roomCode) { roomCode = code; unread = 0; badge(); if (!code) setOpen(false); drawLog(); }
    if (lang !== MS.i18n.lang) texts();
    box.hidden = !on;
  };
  ui.chatOpen = function (v) { build(); setOpen(v); }; // usado nos testes

  if (MS.net) MS.net.onChat = onChat;
})(globalThis);
