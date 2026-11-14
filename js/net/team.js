/* =====================================================================
 * net/team.js — REGRAS DA EQUIPE (puras, sem rede, testáveis)
 *
 * members = [{ id, name, roles: ['bus', ...], host: true|false }]
 * Os papéis vêm de scenario.team.roles (js/data/scenarios.js).
 *
 *   MS.team.can(sc, members, memberId, action, args) → { ok, reason }
 *   MS.team.claim(sc, members, memberId, roleIds)    → { ok, members, reason }
 *   MS.team.describe(sc, action, args)               → texto para avisos
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  function t(k, p) { return MS.i18n ? MS.i18n.t(k, p) : k; }
  function L(v) { return MS.i18n ? MS.i18n.L(v) : v; }

  // Únicas ações que um convidado pode pedir ao anfitrião.
  var ACTIONS = ['select', 'setScenario', 'nextPhase', 'prevPhase', 'goToPhase', 'retry', 'reset', 'setPeriod', 'decide', 'setPrediction'];
  var PHASE_ACTIONS = ['setScenario', 'nextPhase', 'prevPhase', 'goToPhase', 'retry', 'reset', 'setPeriod', 'decide'];

  function roles(sc) { return (sc && sc.team && sc.team.roles) || []; }
  function role(sc, id) { return roles(sc).filter(function (r) { return r.id === id; })[0] || null; }
  function member(members, id) { return members.filter(function (m) { return m.id === id; })[0] || null; }
  function holder(members, roleId) {
    return members.filter(function (m) { return (m.roles || []).indexOf(roleId) !== -1; })[0] || null;
  }
  function roleOfSlot(sc, slotId) {
    return roles(sc).filter(function (r) { return (r.slots || []).indexOf(slotId) !== -1; })[0] || null;
  }
  function slotLabel(sc, slotId) {
    var s = (sc.slots || []).filter(function (x) { return x.id === slotId; })[0];
    return s ? L(s.label) : slotId;
  }

  // Quem é responsável por uma escolha: { role, member } (member null = livre).
  function slotOwner(sc, members, slotId) {
    var r = roleOfSlot(sc, slotId);
    return { role: r, member: r ? holder(members, r.id) : null };
  }

  // Quem conduz as fases: dono de um papel com canAdvance (null = qualquer um).
  function leader(sc, members) {
    var lead = roles(sc).filter(function (r) { return r.canAdvance; });
    for (var i = 0; i < lead.length; i++) {
      var h = holder(members, lead[i].id);
      if (h) return { role: lead[i], member: h };
    }
    return { role: lead[0] || null, member: null };
  }

  function can(sc, members, memberId, action, args) {
    if (ACTIONS.indexOf(action) === -1) return { ok: false, reason: t('net.notAllowed') };
    if (!member(members, memberId)) return { ok: false, reason: t('net.notInRoom') };
    if (action === 'select') {
      var o = slotOwner(sc, members, args && args[0]);
      if (!o.member || o.member.id === memberId) return { ok: true };
      return { ok: false, reason: t('net.slotOwned', { slot: slotLabel(sc, args[0]), role: L(o.role.name), name: o.member.name }) };
    }
    if (PHASE_ACTIONS.indexOf(action) !== -1) {
      var l = leader(sc, members);
      if (!l.member || l.member.id === memberId) return { ok: true };
      return { ok: false, reason: t('net.leaderOnly', { name: l.member.name, role: L(l.role.name) }) };
    }
    return { ok: true };
  }

  // Assumir papéis: troca a lista do membro, se nenhum papel tiver outro dono.
  function claim(sc, members, memberId, roleIds) {
    var me = member(members, memberId);
    if (!me) return { ok: false, members: members, reason: t('net.notInRoom') };
    var wanted = (roleIds || []).filter(function (id, i, a) { return role(sc, id) && a.indexOf(id) === i; });
    for (var i = 0; i < wanted.length; i++) {
      var h = holder(members, wanted[i]);
      if (h && h.id !== memberId) return { ok: false, members: members, reason: t('net.roleTaken', { role: L(role(sc, wanted[i]).name), name: h.name }) };
    }
    return {
      ok: true,
      members: members.map(function (m) { return m.id === memberId ? Object.assign({}, m, { roles: wanted }) : m; })
    };
  }

  // Texto curto do que alguém fez (para avisos na tela).
  function describe(sc, action, args) {
    var cat = MS.data && MS.data.catalog;
    if (action === 'select') {
      var s = (sc.slots || []).filter(function (x) { return x.id === args[0]; })[0];
      var item = s && cat && cat[s.source] && cat[s.source][args[1]];
      return args[1] == null ? t('net.undid', { slot: slotLabel(sc, args[0]) })
        : t('net.chose', { name: item ? L(item.name) : args[1], slot: slotLabel(sc, args[0]) });
    }
    if (action === 'setScenario') {
      var sc2 = MS.data && MS.data.scenarios && MS.data.scenarios[args && args[0]];
      return t('net.choseMission', { name: sc2 ? L(sc2.title) : (args && args[0]) });
    }
    if (action === 'setPeriod') {
      var per = MS.data && MS.data.spaceWeather && MS.data.spaceWeather.periods[args && args[0]];
      return t('net.period', { name: per ? L(per.name) : (args && args[0]) });
    }
    if (action === 'setPrediction') return t('net.predicted');
    if (action === 'decide') return t('net.decided', { name: t('life.opt.' + (args && args[0]) + '.' + (args && args[1])) });
    var flow = (MS.data && MS.data.flow && MS.data.flow.phases) || [];
    var ph = flow.filter(function (p) { return p.id === (args && args[0]); })[0];
    var key = { nextPhase: 'net.next', prevPhase: 'net.prev', goToPhase: 'net.goto', retry: 'net.retry', reset: 'net.reset' }[action];
    return key ? t(key, { name: ph ? L(ph.short) : t('net.otherPhase') }) : action;
  }

  // Nome limpo e curto para exibir.
  function cleanName(name) {
    var n = String(name || '').replace(/[<>]/g, '').trim().slice(0, 24);
    return n || t('net.player');
  }

  MS.team = {
    ACTIONS: ACTIONS, roles: roles, role: role, member: member, holder: holder,
    roleOfSlot: roleOfSlot, slotOwner: slotOwner, leader: leader,
    can: can, claim: claim, describe: describe, cleanName: cleanName
  };
})(globalThis);
