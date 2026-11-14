/* =====================================================================
 * state.js — ESTADO ÚNICO do jogo + AÇÕES.
 *
 * Regras:
 *   - Toda tela LÊ MS.store.state (congelado: não dá para mudar direto).
 *   - Toda mudança passa por uma ação daqui (select, setOrbit, nextPhase…).
 *   - Cada ação cria o novo state, salva no localStorage e chama render().
 *   - Resultados NÃO ficam no state: a tela chama MS.sim.run(state).
 *
 * Formato:
 *   { version, scenarioId, phase, reached, attempt,
 *     design: { orbit, launcher, groundStation, payload, structure, ... } }
 *   phase = fase atual · reached = fase mais avançada já liberada
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  var STORAGE_KEY = 'missionSim.state';
  var VERSION = 1; // mude quando o formato do state mudar (progresso antigo é descartado)

  var store = { state: null, render: function () {}, storage: null };

  function data() { return MS.data; }
  function flow() { return data().flow; }
  function phaseIds() { return flow().phases.map(function (p) { return p.id; }); }
  function scenarioOf(s) { return data().scenarios[s.scenarioId]; }
  function findSlot(sc, id) { return sc.slots.filter(function (s) { return s.id === id; })[0] || null; }

  function draft() { return JSON.parse(JSON.stringify(store.state)); }
  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) {
      if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]);
    });
    return Object.freeze(o);
  }

  // ------------------------------------------------------------- Criação
  function createState(scenarioId) {
    var sid = scenarioId || flow().defaultScenario || Object.keys(data().scenarios)[0];
    var sc = data().scenarios[sid];
    if (!sc) throw new Error('Cenário desconhecido: ' + sid);
    var design = {};
    sc.slots.forEach(function (slot) { design[slot.id] = null; });
    var first = flow().phases[0].id;
    return { version: VERSION, scenarioId: sid, phase: first, reached: first, attempt: 1, design: design };
  }

  // Escolhas que faltam para sair da fase indicada (inclui fases anteriores).
  function missingUpTo(s, phaseId) {
    var ids = phaseIds(), limit = ids.indexOf(phaseId);
    return scenarioOf(s).slots.filter(function (slot) {
      return ids.indexOf(slot.phase) <= limit && !s.design[slot.id];
    });
  }

  // Índice da fase mais avançada que o design atual permite alcançar.
  function maxAllowedIndex(s) {
    var ids = phaseIds();
    for (var i = 0; i < ids.length; i++) {
      if (missingUpTo(s, ids[i]).length) return i;
    }
    return ids.length - 1;
  }

  // Deixa phase/reached coerentes com o design.
  function clampPhases(s) {
    var ids = phaseIds(), max = maxAllowedIndex(s);
    var p = Math.max(0, ids.indexOf(s.phase)), r = ids.indexOf(s.reached);
    if (r < p) r = p;
    if (r > max) r = max;
    if (p > r) p = r;
    s.phase = ids[p];
    s.reached = ids[r];
    return s;
  }

  // Limpa um state vindo do localStorage (os dados podem ter mudado).
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return null;
    if (!data().scenarios[raw.scenarioId]) return null;
    var s = createState(raw.scenarioId);
    scenarioOf(s).slots.forEach(function (slot) {
      var v = raw.design && raw.design[slot.id];
      if (typeof v === 'string' && slot.options.indexOf(v) !== -1) s.design[slot.id] = v;
    });
    var ids = phaseIds();
    if (ids.indexOf(raw.phase) !== -1) s.phase = raw.phase;
    if (ids.indexOf(raw.reached) !== -1) s.reached = raw.reached;
    if (typeof raw.attempt === 'number' && raw.attempt >= 1) s.attempt = Math.floor(raw.attempt);
    return clampPhases(s);
  }

  // --------------------------------------------------------------- Ações
  // Escolhe uma opção (ou null para desfazer) em qualquer slot do cenário.
  function select(slotId, optionId) {
    var sc = scenarioOf(store.state);
    var slot = findSlot(sc, slotId);
    if (!slot) throw new Error('Escolha desconhecida: ' + slotId);
    if (optionId != null && slot.options.indexOf(optionId) === -1) {
      throw new Error('Opção "' + optionId + '" não existe em "' + slotId + '".');
    }
    var s = draft();
    s.design[slotId] = optionId == null ? null : optionId;
    s.reached = s.phase; // projeto mudou: as fases seguintes precisam ser refeitas
    commit(clampPhases(s));
  }
  function selectComponent(slotId, componentId) { select(slotId, componentId); }
  function setOrbit(id) { select('orbit', id); }
  function setLauncher(id) { select('launcher', id); }
  function setGroundStation(id) { select('groundStation', id); }

  // Pode avançar? Diz também o que falta escolher.
  function canAdvance(s) {
    s = s || store.state;
    var ids = phaseIds(), i = ids.indexOf(s.phase);
    var missing = missingUpTo(s, s.phase);
    return {
      ok: missing.length === 0 && i < ids.length - 1,
      missing: missing.map(function (slot) { return slot.label; }),
      isLast: i === ids.length - 1
    };
  }

  function nextPhase() {
    if (!canAdvance().ok) return false;
    var s = draft(), ids = phaseIds();
    var i = ids.indexOf(s.phase) + 1;
    s.phase = ids[i];
    if (ids.indexOf(s.reached) < i) s.reached = s.phase;
    commit(s);
    return true;
  }

  function prevPhase() {
    var ids = phaseIds(), i = ids.indexOf(store.state.phase);
    if (i <= 0) return false;
    var s = draft();
    s.phase = ids[i - 1];
    commit(s);
    return true;
  }

  // Ir direto para uma fase já liberada (ex.: clique na barra de fases).
  function goToPhase(phaseId) {
    var ids = phaseIds(), t = ids.indexOf(phaseId);
    if (t < 0 || t > ids.indexOf(store.state.reached)) return false;
    var s = draft();
    s.phase = phaseId;
    commit(s);
    return true;
  }

  // "Ajustar e simular de novo": volta à fase de ajuste mantendo as escolhas.
  function retry() {
    var s = draft();
    s.attempt += 1;
    s.phase = flow().retryPhase || phaseIds()[0];
    s.reached = s.phase;
    commit(clampPhases(s));
  }

  // Começar do zero (opcionalmente em outro cenário).
  function reset(scenarioId) {
    commit(createState(scenarioId));
  }

  // -------------------------------------------------------- Persistência
  function save() {
    if (!store.storage) return;
    try { store.storage.setItem(STORAGE_KEY, JSON.stringify(store.state)); }
    catch (e) { /* armazenamento bloqueado ou cheio: segue sem salvar */ }
  }
  function load() {
    if (!store.storage) return null;
    try {
      var raw = store.storage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function defaultStorage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function commit(next) {
    store.state = deepFreeze(next);
    save();
    store.render(store.state);
  }

  // Inicializa: carrega o progresso salvo (ou cria um novo) e chama render.
  //   opts.render      função chamada após cada mudança: render(state)
  //   opts.storage     objeto tipo localStorage (padrão: window.localStorage)
  //   opts.scenarioId  cenário inicial quando não há progresso salvo
  function init(opts) {
    opts = opts || {};
    store.render = typeof opts.render === 'function' ? opts.render : function () {};
    store.storage = 'storage' in opts ? opts.storage : defaultStorage();
    commit(load() || createState(opts.scenarioId));
    return store.state;
  }

  // Informações da fase atual, para a barra de navegação.
  function phaseInfo(s) {
    s = s || store.state;
    var phases = flow().phases, ids = phaseIds(), i = ids.indexOf(s.phase);
    return { phases: phases, index: i, current: phases[i], reachedIndex: ids.indexOf(s.reached) };
  }

  MS.store = {
    init: init,
    get state() { return store.state; },
    // ações
    select: select, selectComponent: selectComponent,
    setOrbit: setOrbit, setLauncher: setLauncher, setGroundStation: setGroundStation,
    nextPhase: nextPhase, prevPhase: prevPhase, goToPhase: goToPhase,
    retry: retry, reset: reset,
    // consultas
    canAdvance: canAdvance, phaseInfo: phaseInfo,
    // usados pelos testes
    createState: createState, sanitize: sanitize, STORAGE_KEY: STORAGE_KEY
  };
})(globalThis);
