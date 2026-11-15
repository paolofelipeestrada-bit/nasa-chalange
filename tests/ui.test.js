/* Testes da interface: toda fase tem tela e o fluxo funciona por cliques. */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert;
  var GOOD = {
    orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
    payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
    adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
  };

  T.group('Interface');
  // Estes testes usam o painel completo (cartões); o modo cena tem testes próprios abaixo.
  MS.ui.local.sceneMode = false;

  test('toda fase de phases.js tem uma tela registrada', function () {
    MS.data.flow.phases.forEach(function (p) { assert(MS.ui.screens[p.screen], 'sem tela: ' + p.screen); });
  });

  test('todas as telas montam sem erro, com projeto vazio e completo', function () {
    [{}, GOOD].forEach(function (design) {
      MS.data.flow.phases.forEach(function (p) {
        var s = Object.assign(MS.store.createState(), { phase: p.id, reached: p.id, design: Object.assign({}, MS.store.createState().design, design) });
        var html = MS.ui.renderHTML(s);
        assert(html.indexOf('Erro ao montar') === -1, p.id + ': erro ao montar');
        assert(html.indexOf('não está registrada') === -1, p.id + ': tela ausente');
        T.assert.includes(html, MS.ui.h.esc(MS.i18n.L(p.title)));
      });
    });
  });

  test('menu inicial: botões, "continuar" com progresso e volta ao jogo', function () {
    var local = MS.ui.local, was = local.menuOpen;
    try {
      local.menuOpen = true;
      var fresh = MS.store.createState();
      var html = MS.ui.renderHTML(fresh);
      ['menu-play', 'menu-team', 'menu-how', 'menu-about'].forEach(function (a) { T.assert.includes(html, 'data-action="' + a + '"'); });
      assert(html.indexOf('data-action="menu-new"') === -1, 'sem progresso não há "Nova missão"');
      assert(html.indexOf('class="top"') === -1, 'o menu cobre a tela toda (sem topo do jogo)');
      var going = Object.assign(MS.store.createState(), { phase: 'design', reached: 'design', design: Object.assign({}, fresh.design, GOOD) });
      html = MS.ui.renderHTML(going);
      T.assert.includes(html, MS.ui.h.esc(MS.i18n.t('menu.continue')));
      T.assert.includes(html, 'data-action="menu-new"');
      local.menuOpen = false;
      T.assert.includes(MS.ui.renderHTML(going), 'data-action="menu-open"');
    } finally { local.menuOpen = was; }
  });

  test('tutorial: todo passo tem texto nos 3 idiomas e o alvo existe na tela de exemplo', function () {
    var steps = MS.data.tutorial.steps, phase = 'need', demo = 'empty';
    assert(steps.length >= 5, 'poucos passos');
    steps.forEach(function (st, i) {
      ['en', 'pt', 'es'].forEach(function (l) { assert(st.title[l] && st.text[l], 'passo ' + (i + 1) + ' sem texto em ' + l); });
      if (st.phase) { phase = st.phase; demo = st.demo || 'empty'; }
      if (!st.target) return;
      var box = document.createElement('div');
      box.innerHTML = MS.ui.renderHTML(MS.tutorial.demoState(demo, phase));
      assert(box.querySelector(st.target), 'passo ' + (i + 1) + ': alvo "' + st.target + '" não existe na fase ' + phase);
    });
  });

  test('tutorial: o projeto de exemplo não mexe no projeto do jogador', function () {
    MS.store.init({ storage: null, render: function () {} });
    var before = JSON.stringify(MS.store.state);
    var full = MS.tutorial.demoState('full', 'design');
    var sc = MS.data.scenarios[full.scenarioId];
    sc.slots.forEach(function (slot) { assert(sc.slots && full.design[slot.id], 'exemplo sem ' + slot.id); });
    assert.equal(full.phase, 'design');
    var concept = MS.tutorial.demoState('concept', 'concept');
    sc.slots.forEach(function (slot) { assert.equal(!!concept.design[slot.id], slot.phase === 'concept', slot.id); });
    assert.equal(JSON.stringify(MS.store.state), before);
  });

  test('fluxo completo por cliques até o relatório e de volta ao Design', function () {
    var el = document.createElement('div');
    MS.ui.mount(el);
    MS.store.init({ storage: null, render: MS.ui.render });
    MS.store.setSeed(T.quietSeed(GOOD)); // semente sem imprevistos: nota previsível
    function click(sel) {
      var b = el.querySelector(sel);
      assert(b, 'botão não encontrado: ' + sel);
      assert(!b.disabled, 'botão desabilitado: ' + sel);
      b.click();
    }
    function pick(slot) { click('[data-action="select"][data-slot="' + slot + '"][data-option="' + GOOD[slot] + '"]'); }

    click('[data-action="next"]');
    assert.equal(MS.store.state.phase, 'concept');
    assert(el.querySelector('[data-action="next"]').disabled, 'Avançar deveria estar bloqueado');
    ['orbit', 'launcher', 'groundStation'].forEach(pick);
    click('[data-action="next"]'); click('[data-action="next"]');
    assert.equal(MS.store.state.phase, 'design');
    ['payload', 'structure', 'power', 'adcs', 'comms', 'obc'].forEach(pick);
    T.assert.includes(el.innerHTML, 'MEL');
    click('[data-action="next"]'); click('[data-action="next"]');
    assert.equal(MS.store.state.phase, 'implement');
    // Missão no tempo: primeiro a data de lançamento, depois as decisões.
    assert(el.querySelector('[data-action="next"]').disabled, 'sem data de lançamento não deveria avançar');
    click('[data-action="period"][data-id="y2019"]');
    assert(el.querySelector('[data-action="decide"]'), 'deveria pedir uma decisão');
    click('[data-action="decide"][data-id="storm"][data-choice="radiation"]');
    assert(!el.querySelector('[data-action="decide"]'), 'a decisão deveria sumir depois de respondida');
    click('[data-action="next"]');
    assert.equal(MS.store.state.phase, 'report');
    T.assert.includes(el.textContent, 'Missão exemplar');
    click('[data-action="retry"]');
    assert.equal(MS.store.state.phase, 'design');
    assert.equal(MS.store.state.attempt, 2);
  });

  test('modo cena: uma escolha por vez; girar só mostra, confirmar escolhe e avança', function () {
    var local = MS.ui.local;
    var el = document.createElement('div');
    MS.ui.mount(el);
    MS.store.init({ storage: null, render: MS.ui.render });
    local.sceneMode = true; local.sceneSlot = {}; local.sceneIdx = {};
    try {
      MS.store.nextPhase();
      assert.equal(MS.store.state.phase, 'concept');
      assert(el.querySelector('.scene'), 'o Conceito deveria abrir em modo cena');
      assert(!el.querySelector('[data-action="select"]'), 'no modo cena não há cartões soltos');
      T.assert.includes(el.querySelector('.sc-rail .on').textContent, MS.i18n.L(MS.data.scenarios.eo_cubesat.slots.filter(function (s) { return s.id === 'orbit'; })[0].label));
      // Órbita é uma alavanca: da mais baixa (índice 0) à mais alta.
      assert(el.querySelector('.sc-lever'), 'a órbita usa a alavanca de subir/descer');
      var before = JSON.stringify(MS.store.state.design);
      el.querySelector('.lv-notch[data-i="2"]').click();
      assert.equal(JSON.stringify(MS.store.state.design), before, 'girar/mover não muda o projeto');
      var press = el.querySelector('.sc-press');
      var opt = press.dataset.option;
      press.click();
      assert.equal(MS.store.state.design.orbit, opt, 'confirmar escolhe a opção em foco');
      assert(el.querySelector('.sc-dial'), 'a próxima escolha (foguete) usa o botão giratório');
      assert(el.querySelector('.sc-rail .on').textContent.length > 0);
      // O botão "Ver painel completo" volta aos cartões de antes.
      el.querySelector('[data-action="scene-mode"]').click();
      assert(el.querySelector('[data-action="select"]'), 'painel completo mostra os cartões');
      assert(!el.querySelector('.scene'));
    } finally {
      local.sceneMode = false;
      try { localStorage.removeItem('st.sceneMode'); } catch (e) { /* sem storage */ } // o clique no botão grava a preferência
    }
  });

  test('GO da equipe: sem sala não muda nada; em sala, lançar pede o GO de todos', function () {
    var st = Object.assign(MS.store.createState(), { phase: 'build', reached: 'build', design: Object.assign({}, MS.store.createState().design, GOOD) });
    assert.equal(MS.ui.teamGo(st).need, false, 'sozinho não há votação');
    var net = MS.net;
    var ready = null;
    MS.net = {
      active: function () { return true; },
      info: function () { return { inRoom: true, me: 'host', members: [{ id: 'host', name: 'Ana', roles: ['manager'] }, { id: 'p2', name: 'Bia', roles: ['payload'] }], ready: ready }; },
      readyKey: function (s) { return JSON.stringify([s.design, s.period || null]); },
      dispatch: function () {}
    };
    try {
      var g = MS.ui.teamGo(st);
      assert(g.need && !g.asked && !g.all, 'ainda ninguém pediu');
      var html = MS.ui.renderHTML(st);
      T.assert.includes(html, 'go-panel');
      T.assert.includes(html, MS.ui.h.esc(MS.i18n.t('go.ask')));
      ready = { phase: 'build', key: MS.net.readyKey(st), answers: { host: true } };
      g = MS.ui.teamGo(st);
      assert(g.asked && g.yes === 1 && !g.all);
      ready.answers.p2 = true;
      assert(MS.ui.teamGo(st).all, 'todos GO');
      // Projeto mudou depois do GO: vale de novo do zero.
      var st2 = Object.assign({}, st, { design: Object.assign({}, st.design, { payload: 'cam_wide' }) });
      assert(!MS.ui.teamGo(st2).asked, 'GO antigo não vale para outro projeto');
    } finally { MS.net = net; }
  });

  test('textos dos dados são escapados (sem injetar HTML)', function () {
    assert.equal(MS.ui.h.esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });
})(globalThis);
