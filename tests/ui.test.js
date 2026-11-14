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

  test('toda fase de phases.js tem uma tela registrada', function () {
    MS.data.flow.phases.forEach(function (p) { assert(MS.ui.screens[p.screen], 'sem tela: ' + p.screen); });
  });

  test('todas as telas montam sem erro, com projeto vazio e completo', function () {
    [{}, GOOD].forEach(function (design) {
      MS.data.flow.phases.forEach(function (p) {
        var s = Object.assign(MS.store.createState(), { phase: p.id, reached: p.id, design: Object.assign({}, MS.store.createState().design, design) });
        var html = MS.ui.renderHTML(s);
        assert(html.indexOf('Erro ao montar') === -1, p.id + ': erro ao montar');
        assert(html.indexOf('não foi registrada') === -1, p.id + ': tela ausente');
        T.assert.includes(html, MS.ui.h.esc(p.title));
      });
    });
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
    click('[data-action="next"]'); click('[data-action="next"]'); click('[data-action="next"]');
    assert.equal(MS.store.state.phase, 'report');
    T.assert.includes(el.textContent, 'Missão exemplar');
    click('[data-action="retry"]');
    assert.equal(MS.store.state.phase, 'design');
    assert.equal(MS.store.state.attempt, 2);
  });

  test('textos dos dados são escapados (sem injetar HTML)', function () {
    assert.equal(MS.ui.h.esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });
})(globalThis);
