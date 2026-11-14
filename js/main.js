/* Ponto de partida: liga a interface ao estado. */
(function (root) {
  'use strict';
  var MS = root.MS;
  MS.ui.local.menuOpen = true; // abre no menu inicial (js/ui/menu.js)
  MS.ui.mount(document.getElementById('app'));
  MS.store.init({ render: MS.ui.render });
})(globalThis);
