/* Testes de idiomas e de equilíbrio do jogo.
 *  - os três dicionários têm as mesmas chaves e os mesmos {marcadores}
 *  - todo texto dos dados existe em inglês, português e espanhol
 *  - cada tela monta nos 3 idiomas sem chave crua nem {marcador} sobrando
 *  - cada cenário tem pelo menos 2 famílias de projeto vencedoras */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert;
  var I = MS.i18n;
  var LANGS = ['en', 'pt', 'es'];

  function marks(s) { return (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(','); }
  function withLang(l, fn) {
    var old = I.lang;
    I.setLang(l, false);
    try { return fn(); } finally { I.setLang(old, false); }
  }

  T.group('Idiomas');

  test('en, pt e es têm as mesmas chaves e os mesmos marcadores', function () {
    var all = {};
    LANGS.forEach(function (l) { Object.keys(I.dict[l]).forEach(function (k) { all[k] = 1; }); });
    var bad = [];
    Object.keys(all).forEach(function (k) {
      LANGS.forEach(function (l) { if (I.dict[l][k] == null) bad.push(l + ' sem ' + k); });
      if (I.dict.pt[k] != null && marks(I.dict.pt[k]) !== marks(I.dict.en[k])) bad.push('marcadores pt ≠ en: ' + k);
      if (I.dict.es[k] != null && marks(I.dict.es[k]) !== marks(I.dict.en[k])) bad.push('marcadores es ≠ en: ' + k);
    });
    assert(!bad.length, bad.slice(0, 8).join(' · '));
  });

  test('todo texto dos dados existe nos 3 idiomas', function () {
    var bad = [];
    (function walk(v, path) {
      if (!v || typeof v !== 'object') return;
      if (I.isText(v)) {
        LANGS.forEach(function (l) { if (typeof v[l] !== 'string' || !v[l].trim()) bad.push(path + '.' + l); });
        return;
      }
      Object.keys(v).forEach(function (k) { walk(v[k], path + '.' + k); });
    })(MS.data, 'data');
    assert(!bad.length, bad.length + ' textos incompletos, ex.: ' + bad.slice(0, 5).join(', '));
  });

  test('o inglês é o idioma padrão sem escolha salva', function () {
    assert.equal(I.dict.en['app.name'], 'Space Mission Designer');
    assert(LANGS.indexOf(I.lang) !== -1);
  });

  test('separadores de número mudam com o idioma', function () {
    withLang('en', function () { assert.equal(MS.sim.util.fmt(1234.5, 1), '1,234.5'); });
    withLang('es', function () { assert.equal(MS.sim.util.fmt(1234.5, 1), '1.234,5'); });
  });

  test('todas as telas montam nos 3 idiomas sem chave crua nem marcador sobrando', function () {
    var GOOD = {
      orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
      payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
      adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
    };
    var keyLike = /\b(ui|scr|eng|net|hud|rep|risk|mel|build|team|viz|impl|sum|about|chk|res|spec|st|x|p|s|m|u|life)\.[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)?\b/;
    LANGS.forEach(function (l) {
      withLang(l, function () {
        Object.keys(MS.data.scenarios).forEach(function (sid) {
          [{}, GOOD].forEach(function (design) {
            MS.data.flow.phases.forEach(function (p) {
              var base = MS.store.createState();
              var s = Object.assign(base, { scenarioId: sid, phase: p.id, reached: p.id, design: Object.assign({}, base.design, design) });
              var html = MS.ui.renderHTML(s);
              var text = html.replace(/<[^>]*>/g, ' ');
              var left = text.match(/\{[a-zA-Z]+\}/);
              assert(!left, l + '/' + sid + '/' + p.id + ': marcador sobrando ' + (left && left[0]));
              var raw = text.match(keyLike);
              assert(!raw || /\d/.test(raw[0].charAt(raw[0].indexOf('.') + 1)), l + '/' + sid + '/' + p.id + ': chave crua ' + (raw && raw[0]));
              assert(html.indexOf('[object Object]') === -1, l + '/' + sid + '/' + p.id + ': [object Object]');
            });
            // Missão no tempo: decisão pendente e missão completa.
            if (design === GOOD) {
              [{}, { storm: 'keep', memory: 'overwrite', power: 'reduce' }].forEach(function (decisions) {
                ['implement', 'report'].forEach(function (ph) {
                  var b2 = MS.store.createState();
                  var s2 = Object.assign(b2, { scenarioId: sid, phase: ph, reached: ph, period: 'y2024', decisions: decisions, design: Object.assign({}, b2.design, GOOD) });
                  var text2 = MS.ui.renderHTML(s2).replace(/<[^>]*>/g, ' ');
                  var left2 = text2.match(/\{[a-zA-Z]+\}/), raw2 = text2.match(keyLike);
                  assert(!left2, l + '/' + sid + '/' + ph + ' (missão): marcador sobrando ' + (left2 && left2[0]));
                  assert(!raw2 || /\d/.test(raw2[0].charAt(raw2[0].indexOf('.') + 1)), l + '/' + sid + '/' + ph + ' (missão): chave crua ' + (raw2 && raw2[0]));
                });
              });
            }
          });
        });
      });
    });
  });

  T.group('Equilíbrio do jogo');

  // Família = órbita + lançador + câmera + rádio + controle de atitude.
  function census(sid) {
    var sc = MS.data.scenarios[sid];
    var combos = [{}];
    sc.slots.forEach(function (s) {
      var next = [];
      combos.forEach(function (c) {
        s.options.forEach(function (o) { var d = Object.assign({}, c); d[s.id] = o; next.push(d); });
      });
      combos = next;
    });
    var fam = {};
    combos.forEach(function (d) {
      var r = MS.sim.run({ scenarioId: sid, design: d });
      var ok = r.requirements.every(function (x) { return x.status === 'ok'; }) &&
        !r.checks.some(function (c) { return c.status === 'fail'; });
      if (ok) fam[[d.orbit, d.launcher, d.payload, d.comms, d.adcs].join('/')] = 1;
    });
    return Object.keys(fam);
  }

  Object.keys(MS.data.scenarios).forEach(function (sid) {
    test('cenário "' + sid + '" tem pelo menos 2 famílias de projeto vencedoras', function () {
      var f = census(sid);
      assert(f.length >= 2, 'só ' + f.length + ' família(s): ' + f.join(' | '));
    });
  });
})(globalThis);
