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

  // ------------------------------------------- Prever antes de lançar
  // Palpite = faixa de quanto dos dados chega à Terra (state.prediction).
  function dataFraction(result) {
    var life = result.life;
    return life && !life.pending && life.totals ? life.totals.dataFraction : null;
  }
  function bucket(f) { return f == null ? null : f < 0.5 ? 'lt50' : f < 0.9 ? 'mid' : f < 0.995 ? 'most' : 'all'; }

  // ------------------------------------------- Tentativa anterior
  // Recalcula a tentativa guardada (o state só tem as escolhas).
  function attemptState(state, a) {
    return Object.assign({}, state, { design: a.design, period: a.period, decisions: a.decisions || {}, seed: a.seed, prediction: a.prediction, attempt: a.attempt });
  }
  function previous(state) {
    var list = state.attempts || [];
    if (!list.length) return null;
    var a = list[list.length - 1], st = attemptState(state, a);
    try { return { attempt: a, state: st, result: MS.sim.run(st) }; } catch (e) { return null; }
  }
  // O que mudou entre duas tentativas: slots trocados.
  function changes(prevState, state) {
    var sc = MS.data.scenarios[state.scenarioId];
    return sc.slots.filter(function (s) { return prevState.design[s.id] !== state.design[s.id]; }).map(function (s) {
      var cat = MS.data.catalog[s.source] || {};
      var name = function (id) { return id && cat[id] ? MS.i18n.L(cat[id].name) : '—'; };
      return { slot: s.id, label: MS.i18n.L(s.label), from: name(prevState.design[s.id]), to: name(state.design[s.id]) };
    });
  }

  // ------------------------------------------- Cartas de aprendizado
  // Leis de Peter Senge (A Quinta Disciplina), desbloqueadas pelo que o
  // jogador viveu nesta tentativa. O nome da lei só aparece no relatório.
  var CARDS = ['yesterday', 'delay', 'small', 'easy'];
  function cards(state, result, prev) {
    var out = {};
    var life = result.life, tl = life && !life.pending ? life.totals : null;
    // 1. Os problemas de hoje vêm das soluções de ontem: uma falha em órbita com causa no projeto
    var traced = (result.mission.events || []).filter(function (e) { return (e.status === 'fail' || e.status === 'warn') && e.causes && e.causes.length; })[0];
    if (traced) out.yesterday = t('card.yesterday.why', { what: traced.title, cause: traced.causes[0] });
    else if (tl && (tl.end === 'reentry' || tl.end === 'battery')) out.yesterday = t('card.yesterday.life.' + tl.end);
    // 2. Causa e efeito não estão próximos no tempo: tudo verde no solo, problema meses depois em órbita
    var groundOk = !result.verification.some(function (v) { return v.status === 'fail'; });
    if (groundOk && tl && (tl.dataFraction < 0.95 || life.tally.resets > 0 || tl.end !== 'complete')) {
      out.delay = t('card.delay.why', { lost: U().pct(1 - tl.dataFraction), resets: life.tally.resets });
    }
    if (prev) {
      var ch = changes(prev.state, state);
      var a = prev.result.score.total, b = result.score.total;
      // 3. Pequenas mudanças podem produzir grandes resultados
      if (ch.length === 1 && a != null && b != null && b - a >= 15) out.small = t('card.small.why', { slot: ch[0].label, a: a, b: b });
      // 4. O caminho fácil leva de volta ao mesmo lugar
      if (!ch.length && a != null && b != null && b <= a) out.easy = t('card.easy.why', { n: prev.attempt.attempt });
    }
    return CARDS.map(function (id) { return { id: id, unlocked: !!out[id], why: out[id] || '' }; });
  }

  // ------------------------------------------- Comparação das órbitas (fase Conceito)
  // Para cada órbita do cenário, roda o motor com aquela órbita no lugar e lê os
  // 4 efeitos que ela muda: cobertura (revisita da região), detalhe (pixel no
  // chão), contato com a Terra e tempo de vida. A câmera e a estação ainda podem
  // não estar escolhidas: usa as do jogador ou, se faltarem, as de referência
  // (câmera do meio da lista, primeira estação). stars: 1–3, relativo às outras.
  var EFFECTS = [
    { id: 'cover', metric: 'revisit_days', better: 'low' },
    { id: 'detail', metric: 'gsd_m', better: 'low' },
    { id: 'contact', metric: 'contactMinPerDay', better: 'high' },
    { id: 'life', metric: 'lifetime_years', better: 'high' }
  ];
  function orbitCompare(state) {
    var sc = MS.data.scenarios[state.scenarioId];
    var slot = function (id) { return sc.slots.filter(function (s) { return s.id === id; })[0]; };
    var pay = slot('payload'), gs = slot('groundStation');
    var ref = {
      payload: state.design.payload || (pay ? pay.options[Math.floor(pay.options.length / 2)] : null),
      groundStation: state.design.groundStation || (gs ? gs.options[0] : null)
    };
    var rows = slot('orbit').options.map(function (id) {
      var design = Object.assign({}, state.design, { orbit: id });
      if (ref.payload) design.payload = ref.payload;
      if (ref.groundStation) design.groundStation = ref.groundStation;
      var r = MS.sim.run(Object.assign({}, state, { design: design }));
      var vals = {};
      EFFECTS.forEach(function (e) { var m = r.metrics[e.metric]; vals[e.id] = m && m.value != null ? m.value : null; });
      return { id: id, chosen: state.design.orbit === id, values: vals, stars: {} };
    });
    // Estrelas: 3 para a melhor, 1 para a pior; "nunca vê a região" = 0.
    EFFECTS.forEach(function (e) {
      var ok = rows.map(function (x) { return x.values[e.id]; }).filter(function (v) { return v != null && isFinite(v); });
      var lo = Math.min.apply(null, ok), hi = Math.max.apply(null, ok);
      rows.forEach(function (x) {
        var v = x.values[e.id];
        if (v == null) { x.stars[e.id] = null; return; }
        if (!isFinite(v)) { x.stars[e.id] = 0; return; }
        var f = hi === lo ? 1 : (v - lo) / (hi - lo);
        if (e.better === 'low') f = 1 - f;
        x.stars[e.id] = 1 + Math.round(f * 2);
      });
    });
    return { effects: EFFECTS, rows: rows, refPayload: !state.design.payload && ref.payload, refStation: !state.design.groundStation && ref.groundStation };
  }

  MS.advice = { crew: crew, tally: tally, KEY: KEY, BUDGET_RESERVE: BUDGET_RESERVE, orbitCompare: orbitCompare,
                dataFraction: dataFraction, bucket: bucket, previous: previous, changes: changes, cards: cards, CARDS: CARDS };
})(globalThis);
