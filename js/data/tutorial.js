/* =====================================================================
 * TUTORIAL — passos do tour guiado (opcional, aberto pelo menu inicial).
 *
 * Cada passo:
 *   phase   fase mostrada atrás do balão ('need', 'concept', 'design'...);
 *           sem phase, fica na tela do passo anterior
 *   demo    'empty' (projeto vazio) | 'concept' (órbita, foguete e estação
 *           escolhidos) | 'full' (satélite completo)
 *   target  seletor CSS da parte da tela a destacar (sem target: balão no meio)
 *   title, text  T(en, pt, es)
 * O tour mostra um projeto de exemplo e NÃO mexe no projeto do jogador:
 * ao sair, a tela volta exatamente como estava. Motor: js/ui/tutorial.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};

  MS.data.tutorial = {
    // Projeto de exemplo (opções que não existirem no cenário caem na 1ª opção do item).
    demoDesign: {
      orbit: 'sso500', launcher: 'rideshare_sso', groundStation: 'gs_polar',
      payload: 'cam_mid', structure: 'struct_3u', power: 'eps_deploy',
      adcs: 'adcs_wheels', comms: 'com_sband', obc: 'obc_basic'
    },
    steps: [
      { phase: 'need', demo: 'empty',
        title: T('Welcome, Mission Director!', 'Bem-vindo, Diretor da Missão!', '¡Bienvenido, Director de la Misión!'),
        text: T('In about 3 minutes we will show each part of the screen. This is an example: your own progress comes back exactly as it was when the tour ends.',
          'Em uns 3 minutos vamos mostrar cada parte da tela. Isto é um exemplo: o seu progresso volta exatamente como estava quando o tour acabar.',
          'En unos 3 minutos te mostramos cada parte de la pantalla. Esto es un ejemplo: tu progreso vuelve tal como estaba cuando termine el recorrido.') },
      { target: '.scen-grid',
        title: T('1. Pick a customer', '1. Escolha um cliente', '1. Elige un cliente'),
        text: T('Each customer has a real problem on Earth and a budget. Their goals become the requirements your satellite must meet, so this choice decides what "success" means.',
          'Cada cliente tem um problema real na Terra e um orçamento. As metas dele viram os requisitos que o satélite precisa cumprir: esta escolha define o que é "sucesso".',
          'Cada cliente tiene un problema real en la Tierra y un presupuesto. Sus metas se vuelven los requisitos que el satélite debe cumplir: esta elección define qué es "éxito".') },
      { target: '.lobby',
        title: T('Solo or as a team', 'Sozinho ou em equipe', 'Solo o en equipo'),
        text: T('Alone, you play all four roles and the crew gives advice. In a team (2 to 4), each person owns some parts, just like a real NASA team where scientists, engineers and managers negotiate.',
          'Sozinho, você faz os quatro papéis e a equipe dá conselhos. Em equipe (2 a 4), cada pessoa cuida de algumas peças, como numa equipe real da NASA, onde cientistas, engenheiros e gerentes negociam.',
          'Solo, haces los cuatro roles y el equipo te aconseja. En equipo (2 a 4), cada persona se encarga de algunas piezas, como en un equipo real de la NASA donde científicos, ingenieros y gerentes negocian.') },
      { target: '.steps',
        title: T('The mission phases', 'As fases da missão', 'Las fases de la misión'),
        text: T('These are the same steps NASA follows: understand the need, choose a concept, set requirements, design, build and fly. A green check means the phase is done; you can go back any time.',
          'São os mesmos passos que a NASA segue: entender a necessidade, escolher o conceito, definir requisitos, projetar, construir e voar. O ✓ verde mostra a fase concluída; dá para voltar quando quiser.',
          'Son los mismos pasos que sigue la NASA: entender la necesidad, elegir el concepto, definir requisitos, diseñar, construir y volar. El ✓ verde marca la fase hecha; puedes volver cuando quieras.') },
      { target: '.hud-wrap',
        title: T('Your resources', 'Seus recursos', 'Tus recursos'),
        text: T('Mass, power, budget, data, communication and time. Every part uses some of each. Green = there is room, yellow = tight, red = over the limit. Click a box to see what is using it.',
          'Massa, energia, orçamento, dados, comunicação e tempo. Cada peça gasta um pouco de cada. Verde = sobra, amarelo = no limite, vermelho = passou. Clique numa caixa para ver quem está gastando.',
          'Masa, energía, presupuesto, datos, comunicación y tiempo. Cada pieza gasta un poco de cada uno. Verde = sobra, amarillo = justo, rojo = se pasó. Haz clic en una caja para ver quién lo gasta.') },
      { phase: 'concept', demo: 'concept', target: '.slot',
        title: T('2. Orbit, rocket and station', '2. Órbita, foguete e estação', '2. Órbita, cohete y estación'),
        text: T('The orbit is a trade-off: lower means sharper photos but more air drag, so the satellite falls sooner. A sun-synchronous orbit passes over the area at the same hour every day, which is great for comparing images.',
          'A órbita é uma troca: mais baixa dá fotos mais nítidas, mas tem mais atrito com o ar e o satélite cai antes. A órbita heliossíncrona passa sobre a área sempre na mesma hora, ótimo para comparar imagens.',
          'La órbita es un intercambio: más baja da fotos más nítidas, pero hay más roce con el aire y el satélite cae antes. La órbita heliosíncrona pasa sobre la zona siempre a la misma hora, ideal para comparar imágenes.') },
      { target: '.ck-center .hangar-card',
        title: T('The 3D hangar', 'O hangar 3D', 'El hangar 3D'),
        text: T('Here you see what you chose. Drag to turn it. Hover over a card to preview that option before choosing it.',
          'Aqui você vê o que escolheu. Arraste para girar. Passe o mouse sobre um cartão para ver aquela opção antes de escolher.',
          'Aquí ves lo que elegiste. Arrastra para girarlo. Pasa el ratón sobre una tarjeta para ver esa opción antes de elegirla.') },
      { phase: 'design', demo: 'full', target: '.ck-tabs',
        title: T('3. Build the satellite', '3. Monte o satélite', '3. Arma el satélite'),
        text: T('The parts are split by role: Science (camera), Satellite (structure, power, attitude, computer) and Comms (radio). In a team, each tab belongs to someone.',
          'As peças estão separadas por papel: Ciência (câmera), Satélite (estrutura, energia, atitude, computador) e Comunicação (rádio). Em equipe, cada aba é de alguém.',
          'Las piezas están separadas por rol: Ciencia (cámara), Satélite (estructura, energía, actitud, computadora) y Comunicación (radio). En equipo, cada pestaña es de alguien.') },
      { target: '.ck-parts .option',
        title: T('Read the card before choosing', 'Leia o cartão antes de escolher', 'Lee la tarjeta antes de elegir'),
        text: T('Each card shows mass, power, cost and what the part is good or bad at. There is no perfect part: a sharper camera is heavier and makes more data to send down.',
          'Cada cartão mostra massa, energia, custo e no que a peça é boa ou ruim. Não existe peça perfeita: uma câmera mais nítida pesa mais e gera mais dados para enviar.',
          'Cada tarjeta muestra masa, energía, costo y en qué es buena o mala la pieza. No hay pieza perfecta: una cámara más nítida pesa más y genera más datos para enviar.') },
      { target: '.ck-center .hangar-card',
        title: T('Your satellite, live', 'Seu satélite, ao vivo', 'Tu satélite, en vivo'),
        text: T('It is assembled from your parts. The part you just changed glows blue; a preview from hovering glows yellow.',
          'Ele é montado com as suas peças. A peça que você acabou de trocar brilha em azul; a prévia ao passar o mouse brilha em amarelo.',
          'Se arma con tus piezas. La pieza que acabas de cambiar brilla en azul; la vista previa al pasar el ratón brilla en amarillo.') },
      { target: '.ck-ripple',
        title: T('Ripple effect', 'Efeito cascata', 'Efecto dominó'),
        text: T('Change one part and see the chain: a bigger camera → more mass → more power → more data → longer to send to Earth. This is how engineers think.',
          'Troque uma peça e veja a cadeia: câmera maior → mais massa → mais energia → mais dados → mais tempo para mandar à Terra. É assim que engenheiros pensam.',
          'Cambia una pieza y mira la cadena: cámara más grande → más masa → más energía → más datos → más tiempo para enviar a la Tierra. Así piensan los ingenieros.') },
      { target: '.ck-side > .ck-panel',
        title: T('Mission check', 'Checagem da missão', 'Revisión de la misión'),
        text: T('The customer’s goals with your current value next to the target. Green means met. This is how you know the design works before launching.',
          'As metas do cliente com o seu valor atual ao lado da meta. Verde quer dizer cumprida. É assim que você sabe se o projeto funciona antes de lançar.',
          'Las metas del cliente con tu valor actual junto a la meta. Verde significa cumplida. Así sabes si el diseño funciona antes de lanzar.') },
      { target: '.ck-crew',
        title: T('Listen to the crew', 'Ouça a equipe', 'Escucha al equipo'),
        text: T('Each role judges the design by its own goal and explains why. Before launch they vote Go or No-Go, and you can still launch against their advice.',
          'Cada papel julga o projeto pela própria meta e explica o porquê. Antes do lançamento eles votam Go ou No-Go, e você ainda pode lançar contra o conselho.',
          'Cada rol juzga el diseño según su propia meta y explica por qué. Antes del lanzamiento votan Go o No-Go, y aun así puedes lanzar contra su consejo.') },
      { target: '.nav',
        title: T('What is missing and next step', 'O que falta e próximo passo', 'Qué falta y siguiente paso'),
        text: T('This bar always says what you still need to choose. When everything is chosen, the button takes you to the next phase.',
          'Esta barra sempre diz o que ainda falta escolher. Quando tudo estiver escolhido, o botão leva para a próxima fase.',
          'Esta barra siempre dice qué falta elegir. Cuando todo esté elegido, el botón te lleva a la siguiente fase.') },
      { target: null,
        title: T('4. Launch and fly', '4. Lance e voe', '4. Lanza y vuela'),
        text: T('Then you predict how much data will reach Earth, launch, and follow the mission in 3D with time warp. Real space weather (NASA data) can cause surprises, and you decide what to do.',
          'Depois você prevê quantos dados vão chegar à Terra, lança e acompanha a missão em 3D, acelerando o tempo. O clima espacial real (dados da NASA) pode causar imprevistos, e você decide o que fazer.',
          'Después predices cuántos datos llegarán a la Tierra, lanzas y sigues la misión en 3D acelerando el tiempo. El clima espacial real (datos de la NASA) puede causar imprevistos, y tú decides qué hacer.') },
      { target: '[data-action="glossary"]',
        title: T('5. Learn from the report', '5. Aprenda com o relatório', '5. Aprende del informe'),
        text: T('The report explains which choice caused each result, and you can try again and compare. Got stuck on a word? Underlined terms explain themselves, and the Glossary has them all.',
          'O relatório explica qual escolha causou cada resultado, e você pode tentar de novo e comparar. Travou numa palavra? Os termos sublinhados se explicam, e o Glossário tem todos.',
          'El informe explica qué elección causó cada resultado, y puedes intentarlo de nuevo y comparar. ¿Te trabaste con una palabra? Los términos subrayados se explican solos y el Glosario los tiene todos.') },
      { target: null,
        title: T('Ready for launch!', 'Pronto para o lançamento!', '¡Listo para el lanzamiento!'),
        text: T('That is all. There is no single right answer: real teams trade one thing for another. Good mission!',
          'É isso. Não existe uma resposta única: equipes reais trocam uma coisa por outra. Boa missão!',
          'Eso es todo. No hay una única respuesta: los equipos reales cambian una cosa por otra. ¡Buena misión!') }
    ]
  };
})(globalThis);
