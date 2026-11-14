/* =====================================================================
 * ui/team-panel.js — PAINEL DA EQUIPE (multiplayer) e avisos na tela
 *
 * Mostra: criar/entrar numa sala, código da sala, membros e papéis.
 * Os papéis vêm de scenario.team.roles; a rede fica em js/net/room.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
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
      return '<div class="card team"><div class="row-head"><h2>Jogar em equipe</h2>' +
        '<button type="button" class="btn small" data-action="team-toggle">Fechar</button></div>' +
        '<p class="small muted">Cooperativo, de 2 a ' + maxPlayers(sc) + ' jogadores: cada pessoa cuida de alguns subsistemas da mesma missão e todos veem as escolhas ao vivo.</p>' +
        '<ol class="team-steps"><li>Uma pessoa digita o nome e clica em <b>Criar sala</b>.</li>' +
        '<li>Ela passa o código de 6 letras para a equipe.</li>' +
        '<li>Os outros digitam o nome e o código e clicam em <b>Entrar</b>.</li>' +
        '<li>Cada um assume um papel e a equipe joga junta.</li></ol>' + err +
        (MS.net.available() ? '' : '<div class="alert s-warn small">O modo equipe precisa de internet.</div>') +
        '<div class="team-form"><label>Seu nome <input id="team-name" maxlength="24" autocomplete="nickname" value="' + h.esc(savedName()) + '"></label>' +
        '<button type="button" class="btn primary" data-action="team-host">Criar sala</button>' +
        '<span class="muted small">ou</span>' +
        '<label>Código da sala <input id="team-code" maxlength="6" placeholder="ABC123" autocomplete="off" style="text-transform:uppercase"></label>' +
        '<button type="button" class="btn" data-action="team-join">Entrar</button></div></div>';
    }

    if (info.status !== 'online') {
      return '<div class="card team"><div class="row-head"><span>Conectando à sala <strong class="code">' + h.esc(info.code) + '</strong>…</span>' +
        '<button type="button" class="btn small" data-action="team-leave">Cancelar</button></div>' + err + '</div>';
    }

    var lead = MS.team.leader(sc, info.members);
    var me = MS.team.member(info.members, info.me) || { roles: [] };
    var mine = me.roles.map(function (id) { var r = MS.team.role(sc, id); return r ? r.name : id; });
    var head = '<div class="row-head"><div><h2>Sala <span class="code">' + h.esc(info.code) + '</span></h2>' +
      '<span class="small muted"><span class="seats">' + info.members.length + '/' + maxPlayers(sc) + ' jogadores</span> · você: ' + h.esc(info.myName) +
      (mine.length ? ' (' + h.esc(mine.join(', ')) + ')' : ' (sem papel)') + (info.isHost ? ' · anfitrião' : '') + '</span></div>' +
      '<div class="actions"><button type="button" class="btn small" data-action="team-toggle">' + (local.teamOpen ? 'Recolher' : 'Ver equipe') + '</button>' +
      '<button type="button" class="btn small" data-action="team-leave">Sair da sala</button></div></div>';
    if (!local.teamOpen) return '<div class="card team compact">' + head + '</div>';

    var roles = MS.team.roles(sc).map(function (r) {
      var who = MS.team.holder(info.members, r.id), isMine = who && who.id === info.me;
      var slots = (r.slots || []).map(function (sid) {
        var s = sc.slots.filter(function (x) { return x.id === sid; })[0];
        return s ? s.label : sid;
      }).join(', ');
      var btn = isMine ? '<button type="button" class="btn small" data-action="team-role" data-role="' + h.esc(r.id) + '">Largar</button>'
        : who ? '<span class="small muted">com ' + h.esc(who.name) + '</span>'
          : '<button type="button" class="btn small primary" data-action="team-role" data-role="' + h.esc(r.id) + '">Assumir</button>';
      return '<div class="role' + (isMine ? ' mine' : '') + '"><div class="row-head"><strong>' + h.esc(r.name) + '</strong>' + btn + '</div>' +
        '<div class="small">' + h.esc(r.description || '') + '</div>' +
        '<div class="small muted">Cuida de: ' + h.esc(slots) + (r.canAdvance ? ' · conduz as fases' : '') + '</div></div>';
    }).join('');
    var people = info.members.map(function (m) {
      var rn = (m.roles || []).map(function (id) { var r = MS.team.role(sc, id); return r ? r.name : id; });
      return '<li>' + h.esc(m.name) + (m.id === info.me ? ' <span class="muted">(você)</span>' : '') +
        (m.host ? ' <span class="muted">· anfitrião</span>' : '') + ' — <span class="small">' + h.esc(rn.join(', ') || 'sem papel') + '</span></li>';
    }).join('');
    return '<div class="card team">' + head + err +
      '<p class="small muted">Passe o código <strong>' + h.esc(info.code) + '</strong> para a equipe. Papel sem dono fica livre para qualquer um. ' +
      (lead.member ? 'Quem conduz as fases: ' + h.esc(lead.member.name) + '.' : 'Ninguém é Gerente de missão: qualquer um avança as fases.') + '</p>' +
      '<div class="roles">' + roles + '</div><h3>Na sala</h3><ul class="people">' + people + '</ul></div>';
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
      if (info.inRoom && info.isHost && info.members.length > 1 && !root.confirm('Você é o anfitrião: se sair, a sala acaba para todos. Sair?')) return;
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
