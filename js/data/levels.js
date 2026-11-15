/* =====================================================================
 * NÍVEIS DE DIFICULDADE — Fácil (a partir de ~12 anos), Normal e Difícil.
 *
 * Cada nível é um AJUSTE aplicado sobre os cenários de scenarios.js
 * (js/levels.js monta o cenário ajustado; o motor não muda):
 *   budgetFactor     multiplica o orçamento do cliente
 *   deadlineAdd      meses a mais (ou a menos) no prazo
 *   marginFactor     multiplica as folgas recomendadas (menos = mais tolerante)
 *   chanceFactor     multiplica a chance dos imprevistos sorteados
 *   fixed            escolhas feitas pelo jogo: { slot: opção }
 *   follow           escolhas que seguem outra: { launcher: 'orbit' } = o
 *                    lançador que chega na órbita escolhida
 *   hints            mostra o botão "Dica" (⭐ na opção recomendada)
 *   recommend        opção recomendada por cenário (usada pela Dica)
 *   help             texto simples de cada escolha (troca o "Por que importa")
 *   addSlots         escolhas novas (só existem neste nível) + addRoleSlots
 *   addEvents        imprevistos novos
 *   ui               'simple' (menos números) | 'full' (todos os números)
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};

  MS.data.levels = {
    order: ['easy', 'normal', 'hard'],
    default: 'normal',

    easy: {
      icon: '🟢',
      name: T('Easy', 'Fácil', 'Fácil'),
      tagline: T('From age 12. Fewer choices, simple words and tips.', 'A partir de 12 anos. Menos escolhas, palavras simples e dicas.', 'Desde los 12 años. Menos elecciones, palabras simples y pistas.'),
      budgetFactor: 1.3, deadlineAdd: 6, marginFactor: 0.5, chanceFactor: 0.5,
      fixed: { adcs: 'adcs_wheels', obc: 'obc_basic' },
      follow: { launcher: 'orbit' },
      hints: true,
      ui: 'simple',
      recommend: {
        eo_cubesat: { orbit: 'sso500', groundStation: 'gs_polar', payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy', comms: 'com_sband' },
        fire_watch: { orbit: 'sso500', groundStation: 'gs_polar', payload: 'cam_wide', structure: 'struct_3u', power: 'eps_deploy', comms: 'com_sband' },
        city_map: { orbit: 'sso500', groundStation: 'gs_polar', payload: 'cam_hr', structure: 'struct_6u', power: 'eps_body', comms: 'com_sband' }
      },
      help: {
        orbit: T('How high the satellite flies. Lower = sharper photos, but air slowly pulls it down.', 'A altura em que o satélite voa. Mais baixo = fotos mais nítidas, mas o ar vai puxando ele para baixo.', 'La altura a la que vuela el satélite. Más bajo = fotos más nítidas, pero el aire lo va bajando.'),
        launcher: T('The game picks the rocket that goes to your orbit.', 'O jogo escolhe o foguete que vai para a sua órbita.', 'El juego elige el cohete que va a tu órbita.'),
        groundStation: T('The antenna on Earth that talks to the satellite. More visits per day = more photos arrive.', 'A antena na Terra que conversa com o satélite. Mais visitas por dia = mais fotos chegam.', 'La antena en la Tierra que habla con el satélite. Más visitas por día = llegan más fotos.'),
        payload: T('The camera. Sharper cameras see small things but are heavier and make more photos to send.', 'A câmera. Câmeras mais nítidas veem coisas pequenas, mas pesam mais e geram mais fotos para enviar.', 'La cámara. Las más nítidas ven cosas pequeñas, pero pesan más y generan más fotos para enviar.'),
        structure: T('The box. Everything must fit inside. A bigger box holds more but costs more.', 'A caixa. Tudo precisa caber dentro. Caixa maior cabe mais, mas custa mais.', 'La caja. Todo debe caber dentro. Una caja más grande cabe más, pero cuesta más.'),
        power: T('Solar panels. They must make more energy than the satellite uses.', 'Painéis solares. Eles precisam gerar mais energia do que o satélite gasta.', 'Paneles solares. Deben generar más energía de la que usa el satélite.'),
        adcs: T('Reaction wheels keep the camera pointed.', 'Rodas de reação mantêm a câmera apontada.', 'Ruedas de reacción mantienen la cámara apuntando.'),
        comms: T('The radio that sends photos home. Faster radio = more photos arrive.', 'O rádio que manda as fotos para casa. Rádio mais rápido = mais fotos chegam.', 'La radio que manda las fotos a casa. Radio más rápida = llegan más fotos.'),
        obc: T('The computer that saves the photos.', 'O computador que guarda as fotos.', 'La computadora que guarda las fotos.')
      }
    },

    normal: {
      icon: '🟡',
      name: T('Normal', 'Normal', 'Normal'),
      tagline: T('The full mission, like the game was designed.', 'A missão completa, como o jogo foi pensado.', 'La misión completa, como se pensó el juego.'),
      budgetFactor: 1, deadlineAdd: 0, marginFactor: 1, chanceFactor: 1
    },

    hard: {
      icon: '🔴',
      name: T('Hard', 'Difícil', 'Difícil'),
      tagline: T('Less money and time, more surprises, battery and radiation shielding, every number shown.', 'Menos dinheiro e prazo, mais imprevistos, bateria e blindagem contra radiação, todos os números à mostra.', 'Menos dinero y plazo, más imprevistos, batería y blindaje contra radiación, todos los números a la vista.'),
      budgetFactor: 0.85, deadlineAdd: -2, marginFactor: 1.5, chanceFactor: 1.5,
      ui: 'full',
      // Variáveis novas (motor: métricas batteryNeed_Wh / battery_Wh e o imprevisto de radiação)
      addSlots: [
        { id: 'battery', phase: 'design', segment: 'space', source: 'components', options: ['bat_10', 'bat_20', 'bat_40'], after: 'power',
          label: T('Battery', 'Bateria', 'Batería'),
          help: T('Powers the satellite in Earth’s shadow (about a third of every orbit). A battery that is drained deeply every orbit wears out: keep it under 30% per orbit.',
            'Alimenta o satélite na sombra da Terra (cerca de um terço de cada volta). Bateria descarregada fundo a cada volta se desgasta: use no máximo 30% por volta.',
            'Alimenta el satélite en la sombra de la Tierra (cerca de un tercio de cada vuelta). Una batería descargada a fondo cada vuelta se desgasta: usa como máximo 30% por vuelta.') },
        { id: 'shield', phase: 'design', segment: 'space', source: 'components', options: ['shield_none', 'shield_ta'], after: 'obc',
          label: T('Radiation shielding', 'Blindagem contra radiação', 'Blindaje contra radiación'),
          help: T('Space particles can flip bits in the computer memory. A thin metal shield costs mass and money but protects the data.',
            'Partículas do espaço podem trocar bits na memória do computador. Uma placa fina de metal custa massa e dinheiro, mas protege os dados.',
            'Las partículas del espacio pueden cambiar bits en la memoria de la computadora. Una placa fina de metal cuesta masa y dinero, pero protege los datos.') }
      ],
      addRoleSlots: { bus: ['battery', 'shield'] },
      addMargins: { battery: 0.2 },
      addEvents: [
        { id: 'RE7', fx: 'glitch', after: 'E5', chance: 0.35, mitigatedBy: [{ slot: 'shield', is: 'shield_ta' }], effect: { degrade: 0.8 },
          title: T('Radiation hit the computer', 'Radiação atingiu o computador', 'La radiación golpeó la computadora'),
          when: T('Months in orbit', 'Meses em órbita', 'Meses en órbita'),
          description: T('A high-energy particle flips bits in the computer memory.', 'Uma partícula de alta energia troca bits na memória do computador.', 'Una partícula de alta energía cambia bits en la memoria de la computadora.'),
          text: T('A radiation hit flipped bits in memory: part of the stored images was corrupted.', 'Um golpe de radiação trocou bits na memória: parte das imagens guardadas estragou.', 'Un golpe de radiación cambió bits en la memoria: parte de las imágenes guardadas se dañó.'),
          mitigatedText: T('A radiation hit reached the computer, but the shielding stopped most particles.', 'Um golpe de radiação chegou ao computador, mas a blindagem barrou a maior parte das partículas.', 'Un golpe de radiación llegó a la computadora, pero el blindaje frenó la mayoría de las partículas.'),
          lesson: T('Above the atmosphere radiation is constant: shielding (or error-correcting memory) protects the data.', 'Acima da atmosfera a radiação é constante: blindagem (ou memória com correção de erros) protege os dados.', 'Sobre la atmósfera la radiación es constante: el blindaje (o memoria con corrección de errores) protege los datos.') }
      ]
    }
  };
})(globalThis);
