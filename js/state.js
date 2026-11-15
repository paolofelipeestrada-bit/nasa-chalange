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
 *   { version, scenarioId, phase, reached, attempt, seed,
 *     design: { orbit, launcher, groundStation, payload, structure, ... } }
 *   seed = semente dos imprevistos (muda a cada tentativa; no multiplayer
 *          a sala inteira usa a mesma)
 *   phase = fase atual · reached = fase mais avançada já liberada
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  var STORAGE_KEY = 'missionSim.state';
  var VERSION = 1; // mude quando o formato do state mudar (progresso antigo é descartado)

  var store = { state: null, render: function () {}, storage: null, persist: true, listeners: [] };

  function data() { return MS.data; }
  function flow() { return data().flow; }
  function phaseIds() { return flow().phases.map(function (p) { return p.id; }); }
  // Cenário no nível de dificuldade do state (js/levels.js; sem ele, o cenário puro).
  function scenarioOf(s) { return MS.levels ? MS.levels.scenario(s) : data().scenarios[s.scenarioId]; }
  function levelOk(l) { return !MS.levels || MS.levels.ids().indexOf(l) !== -1; }
  function autoFill(s) { if (MS.levels) s.design = MS.levels.autoFill(scenarioOf(s), s.design); return s; }
  function findSlot(sc, id) { return sc.slots.filter(function (s) { return s.id === id; })[0] || null; }

  function newSeed() {
    try {
      var a = new Uint32Array(1);
      root.crypto.getRandomValues(a);
      return a[0];
    } catch (e) { return Math.floor(Math.random() * 4294967296) >>> 0; }
  }

  function draft() { return JSON.parse(JSON.stringify(store.state)); }
  function deepFreeze(o) {
    Object.keys(o).forEach(function (k) {
      if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]);
    });
    return Object.freeze(o);
  }

  // ------------------------------------------------------------- Criação
  function createState(scenarioId, difficulty) {
    var sid = scenarioId || flow().defaultScenario || Object.keys(data().scenarios)[0];
    if (!data().scenarios[sid]) throw new Error('Cenário desconhecido: ' + sid);
    var lvl = levelOk(difficulty) && difficulty ? difficulty : (MS.levels ? MS.levels.id({}) : 'normal');
    var first = flow().phases[0].id;
    // difficulty: nível (js/data/levels.js) · period: janela de lançamento (clima espacial real)
    // decisions: escolhas durante a missão · prediction: palpite antes de lançar (PREDICTIONS)
    // attempts: tentativas anteriores (só escolhas)
    var s = { version: VERSION, scenarioId: sid, difficulty: lvl, phase: first, reached: first, attempt: 1, seed: newSeed(), design: {}, period: null, decisions: {},
              prediction: null, attempts: [] };
    scenarioOf(s).slots.forEach(function (slot) { s.design[slot.id] = null; });
    return autoFill(s);
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
    var s = createState(raw.scenarioId, levelOk(raw.difficulty) ? raw.difficulty : null);
    scenarioOf(s).slots.forEach(function (slot) {
      var v = raw.design && raw.design[slot.id];
      if (typeof v === 'string' && slot.options.indexOf(v) !== -1) s.design[slot.id] = v;
    });
    var ids = phaseIds();
    if (ids.indexOf(raw.phase) !== -1) s.phase = raw.phase;
    if (ids.indexOf(raw.reached) !== -1) s.reached = raw.reached;
    if (typeof raw.attempt === 'number' && raw.attempt >= 1) s.attempt = Math.floor(raw.attempt);
    if (typeof raw.seed === 'number' && isFinite(raw.seed)) s.seed = raw.seed >>> 0;
    if (validPeriod(raw.period)) s.period = raw.period;
    if (raw.decisions && typeof raw.decisions === 'object') {
      Object.keys(raw.decisions).forEach(function (k) {
        if (validDecision(k, raw.decisions[k])) s.decisions[k] = raw.decisions[k];
      });
    }
    if (PREDICTIONS.indexOf(raw.prediction) !== -1) s.prediction = raw.prediction;
    if (Array.isArray(raw.attempts)) s.attempts = raw.attempts.map(cleanAttempt.bind(null, s)).filter(Boolean).slice(-MAX_ATTEMPTS);
    return clampPhases(autoFill(s));
  }

  // Tentativa guardada: só as escolhas (o resultado é sempre recalculado).
  function cleanAttempt(s, a) {
    if (!a || typeof a !== 'object' || !a.design) return null;
    var out = { attempt: Math.max(1, Math.floor(+a.attempt || 1)), design: {}, period: validPeriod(a.period) ? a.period : null,
                decisions: {}, seed: (+a.seed || 0) >>> 0, prediction: PREDICTIONS.indexOf(a.prediction) !== -1 ? a.prediction : null };
    scenarioOf(s).slots.forEach(function (slot) {
      var v = a.design[slot.id];
      out.design[slot.id] = typeof v === 'string' && slot.options.indexOf(v) !== -1 ? v : null;
    });
    Object.keys(a.decisions || {}).forEach(function (k) { if (validDecision(k, a.decisions[k])) out.decisions[k] = a.decisions[k]; });
    return out;
  }

  // Palpites possíveis antes do lançamento: quanto dos dados chega à Terra.
  var PREDICTIONS = ['lt50', 'mid', 'most', 'all'];
  var MAX_ATTEMPTS = 6;

  function validPeriod(p) {
    var sw = data().spaceWeather;
    return typeof p === 'string' && !!(sw && sw.periods && sw.periods[p]);
  }
  function validDecision(id, opt) {
    var o = MS.life && MS.life.OPTIONS[id];
    return !!o && o.indexOf(opt) !== -1;
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
    autoFill(s);         // escolhas automáticas do nível (ex.: no Fácil o foguete segue a órbita)
    s.decisions = {};    // outro satélite: a missão (e suas decisões) recomeça
    s.prediction = null; // e o palpite também
    s.reached = s.phase; // projeto mudou: as fases seguintes precisam ser refeitas
    commit(clampPhases(s));
  }
  function selectComponent(slotId, componentId) { select(slotId, componentId); }
  function setOrbit(id) { select('orbit', id); }
  function setLauncher(id) { select('launcher', id); }
  function setGroundStation(id) { select('groundStation', id); }

  // Escolher a janela de lançamento (clima espacial real daquele período).
  function setPeriod(periodId) {
    if (periodId != null && !validPeriod(periodId)) throw new Error('Janela de lançamento desconhecida: ' + periodId);
    var s = draft();
    s.period = periodId == null ? null : periodId;
    s.decisions = {};
    commit(s);
  }

  // Decisão durante a missão; vale como regra até o fim da missão.
  function decide(id, option) {
    if (!validDecision(id, option)) throw new Error('Decisão inválida: ' + id + '=' + option);
    var s = draft();
    s.decisions[id] = option;
    commit(s);
  }

  // Palpite antes de lançar ("prever antes de lançar"): null apaga.
  function setPrediction(id) {
    if (id != null && PREDICTIONS.indexOf(id) === -1) throw new Error('Palpite desconhecido: ' + id);
    var s = draft();
    s.prediction = id == null ? null : id;
    commit(s);
  }

  // A fase da missão só termina com a janela escolhida e sem decisão pendente.
  var T = MS.i18n ? MS.i18n.T : function (en) { return en; };
  var LABEL_PERIOD = T('Launch window', 'Janela de lançamento', 'Ventana de lanzamiento');
  var LABEL_DECISION = T('Mission decision', 'Decisão da missão', 'Decisión de la misión');
  function missionMissing(s) {
    if (s.phase !== 'implement' || missingUpTo(s, s.phase).length) return [];
    if (!s.period) return [LABEL_PERIOD];
    if (MS.sim) {
      try { if (MS.sim.run(s).mission.status === 'decide') return [LABEL_DECISION]; } catch (e) { /* sem motor */ }
    }
    return [];
  }

  // Pode avançar? Diz também o que falta escolher.
  function canAdvance(s) {
    s = s || store.state;
    var ids = phaseIds(), i = ids.indexOf(s.phase);
    var missing = missingUpTo(s, s.phase).map(function (slot) { return slot.label; }).concat(missionMissing(s));
    return {
      ok: missing.length === 0 && i < ids.length - 1,
      missing: missing,
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
    // guarda a tentativa que acabou para comparar lado a lado no relatório
    s.attempts = (s.attempts || []).concat([{ attempt: s.attempt, design: s.design, period: s.period, decisions: s.decisions, seed: s.seed, prediction: s.prediction }]).slice(-MAX_ATTEMPTS);
    s.attempt += 1;
    s.seed = newSeed(); // imprevistos novos a cada tentativa
    s.decisions = {};
    s.prediction = null;
    s.phase = flow().retryPhase || phaseIds()[0];
    s.reached = s.phase;
    commit(clampPhases(s));
  }

  // Define a semente dos imprevistos (multiplayer: a sala usa a mesma).
  function setSeed(seed) {
    if (typeof seed !== 'number' || !isFinite(seed)) throw new Error('Semente inválida.');
    var s = draft();
    s.seed = seed >>> 0;
    commit(s);
  }

  // Começar do zero (opcionalmente em outro cenário).
  function reset(scenarioId) {
    commit(createState(scenarioId, store.state && store.state.difficulty));
  }

  // Trocar o nível de dificuldade: guarda as escolhas que continuam valendo.
  function setDifficulty(level) {
    if (!levelOk(level)) throw new Error('Nível desconhecido: ' + level);
    if (level === store.state.difficulty) return true;
    var s = createState(store.state.scenarioId, level);
    scenarioOf(s).slots.forEach(function (slot) {
      var v = store.state.design[slot.id];
      if (!slot.auto && v && slot.options.indexOf(v) !== -1) s.design[slot.id] = v;
    });
    autoFill(s);
    s.phase = store.state.phase;
    s.attempt = store.state.attempt;
    s.seed = store.state.seed;
    commit(clampPhases(s));
    return true;
  }

  // Trocar de missão (cliente/objetivo) na fase 1: guarda as escolhas que
  // também existem no cenário novo, sorteia imprevistos novos.
  function setScenario(scenarioId) {
    if (!data().scenarios[scenarioId]) throw new Error('Cenário desconhecido: ' + scenarioId);
    if (scenarioId === store.state.scenarioId) return true;
    var s = createState(scenarioId, store.state.difficulty);
    scenarioOf(s).slots.forEach(function (slot) {
      var v = store.state.design[slot.id];
      if (!slot.auto && v && slot.options.indexOf(v) !== -1) s.design[slot.id] = v;
    });
    autoFill(s);
    s.phase = store.state.phase;
    s.attempt = store.state.attempt;
    commit(clampPhases(s));
    return true;
  }

  // -------------------------------------------------------- Persistência
  function save() {
    if (!store.storage || !store.persist) return;
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
    store.listeners.forEach(function (fn) { try { fn(store.state); } catch (e) { if (root.console) console.error(e); } });
  }

  // ------------------------------------------------- Multiplayer (sala)
  // Avisa a cada mudança de state (o anfitrião usa para mandar à sala).
  function onChange(fn) {
    store.listeners.push(fn);
    return function () { store.listeners = store.listeners.filter(function (f) { return f !== fn; }); };
  }
  // Substitui o state por um recebido (convidado recebendo do anfitrião).
  function loadRemote(raw) {
    var s = sanitize(raw);
    if (!s) return false;
    commit(s);
    return true;
  }
  // Liga/desliga salvar no localStorage (convidados não sobrescrevem o jogo solo).
  function setPersistence(on) { store.persist = !!on; }

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
    retry: retry, reset: reset, setSeed: setSeed, setScenario: setScenario, setDifficulty: setDifficulty,
    setPeriod: setPeriod, decide: decide, setPrediction: setPrediction, PREDICTIONS: PREDICTIONS,
    // multiplayer
    onChange: onChange, load: loadRemote, setPersistence: setPersistence,
    // consultas
    canAdvance: canAdvance, phaseInfo: phaseInfo,
    // usados pelos testes
    createState: createState, sanitize: sanitize, STORAGE_KEY: STORAGE_KEY
  };
})(globalThis);
