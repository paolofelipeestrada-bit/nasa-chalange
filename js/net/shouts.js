/* =====================================================================
 * net/shouts.js — GRITOS DA EQUIPE (regras puras, sem rede nem tela; testado)
 *
 * Um grito viaja pela sala como { id, to, slot } e cada pessoa monta o
 * texto no SEU idioma (MS.shouts.text). Tipos de id:
 *   'ask'          pedido para o papel `to` escolher a peça `slot`
 *   'alert:<res>'  aviso de recurso (mass, power, cost, ...)
 *   '<frase>'      frase da equipe (good, wait, hurry, help, look)
 *
 *   MS.shouts.options(sc, state, result, members, meId) → botões disponíveis
 *   MS.shouts.text(sc, shout)    → frase no idioma atual
 *   MS.shouts.clean(sc, shout)   → grito válido ou null (vindo da rede)
 *   MS.shouts.forMe(sc, shout, members, meId) → é para mim?
 *   MS.shouts.allow(last, now)   → passou o intervalo mínimo entre gritos?
 *   MS.shouts.roleColor(role)    → cor do papel (sci/eng/mgr/com/dir)
 * Frases: js/data/shouts.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var GAP_MS = 2000; // um grito a cada 2 s por pessoa

  function D() { return MS.data.shouts; }
  function L(v) { return MS.i18n ? MS.i18n.L(v) : v; }
  function team(sc) { return (sc && sc.team && sc.team.roles) || []; }
  function role(sc, id) { return team(sc).filter(function (r) { return r.id === id; })[0] || null; }
  function slot(sc, id) { return (sc.slots || []).filter(function (s) { return s.id === id; })[0] || null; }
  function phrase(id) { return D().team.filter(function (x) { return x.id === id; })[0] || null; }
  function myRoles(members, meId) {
    var m = (members || []).filter(function (x) { return x.id === meId; })[0];
    return m ? m.roles || [] : [];
  }

  // Botões que fazem sentido agora: pedir as peças que faltam a quem cuida
  // delas, avisar dos recursos no amarelo/vermelho e as frases da equipe.
  function options(sc, state, result, members, meId) {
    var mine = myRoles(members, meId), out = [];
    team(sc).forEach(function (r) {
      if (mine.indexOf(r.id) !== -1) return;
      (r.slots || []).forEach(function (sid) {
        var s = slot(sc, sid);
        if (s && s.phase === state.phase && !state.design[sid]) out.push({ kind: 'ask', shout: { id: 'ask', to: r.id, slot: sid } });
      });
    });
    ((result && result.resources) || []).forEach(function (res) {
      if ((res.status === 'fail' || res.status === 'warn') && D().alerts[res.id]) {
        out.push({ kind: 'alert', hot: res.status === 'fail', shout: { id: 'alert:' + res.id } });
      }
    });
    D().team.forEach(function (p) { out.push({ kind: 'team', icon: p.icon, shout: { id: p.id } }); });
    return out;
  }

  function text(sc, sh) {
    if (!sh) return '';
    if (sh.id === 'ask') {
      var r = role(sc, sh.to), s = slot(sc, sh.slot);
      return L(D().ask).replace('{role}', r ? L(r.name) : '?').replace('{slot}', s ? L(s.label) : '?');
    }
    if (sh.id.indexOf('alert:') === 0) return L(D().alerts[sh.id.slice(6)]);
    var p = phrase(sh.id);
    return p ? L(p.text) : '';
  }

  // Só deixa passar gritos conhecidos (a mensagem vem de outro navegador).
  function clean(sc, sh) {
    if (!sh || typeof sh.id !== 'string') return null;
    if (sh.id === 'ask') {
      var r = role(sc, sh.to);
      if (!r || (r.slots || []).indexOf(sh.slot) === -1) return null;
      return { id: 'ask', to: r.id, slot: sh.slot };
    }
    if (sh.id.indexOf('alert:') === 0) return D().alerts[sh.id.slice(6)] ? { id: sh.id } : null;
    return phrase(sh.id) ? { id: sh.id } : null;
  }

  function forMe(sc, sh, members, meId) {
    return !!(sh && sh.id === 'ask' && myRoles(members, meId).indexOf(sh.to) !== -1);
  }

  function allow(last, now) { return !last || now - last >= GAP_MS; }

  var COLORS = { manager: 'mgr', payload: 'sci', bus: 'eng', ground: 'com' };
  function roleColor(r) { return (r && (r.color || COLORS[r.id])) || 'dir'; }

  MS.shouts = { options: options, text: text, clean: clean, forMe: forMe, allow: allow, roleColor: roleColor, GAP_MS: GAP_MS };
})(globalThis);
