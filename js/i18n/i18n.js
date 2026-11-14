/* =====================================================================
 * i18n.js — IDIOMAS (inglês padrão, português e espanhol)
 *
 *   MS.i18n.t('chave', { x: 1 })  texto da interface/motor (dicionários
 *                                  em js/i18n/en.js, pt.js, es.js)
 *   MS.i18n.L(valor)              texto dos dados: { en, pt, es } ou string
 *   MS.i18n.setLang('pt')         troca o idioma (salvo no navegador)
 *   MS.i18n.sep()                 separadores de número do idioma
 *
 * O idioma é de cada jogador (não vai para o state nem para a sala).
 * Ordem de escolha: ?lang= na URL → último escolhido → inglês.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var i18n = MS.i18n = MS.i18n || {};
  var KEY = 'missionSim.lang';

  i18n.langs = [
    { id: 'en', name: 'English', locale: 'en-US' },
    { id: 'pt', name: 'Português', locale: 'pt-BR' },
    { id: 'es', name: 'Español', locale: 'es-ES' }
  ];
  i18n.dict = i18n.dict || { en: {}, pt: {}, es: {} };

  function valid(l) { return i18n.langs.some(function (x) { return x.id === l; }); }
  function initial() {
    try {
      var q = root.location && /[?&]lang=(\w+)/.exec(root.location.search || '');
      if (q && valid(q[1])) return q[1];
    } catch (e) { /* sem location */ }
    try {
      var s = root.localStorage && root.localStorage.getItem(KEY);
      if (valid(s)) return s;
    } catch (e) { /* armazenamento bloqueado */ }
    return 'en';
  }

  i18n.lang = initial();

  // persist=false: troca só nesta página (usado pelos testes).
  i18n.setLang = function (l, persist) {
    if (!valid(l)) return false;
    i18n.lang = l;
    if (persist !== false) { try { root.localStorage.setItem(KEY, l); } catch (e) { /* ok */ } }
    try { if (root.document && root.document.documentElement) root.document.documentElement.lang = i18n.locale(); } catch (e) { /* ok */ }
    return true;
  };

  i18n.locale = function () {
    var l = i18n.langs.filter(function (x) { return x.id === i18n.lang; })[0];
    return l ? l.locale : 'en-US';
  };

  // Separadores: inglês 1,234.5 · português e espanhol 1.234,5
  i18n.sep = function () {
    return i18n.lang === 'en' ? { thousands: ',', decimal: '.' } : { thousands: '.', decimal: ',' };
  };

  function format(s, params) {
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, function (all, k) { return params[k] != null ? String(params[k]) : all; });
  }

  // Texto de dicionário. Falta no idioma → inglês → a própria chave.
  i18n.t = function (key, params) {
    var d = i18n.dict[i18n.lang] || {};
    var s = d[key];
    if (s == null) s = i18n.dict.en[key];
    if (s == null) s = key;
    return format(s, params);
  };
  i18n.has = function (key) { return i18n.dict.en[key] != null; };

  // Texto dos dados: string simples ou { en, pt, es }.
  function isText(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v) && ('en' in v || 'pt' in v || 'es' in v);
  }
  i18n.isText = isText;
  i18n.L = function (v) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(i18n.L);
    if (isText(v)) return v[i18n.lang] != null ? v[i18n.lang] : v.en != null ? v.en : v.pt;
    return v;
  };

  // Atalho para escrever textos nos dados: T('en', 'pt', 'es').
  i18n.T = function (en, pt, es) { return { en: en, pt: pt, es: es }; };
})(globalThis);
