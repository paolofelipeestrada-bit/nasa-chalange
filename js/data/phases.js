/* =====================================================================
 * FLUXO DE FASES — os 6 passos da NASA para projetar uma missão
 * científica (webinar "Design and Develop Science Missions", 2025)
 * + o relatório final.
 *
 *   id        identificador guardado no state (state.phase)
 *   screen    qual tela desenha esta fase (js/ui/screen*.js)
 *   nasaStep  número do passo da NASA (1 a 6); o relatório não tem
 *   title     nome do passo · short: nome curto · subtitle: descrição
 *   nasa      "Na NASA": o que as equipes de verdade fazem neste passo
 *   guide     caixa "O que fazer aqui" · tips: dicas curtas
 *   segments  segmentos da missão em jogo (launch, space, ground, user)
 *   cml       nível de maturidade do conceito (JPL) ao fim da fase
 *
 * Textos em { en, pt, es } (T('inglês', 'português', 'espanhol')).
 * As escolhas de cada fase vêm do cenário (campo "phase" dos slots).
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};

  MS.data.flow = {
    defaultScenario: 'eo_cubesat',
    retryPhase: 'design', // para onde "Ajustar e simular de novo" leva

    // Os 4 segmentos de toda missão científica (NASA).
    segments: {
      launch: { name: T('Launch', 'Lançamento', 'Lanzamiento'),
        text: T('The rocket and services that put the spacecraft in space.', 'O foguete e os serviços que levam a nave ao espaço.', 'El cohete y los servicios que llevan la nave al espacio.') },
      space: { name: T('Space', 'Espaço', 'Espacio'),
        text: T('The spacecraft and its instruments, which collect the data.', 'A nave e os instrumentos que coletam os dados.', 'La nave y los instrumentos que recogen los datos.') },
      ground: { name: T('Ground', 'Solo', 'Tierra'),
        text: T('Ground stations and mission control: talk to the spacecraft and receive the data.', 'Estações em solo e controle da missão: falam com a nave e recebem os dados.', 'Estaciones terrenas y control de misión: hablan con la nave y reciben los datos.') },
      user: { name: T('User', 'Usuário', 'Usuario'),
        text: T('The scientists and people who use the data.', 'Os cientistas e as pessoas que usam os dados.', 'Los científicos y las personas que usan los datos.') }
    },

    // Níveis de maturidade do conceito (JPL, Concept Maturity Levels).
    cml: {
      1: T('CML 1 · Cocktail napkin: the idea and its science goal', 'CML 1 · Guardanapo: a ideia e o objetivo científico', 'CML 1 · Servilleta: la idea y su objetivo científico'),
      2: T('CML 2 · Initial feasibility: first numbers', 'CML 2 · Viabilidade inicial: primeiros números', 'CML 2 · Viabilidad inicial: primeros números'),
      3: T('CML 3 · Trade space: comparing options', 'CML 3 · Espaço de trocas: comparar opções', 'CML 3 · Espacio de compromisos: comparar opciones'),
      4: T('CML 4 · Point design: one design, with margins', 'CML 4 · Projeto definido: um projeto, com folgas', 'CML 4 · Diseño puntual: un diseño, con márgenes')
    },

    phases: [
      { id: 'need', screen: 'need', nasaStep: 1, segments: ['user'], cml: 1,
        title: T('Identify Need & Goals', 'Identificar necessidade e objetivos', 'Identificar necesidad y objetivos'),
        short: T('Need', 'Necessidade', 'Necesidad'),
        subtitle: T('Who needs the data, and for what', 'Quem precisa dos dados, e para quê', 'Quién necesita los datos, y para qué'),
        nasa: T('NASA begins with the end in mind: first, who will use the data and what they need. Only then does anyone draw a spacecraft.',
          'A NASA começa pelo fim: primeiro, quem vai usar os dados e do que precisa. Só depois alguém desenha a nave.',
          'La NASA empieza por el final: primero, quién usará los datos y qué necesita. Solo después alguien dibuja la nave.'),
        guide: T('Choose your customer. Each one has a different problem, so the best satellite is different too. Their goals become the mission requirements.',
          'Escolha o seu cliente. Cada um tem um problema diferente, então o melhor satélite também muda. Os objetivos dele viram os requisitos da missão.',
          'Elige a tu cliente. Cada uno tiene un problema distinto, así que el mejor satélite también cambia. Sus objetivos se convierten en los requisitos de la misión.'),
        tips: [T('Click a customer card to choose the mission.', 'Clique num cartão de cliente para escolher a missão.', 'Haz clic en una tarjeta de cliente para elegir la misión.'),
          T('Then press "Start the concept" at the bottom.', 'Depois clique em "Começar o conceito" lá embaixo.', 'Luego pulsa "Empezar el concepto" abajo.')] },
      { id: 'concept', screen: 'concept', nasaStep: 2, segments: ['launch', 'space', 'ground'], cml: 2,
        title: T('Define Concept', 'Definir o conceito', 'Definir el concepto'),
        short: T('Concept', 'Conceito', 'Concepto'),
        subtitle: T('Orbit, launcher and ground station', 'Órbita, lançador e estação em solo', 'Órbita, lanzador y estación terrena'),
        nasa: T('Engineers sketch how the mission will work from start to end (the concept of operations): where it flies, how it gets there and how it talks to Earth.',
          'Os engenheiros desenham como a missão vai funcionar do começo ao fim (o conceito de operações): por onde voa, como chega lá e como fala com a Terra.',
          'Los ingenieros dibujan cómo funcionará la misión de principio a fin (el concepto de operaciones): por dónde vuela, cómo llega y cómo habla con la Tierra.'),
        guide: T('Decide where the satellite will fly ([[orbit|orbit]]), how it gets there (launcher) and where the team talks to it from ([[groundStation|ground station]]).',
          'Decida onde o satélite vai ficar ([[orbit|órbita]]), como ele chega lá (lançador) e de onde a equipe fala com ele ([[groundStation|estação em solo]]).',
          'Decide dónde volará el satélite ([[orbit|órbita]]), cómo llega (lanzador) y desde dónde habla el equipo con él ([[groundStation|estación terrena]]).'),
        tips: [T('Hover a card to preview what it changes in the panel at the top.', 'Passe o mouse num cartão para ver a prévia no painel do topo.', 'Pasa el ratón por una tarjeta para ver la vista previa en el panel superior.'),
          T('Red under "Compatibility" means the choices do not fit together.', 'Vermelho em "Compatibilidade" quer dizer que as escolhas não combinam.', 'Rojo en "Compatibilidad" significa que las elecciones no encajan.')] },
      { id: 'requirements', screen: 'requirements', nasaStep: 3, segments: ['user', 'space'], cml: 2,
        title: T('Define Requirements', 'Definir os requisitos', 'Definir los requisitos'),
        short: T('Requirements', 'Requisitos', 'Requisitos'),
        subtitle: T('Measurable rules the mission must meet', 'Regras medíveis que a missão deve cumprir', 'Reglas medibles que la misión debe cumplir'),
        nasa: T('Each goal becomes a number that can be measured, and each number comes with a plan to check it. Example from NASA: "container under 250 g" is checked by weighing the empty container.',
          'Cada objetivo vira um número medível, e cada número vem com um jeito de conferir. Exemplo da NASA: "recipiente com menos de 250 g" se confere pesando o recipiente vazio.',
          'Cada objetivo se convierte en un número medible, y cada número viene con una forma de comprobarlo. Ejemplo de la NASA: "recipiente de menos de 250 g" se comprueba pesando el recipiente vacío.'),
        guide: T('The customer\'s goals became [[requirement|requirements]]. In the end, your design passes or fails on these numbers.',
          'Os objetivos do cliente viraram [[requirement|requisitos]]. No fim, o projeto é aprovado ou reprovado por esses números.',
          'Los objetivos del cliente se convirtieron en [[requirement|requisitos]]. Al final, tu diseño aprueba o falla según estos números.'),
        tips: [T('Read "Why this value" for each one.', 'Leia o "Por que este valor" de cada um.', 'Lee el "Por qué este valor" de cada uno.'),
          T('Each one shows how it will be verified before launch.', 'Cada um mostra como será verificado antes do lançamento.', 'Cada uno muestra cómo se verificará antes del lanzamiento.')] },
      { id: 'design', screen: 'design', nasaStep: 4, segments: ['space'], cml: 3,
        title: T('Design', 'Projetar', 'Diseñar'),
        short: T('Design', 'Projeto', 'Diseño'),
        subtitle: T('Parts, equipment list and resources', 'Peças, lista de equipamentos e recursos', 'Piezas, lista de equipos y recursos'),
        nasa: T('The team picks the hardware and keeps a list of every part with its mass, power and cost. Every gain costs something somewhere else.',
          'A equipe escolhe o hardware e mantém uma lista de cada peça com massa, energia e custo. Todo ganho custa algo em outro lugar.',
          'El equipo elige el hardware y mantiene una lista de cada pieza con su masa, energía y costo. Toda ganancia cuesta algo en otro lugar.'),
        guide: T('Build the satellite by choosing one option per subsystem. Better performance almost always weighs more, uses more power, costs more or takes longer.',
          'Monte o satélite escolhendo uma opção para cada subsistema. Mais desempenho quase sempre pesa mais, gasta mais energia, custa mais ou demora mais.',
          'Arma el satélite eligiendo una opción por subsistema. Más rendimiento casi siempre pesa más, consume más energía, cuesta más o tarda más.'),
        tips: [T('Green: room to spare. Yellow: at the limit. Red: does not fit.', 'Verde: sobra. Amarelo: no limite. Vermelho: não cabe.', 'Verde: sobra. Amarillo: al límite. Rojo: no cabe.'),
          T('Hover a card to see its effect on all 6 resources before you click.', 'Passe o mouse num cartão para ver o efeito nos 6 recursos antes de clicar.', 'Pasa el ratón por una tarjeta para ver su efecto en los 6 recursos antes de hacer clic.')] },
      { id: 'build', screen: 'build', nasaStep: 5, segments: ['space', 'ground'], cml: 4,
        title: T('Build & Verify', 'Construir e verificar', 'Construir y verificar'),
        short: T('Verify', 'Verificação', 'Verificación'),
        subtitle: T('Prove every requirement before launch', 'Provar cada requisito antes do lançamento', 'Demostrar cada requisito antes del lanzamiento'),
        nasa: T('Before launch, each requirement is proven by a test, an analysis or an inspection. Problems found here are cheap; problems found in orbit are not.',
          'Antes do lançamento, cada requisito é provado por teste, análise ou inspeção. Problema achado aqui é barato; em órbita, não.',
          'Antes del lanzamiento, cada requisito se demuestra con una prueba, un análisis o una inspección. Un problema hallado aquí es barato; en órbita, no.'),
        guide: T('The team tests the satellite. Each [[verification|verification]] checks a requirement or a limit. You also see the [[risk|risks]]: what can go wrong in orbit.',
          'A equipe testa o satélite. Cada [[verification|verificação]] confere um requisito ou um limite. Também aparecem os [[risk|riscos]]: o que pode dar errado em órbita.',
          'El equipo prueba el satélite. Cada [[verification|verificación]] revisa un requisito o un límite. También ves los [[risk|riesgos]]: lo que puede salir mal en órbita.'),
        tips: [T('Red: it will cause trouble. Go back to Design to fix it.', 'Vermelho: vai dar problema. Volte ao Projeto para corrigir.', 'Rojo: causará problemas. Vuelve a Diseño para corregirlo.'),
          T('You can also launch anyway and see what happens.', 'Você também pode lançar assim mesmo e ver o que acontece.', 'También puedes lanzar igual y ver qué pasa.')] },
      { id: 'implement', screen: 'implement', nasaStep: 6, segments: ['launch', 'space', 'ground'], cml: 4,
        title: T('Implement', 'Implementar', 'Implementar'),
        short: T('Mission', 'Missão', 'Misión'),
        subtitle: T('Launch and operations', 'Lançamento e operação', 'Lanzamiento y operación'),
        nasa: T('Launch and operations: scientists and engineers watch from the ground, on console, ready for surprises.',
          'Lançamento e operação: cientistas e engenheiros acompanham do solo, de plantão, prontos para imprevistos.',
          'Lanzamiento y operación: científicos e ingenieros siguen todo desde tierra, de guardia, listos para imprevistos.'),
        guide: T('Pick the launch date, then fly the mission through the real space weather of that year. When mission control gets an alert, you decide.',
          'Escolha a data de lançamento e voe a missão pelo clima espacial real daquele ano. Quando o centro de controle receber um alerta, você decide.',
          'Elige la fecha de lanzamiento y vuela la misión por el clima espacial real de ese año. Cuando el centro de control reciba una alerta, tú decides.'),
        tips: [T('The mission pauses at each decision; your answer becomes the rule for the rest of the year.', 'A missão pausa em cada decisão; sua resposta vira a regra pelo resto do ano.', 'La misión se pausa en cada decisión; tu respuesta se vuelve la regla por el resto del año.'),
          T('The charts show altitude, memory and power day by day; the diary links each real event to NASA.', 'Os gráficos mostram altitude, memória e energia dia a dia; o diário liga cada evento real à NASA.', 'Los gráficos muestran altitud, memoria y energía día a día; el diario enlaza cada evento real con la NASA.'),
          T('Drag the 3D view to rotate it; use the wheel to zoom.', 'Arraste o 3D para girar e use a rodinha para dar zoom.', 'Arrastra la vista 3D para girarla; usa la rueda para el zoom.')] },
      { id: 'report', screen: 'report', nasaStep: null, segments: ['user'], cml: 4,
        title: T('Mission Report', 'Relatório da missão', 'Informe de la misión'),
        short: T('Report', 'Relatório', 'Informe'),
        subtitle: T('Results and lessons', 'Resultado e lições', 'Resultado y lecciones'),
        nasa: T('The data reaches the user segment: the people who needed it. Did the mission answer their need? Teams write down the lessons for the next mission.',
          'Os dados chegam ao segmento do usuário: quem precisava deles. A missão respondeu à necessidade? As equipes anotam as lições para a próxima missão.',
          'Los datos llegan al segmento de usuario: quienes los necesitaban. ¿La misión respondió a su necesidad? Los equipos anotan las lecciones para la próxima misión.'),
        guide: T('See the mission score, what worked and what failed. The lessons say what to change in the next attempt.',
          'Veja a nota da missão, o que deu certo e o que falhou. As lições dizem o que mudar na próxima tentativa.',
          'Mira la nota de la misión, qué salió bien y qué falló. Las lecciones dicen qué cambiar en el próximo intento.'),
        tips: [T('"Adjust and simulate again" goes back to Design and keeps your choices.', '"Ajustar e simular de novo" volta ao Projeto mantendo as escolhas.', '"Ajustar y simular de nuevo" vuelve a Diseño y mantiene tus elecciones.'),
          T('Each attempt draws new random events.', 'Cada tentativa sorteia imprevistos novos.', 'Cada intento sortea imprevistos nuevos.')] }
    ]
  };
})(globalThis);
