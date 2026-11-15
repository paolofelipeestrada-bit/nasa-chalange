/* =====================================================================
 * ui/scene.js — MODO CENA (uma escolha por vez, com controles de cockpit)
 *
 * Nas fases de Conceito e Projeto, em vez do painel com todas as peças,
 * cada escolha vira uma cena grande:
 *   trilha    as escolhas da fase, uma bolinha por escolha (clicáveis)
 *   esquerda  o personagem do papel que cuida da escolha, falando por quê
 *   centro    o hangar 3D (a peça em prévia aparece em amarelo)
 *   direita   o console: botão giratório (ou alavanca de subir/descer, na
 *             órbita) para passar pelas opções, a ficha da opção e o botão
 *             grande de CONFIRMAR, que escolhe e leva para a próxima cena
 * Girar o botão só mostra a prévia (HUD e hangar); nada muda no state até
 * confirmar (a escolha vira a mesma ação "select" dos cartões).
 * O painel completo de antes continua a um clique ("Ver painel completo").
 * No tutorial guiado, o painel completo volta sozinho (os balões apontam
 * para ele). Preferência só desta pessoa: ui.local + localStorage.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h;
  var t = MS.i18n.t, L = MS.i18n.L;
  var local = ui.local;
  var KEY = 'st.sceneMode';
  if (!('sceneMode' in local)) {
    local.sceneMode = true;
    try { if (root.localStorage && root.localStorage.getItem(KEY) === 'off') local.sceneMode = false; } catch (e) { /* sem storage */ }
  }
  local.sceneSlot = local.sceneSlot || {};  // fase → escolha aberta ('done' = resumo)
  local.sceneIdx = local.sceneIdx || {};    // escolha → opção em foco no botão
  var PHASES = { concept: true, design: true };
  var ROLE_CHAR = { payload: 'sci', bus: 'eng', ground: 'com', manager: 'mgr' };
  var DONE = 'done';

  function rerender() { if (MS.store.state) ui.render(MS.store.state); }
  function plain(x) { return String(L(x) || '').replace(/\[\[(\w+)(?:\|([^\]]+))?\]\]/g, function (m, a, b) { return b || a; }); }

  function active(state) {
    return !!(local.sceneMode && PHASES[state.phase] && !(MS.tutorial && MS.tutorial.active));
  }
  function slotsOf(state) {
    return h.scenario(state).slots.filter(function (s) { return s.phase === state.phase && !s.auto; });
  }
  function roleOf(sc, slot) { return MS.team && MS.team.roleOfSlot ? MS.team.roleOfSlot(sc, slot.id) : null; }
  function charKey(role) { return (role && ROLE_CHAR[role.id]) || 'dir'; }

  // Ordem das opções no controle. Órbita: da mais baixa à mais alta (alavanca).
  function optionsOf(slot) {
    var cat = MS.data.catalog[slot.source] || {};
    var ids = slot.options.slice();
    if (slot.source === 'orbits') ids.sort(function (a, b) { return (cat[a].altitude_km || 0) - (cat[b].altitude_km || 0); });
    return ids;
  }
  // Alavanca só quando as opções diferem em altitude (locais de pouso na Lua: botão).
  function isLever(slot) {
    if (slot.source !== 'orbits') return false;
    var cat = MS.data.catalog.orbits, alts = {};
    slot.options.forEach(function (o) { alts[(cat[o] || {}).altitude_km || 0] = true; });
    return Object.keys(alts).length > 1;
  }

  function openSlot(state, slots) {
    var want = local.sceneSlot[state.phase];
    if (want === DONE && slots.every(function (s) { return state.design[s.id]; })) return null;
    var hit = slots.filter(function (s) { return s.id === want; })[0];
    if (hit) return hit;
    // Em equipe, abre primeiro uma escolha vazia que é MINHA.
    var empty = slots.filter(function (s) { return !state.design[s.id]; });
    return empty.filter(function (s) { return !editLock(state, s); })[0] || empty[0] || null;
  }
  function focusIdx(state, slot, opts) {
    var i = local.sceneIdx[slot.id];
    if (i != null && i >= 0 && i < opts.length) return i;
    var cur = opts.indexOf(state.design[slot.id]);
    return cur >= 0 ? cur : 0;
  }
  function editLock(state, slot) {
    var room = ui.roomInfo();
    if (!room) return null;
    var c = MS.team.can(h.scenario(state), room.members, room.me, 'select', [slot.id]);
    return c.ok ? null : c.reason;
  }

  // ------------------------------------------------------------ Controles
  // Botão giratório: ponteiro de -135° a +135°, um entalhe por opção.
  function knob(n, i, lock) {
    var span = 270, a0 = -135;
    var ang = n > 1 ? a0 + span * i / (n - 1) : 0;
    var ticks = '';
    for (var k = 0; k < n; k++) {
      var ak = (n > 1 ? a0 + span * k / (n - 1) : 0) * Math.PI / 180;
      var x1 = 60 + Math.sin(ak) * 50, y1 = 60 - Math.cos(ak) * 50, x2 = 60 + Math.sin(ak) * 57, y2 = 60 - Math.cos(ak) * 57;
      ticks += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" class="' + (k === i ? 'on' : '') + '"/>';
    }
    return '<div class="sc-dial" data-dial="knob" data-n="' + n + '" role="slider" tabindex="0" aria-valuemin="1" aria-valuemax="' + n + '" aria-valuenow="' + (i + 1) + '" aria-label="' + h.esc(t('sc.knob')) + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><g class="kn-ticks">' + ticks + '</g>' +
      '<circle cx="60" cy="60" r="42" class="kn-ring"/><circle cx="60" cy="60" r="34" class="kn-cap"/>' +
      '<g class="kn-ptr" style="transform:rotate(' + ang + 'deg)"><rect x="57" y="28" width="6" height="22" rx="3"/></g>' +
      '<circle cx="60" cy="60" r="8" class="kn-hub"/></svg></div>';
  }
  // Alavanca de subir/descer (órbita): topo = órbita mais alta.
  function lever(n, i, labels) {
    var pos = n > 1 ? 1 - i / (n - 1) : 0.5;
    var notches = labels.map(function (lb, k) {
      var p = n > 1 ? (1 - k / (n - 1)) * 100 : 50;
      return '<button type="button" class="lv-notch' + (k === i ? ' on' : '') + '" style="top:' + p + '%" data-action="scene-pick" data-i="' + k + '">' + h.esc(lb) + '</button>';
    }).join('');
    return '<div class="sc-lever" data-dial="lever" data-n="' + n + '" role="slider" tabindex="0" aria-valuemin="1" aria-valuemax="' + n + '" aria-valuenow="' + (i + 1) + '" aria-label="' + h.esc(t('sc.lever')) + '">' +
      '<div class="lv-track"><span class="lv-up">▲ ' + h.esc(t('sc.higher')) + '</span><span class="lv-down">▼ ' + h.esc(t('sc.lower')) + '</span>' +
      '<div class="lv-handle" style="top:' + (pos * 100) + '%"><i></i></div></div><div class="lv-notches">' + notches + '</div></div>';
  }

  // Ficha da opção em foco.
  function optionCard(state, slot, id, sv) {
    var cat = MS.data.catalog[slot.source] || {}, it = cat[id] || {};
    var structId = state.design.structure, comp = MS.data.catalog.components;
    var ff = structId && comp[structId] ? comp[structId].formFactor : null;
    var pic = MS.parts3d && MS.parts3d.thumb ? MS.parts3d.thumb(slot.source, id) : '';
    var chosen = state.design[slot.id] === id;
    var rec = MS.levels ? MS.levels.recommended(state, slot.id) : null;
    var hinted = rec && local.hints && local.hints[slot.id] && rec === id;
    return '<div class="sc-opt' + (chosen ? ' chosen' : '') + '">' +
      (pic ? '<span class="sc-opt-pic"><img src="' + h.esc(pic) + '" alt="" draggable="false"></span>' : '') +
      '<div class="sc-opt-top">' + (chosen ? '<span class="sc-tag pixel">✓ ' + h.esc(t('sc.current')) + '</span>' : '') +
      (hinted ? '<span class="hint-star">⭐ ' + h.esc(t('ui.hint')) + '</span>' : '') +
      '<b class="sc-opt-name">' + h.esc(L(it.name)) + '</b></div>' +
      (it.description ? '<p class="sc-opt-desc">' + h.esc(L(it.description)) + '</p>' : '') +
      (sv && h.sciValue ? h.sciValue(sv.options[id]) : '') +
      (it.pros || it.cons ? '<span class="pc">' + (it.pros ? '<span class="pro"><span><b>' + h.esc(t('ui.pro')) + '</b> ' + h.esc(L(it.pros)) + '</span></span>' : '') +
        (it.cons ? '<span class="con"><span><b>' + h.esc(t('ui.con')) + '</b> ' + h.esc(L(it.cons)) + '</span></span>' : '') + '</span>' : '') +
      h.specs(it, ff) + '</div>';
  }

  // Trilha: uma bolinha por escolha da fase, mais o resumo no fim.
  function rail(state, slots, open) {
    return '<ol class="sc-rail">' + slots.map(function (s, k) {
      var done = !!state.design[s.id], on = open && open.id === s.id;
      return '<li class="' + (on ? 'on' : done ? 'done' : '') + '"><button type="button" data-action="scene-go" data-slot="' + h.esc(s.id) + '"' + (on ? ' aria-current="step"' : '') + '>' +
        '<span class="sc-dot">' + (done && !on ? h.icon('ok', { size: 14, stroke: 3 }) : k + 1) + '</span><span class="sc-rl">' + h.esc(plain(s.label)) + '</span></button></li>';
    }).join('') + '<li class="' + (!open ? 'on' : '') + '"><button type="button" data-action="scene-go" data-slot="' + DONE + '"' +
      (slots.every(function (s) { return state.design[s.id]; }) ? '' : ' disabled') + '><span class="sc-dot">★</span><span class="sc-rl">' + h.esc(t('sc.review')) + '</span></button></li></ol>';
  }

  // Fala curta: a 1ª frase à vista; o resto (e o conselho, se está tudo bem)
  // em "saber mais". Conselho com alerta (amarelo/vermelho) fica sempre à vista.
  function bubbleText(help, adv) {
    var txt = String(L(help) || ''), m = txt.match(/^(.+?[.!?])\s+(.+)$/);
    var first = m ? m[1] : txt, rest = m ? m[2] : '';
    var warn = adv && adv.status !== 'ok';
    var more = (rest ? '<p>' + h.rich(rest) + '</p>' : '') + (adv && !warn ? '<p class="sc-adv s-ok">' + h.esc(adv.text) + '</p>' : '');
    return (first ? '<p>' + h.rich(first) + '</p>' : '') +
      (warn ? '<p class="sc-adv s-' + adv.status + '">' + h.esc(adv.text) + '</p>' : '') +
      (more ? '<details class="sc-more"><summary>' + h.esc(t('sc.more')) + '</summary>' + more + '</details>' : '');
  }

  function crewLine(state, result, key) {
    if (!MS.advice || !MS.advice.crew) return null;
    return MS.advice.crew(state, result).filter(function (a) { return a.key === key; })[0] || null;
  }

  function stage(state, result, slot) {
    var sc = h.scenario(state), role = roleOf(sc, slot), ck = charKey(role);
    var opts = optionsOf(slot), i = focusIdx(state, slot, opts), id = opts[i];
    var cat = MS.data.catalog[slot.source] || {};
    var lock = editLock(state, slot);
    var chosen = state.design[slot.id] === id;
    var sv = slot.id === 'payload' && MS.advice && MS.advice.scienceValue ? MS.advice.scienceValue(state) : null;
    var adv = crewLine(state, result, ck);
    var rec = MS.levels ? MS.levels.recommended(state, slot.id) : null;
    var who = role ? L(role.name) : t('crew.dir.title');
    var room = ui.roomInfo(), owner = room && role ? MS.team.slotOwner(sc, room.members, slot.id) : null;
    if (owner && owner.member) who += ' · ' + owner.member.name;
    var ctrl = isLever(slot)
      ? lever(opts.length, i, opts.map(function (o) { return L(cat[o].name); }))
      : knob(opts.length, i, lock) + '<div class="sc-pills">' + opts.map(function (o, k) {
          return '<button type="button" class="sc-pill' + (k === i ? ' on' : '') + (state.design[slot.id] === o ? ' chosen' : '') + '" data-action="scene-pick" data-i="' + k + '">' + h.esc(L(cat[o].name)) + '</button>';
        }).join('') + '</div>';
    return '<div class="sc-grid">' +
      '<aside class="sc-crew r-' + ck + '">' + h.character(ck, 132, { anim: true }) +
        '<span class="sc-who"><b>' + h.esc(who) + '</b></span>' +
        '<div class="sc-bubble"><p class="sc-q">' + h.rich(slot.label) + '</p>' + bubbleText(slot.help, adv) +
          (rec && !(local.hints && local.hints[slot.id]) ? '<button type="button" class="btn small hint-btn" data-action="hint" data-slot="' + h.esc(slot.id) + '">💡 ' + h.esc(t('ui.hintAsk')) + '</button>' : '') +
        '</div></aside>' +
      '<section class="sc-view"><div class="card hangar-card sc-hangar"><div data-viz="hangar"></div></div></section>' +
      '<section class="sc-console" aria-label="' + h.esc(t('sc.console')) + '">' +
        '<div class="sc-ctrl' + (isLever(slot) ? ' is-lever' : '') + '"><button type="button" class="sc-arrow" data-action="scene-turn" data-dir="-1" aria-label="' + h.esc(t('sc.prev')) + '"' + (i === 0 ? ' disabled' : '') + '>' + (isLever(slot) ? '▼' : '◀') + '</button>' +
          ctrl + '<button type="button" class="sc-arrow" data-action="scene-turn" data-dir="1" aria-label="' + h.esc(t('sc.next')) + '"' + (i === opts.length - 1 ? ' disabled' : '') + '>' + (isLever(slot) ? '▲' : '▶') + '</button></div>' +
        '<p class="sc-count pixel">' + (i + 1) + ' / ' + opts.length + '</p>' +
        optionCard(state, slot, id, sv) +
        '<div class="sc-go"><button type="button" class="sc-press' + (chosen ? ' done' : '') + '" data-action="scene-confirm" data-slot="' + h.esc(slot.id) + '" data-option="' + h.esc(id) + '"' + (lock ? ' disabled' : '') + '>' +
          '<span class="sp-cap"></span><span class="sp-txt">' + h.esc(chosen ? t('sc.keep') : t('sc.confirm')) + '</span></button>' +
          (lock ? '<p class="small muted">' + h.esc(lock) + '</p>' : '<p class="small muted">' + h.esc(t('sc.confirmNote')) + '</p>') + '</div>' +
      '</section></div>';
  }

  function summary(state, result, slots) {
    var sc = h.scenario(state), cat = MS.data.catalog;
    var all = h.scenario(state).slots.filter(function (s) { return s.phase === state.phase; });
    var items = all.map(function (s) {
      var id = state.design[s.id], it = id ? (cat[s.source] || {})[id] : null, role = roleOf(sc, s);
      return '<li class="r-' + charKey(role) + '">' + h.character(charKey(role), 44) + '<div><span class="small muted">' + h.esc(plain(s.label)) + '</span><b>' + h.esc(it ? L(it.name) : '—') + '</b></div>' +
        (s.auto ? '' : '<button type="button" class="btn small" data-action="scene-go" data-slot="' + h.esc(s.id) + '">' + h.esc(t('sc.change')) + '</button>') + '</li>';
    }).join('');
    var check = state.phase === 'design' && h.missionCheck ? h.missionCheck(result)
      : h.statusRows(result.checks.filter(function (c) { return c.id === 'launch' || c.id === 'contact'; }));
    return '<div class="sc-grid sc-sum">' +
      '<section class="sc-view"><div class="card hangar-card sc-hangar"><div data-viz="hangar"></div></div></section>' +
      '<section class="sc-console"><h2>' + h.esc(t('sc.allSet')) + '</h2><p class="section-note">' + h.esc(t('sc.allSetNote')) + '</p>' +
        '<ul class="sc-chosen">' + items + '</ul><div class="ck-panel"><div class="ck-head"><h2>' + h.icon('ok', { size: 16 }) + h.esc(t('ck.check')) + '</h2></div>' + check + '</div></section></div>';
  }

  // Torre de controle: em equipe, quem não tem escolha nesta fase (ex.: o
  // gerente no Projeto) vê ao vivo quem está escolhendo o quê.
  function tower(state, result, slots) {
    var sc = h.scenario(state), cat = MS.data.catalog, room = ui.roomInfo();
    var rows = slots.map(function (s) {
      var role = roleOf(sc, s), own = room && role ? MS.team.slotOwner(sc, room.members, s.id) : null;
      var id = state.design[s.id], it = id ? (cat[s.source] || {})[id] : null;
      return '<li class="r-' + charKey(role) + (it ? ' done' : '') + '">' + h.character(charKey(role), 48, { anim: !it }) +
        '<div><b>' + h.esc(own && own.member ? own.member.name : t('ui.free')) + '</b><span class="small muted">' + h.esc(plain(s.label)) + '</span></div>' +
        '<span class="tw-st">' + (it ? h.icon('ok', { size: 14, stroke: 3 }) + h.esc(L(it.name)) : '<span class="tw-dots">' + h.esc(t('sc.tower.choosing')) + '</span>') + '</span>' +
        '<button type="button" class="btn small" data-action="scene-go" data-slot="' + h.esc(s.id) + '">' + h.esc(t('sc.tower.see')) + '</button></li>';
    }).join('');
    var n = slots.filter(function (s) { return state.design[s.id]; }).length;
    var check = state.phase === 'design' && h.missionCheck ? h.missionCheck(result)
      : h.statusRows(result.checks.filter(function (c) { return c.id === 'launch' || c.id === 'contact'; }));
    return '<div class="sc-grid sc-sum">' +
      '<section class="sc-view"><div class="card hangar-card sc-hangar"><div data-viz="hangar"></div></div></section>' +
      '<section class="sc-console"><h2>' + h.icon('team', { size: 18 }) + h.esc(t('sc.tower.title')) + ' <span class="tw-n pixel">' + n + '/' + slots.length + '</span></h2>' +
        '<p class="section-note">' + h.esc(t('sc.tower.note')) + '</p><ul class="sc-tower">' + rows + '</ul>' +
        '<div class="ck-panel"><div class="ck-head"><h2>' + h.icon('ok', { size: 16 }) + h.esc(t('ck.check')) + '</h2></div>' + check + '</div></section></div>';
  }
  function towerFor(state, slots) {
    if (!ui.roomInfo() || local.sceneSlot[state.phase]) return false;
    return slots.length && slots.every(function (s) { return !!editLock(state, s); }) && slots.some(function (s) { return !state.design[s.id]; });
  }

  function sceneHTML(state, result) {
    var slots = slotsOf(state), open = openSlot(state, slots);
    if (towerFor(state, slots)) {
      var tk = state.phase + '|tower', te = local.sceneLastKey !== tk;
      local.sceneLastKey = tk; local.sceneOpen = null;
      return '<div class="scene' + (te ? ' sc-enter' : '') + '"><div class="sc-top">' + rail(state, slots, null) +
        '<button type="button" class="btn small sc-mode" data-action="scene-mode">' + h.icon('eye', { size: 16 }) + h.esc(t('sc.full')) + '</button></div>' +
        tower(state, result, slots) + '</div>';
    }
    var key = state.phase + '|' + (open ? open.id : DONE);
    var enter = local.sceneLastKey !== key;
    local.sceneLastKey = key;
    local.sceneOpen = open ? open.id : null;
    return '<div class="scene' + (enter ? ' sc-enter' : '') + '">' +
      '<div class="sc-top">' + rail(state, slots, open) +
        '<button type="button" class="btn small sc-mode" data-action="scene-mode">' + h.icon('eye', { size: 16 }) + h.esc(t('sc.full')) + '</button></div>' +
      (open ? stage(state, result, open) : summary(state, result, slots)) + '</div>';
  }
  function modeBar() {
    return '<div class="sc-back"><button type="button" class="btn small" data-action="scene-mode">' + h.icon('rocket', { size: 16 }) + h.esc(t('sc.toScene')) + '</button></div>';
  }

  // ---------------------------------------- Requisitos em cartas que viram
  // Uma carta por requisito. Frente: o que o cliente quer. Verso: o número
  // que prova isso, as escolhas que mexem nele, como será conferido e o
  // valor agora. Clique vira a carta; "Próxima carta" segue.
  var OPS_REQ = { '<=': '≤', '>=': '≥', '<': '<', '>': '>' };
  function reqScene(state, result) {
    var sc = h.scenario(state), reqs = result.requirements, U = MS.sim.util;
    if (!reqs.length) return null;
    var goals = {};
    sc.goals.forEach(function (g) { goals[g.id] = g.text; });
    var verif = {};
    result.verification.forEach(function (v) { v.items.forEach(function (it) { if (it.kind === 'requirement') verif[it.id] = v; }); });
    var i = Math.max(0, Math.min(reqs.length - 1, local.reqIdx || 0)), r = reqs[i];
    local.reqFlip = local.reqFlip || {};
    var flipped = !!local.reqFlip[r.id];
    var key = 'req|' + r.id, enter = local.sceneLastKey !== key;
    local.sceneLastKey = key;
    var railH = '<ol class="sc-rail">' + reqs.map(function (x, k) {
      var seen = !!local.reqFlip[x.id];
      return '<li class="' + (k === i ? 'on' : seen ? 'done' : '') + '"><button type="button" data-action="req-go" data-i="' + k + '"' + (k === i ? ' aria-current="step"' : '') + '>' +
        '<span class="sc-dot">' + (seen && k !== i ? h.icon('ok', { size: 14, stroke: 3 }) : h.esc(x.id)) + '</span><span class="sc-rl">' + h.esc(x.title) + '</span></button></li>';
    }).join('') + '</ol>';
    var metric = result.metrics[r.metric];
    var target = r.ref ? t('req3.refTarget', { m: L((MS.sim.metricInfo()[r.ref] || {}).label) || r.ref })
      : (OPS_REQ[r.op] || r.op) + ' ' + U.withUnit(r.threshold, r.unit, r.threshold === Math.round(r.threshold) ? 0 : 1);
    var drivers = (r.drivers || []).map(function (id) {
      var slot = sc.slots.filter(function (x) { return x.id === id; })[0];
      if (!slot) return '';
      var cur = state.design[id], cat = MS.data.catalog[slot.source] || {};
      return '<li class="' + (cur ? 'set' : '') + '"><b>' + h.esc(plain(slot.label)) + '</b><span>' + h.esc(cur && cat[cur] ? L(cat[cur].name) : t(slot.phase === 'design' ? 'req3.inDesign' : 'req3.notYet')) + '</span></li>';
    }).join('');
    var v = verif[r.id];
    var now = r.status === 'pending' ? '<span class="muted">' + h.esc(t('req3.waiting')) + '</span>'
      : h.stateTag(r.status) + ' <span>' + h.esc(t('req3.now', { v: U.withUnit(r.value, r.unit, metric ? metric.decimals : 1) })) + '</span>';
    var c = MS.advice && MS.advice.client ? MS.advice.client(state, result) : null;
    var front = '<div class="rc-face rc-front"><span class="rc-tag pixel">' + h.esc(r.id) + '</span>' +
      '<span class="eyebrow">' + h.icon('team', { size: 14 }) + h.esc(t('req3.goal')) + (c && c.name ? ' · ' + h.esc(c.name) : '') + '</span>' +
      '<p class="rc-goal">“' + h.rich(r.goal ? goals[r.goal] : r.title) + '”</p><span class="rc-hint">' + h.esc(t('sc.req.flip')) + ' ↻</span></div>';
    var back = '<div class="rc-face rc-back s-' + r.status + '"><span class="rc-tag pixel">' + h.esc(r.id) + '</span>' +
      '<b class="rc-title">' + h.esc(r.title) + '</b><span class="rc-target' + (r.ref ? '' : ' pixel') + '">' + h.esc(target) + '</span>' +
      '<span class="eyebrow">' + h.icon('eng', { size: 14 }) + h.esc(t('req3.drivers')) + '</span><ul class="rc-drivers">' + drivers + '</ul>' +
      (v ? '<span class="eyebrow">' + h.icon('ok', { size: 14 }) + h.esc(t('req3.verify')) + '</span><p class="rc-verif"><b>' + h.esc(v.method) + '</b> · ' + h.esc(v.title) + '</p>' : '') +
      '<div class="rc-now">' + now + '</div></div>';
    var nav = '<div class="rc-nav">' +
      (i > 0 ? '<button type="button" class="btn" data-action="req-go" data-i="' + (i - 1) + '">← ' + h.esc(t('sc.req.prev')) + '</button>' : '<span></span>') +
      (i < reqs.length - 1 ? '<button type="button" class="btn primary big-go" data-action="req-go" data-i="' + (i + 1) + '"' + (flipped ? '' : ' disabled') + '>' + h.esc(t('sc.req.next')) + ' →</button>'
        : '<span class="rc-done">' + h.esc(t(flipped ? 'sc.req.allSeen' : 'sc.req.flipLast')) + '</span>') + '</div>';
    return '<div class="scene sc-req' + (enter ? ' sc-enter' : '') + '"><div class="sc-top">' + railH +
      '<button type="button" class="btn small sc-mode" data-action="scene-mode">' + h.icon('eye', { size: 16 }) + h.esc(t('sc.full')) + '</button></div>' +
      '<div class="rc-stage"><div role="button" tabindex="0" class="rc-card' + (flipped ? ' flipped' : '') + '" data-action="req-flip" data-id="' + h.esc(r.id) + '" aria-pressed="' + flipped + '">' +
      '<span class="rc-inner">' + front + back + '</span></div>' + nav + '</div></div>';
  }
  ui.actions['req-flip'] = function (d) {
    local.reqFlip = local.reqFlip || {};
    var on = local.reqFlip[d.id] = !local.reqFlip[d.id];
    sound('flip');
    // Vira a carta que já está na tela (sem redesenhar), para a animação 3D
    // acontecer de verdade; só redesenha se a carta não estiver no documento.
    var card = root.document && root.document.querySelector('.rc-card[data-id="' + String(d.id).replace(/"/g, '') + '"]');
    if (!card) { rerender(); return; }
    card.classList.toggle('flipped', on);
    card.setAttribute('aria-pressed', String(on));
    card.classList.remove('flipping'); void card.offsetWidth; card.classList.add('flipping');
    var nx = root.document.querySelector('.rc-nav .big-go');
    if (nx) nx.disabled = !on;
    var dn = root.document.querySelector('.rc-nav .rc-done');
    if (dn) dn.textContent = t(on ? 'sc.req.allSeen' : 'sc.req.flipLast');
    var dot = root.document.querySelector('.sc-req .sc-rail li.on');
    if (dot) dot.classList.toggle('seen', on);
  };
  ui.actions['req-go'] = function (d) { local.reqIdx = Number(d.i); rerender(); };
  (function () {
    var scr = ui.screens.requirements;
    if (!scr) return;
    var orig = scr.render;
    scr.render = function (state, result) {
      if (local.sceneMode && !(MS.tutorial && MS.tutorial.active)) {
        var html = reqScene(state, result);
        if (html) return html;
      }
      return (local.sceneMode === false && !(MS.tutorial && MS.tutorial.active) ? modeBar() : '') + orig(state, result);
    };
  })();

  // ------------------------------------- Construir: checklist de lançamento
  // checar → palpite → data → lançar (o botão vermelho é o mesmo "next" do
  // rodapé, então o GO da equipe e o lançamento seguem as mesmas regras).
  function buildSteps(p) { return ['check', 'predict'].concat(p.window ? ['window'] : []).concat(['launch']); }
  function buildScene(state, result) {
    var p = ui.buildParts(state, result), steps = buildSteps(p);
    var cur = steps.indexOf(local.buildStep) >= 0 ? local.buildStep : 'check', i = steps.indexOf(cur);
    var key = 'build|' + cur, enter = local.sceneLastKey !== key;
    local.sceneLastKey = key;
    var done = { check: !p.fails, predict: !!state.prediction, window: !!state.period, launch: false };
    var railH = '<ol class="sc-rail">' + steps.map(function (s, k) {
      return '<li class="' + (s === cur ? 'on' : k < i && done[s] ? 'done' : '') + '"><button type="button" data-action="build-step" data-step="' + s + '"' + (s === cur ? ' aria-current="step"' : '') + '>' +
        '<span class="sc-dot">' + (k < i && done[s] ? h.icon('ok', { size: 14, stroke: 3 }) : k + 1) + '</span><span class="sc-rl">' + h.esc(t('sc.build.' + s)) + '</span></button></li>';
    }).join('') + '</ol>';
    var body;
    if (cur === 'launch') {
      var can = MS.store.canAdvance(state), lock = ui.phaseLock ? ui.phaseLock(state) : null;
      var g = ui.teamGo ? ui.teamGo(state) : { need: false };
      var label = g.need && !g.all ? (g.asked && !g.no ? t('go.wait', { n: g.yes, total: g.total }) : g.no ? t('go.again') : t('go.ask')) : t('sc.launch');
      var off = !can.ok || (g.need ? (g.all && !!lock) || (g.asked && !g.no && !g.all) : !!lock);
      body = (g.need ? p.go : '') + '<div class="sc-launch"><p class="sc-launch-q">' + h.esc(t(p.fails ? 'sc.launchRisky' : 'sc.launchQ')) + '</p>' +
        '<button type="button" class="sc-press sc-big" data-action="next"' + (off ? ' disabled' : '') + '><span class="sp-cap"></span><span class="sp-txt">' + h.esc(label) + '</span></button>' +
        (lock && !g.need ? '<p class="small muted">' + h.esc(lock) + '</p>' : '') + '</div>';
    } else {
      body = p[cur] + '<div class="sc-next"><button type="button" class="btn primary big-go" data-action="build-step" data-step="' + steps[i + 1] + '">' +
        h.esc(t('sc.build.go.' + steps[i + 1])) + ' →</button></div>';
    }
    return '<div class="scene sc-build' + (enter ? ' sc-enter' : '') + '"><div class="sc-top">' + railH +
      '<button type="button" class="btn small sc-mode" data-action="scene-mode">' + h.icon('eye', { size: 16 }) + h.esc(t('sc.full')) + '</button></div>' +
      '<div class="sc-grid sc-one"><div>' + body + '</div></div></div>';
  }
  ui.actions['build-step'] = function (d) { local.buildStep = d.step; rerender(); root.scrollTo(0, 0); };
  // Palpite e data escolhidos já levam para a próxima cena.
  ['predict', 'period'].forEach(function (name) {
    var orig = ui.actions[name];
    ui.actions[name] = function (d) {
      orig(d);
      var st = MS.store.state;
      if (!local.sceneMode || !st || st.phase !== 'build') return;
      var p = ui.buildParts(st, MS.sim.run(st)), steps = buildSteps(p), i = steps.indexOf(local.buildStep);
      if (i >= 0 && i < steps.length - 1 && (name === 'period' || st.prediction)) { local.buildStep = steps[i + 1]; rerender(); }
    };
  });

  // ------------------------------------- Abertura de fase (transição)
  // Ao trocar de fase, um cartão grande por 1,8 s: "Passo 4 de 6 · Projeto",
  // com o personagem que comanda a fase. Clique para pular.
  var PHASE_CHAR = { need: 'dir', concept: 'mgr', requirements: 'sci', design: 'eng', build: 'eng', implement: 'com', report: 'dir' };
  ui.phaseIntro = function (state) {
    if (!root.document || (MS.tutorial && MS.tutorial.active) || local.menuOpen) return;
    sound('phase');
    var reduce = false;
    try { reduce = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sem matchMedia */ }
    if (reduce) return;
    var ph = MS.store.phaseInfo(state).current;
    var old = root.document.querySelector('.ph-intro');
    if (old) old.remove();
    var el = root.document.createElement('div');
    el.className = 'ph-intro';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="pi-card"><span class="pi-step pixel">' + h.esc(ph.nasaStep ? t('ui.stepOf', { n: ph.nasaStep, total: 6 }) : t('ui.finalStep')) + '</span>' +
      h.character(PHASE_CHAR[state.phase] || 'dir', 120, { anim: true }) +
      '<h2 class="pi-title pixel">' + h.esc(L(ph.title)) + '</h2><p class="pi-sub">' + h.esc(L(ph.subtitle) || '') + '</p></div>';
    el.addEventListener('click', function () { el.remove(); });
    root.document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 1500);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 1900);
  };

  // ----------------------------------------------- Fase 1 em 3 cenas
  // cliente → missão → como jogar; o botão grande leva para a próxima.
  var NEED = ['client', 'brief', 'play'];
  function needScene(state) {
    var p = ui.needParts(state), cur = NEED.indexOf(local.needStep) >= 0 ? local.needStep : 'client';
    var i = NEED.indexOf(cur);
    var key = 'need|' + cur, enter = local.sceneLastKey !== key;
    local.sceneLastKey = key;
    var railH = '<ol class="sc-rail">' + NEED.map(function (s, k) {
      return '<li class="' + (s === cur ? 'on' : k < i ? 'done' : '') + '"><button type="button" data-action="need-step" data-step="' + s + '"' + (s === cur ? ' aria-current="step"' : '') + '>' +
        '<span class="sc-dot">' + (k < i ? h.icon('ok', { size: 14, stroke: 3 }) : k + 1) + '</span><span class="sc-rl">' + h.esc(t('sc.need.' + s)) + '</span></button></li>';
    }).join('') + '</ol>';
    var nextBtn = i < NEED.length - 1
      ? '<div class="sc-next"><button type="button" class="btn primary big-go" data-action="need-step" data-step="' + NEED[i + 1] + '">' + h.esc(t('sc.need.go.' + NEED[i + 1])) + ' →</button></div>'
      : '';
    return '<div class="scene sc-need' + (enter ? ' sc-enter' : '') + '"><div class="sc-top">' + railH +
      '<button type="button" class="btn small sc-mode" data-action="scene-mode">' + h.icon('eye', { size: 16 }) + h.esc(t('sc.full')) + '</button></div>' +
      '<div class="sc-grid sc-one">' + '<div>' + p[cur] + nextBtn + '</div></div></div>';
  }
  ui.actions['need-step'] = function (d) {
    local.needStep = d.step; rerender(); root.scrollTo(0, 0);
  };
  // Escolher o cliente já leva para a missão dele.
  var origScenario = ui.actions.scenario;
  ui.actions.scenario = function (d) {
    origScenario(d);
    var st = MS.store.state;
    if (local.sceneMode && st && st.phase === 'need' && st.scenarioId === d.id) { local.needStep = 'brief'; rerender(); }
  };

  // Embrulha as telas: com o modo cena ligado, a cena; senão, o painel de antes.
  (function () {
    var scr = ui.screens.build;
    if (!scr || !ui.buildParts) return;
    var orig = scr.render;
    scr.render = function (state, result) {
      if (local.sceneMode && !(MS.tutorial && MS.tutorial.active)) return buildScene(state, result);
      return (local.sceneMode === false && !(MS.tutorial && MS.tutorial.active) ? modeBar() : '') + orig(state, result);
    };
  })();
  (function () {
    var scr = ui.screens.need;
    if (!scr || !ui.needParts) return;
    var orig = scr.render;
    scr.render = function (state, result) {
      if (local.sceneMode && !(MS.tutorial && MS.tutorial.active)) return needScene(state);
      return (local.sceneMode === false && !(MS.tutorial && MS.tutorial.active) ? modeBar() : '') + orig(state, result);
    };
  })();
  Object.keys(PHASES).forEach(function (id) {
    var scr = ui.screens[id];
    if (!scr) return;
    var orig = scr.render;
    scr.render = function (state, result) {
      if (active(state)) return sceneHTML(state, result);
      return (local.sceneMode === false && !(MS.tutorial && MS.tutorial.active) ? modeBar() : '') + orig(state, result);
    };
  });

  // ---------------------------------------------------------------- Som
  function sound(n, a) { if (MS.sfx) MS.sfx.play(n, a); }

  // --------------------------------------------------------------- Ações
  function openNow() {
    var st = MS.store.state;
    if (!st || !local.sceneOpen) return null;
    return slotsOf(st).filter(function (s) { return s.id === local.sceneOpen; })[0] || null;
  }
  function setIdx(slot, i) {
    var n = optionsOf(slot).length;
    i = Math.max(0, Math.min(n - 1, i));
    if (local.sceneIdx[slot.id] === i) return false;
    local.sceneIdx[slot.id] = i;
    sound('tick', i);
    return true;
  }
  Object.assign(ui.actions, {
    'scene-turn': function (d) {
      var slot = openNow(); if (!slot) return;
      var st = MS.store.state, opts = optionsOf(slot);
      if (setIdx(slot, focusIdx(st, slot, opts) + Number(d.dir))) rerender();
    },
    'scene-pick': function (d) {
      var slot = openNow(); if (!slot) return;
      if (setIdx(slot, Number(d.i))) rerender();
    },
    'scene-go': function (d) {
      var st = MS.store.state; if (!st) return;
      local.sceneSlot[st.phase] = d.slot;
      if (d.slot !== DONE) delete local.sceneIdx[d.slot];
      ui.clearPreview();
      rerender();
    },
    'scene-confirm': function (d) {
      var st = MS.store.state; if (!st) return;
      sound('confirm');
      // Próxima cena: a próxima escolha ainda vazia (ou o resumo).
      var rest = slotsOf(st).filter(function (s) { return s.id !== d.slot && !st.design[s.id]; });
      var after = rest.filter(function (s) { return !editLock(st, s); })[0] || rest[0];
      local.sceneSlot[st.phase] = after ? after.id : DONE;
      delete local.sceneIdx[d.slot];
      ui.clearPreview();
      if (st.design[d.slot] === d.option) { rerender(); return; }
      ui.dispatch('select', [d.slot, d.option]);
    },
    'scene-mode': function () {
      local.sceneMode = !local.sceneMode;
      try { if (root.localStorage) root.localStorage.setItem(KEY, local.sceneMode ? 'on' : 'off'); } catch (e) { /* sem storage */ }
      ui.clearPreview();
      rerender();
      root.scrollTo(0, 0);
    }
  });

  // Depois de desenhar: a opção em foco aparece como prévia (HUD + hangar).
  ui.sceneAfter = function (rootEl, state) {
    var fresh = rootEl && rootEl.querySelector && rootEl.querySelector('.scene.sc-enter');
    if (fresh && root.innerWidth <= 760 && fresh.getBoundingClientRect().top < 0) {
      try { fresh.scrollIntoView({ block: 'start' }); } catch (e) { /* navegador antigo */ }
    }
    if (!active(state)) return;
    var slot = openNow();
    if (!slot) return;
    var opts = optionsOf(slot), id = opts[focusIdx(state, slot, opts)];
    if (id && state.design[slot.id] !== id) ui.preview(slot.id, id); else ui.clearPreview();
  };

  // Girar com o mouse/dedo: arrastar no botão ou na alavanca escolhe o entalhe.
  function idxFromPointer(el, e) {
    var r = el.getBoundingClientRect(), n = Number(el.dataset.n) || 1;
    if (el.dataset.dial === 'lever') {
      var tr = el.querySelector('.lv-track').getBoundingClientRect();
      var p = 1 - Math.max(0, Math.min(1, (e.clientY - tr.top) / tr.height));
      return Math.round(p * (n - 1));
    }
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var a = Math.atan2(e.clientX - cx, cy - e.clientY) * 180 / Math.PI; // 0 = para cima
    a = Math.max(-135, Math.min(135, a));
    return n > 1 ? Math.round((a + 135) / 270 * (n - 1)) : 0;
  }
  if (root.document && root.document.addEventListener) {
    var drag = null;
    root.document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest && e.target.closest('[data-dial]');
      if (!el || e.target.closest('button')) return;
      drag = el;
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
      e.preventDefault();
    });
    root.document.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var el = drag, slot = openNow(); drag = null;
      if (slot && setIdx(slot, idxFromPointer(el, e))) rerender();
    });
    root.document.addEventListener('keydown', function (e) {
      // Carta de requisito: Enter ou espaço vira.
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('rc-card')) { e.preventDefault(); e.target.click(); return; }
      var el = e.target.closest && e.target.closest('[data-dial]');
      if (!el) return;
      var step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (e.key === 'Enter' || e.key === ' ') {
        var b = root.document.querySelector('.sc-press');
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
        return;
      }
      if (!step) return;
      e.preventDefault();
      var slot = openNow(); if (!slot) return;
      if (setIdx(slot, focusIdx(MS.store.state, slot, optionsOf(slot)) + step)) {
        rerender();
        var again = root.document.querySelector('[data-dial]');
        if (again) again.focus({ preventScroll: true });
      }
    });
  }

  ui.scene = { active: active, html: sceneHTML };
})(globalThis);
