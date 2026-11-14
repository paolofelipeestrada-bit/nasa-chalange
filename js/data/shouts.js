/* =====================================================================
 * GRITOS DA EQUIPE — frases rápidas do modo equipe (botão "Gritar").
 *
 *   ask      pedido para um papel escolher uma peça que falta
 *            ({role} e {slot} são trocados pelos nomes no idioma de cada um)
 *   alerts   um por recurso (id de result.resources): aparece quando o
 *            recurso está amarelo ou vermelho
 *   team     frases livres da equipe
 *   ready    "todos prontos?" antes do lançamento
 * Regras e montagem: js/net/shouts.js. Tela: js/ui/shouts-ui.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};

  MS.data.shouts = {
    ask: T('{role}: you still need to pick {slot}!', '{role}: falta escolher {slot}!', '{role}: ¡falta elegir {slot}!'),
    alerts: {
      mass: T('Too heavy! Lose some mass!', 'Pesado demais! Tira massa!', '¡Demasiado pesado! ¡Quita masa!'),
      volume: T('It does not fit in the box!', 'Não cabe na caixa!', '¡No cabe en la caja!'),
      power: T('We are short on power!', 'Falta energia!', '¡Falta energía!'),
      cost: T('Over budget! Cheaper parts!', 'Estourou o orçamento! Peças mais baratas!', '¡Nos pasamos del presupuesto! ¡Piezas más baratas!'),
      storage: T('The memory is filling up!', 'A memória está enchendo!', '¡La memoria se está llenando!'),
      downlink: T('The radio cannot send all the data!', 'O rádio não dá conta de mandar os dados!', '¡La radio no alcanza a enviar los datos!'),
      time: T('We will miss the deadline!', 'Vamos estourar o prazo!', '¡Nos vamos a pasar del plazo!')
    },
    team: [
      { id: 'good', icon: 'ok', text: T('Great choice!', 'Boa escolha!', '¡Buena elección!') },
      { id: 'wait', icon: 'warn', text: T('Wait! Don’t advance yet!', 'Espera! Não avança ainda!', '¡Espera! ¡No avances todavía!') },
      { id: 'hurry', icon: 'time', text: T('Hurry up, team!', 'Rápido, equipe!', '¡Rápido, equipo!') },
      { id: 'help', icon: 'team', text: T('Help me here!', 'Me ajuda aqui!', '¡Ayúdame aquí!') },
      { id: 'look', icon: 'eye', text: T('Look at the resources panel!', 'Olha o painel de recursos!', '¡Mira el panel de recursos!') }
    ],
    ready: {
      ask: T('Everyone ready to launch?', 'Todos prontos para lançar?', '¿Todos listos para lanzar?'),
      yes: T('Ready!', 'Pronto!', '¡Listo!'),
      no: T('Wait!', 'Espera!', '¡Espera!')
    }
  };
})(globalThis);
