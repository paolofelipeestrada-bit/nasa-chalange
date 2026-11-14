/* Mini executor de testes, sem dependências.
 *   T.group('Nome')            agrupa os testes seguintes
 *   T.test('descrição', fn)    registra um teste
 *   T.assert(cond, msg) · .equal · .near · .throws · .includes
 *   T.run()                    → [{ group, name, ok, error }]
 */
(function (root) {
  'use strict';
  var tests = [];
  var currentGroup = '';

  function show(x) { try { return JSON.stringify(x); } catch (e) { return String(x); } }
  function fail(msg) { throw new Error(msg); }
  function prefix(msg) { return msg ? msg + ' — ' : ''; }

  var assert = function (cond, msg) { if (!cond) fail(msg || 'condição falsa'); };
  assert.equal = function (actual, expected, msg) {
    if (actual !== expected) fail(prefix(msg) + 'esperado ' + show(expected) + ', obtido ' + show(actual));
  };
  assert.near = function (actual, expected, tolerance, msg) {
    if (!(typeof actual === 'number' && Math.abs(actual - expected) <= tolerance)) {
      fail(prefix(msg) + 'esperado ' + expected + ' ± ' + tolerance + ', obtido ' + show(actual));
    }
  };
  assert.throws = function (fn, msg) {
    var threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) fail(msg || 'esperava um erro');
  };
  assert.includes = function (text, part, msg) {
    if (String(text).indexOf(part) === -1) fail(prefix(msg) + 'o texto não contém ' + show(part) + ': ' + show(text));
  };

  root.T = {
    group: function (name) { currentGroup = name; },
    test: function (name, fn) { tests.push({ group: currentGroup, name: name, fn: fn }); },
    assert: assert,
    run: function () {
      return tests.map(function (t) {
        try {
          t.fn();
          return { group: t.group, name: t.name, ok: true };
        } catch (e) {
          return { group: t.group, name: t.name, ok: false, error: e && e.message ? e.message : String(e) };
        }
      });
    }
  };
})(globalThis);
