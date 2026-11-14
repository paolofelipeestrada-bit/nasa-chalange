/* =====================================================================
 * advice.js — CONSELHOS DA EQUIPE (puro, sem DOM, sem IA)
 *
 *   MS.advice.crew(state, result) → [{ role, key, name, goal, status, text, vote }]
 *
 * Cada papel da equipe (scenarios.js → team.roles) tem uma META própria e
 * olha o mesmo resultado do motor (MS.sim.run) pelo seu ângulo:
 *   manager (Gerente)   custo ≤ 90% do orçamento, prazo ok, foguete compatível
 *   payload (Cientista) todos os requisitos do cliente cumpridos
 *   bus (Engenheiro)    folga de massa e de energia (as do cenário: 10% e 20%)
 *   ground (Comunic.)   envio de dados com folga e memória suficiente
 * As metas puxam para lados diferentes: é assim que o conflito aparece
 * mesmo jogando sozinho (painel "Crew advice") e vira o voto Go/No-Go.
 *
 * status: ok (meta cumprida) · warn (no limite) · fail (meta quebrada) · pending
 * vote:   'go' só com a meta cumprida; null enquanto faltam escolhas.
 * Textos: chaves crew.* em js/i18n/en|pt|es.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var t = function (k, p) { return MS.i18n.t(k, p); };

  // Reserva de orçamento que o Gerente quer manter (CubeSat 101: ≥ 10%).
  var BUDGET_RESERVE = 0.10;
  // Papel do jogo → chave visual (cor e ícone do canvas).
  var KEY = { manager: 'mgr', payload: 'sci', bus: 'eng', ground: 'com' };
  // Ordem em que os conselheiros falam no painel.
  var ORDER = ['payload', 'bus', 'ground', 'manager'];

  function U() { return MS.sim.util; }
  function res(result, id) { return result.resources.filter(function (r) { return r.id === id; })[0]; }
  function chk(result, id) { return result.checks.filter(function (c) { return c.id === id; })[0]; }
  function num(r, x) { return U().withUnit(x, r.unit, r.decimals > 1 ? 1 : r.decimals); }
  function pending(r) { return !r || r.status === 'pending'; }

  // ------------------------------------------------------ Cientista
  function scientist(state, result) {
    var reqs = result.requirements;
    if (!state.design.payload || reqs.some(function (r) { return r.status === 'pending'; })) {
      return { status: 'pending', text: t('crew.sci.pending') };
    }
    var miss = reqs.filter(function (r) { return r.status === 'fail'; });
    if (miss.length) {
      var r = miss[0];
      return { status: 'fail', text: t('crew.sci.fail', {
        title: r.title, value: U().withUnit(r.value, r.unit, 1), need: U().withUnit(r.threshold, r.unit, 1), more: miss.length > 1 ? t('crew.sci.more', { n: miss.length - 1 }) : '' }) };
    }
    return { status: 'ok', text: t('crew.sci.ok', { n: reqs.length }) };
  }

  // ------------------------------------------------------ Engenheiro
  function engineer(state, result) {
    var m = res(result, 'mass'), v = res(result, 'volume'), p = res(result, 'power');
    if (!state.design.structure || pending(m) || pending(p)) return { status: 'pending', text: t('crew.eng.pending') };
    if (v && v.status === 'fail') return { status: 'fail', text: t('crew.eng.volume', { need: num(v, v.demand), cap: num(v, v.capacity) }) };
    if (m.status === 'fail') return { status: 'fail', text: t('crew.eng.heavy', { mass: num(m, m.demand), cap: num(m, m.capacity) }) };
    if (p.status === 'fail') return { status: 'fail', text: t('crew.eng.power', { use: num(p, p.demand), gen: num(p, p.capacity) }) };
    if (m.status === 'warn') return { status: 'warn', text: t('crew.eng.massTight', { pct: U().pct(m.margin), rec: U().pct(m.recommendedMargin) }) };
    if (p.status === 'warn') return { status: 'warn', text: t('crew.eng.powerTight', { pct: U().pct(p.margin), rec: U().pct(p.recommendedMargin) }) };
    return { status: 'ok', text: t('crew.eng.ok', { mass: U().pct(m.margin), power: U().pct(p.margin) }) };
  }

  // ------------------------------------------------------ Comunicações
  function comms(state, result) {
    var d = res(result, 'downlink'), s = res(result, 'storage');
    if (!state.design.comms || !state.design.groundStation || pending(d)) return { status: 'pending', text: t('crew.com.pending') };
    if (d.status === 'fail') return { status: 'fail', text: t('crew.com.stuck', { stuck: num(d, d.demand - d.capacity), made: num(d, d.demand) }) };
    if (s && s.status === 'fail') return { status: 'fail', text: t('crew.com.memory', { need: num(s, s.demand), cap: num(s, s.capacity) }) };
    if (d.status === 'warn') return { status: 'warn', text: t('crew.com.tight', { pct: U().pct(d.margin), rec: U().pct(d.recommendedMargin) }) };
    if (s && s.status === 'warn') return { status: 'warn', text: t('crew.com.memTight', { pct: U().pct(s.margin) }) };
    return { status: 'ok', text: t('crew.com.ok', { cap: num(d, d.capacity), made: num(d, d.demand) }) };
  }

  // ------------------------------------------------------ Gerente
  function manager(state, result) {
    var c = res(result, 'cost'), tm = res(result, 'time'), launch = chk(result, 'launch');
    if (!state.design.orbit || !state.design.launcher) return { status: 'pending', text: t('crew.mgr.pending') };
    if (launch && launch.status === 'fail') return { status: 'fail', text: t('crew.mgr.rocket', { why: launch.explanation }) };
    if (pending(c)) return { status: 'pending', text: t('crew.mgr.pending') };
    if (c.status === 'fail') return { status: 'fail', text: t('crew.mgr.over', { cost: num(c, c.demand), budget: num(c, c.capacity) }) };
    if (tm && tm.status === 'fail') return { status: 'fail', text: t('crew.mgr.late', { months: num(tm, tm.demand), deadline: num(tm, tm.capacity) }) };
    var left = c.capacity - c.demand;
    if (c.margin < BUDGET_RESERVE - 1e-9) return { status: 'warn', text: t('crew.mgr.reserve', { left: num(c, left), pct: U().pct(c.margin) }) };
    if (tm && tm.status === 'warn') return { status: 'warn', text: t('crew.mgr.tightTime', { months: num(tm, tm.demand), deadline: num(tm, tm.capacity) }) };
    return { status: 'ok', text: t('crew.mgr.ok', { left: num(c, left), months: tm ? num(tm, tm.demand) : '—' }) };
  }

  var BY_ROLE = { payload: scientist, bus: engineer, ground: comms, manager: manager };

  function crew(state, result) {
    var sc = MS.data.scenarios[state.scenarioId];
    var roles = (sc.team && sc.team.roles) || [];
    return ORDER.map(function (id) {
      var role = roles.filter(function (r) { return r.id === id; })[0];
      if (!role || !BY_ROLE[id]) return null;
      var a = BY_ROLE[id](state, result);
      return {
        role: id, key: KEY[id], name: MS.i18n.L(role.name), goal: t('crew.' + KEY[id] + '.goal'),
        status: a.status, text: a.text,
        vote: a.status === 'pending' ? null : a.status === 'ok' ? 'go' : 'nogo'
      };
    }).filter(Boolean);
  }

  // Resumo do voto: quantos Go, quantos No-Go, e se é unânime.
  function tally(list) {
    var go = list.filter(function (a) { return a.vote === 'go'; }).length;
    var nogo = list.filter(function (a) { return a.vote === 'nogo'; }).length;
    return { go: go, nogo: nogo, open: list.length - go - nogo, unanimous: go === list.length };
  }

  MS.advice = { crew: crew, tally: tally, KEY: KEY, BUDGET_RESERVE: BUDGET_RESERVE };
})(globalThis);
