/* =====================================================================
 * levels.js — NÍVEL DE DIFICULDADE aplicado ao cenário (puro, testado)
 *
 *   MS.levels.scenario(state)        cenário do jogo no nível do state
 *   MS.levels.apply(cenário, nível)  cenário ajustado (Normal = o próprio)
 *   MS.levels.autoFill(sc, design)   preenche escolhas fixas/seguidas
 *   MS.levels.recommended(state, slot)  opção da Dica (só onde há dica)
 *   MS.levels.id(state) · ids() · def(id)
 *
 * O motor (sim.js), o estado e as telas pedem o cenário por aqui, então o
 * nível muda orçamento, prazo, folgas, imprevistos e escolhas sem que o
 * motor saiba de níveis. Os ajustes ficam em js/data/levels.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function data() { return MS.data || {}; }
  function L() { return data().levels || { order: ['normal'], default: 'normal', normal: {} }; }
  function ids() { return L().order || ['normal']; }
  function def(id) { return L()[id] || null; }
  function id(state) {
    var v = state && state.difficulty;
    return ids().indexOf(v) !== -1 ? v : (L().default || 'normal');
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(x, d) { return typeof x === 'number' && isFinite(x) ? x : d; }

  function apply(base, levelId) {
    var lv = def(levelId);
    if (!base || !lv || levelId === (L().default || 'normal') && !lv.fixed && !lv.addSlots) return base;
    if (cache) {
      var byLevel = cache.get(base);
      if (byLevel && byLevel[levelId]) return byLevel[levelId];
    }
    var sc = clone(base);
    sc.level = levelId;
    sc.budget_k = Math.round(base.budget_k * num(lv.budgetFactor, 1));
    sc.params = sc.params || {};
    sc.params.deadline_months = num(sc.params.deadline_months, 24) + num(lv.deadlineAdd, 0);
    var mg = sc.params.margins = sc.params.margins || {};
    Object.keys(mg).forEach(function (k) { mg[k] = Math.round(mg[k] * num(lv.marginFactor, 1) * 1000) / 1000; });
    Object.keys(lv.addMargins || {}).forEach(function (k) { mg[k] = lv.addMargins[k]; });
    sc.randomEvents = (sc.randomEvents || []).map(function (re) {
      re.chance = Math.min(0.95, Math.round(re.chance * num(lv.chanceFactor, 1) * 1000) / 1000);
      return re;
    }).concat(clone(lv.addEvents || []).map(function (re) {
      // Cenário sem o evento de referência (ex.: missões da ISS não têm "Primeira imagem"):
      // o imprevisto entra depois do primeiro contato, ou do último evento antes do fim.
      var ids = (sc.events || []).map(function (e) { return e.id; });
      if (re.after && ids.indexOf(re.after) === -1) re.after = ids.indexOf('E4') !== -1 ? 'E4' : ids[Math.max(0, ids.length - 2)];
      return re;
    }));

    (lv.addSlots || []).forEach(function (s) {
      var add = clone(s), at = sc.slots.map(function (x) { return x.id; }).indexOf(add.after);
      delete add.after;
      sc.slots.splice(at === -1 ? sc.slots.length : at + 1, 0, add);
    });
    sc.slots.forEach(function (slot) {
      if (lv.fixed && lv.fixed[slot.id] && slot.options.indexOf(lv.fixed[slot.id]) !== -1) {
        slot.options = [lv.fixed[slot.id]];
        slot.auto = 'fixed';
      } else if (lv.follow && lv.follow[slot.id]) {
        slot.auto = 'follow';
        slot.follows = lv.follow[slot.id];
      }
      if (lv.help && lv.help[slot.id]) slot.help = clone(lv.help[slot.id]);
    });
    if (sc.team && sc.team.roles && lv.addRoleSlots) {
      sc.team.roles.forEach(function (r) { r.slots = (r.slots || []).concat(lv.addRoleSlots[r.id] || []); });
    }
    if (cache) { var m = cache.get(base) || {}; m[levelId] = sc; cache.set(base, m); }
    return sc;
  }

  function scenario(state, d) {
    var all = (d || data()).scenarios || {};
    return apply(all[state && state.scenarioId], id(state));
  }

  // Opção que "segue" outra escolha: a que lista o valor escolhido em algum
  // campo de lista (ex.: o lançador cujas órbitas incluem a órbita escolhida).
  function follower(sc, slot, design, catalog) {
    var v = design[slot.follows];
    if (!v) return null;
    var section = (catalog || data().catalog || {})[slot.source] || {};
    for (var i = 0; i < slot.options.length; i++) {
      var it = section[slot.options[i]] || {};
      var hit = Object.keys(it).some(function (k) { return Array.isArray(it[k]) && it[k].indexOf(v) !== -1; });
      if (hit) return slot.options[i];
    }
    return null;
  }

  // Escolhas automáticas do nível (fixas e seguidas). Devolve um design novo.
  function autoFill(sc, design, catalog) {
    var out = Object.assign({}, design);
    sc.slots.forEach(function (slot) {
      if (slot.auto === 'fixed') out[slot.id] = slot.options[0];
      else if (slot.auto === 'follow') out[slot.id] = follower(sc, slot, out, catalog);
    });
    return out;
  }

  function recommended(state, slotId) {
    var lv = def(id(state));
    if (!lv || !lv.hints || !lv.recommend) return null;
    var r = lv.recommend[state.scenarioId];
    return (r && r[slotId]) || null;
  }

  MS.levels = { ids: ids, def: def, id: id, apply: apply, scenario: scenario, autoFill: autoFill, recommended: recommended };
})(globalThis);
