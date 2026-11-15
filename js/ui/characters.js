/* =====================================================================
 * ui/characters.js — PERSONAGENS DA TRIPULAÇÃO (desenho 2D em SVG)
 *
 * Um personagem por papel, no mesmo estilo plano da cliente (screens-start):
 *   dir  Mission Director / capitão — traje de astronauta e capacete
 *   sci  Cientista da carga útil   — jaleco, óculos e tablet
 *   eng  Engenheiro da plataforma  — macacão e capacete de obra
 *   mgr  Gerente da missão         — blazer e prancheta
 *   com  Comunicações e solo       — fone com microfone
 * A cor de cada um é a do papel (variáveis --sci, --eng... em style.css).
 *
 *   MS.ui.h.character(key, size)  → <svg> do personagem
 *   MS.ui.h.crewRoster(state)     → os 5 cartões "quem cuida de quê"
 * Textos: crew.<key>.title, crew.<key>.cares (3 idiomas).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, t = MS.i18n.t;

  var COLOR = { dir: '#7fb2ff', sci: '#b794ff', eng: '#ff9a3c', mgr: '#ff7ac6', com: '#3fd0ff' };
  // Pele e cabelo variados: a tripulação é diversa.
  var LOOK = {
    dir: { skin: '#b97a56', hair: '#2a1a12' },
    sci: { skin: '#f0c9a6', hair: '#1d1d2b', long: true },
    eng: { skin: '#7a4b31', hair: '#120c08' },
    mgr: { skin: '#d9a47e', hair: '#6b3b1c', long: true },
    com: { skin: '#e6b98f', hair: '#c9862f' }
  };

  function face(L, cy) {
    // Rosto com volume: sombra do lado direito, bochechas e olhos que piscam (.ch-eyes).
    return '<ellipse cx="32" cy="' + cy + '" rx="10.5" ry="12" fill="' + L.skin + '"/>' +
      '<ellipse cx="35.5" cy="' + (cy + 1.5) + '" rx="7" ry="10" fill="#000" opacity=".1"/>' +
      '<circle cx="26" cy="' + (cy + 4.5) + '" r="2" fill="#ff7a7a" opacity=".25"/><circle cx="38" cy="' + (cy + 4.5) + '" r="2" fill="#ff7a7a" opacity=".25"/>' +
      '<g class="ch-eyes"><circle cx="28" cy="' + (cy + 1) + '" r="1.6" fill="#22150e"/><circle cx="36" cy="' + (cy + 1) + '" r="1.6" fill="#22150e"/>' +
      '<circle cx="28.6" cy="' + (cy + 0.4) + '" r=".55" fill="#fff"/><circle cx="36.6" cy="' + (cy + 0.4) + '" r=".55" fill="#fff"/></g>' +
      '<path d="M28 ' + (cy + 6) + ' q4 3.5 8 0" stroke="#5a2a1a" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  }
  function hair(L, cy) {
    return '<path d="M21.5 ' + (cy - 1) + ' q0 -12 10.5 -12 q10.5 0 10.5 12 q-4 -6.5 -10.5 -6.5 q-6.5 0 -10.5 6.5z" fill="' + L.hair + '"/>';
  }

  var DRAW = {
    // Astronauta: traje branco com faixa na cor do papel, capacete com viseira.
    dir: function (c, L) {
      return '<path d="M12 64 q2 -16 20 -16 q18 0 20 16z" fill="#e9eef8"/>' +
        '<path d="M24 50 h16 v14 h-16z" fill="' + c + '" opacity=".9"/>' +
        '<circle cx="44" cy="56" r="3.2" fill="#ff6b6b"/><circle cx="44" cy="56" r="1.4" fill="#fff"/>' +
        '<circle cx="32" cy="28" r="17" fill="#e9eef8"/>' +
        '<circle cx="32" cy="29" r="13" fill="#1b2b55"/>' + face(L, 30) + hair(L, 30) +
        '<path d="M22 22 q5 -6 12 -6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".75"/>' +
        '<rect x="28" y="43" width="8" height="5" rx="2" fill="#c9d3e6"/>';
    },
    // Cientista: jaleco branco aberto, blusa na cor do papel, óculos e tablet.
    sci: function (c, L) {
      return (L.long ? '<path d="M19 34 q0 -20 13 -20 q13 0 13 20 v8 h-26z" fill="' + L.hair + '"/>' : '') +
        '<path d="M12 64 q2 -16 20 -16 q18 0 20 16z" fill="#f4f6fb"/>' +
        '<path d="M27 48 l5 9 l5 -9 v16 h-10z" fill="' + c + '"/>' +
        '<rect x="29" y="42" width="6" height="7" rx="2" fill="' + L.skin + '"/>' + face(L, 31) + hair(L, 31) +
        '<circle cx="28" cy="32" r="3.4" fill="none" stroke="#2a2a3a" stroke-width="1.4"/><circle cx="36" cy="32" r="3.4" fill="none" stroke="#2a2a3a" stroke-width="1.4"/>' +
        '<path d="M31.4 32 h1.2" stroke="#2a2a3a" stroke-width="1.4"/>' +
        '<rect x="40" y="52" width="10" height="12" rx="2" fill="#2a3d6b" stroke="' + c + '" stroke-width="1.4"/>';
    },
    // Engenheiro: macacão laranja, capacete de obra e chave inglesa no peito.
    eng: function (c, L) {
      return '<path d="M12 64 q2 -16 20 -16 q18 0 20 16z" fill="' + c + '"/>' +
        '<path d="M25 49 v15 M39 49 v15" stroke="#b3611f" stroke-width="2.2"/>' +
        '<rect x="29" y="42" width="6" height="7" rx="2" fill="' + L.skin + '"/>' + face(L, 31) +
        '<path d="M19 26 q0 -12 13 -12 q13 0 13 12z" fill="#ffd23f"/><rect x="17" y="25" width="30" height="3.5" rx="1.7" fill="#f2b705"/>' +
        '<path d="M32 14 v5" stroke="#f2b705" stroke-width="2.4"/>' +
        '<path d="M42 54 l4 4 m-1.5 -5.5 a2.6 2.6 0 1 0 2 3.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    },
    // Gerente: blazer na cor do papel, camisa branca e prancheta com check.
    mgr: function (c, L) {
      return (L.long ? '<path d="M19 34 q0 -20 13 -20 q13 0 13 20 v10 h-26z" fill="' + L.hair + '"/>' : '') +
        '<path d="M12 64 q2 -16 20 -16 q18 0 20 16z" fill="' + c + '"/>' +
        '<path d="M27 48 l5 8 l5 -8 v16 h-10z" fill="#fff"/><path d="M32 56 v8" stroke="' + c + '" stroke-width="1.2"/>' +
        '<rect x="29" y="42" width="6" height="7" rx="2" fill="' + L.skin + '"/>' + face(L, 31) + hair(L, 31) +
        '<rect x="14" y="51" width="11" height="13" rx="1.6" fill="#f4f6fb" stroke="#8a6a3a" stroke-width="1.2"/>' +
        '<path d="M17 57 l2 2 l4 -4" stroke="#1c8a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    },
    // Comunicações: jaqueta na cor do papel, fone com microfone.
    com: function (c, L) {
      return '<path d="M12 64 q2 -16 20 -16 q18 0 20 16z" fill="' + c + '"/>' +
        '<path d="M32 49 v15" stroke="#1d8fb3" stroke-width="1.6"/>' +
        '<rect x="29" y="42" width="6" height="7" rx="2" fill="' + L.skin + '"/>' + face(L, 31) + hair(L, 31) +
        '<path d="M20 31 q0 -15 12 -15 q12 0 12 15" stroke="#2a3d6b" stroke-width="2.6" fill="none"/>' +
        '<rect x="17.5" y="28" width="5" height="8" rx="2.2" fill="#2a3d6b"/><rect x="41.5" y="28" width="5" height="8" rx="2.2" fill="#2a3d6b"/>' +
        '<path d="M20 35 q2 5 8 5" stroke="#2a3d6b" stroke-width="1.8" fill="none"/><circle cx="28.5" cy="40" r="1.8" fill="' + c + '"/>';
    }
  };

  // opts.anim: respira e pisca (CSS .char.anim). Luz de cima à esquerda e
  // sombra embaixo dão volume ("meio 3D") sem sair do estilo plano do jogo.
  function character(key, size, opts) {
    var c = COLOR[key] || COLOR.dir, L = LOOK[key] || LOOK.dir, draw = DRAW[key] || DRAW.dir;
    size = size || 48; opts = opts || {};
    var id = 'ch-' + key + '-' + size;
    return '<svg class="char char-' + key + (opts.anim ? ' anim' : '') + '" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<defs><radialGradient id="' + id + '-bg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#2b4282"/><stop offset="1" stop-color="#0f1a38"/></radialGradient>' +
      '<radialGradient id="' + id + '-lt" cx="30%" cy="22%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient><clipPath id="' + id + '-c"><circle cx="32" cy="32" r="32"/></clipPath></defs>' +
      '<circle cx="32" cy="32" r="32" fill="url(#' + id + '-bg)"/>' +
      '<circle cx="32" cy="36" r="17" fill="' + c + '" opacity=".18"/>' +
      '<g clip-path="url(#' + id + '-c)"><g class="ch-body">' + draw(c, L) + '</g><circle cx="32" cy="32" r="32" fill="url(#' + id + '-lt)"/></g>' +
      '<circle cx="32" cy="32" r="31" fill="none" stroke="' + c + '" stroke-width="2"/></svg>';
  }

  // Os 5 cartões da tripulação: quem é e do que cuida. Na sala de equipe,
  // mostra quem pegou cada papel.
  var ROLE_OF = { mgr: 'manager', sci: 'payload', eng: 'bus', com: 'ground' };
  function crewRoster(state) {
    var room = MS.net && MS.net.active() ? MS.net.info() : null, sc = h.scenario(state);
    return '<section class="roster" aria-label="' + h.esc(t('crew.roster')) + '"><h2 class="roster-h">' + h.esc(t('crew.roster')) + '</h2>' +
      '<p class="section-note">' + h.esc(t(room ? 'crew.rosterTeam' : 'crew.rosterSolo')) + '</p><ul class="roster-list">' +
      ['dir', 'sci', 'eng', 'com', 'mgr'].map(function (k) {
        var who = '';
        if (room && ROLE_OF[k]) {
          var m = room.members.filter(function (x) { return (x.roles || []).indexOf(ROLE_OF[k]) >= 0; })[0];
          who = '<span class="ro-who' + (m ? ' taken' : '') + '">' + h.esc(m ? m.name : t('ui.free')) + '</span>';
        } else if (!room && k === 'dir') who = '<span class="ro-who taken">' + h.esc(t('crew.you')) + '</span>';
        var role = ROLE_OF[k] && MS.team ? MS.team.role(sc, ROLE_OF[k]) : null;
        return '<li class="ro r-' + k + '">' + character(k, 72, { anim: true }) + '<div><b>' + h.esc(role ? MS.i18n.L(role.name) : t('crew.dir.title')) + '</b>' +
          '<span class="ro-cares">' + h.icon(k, { size: 13 }) + h.esc(t('crew.' + k + '.cares')) + '</span>' + who + '</div></li>';
      }).join('') + '</ul></section>';
  }

  h.character = character;
  h.crewRoster = crewRoster;
})(globalThis);
