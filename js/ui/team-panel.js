/* =====================================================================
 * ui/team-panel.js — PAINEL DA EQUIPE (multiplayer) e avisos na tela
 *
 * Mostra: criar/entrar numa sala, código da sala, membros e papéis.
 * Os papéis vêm de scenario.team.roles; a rede fica em js/net/room.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
  var t = MS.i18n.t, L = MS.i18n.L;
  var NAME_KEY = 'missionSim.name';
  var local = ui.local = ui.local || { teamOpen: false };

  function savedName() { try { return root.localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function saveName(n) { try { root.localStorage.setItem(NAME_KEY, n); } catch (e) { /* sem armazenamento */ } }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function rerender() { if (MS.store.state) ui.render(MS.store.state); }
  function maxPlayers(sc) { return (sc.team && sc.team.maxPlayers) || 4; }

  // ----------------------------------------------------------------- Painel
  ui.teamPanel = function (state) {
    if (!MS.net) return '';
    var info = MS.net.info(), sc = h.scenario(state);
    if (!info.inRoom && !local.teamOpen) return '';
    var err = info.error ? '<div class="alert s-fail small">' + h.esc(info.error) + '</div>' : '';

    if (!info.inRoom) {
      return '<div class="card team"><div class="row-head"><h2>' + h.esc(t('ui.playTeam')) + '</h2>' +
        '<button type="button" class="btn small" data-action="team-toggle">' + h.esc(t('ui.close')) + '</button></div>' +
        '<p class="small muted">' + h.esc(t('team.intro', { n: maxPlayers(sc) })) + '</p>' +
        '<ol class="team-steps"><li>' + h.esc(t('team.step1')) + '</li>' +
        '<li>' + h.esc(t('team.step2')) + '</li>' +
        '<li>' + h.esc(t('team.step3')) + '</li>' +
        '<li>' + h.esc(t('team.step4')) + '</li></ol>' + err +
        (MS.net.available() ? '' : '<div class="alert s-warn small">' + h.esc(t('team.needsNet')) + '</div>') +
        '<div class="team-form"><label>' + h.esc(t('team.yourName')) + ' <input id="team-name" maxlength="24" autocomplete="nickname" value="' + h.esc(savedName()) + '"></label>' +
        '<button type="button" class="btn primary" data-action="team-host">' + h.esc(t('team.create')) + '</button>' +
        '<span class="muted small">' + h.esc(t('team.or')) + '</span>' +
        '<label>' + h.esc(t('team.code')) + ' <input id="team-code" maxlength="6" placeholder="ABC123" autocomplete="off" style="text-transform:uppercase"></label>' +
        '<button type="button" class="btn" data-action="team-join">' + h.esc(t('team.join')) + '</button></div></div>';
    }

    if (info.status !== 'online') {
      return '<div class="card team"><div class="row-head"><span>' + h.esc(t('team.connecting')) + ' <strong class="code">' + h.esc(info.code) + '</strong>…</span>' +
        '<button type="button" class="btn small" data-action="team-leave">' + h.esc(t('team.cancel')) + '</button></div>' + err + '</div>';
    }

    var lead = MS.team.leader(sc, info.members);
    var me = MS.team.member(info.members, info.me) || { roles: [] };
    var mine = me.roles.map(function (id) { var r = MS.team.role(sc, id); return r ? L(r.name) : id; });
    var head = '<div class="row-head"><div><h2>' + h.esc(t('team.room')) + ' <span class="code">' + h.esc(info.code) + '</span></h2>' +
      '<span class="small muted"><span class="seats">' + h.esc(t('team.seats', { n: info.members.length, max: maxPlayers(sc) })) + '</span> · ' + h.esc(t('team.you')) + ' ' + h.esc(info.myName) +
      ' (' + h.esc(mine.length ? mine.join(', ') : t('team.noRole')) + ')' + (info.isHost ? ' · ' + h.esc(t('team.host')) : '') + '</span></div>' +
      '<div class="actions"><button type="button" class="btn small" data-action="team-toggle">' + h.esc(local.teamOpen ? t('team.collapse') : t('team.see')) + '</button>' +
      '<button type="button" class="btn small" data-action="team-leave">' + h.esc(t('team.leave')) + '</button></div></div>';
    if (!local.teamOpen) return '<div class="card team compact">' + head + '</div>';

    var roles = MS.team.roles(sc).map(function (r) {
      var who = MS.team.holder(info.members, r.id), isMine = who && who.id === info.me;
      var slots = (r.slots || []).map(function (sid) {
        var s = sc.slots.filter(function (x) { return x.id === sid; })[0];
        return s ? L(s.label) : sid;
      }).join(', ');
      var btn = isMine ? '<button type="button" class="btn small" data-action="team-role" data-role="' + h.esc(r.id) + '">' + h.esc(t('team.drop')) + '</button>'
        : who ? '<span class="small muted">' + h.esc(t('team.with', { name: who.name })) + '</span>'
          : '<button type="button" class="btn small primary" data-action="team-role" data-role="' + h.esc(r.id) + '">' + h.esc(t('team.take')) + '</button>';
      return '<div class="role' + (isMine ? ' mine' : '') + '"><div class="row-head"><strong>' + h.esc(L(r.name)) + '</strong>' + btn + '</div>' +
        '<div class="small">' + h.esc(L(r.description) || '') + '</div>' +
        '<div class="small muted">' + h.esc(t('team.handles', { list: slots })) + (r.canAdvance ? ' · ' + h.esc(t('team.leads')) : '') + '</div></div>';
    }).join('');
    var people = info.members.map(function (m) {
      var rn = (m.roles || []).map(function (id) { var r = MS.team.role(sc, id); return r ? L(r.name) : id; });
      return '<li>' + h.esc(m.name) + (m.id === info.me ? ' <span class="muted">(' + h.esc(t('team.youShort')) + ')</span>' : '') +
        (m.host ? ' <span class="muted">· ' + h.esc(t('team.host')) + '</span>' : '') + ' — <span class="small">' + h.esc(rn.join(', ') || t('team.noRole')) + '</span></li>';
    }).join('');
    return '<div class="card team">' + head + err +
      '<p class="small muted">' + h.esc(t('team.shareCode', { code: info.code })) + ' ' +
      h.esc(lead.member ? t('team.leader', { name: lead.member.name }) : t('team.noLeader')) + '</p>' +
      '<div class="roles">' + roles + '</div><h3>' + h.esc(t('team.inRoom')) + '</h3><ul class="people">' + people + '</ul></div>';
  };

  // ------------------------------------------------------------------ Ações
  Object.assign(ui.actions, {
    'team-toggle': function () { local.teamOpen = !local.teamOpen; rerender(); },
    'team-host': function () {
      var n = MS.team.cleanName(val('team-name'));
      saveName(n); local.teamOpen = true;
      MS.net.host(n);
    },
    'team-join': function () {
      var n = MS.team.cleanName(val('team-name'));
      saveName(n); local.teamOpen = true;
      MS.net.join(val('team-code'), n);
    },
    'team-leave': function () {
      var info = MS.net.info();
      if (info.inRoom && info.isHost && info.members.length > 1 && !root.confirm(t('team.confirmLeave'))) return;
      MS.net.leave();
    },
    'team-role': function (d) {
      var info = MS.net.info(), me = MS.team.member(info.members, info.me);
      if (!me) return;
      var roles = me.roles.indexOf(d.role) !== -1
        ? me.roles.filter(function (r) { return r !== d.role; })
        : me.roles.concat([d.role]);
      MS.net.claimRoles(roles);
    }
  });

  // ---------------------------------------------------------------- Avisos
  ui.toast = function (msg) {
    if (!document.body) return;
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild); // no máximo 4 avisos
    setTimeout(function () { el.remove(); }, 4500);
  };

  if (MS.net) {
    MS.net.onUpdate = rerender;
    MS.net.onToast = ui.toast;
  }
})(globalThis);
