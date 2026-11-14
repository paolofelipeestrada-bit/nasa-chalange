/* =====================================================================
 * CENÁRIOS — cada cenário é uma missão completa (um cliente com um
 * objetivo). O jogador escolhe o cenário na fase 1 (Need & Goals).
 *
 * Os três cenários usam as mesmas escolhas, verificações e imprevistos
 * (BASE abaixo) e mudam cliente, área, orçamento e requisitos. Por isso
 * cada um tem um satélite vencedor diferente.
 *
 * Cenário novo: acrescente uma chamada variant('id', {...}) no fim.
 * Nada no motor muda. Textos em { en, pt, es } = T('en', 'pt', 'es').
 *
 *   card                      cartão de escolha (ícone, frase, desafio)
 *   need, goals, constraints  textos da fase Need & Goals
 *   aoi                       área de interesse (área e latitude)
 *   budget_k                  orçamento total (k$)
 *   params                    parâmetros do modelo e margens recomendadas
 *                             (baseDev_months e deadline_months = prazo)
 *   slots                     escolhas: fase, segmento da missão (launch,
 *                             space, ground), help (aceita [[termo]]),
 *                             seção do catálogo (source) e opções (ids)
 *   requirements              métrica do motor + operador + valor
 *                             (ou ref: comparar com outra métrica)
 *   verification              plano de verificação (Build & Verify)
 *   events                    linha do tempo da missão (Implement)
 *   randomEvents              imprevistos sorteados (chance, mitigação, efeito)
 *   team                      papéis do modo equipe
 *   scoring, grades           pesos da pontuação e faixas do relatório
 *
 * Métricas e verificações disponíveis: MS.sim.metricDefs e
 * MS.sim.checkIds (js/sim.js). Nos textos dos eventos, {métrica} é
 * trocado pelo valor calculado, ex.: {gsd_m}.
 *
 * Condições (em eventos):  { check: 'power' }  { requirement: 'R1' }
 *                          { metric: 'mass_kg', op: '<=', value: 3 }
 * fx (eventos e imprevistos): efeito visual no 3D. Opções em MS.vizSchedule.FX
 *   (js/viz/schedule.js): launch, separation, power, contact, image,
 *   coverage, end, delay, storm, glitch, wobble, debris, stationDown.
 * onFail (em eventos):     'abort' (missão termina) · 'none' (só relata)
 *                          { degrade: 0.3 } (multiplica o resultado)
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};
  MS.data.scenarios = MS.data.scenarios || {};

  // ------------------------------------------------- Escolhas do jogador
  // Ordem aqui = ordem na tela. "phase" diz em que fase a escolha é feita.
  var SLOTS = [
    { id: 'orbit', phase: 'concept', segment: 'space', source: 'orbits', options: ['sso500', 'sso600', 'iss400'],
      label: T('Orbit', 'Órbita', 'Órbita'),
      help: T('Where the satellite will fly. Lower: sharper images, but it falls sooner ([[lifetime|orbital lifetime]]).',
        'Onde o satélite vai ficar. Mais baixa: imagens mais nítidas, mas cai antes ([[lifetime|vida orbital]]).',
        'Dónde volará el satélite. Más baja: imágenes más nítidas, pero cae antes ([[lifetime|vida orbital]]).') },
    { id: 'launcher', phase: 'concept', segment: 'launch', source: 'launchers', options: ['rideshare_sso', 'rideshare_tug', 'iss_cargo'],
      label: T('Launcher', 'Lançador', 'Lanzador'),
      help: T('The rocket ride. Each one only reaches certain orbits, and some make you wait longer ([[rideshare|rideshare]]).',
        'A viagem de foguete. Cada um só vai para certas órbitas, e alguns fazem esperar mais ([[rideshare|carona]]).',
        'El viaje en cohete. Cada uno solo llega a ciertas órbitas, y algunos hacen esperar más ([[rideshare|viaje compartido]]).') },
    { id: 'groundStation', phase: 'concept', segment: 'ground', source: 'groundStations', options: ['gs_polar', 'gs_national'],
      label: T('Ground station', 'Estação em solo', 'Estación terrena'),
      help: T('The antenna on Earth that receives the images. More passes per day = more time for the [[downlink|downlink]].',
        'A antena na Terra que recebe as imagens. Mais passagens por dia = mais tempo para o [[downlink|envio de dados]].',
        'La antena en la Tierra que recibe las imágenes. Más pasadas por día = más tiempo para el [[downlink|envío de datos]].') },
    { id: 'payload', phase: 'design', segment: 'space', source: 'components', options: ['cam_wide', 'cam_mid', 'cam_hr'],
      label: T('Instrument', 'Instrumento', 'Instrumento'),
      help: T('The camera ([[payload|payload]]): it sets the image detail ([[gsd|GSD]]) and how wide each photo is ([[swath|swath]]).',
        'A câmera ([[payload|carga útil]]): define o detalhe das imagens ([[gsd|GSD]]) e a largura da foto ([[swath|faixa]]).',
        'La cámara ([[payload|carga útil]]): define el detalle de las imágenes ([[gsd|GSD]]) y el ancho de la foto ([[swath|franja]]).') },
    { id: 'structure', phase: 'design', segment: 'space', source: 'components', options: ['struct_3u', 'struct_6u'],
      label: T('Structure', 'Estrutura', 'Estructura'),
      help: T('The [[cubesat|CubeSat]] "box": everything must fit inside its volume (in [[u|U]]).',
        'A "caixa" do [[cubesat|CubeSat]]: tudo precisa caber no volume dela (em [[u|U]]).',
        'La "caja" del [[cubesat|CubeSat]]: todo debe caber en su volumen (en [[u|U]]).') },
    { id: 'power', phase: 'design', segment: 'space', source: 'components', options: ['eps_body', 'eps_deploy'],
      label: T('Power', 'Energia', 'Energía'),
      help: T('Solar panels and battery. They must make more power than the satellite uses, with a [[margin|margin]].',
        'Painéis solares e bateria. Precisa gerar mais energia do que o satélite gasta, com [[margin|folga]].',
        'Paneles solares y batería. Deben generar más energía de la que usa el satélite, con [[margin|margen]].') },
    { id: 'adcs', phase: 'design', segment: 'space', source: 'components', options: ['adcs_mag', 'adcs_wheels'],
      label: T('Attitude control', 'Controle de atitude', 'Control de actitud'),
      help: T('Turns and points the satellite ([[adcs|attitude control]]). Better cameras need more precise pointing.',
        'Gira e aponta o satélite ([[adcs|controle de atitude]]). Câmeras melhores exigem apontamento mais preciso.',
        'Gira y apunta el satélite ([[adcs|control de actitud]]). Las mejores cámaras exigen un apuntamiento más preciso.') },
    { id: 'comms', phase: 'design', segment: 'space', source: 'components', options: ['com_uhf', 'com_sband'],
      label: T('Radio', 'Comunicação', 'Comunicación'),
      help: T('The radio that sends images to the station. Is it fast enough to send everything the camera makes?',
        'O rádio que manda as imagens para a estação. Rápido o bastante para enviar tudo o que a câmera gera?',
        'La radio que envía las imágenes a la estación. ¿Es lo bastante rápida para enviar todo lo que genera la cámara?') },
    { id: 'obc', phase: 'design', segment: 'space', source: 'components', options: ['obc_basic', 'obc_adv'],
      label: T('Onboard computer', 'Computador de bordo', 'Computadora de a bordo'),
      help: T('Stores and shrinks the images ([[compression|compression]]): less data to send.',
        'Guarda e comprime as imagens ([[compression|compressão]]): menos dados para enviar.',
        'Guarda y comprime las imágenes ([[compression|compresión]]): menos datos para enviar.') }
  ];

  // ----------------------------------------- Plano de verificação (Build)
  var VERIFICATION = [
    { id: 'V1', requirements: ['R1'], method: T('Analysis', 'Análise', 'Análisis'),
      title: T('Optical performance analysis', 'Análise de desempenho óptico', 'Análisis de rendimiento óptico'),
      description: T('Ground detail (GSD) computed from the instrument optics and the altitude.', 'Cálculo do GSD a partir da óptica do instrumento e da altitude.', 'Cálculo del GSD a partir de la óptica del instrumento y la altitud.') },
    { id: 'V2', requirements: ['R2'], method: T('Analysis', 'Análise', 'Análisis'),
      title: T('Coverage simulation', 'Simulação de cobertura', 'Simulación de cobertura'),
      description: T('Simulated photo strips over the area of interest.', 'Simulação das faixas fotografadas sobre a área de interesse.', 'Simulación de las franjas fotografiadas sobre el área de interés.') },
    { id: 'V3', requirements: ['R3'], checks: ['band', 'contact', 'downlink', 'storage'], method: T('Test', 'Teste', 'Prueba'),
      title: T('End-to-end communication test', 'Teste de comunicação ponta a ponta', 'Prueba de comunicación de extremo a extremo'),
      description: T('Satellite and station exchange data on the bench; link and data budgets.', 'Satélite e estação trocam dados em bancada; orçamento de enlace e de dados.', 'Satélite y estación intercambian datos en banco; presupuesto de enlace y de datos.') },
    { id: 'V4', requirements: ['R4'], method: T('Analysis', 'Análise', 'Análisis'),
      title: T('Orbital lifetime analysis', 'Análise de vida orbital', 'Análisis de vida orbital'),
      description: T('Forecast of how air drag lowers the orbit.', 'Previsão do decaimento da órbita pelo arrasto atmosférico.', 'Previsión del descenso de la órbita por el arrastre atmosférico.') },
    { id: 'V5', checks: ['volume', 'mass', 'launch'], method: T('Inspection', 'Inspeção', 'Inspección'),
      title: T('Fit and mass inspection', 'Inspeção de encaixe e massa', 'Inspección de encaje y masa'),
      description: T('The satellite is weighed, measured and fitted into the launcher\'s dispenser.', 'O satélite é pesado, medido e encaixado no dispensador do lançador.', 'El satélite se pesa, se mide y se encaja en el dispensador del lanzador.') },
    { id: 'V6', checks: ['power'], method: T('Test', 'Teste', 'Prueba'),
      title: T('Power balance test', 'Teste de balanço de energia', 'Prueba de balance de energía'),
      description: T('The satellite runs through simulated sun and shadow cycles.', 'O satélite opera em ciclos de sol e sombra simulados.', 'El satélite opera en ciclos simulados de sol y sombra.') },
    { id: 'V7', checks: ['pointing'], method: T('Test', 'Teste', 'Prueba'),
      title: T('Pointing test', 'Teste de apontamento', 'Prueba de apuntamiento'),
      description: T('An air-bearing table measures the attitude control precision.', 'Mesa de rolamento mede a precisão do controle de atitude.', 'Una mesa de rodamiento mide la precisión del control de actitud.') },
    { id: 'V8', checks: ['cost', 'time'], method: T('Review', 'Revisão', 'Revisión'),
      title: T('Cost and schedule review', 'Revisão de custo e prazo', 'Revisión de costo y plazo'),
      description: T('Parts, launch and station against the budget; build time and launch wait against the deadline.', 'Equipamentos, lançamento e estação contra o orçamento; construção e espera do lançamento contra o prazo.', 'Equipos, lanzamiento y estación contra el presupuesto; construcción y espera del lanzamiento contra el plazo.') }
  ];

  // ----------------------------------------- Linha do tempo (Implement)
  // Avaliados em ordem. Um 'abort' encerra a missão.
  var EVENTS = [
    { id: 'E1', fx: 'launch', when: T('Day 0', 'Dia 0', 'Día 0'), title: T('Launch', 'Lançamento', 'Lanzamiento'),
      conditions: [{ check: 'launch' }, { check: 'mass' }, { check: 'volume' }], onFail: 'abort',
      success: T('The rocket carried the CubeSat to the {altitude_km} km orbit.', 'O foguete levou o CubeSat até a órbita de {altitude_km} km.', 'El cohete llevó el CubeSat a la órbita de {altitude_km} km.'),
      failure: T('The satellite could not be launched.', 'O satélite não pôde ser lançado.', 'El satélite no pudo lanzarse.') },
    { id: 'ET', fx: 'delay', when: T('Day 0', 'Dia 0', 'Día 0'), title: T('Ready on time?', 'Pronto no prazo?', '¿Listo a tiempo?'),
      conditions: [{ check: 'time' }], onFail: { degrade: 0.85 },
      success: T('Built, tested and launched after {schedule_months} months: within the {deadline_months}-month deadline.', 'Construído, testado e lançado em {schedule_months} meses: dentro do prazo de {deadline_months} meses.', 'Construido, probado y lanzado en {schedule_months} meses: dentro del plazo de {deadline_months} meses.'),
      failure: T('It only launched after {schedule_months} months; the deadline was {deadline_months}. The customer went without data during the delay.', 'Só foi lançado depois de {schedule_months} meses; o prazo era {deadline_months}. O cliente ficou sem dados durante o atraso.', 'Solo se lanzó después de {schedule_months} meses; el plazo era {deadline_months}. El cliente se quedó sin datos durante el retraso.') },
    { id: 'E2', fx: 'separation', when: T('Day 1', 'Dia 1', 'Día 1'), title: T('Separation and stabilization', 'Separação e estabilização', 'Separación y estabilización'),
      conditions: [],
      success: T('The satellite was released, stopped tumbling and opened its antennas.', 'O satélite foi ejetado, parou de girar e abriu as antenas.', 'El satélite fue liberado, dejó de girar y abrió sus antenas.') },
    { id: 'E3', fx: 'power', when: T('Week 1', 'Semana 1', 'Semana 1'), title: T('Power in orbit', 'Energia em órbita', 'Energía en órbita'),
      conditions: [{ check: 'power' }], onFail: { degrade: 0.3 },
      success: T('The panels make {powerGen_W} W and the satellite uses {powerUse_W} W: the battery stays charged.', 'Os painéis geram {powerGen_W} W e o satélite consome {powerUse_W} W: a bateria se mantém carregada.', 'Los paneles generan {powerGen_W} W y el satélite consume {powerUse_W} W: la batería se mantiene cargada.'),
      failure: T('The battery runs dry: the satellite enters safe mode and works only about 30% of the time.', 'A bateria se esgota: o satélite entra em modo de segurança e só opera cerca de 30% do tempo.', 'La batería se agota: el satélite entra en modo seguro y solo opera cerca del 30% del tiempo.') },
    { id: 'E4', fx: 'contact', when: T('Week 1', 'Semana 1', 'Semana 1'), title: T('First contact', 'Primeiro contato', 'Primer contacto'),
      conditions: [{ check: 'contact' }, { check: 'band' }], onFail: 'abort',
      success: T('The station received the health data: {passesPerDay} passes and {contactMinPerDay} min of contact per day.', 'A estação recebeu a telemetria: {passesPerDay} passagens e {contactMinPerDay} min de contato por dia.', 'La estación recibió la telemetría: {passesPerDay} pasadas y {contactMinPerDay} min de contacto por día.'),
      failure: T('The station never managed to talk to the satellite. Without contact, the mission is lost.', 'A estação nunca conseguiu falar com o satélite. Sem contato, a missão está perdida.', 'La estación nunca logró hablar con el satélite. Sin contacto, la misión está perdida.') },
    { id: 'E5', fx: 'image', when: T('Week 3', 'Semana 3', 'Semana 3'), title: T('First image', 'Primeira imagem', 'Primera imagen'),
      conditions: [{ check: 'pointing' }], onFail: { degrade: 0 },
      success: T('First sharp image of the area, at {gsd_m} m per pixel.', 'Primeira imagem nítida da área, com {gsd_m} m por pixel.', 'Primera imagen nítida del área, con {gsd_m} m por píxel.'),
      failure: T('Images come out blurry and off target: the attitude control cannot point as precisely as the instrument needs.', 'As imagens saem borradas e fora do alvo: o controle de atitude não aponta com a precisão que o instrumento exige.', 'Las imágenes salen borrosas y fuera del objetivo: el control de actitud no apunta con la precisión que exige el instrumento.') },
    { id: 'E6', fx: 'image', when: T('Month 1', 'Mês 1', 'Mes 1'), title: T('Spotting clearings', 'Detecção de clareiras', 'Detección de claros'),
      conditions: [{ requirement: 'R1' }], onFail: { degrade: 0.5 },
      success: T('At {gsd_m} m per pixel, 1-hectare clearings show up in the images.', 'Com {gsd_m} m por pixel, clareiras de 1 hectare aparecem nas imagens.', 'Con {gsd_m} m por píxel, los claros de 1 hectárea aparecen en las imágenes.'),
      failure: T('At {gsd_m} m per pixel small clearings do not show up: only about half of the deforestation is detected.', 'Com {gsd_m} m por pixel as clareiras pequenas não aparecem: só cerca de metade do desmatamento é detectada.', 'Con {gsd_m} m por píxel los claros pequeños no aparecen: solo se detecta cerca de la mitad de la deforestación.') },
    { id: 'E7', fx: 'coverage', when: T('Months 1–12', 'Meses 1–12', 'Meses 1–12'), title: T('Area coverage', 'Cobertura da área', 'Cobertura del área'),
      conditions: [{ requirement: 'R2' }], onFail: 'none',
      success: T('A complete map of the area every {revisit_days} days.', 'Um mapa completo da área a cada {revisit_days} dias.', 'Un mapa completo del área cada {revisit_days} días.'),
      failure: T('The whole area is only covered every {revisit_days} days: maps arrive late.', 'A área completa só é coberta a cada {revisit_days} dias: os mapas atrasam.', 'El área completa solo se cubre cada {revisit_days} días: los mapas llegan tarde.') },
    { id: 'E8', fx: 'contact', when: T('Months 1–12', 'Meses 1–12', 'Meses 1–12'), title: T('Data delivery', 'Entrega de dados', 'Entrega de datos'),
      conditions: [{ requirement: 'R3' }], onFail: 'none',
      success: T('All {dataPerDay_Gbit} Gbit made each day reach the ground.', 'Os {dataPerDay_Gbit} Gbit gerados por dia chegam todos ao solo.', 'Los {dataPerDay_Gbit} Gbit generados por día llegan todos a tierra.'),
      failure: T('The satellite makes {dataPerDay_Gbit} Gbit per day but can only send {downlink_Gbit_day}: the rest is thrown away.', 'O satélite gera {dataPerDay_Gbit} Gbit por dia, mas só consegue enviar {downlink_Gbit_day}: o resto é descartado.', 'El satélite genera {dataPerDay_Gbit} Gbit por día, pero solo puede enviar {downlink_Gbit_day}: el resto se descarta.') },
    { id: 'E9', fx: 'end', when: T('Year 1', 'Ano 1', 'Año 1'), title: T('End of mission', 'Fim da missão', 'Fin de la misión'),
      conditions: [{ requirement: 'R4' }], onFail: 'none',
      success: T('The mission completed its planned time; the orbit still lasts about {lifetime_years} years.', 'A missão completou o tempo previsto; a órbita ainda dura cerca de {lifetime_years} anos.', 'La misión completó el tiempo previsto; la órbita aún dura unos {lifetime_years} años.'),
      failure: T('Air drag brought the satellite down after {lifetime_years} years, earlier than planned.', 'O arrasto atmosférico derrubou o satélite após {lifetime_years} ano, antes do previsto.', 'El arrastre atmosférico derribó el satélite tras {lifetime_years} años, antes de lo previsto.') }
  ];

  // Imprevistos: sorteados com a semente da tentativa (state.seed).
  //   chance       probabilidade de acontecer (0 a 1)
  //   appliesIf    só pode acontecer se estas condições valerem
  //   mitigatedBy  se o projeto cumprir isto, o imprevisto não causa dano
  //   effect       dano sem mitigação: { degrade: 0.7 } · 'abort' · 'none'
  //   after        aparece na linha do tempo logo depois deste evento
  //   lesson       entra nas lições do relatório quando causa dano
  var RANDOM_EVENTS = [
    { id: 'RE1', fx: 'delay', after: 'E1', chance: 0.2, effect: { degrade: 0.85 },
      when: T('Day 0', 'Dia 0', 'Día 0'), title: T('Launch delay', 'Atraso no lançamento', 'Retraso del lanzamiento'),
      description: T('Rideshare rockets are often delayed by weather or by other satellites.', 'Foguetes de carona atrasam com frequência por causa do clima ou de outros satélites.', 'Los cohetes compartidos se retrasan a menudo por el clima o por otros satélites.'),
      text: T('The launch slipped two months: less operating time was left in the planned year.', 'O lançamento atrasou dois meses: sobrou menos tempo de operação no ano previsto.', 'El lanzamiento se retrasó dos meses: quedó menos tiempo de operación en el año previsto.'),
      lesson: T('Launch delays are common: a satellite with a long orbital life makes up for lost time.', 'Atrasos de lançamento são comuns: um satélite com vida orbital longa compensa o tempo perdido.', 'Los retrasos de lanzamiento son comunes: un satélite con vida orbital larga compensa el tiempo perdido.') },
    { id: 'RE2', fx: 'storm', after: 'E6', chance: 0.25, mitigatedBy: [{ margin: 'power', op: '>=', value: 0.3 }], effect: { degrade: 0.7 },
      when: T('Month 2', 'Mês 2', 'Mes 2'), title: T('Solar storm', 'Tempestade solar', 'Tormenta solar'),
      description: T('A strong solar storm damages part of the solar cells.', 'Uma tempestade solar forte danifica parte das células solares.', 'Una fuerte tormenta solar daña parte de las células solares.'),
      text: T('A solar storm damaged solar cells: power ran short and the satellite spent weeks in safe mode.', 'Uma tempestade solar danificou células solares: a energia ficou curta e o satélite passou semanas em modo de segurança.', 'Una tormenta solar dañó células solares: faltó energía y el satélite pasó semanas en modo seguro.'),
      mitigatedText: T('A solar storm damaged solar cells, but the power margin absorbed the loss.', 'Uma tempestade solar danificou células solares, mas a folga de energia absorveu a perda.', 'Una tormenta solar dañó células solares, pero el margen de energía absorbió la pérdida.'),
      lesson: T('Leave at least 30% power margin: radiation reduces what the panels make.', 'Deixe pelo menos 30% de folga de energia: a radiação reduz a geração dos painéis.', 'Deja al menos 30% de margen de energía: la radiación reduce lo que generan los paneles.') },
    { id: 'RE3', fx: 'glitch', after: 'E5', chance: 0.3, mitigatedBy: [{ slot: 'comms', is: 'com_sband' }], effect: { degrade: 0.75 },
      when: T('Month 1', 'Mês 1', 'Mes 1'), title: T('Onboard software bug', 'Bug no software de bordo', 'Error en el software de a bordo'),
      description: T('A software bug freezes the computer and a big fix must be sent up.', 'Um erro de software trava o computador e exige enviar uma correção grande lá de cima.', 'Un error de software congela la computadora y hay que enviar una corrección grande.'),
      text: T('A bug froze the onboard computer. Over the slow radio, the fix took weeks to upload.', 'Um bug travou o computador de bordo. Pelo rádio lento, a correção levou semanas para subir.', 'Un error congeló la computadora de a bordo. Por la radio lenta, la corrección tardó semanas en subir.'),
      mitigatedText: T('A bug froze the onboard computer; the fix went up in a single pass over the S-band radio.', 'Um bug travou o computador de bordo; a correção subiu em uma passagem pelo rádio banda S.', 'Un error congeló la computadora de a bordo; la corrección subió en una pasada por la radio banda S.'),
      lesson: T('A fast radio also lets you fix the software in orbit.', 'Um rádio rápido também serve para corrigir o software em órbita.', 'Una radio rápida también sirve para corregir el software en órbita.') },
    { id: 'RE4', fx: 'wobble', after: 'E6', chance: 0.15, appliesIf: [{ slot: 'adcs', is: 'adcs_wheels' }], effect: { degrade: 0.6 },
      when: T('Month 5', 'Mês 5', 'Mes 5'), title: T('Reaction wheel failure', 'Falha de uma roda de reação', 'Falla de una rueda de reacción'),
      description: T('Reaction wheels have moving parts and can jam.', 'Rodas de reação têm partes móveis e podem travar.', 'Las ruedas de reacción tienen partes móviles y pueden trabarse.'),
      text: T('One reaction wheel jammed. The satellite keeps pointing with the others but loses some images.', 'Uma das rodas de reação travou. O satélite segue apontando com as outras, mas perde parte das imagens.', 'Una rueda de reacción se trabó. El satélite sigue apuntando con las otras, pero pierde parte de las imágenes.'),
      lesson: T('Parts with moving pieces fail: real missions carry a spare wheel (redundancy).', 'Peças com partes móveis falham: missões reais levam uma roda extra (redundância).', 'Las piezas con partes móviles fallan: las misiones reales llevan una rueda extra (redundancia).') },
    { id: 'RE5', fx: 'debris', after: 'E7', chance: 0.25, appliesIf: [{ slot: 'orbit', is: 'iss400' }], effect: { degrade: 0.9 },
      when: T('Month 6', 'Mês 6', 'Mes 6'), title: T('Debris collision alert', 'Alerta de colisão com detrito', 'Alerta de colisión con escombros'),
      description: T('Near the Space Station there is heavy traffic and debris; avoidance maneuvers interrupt the images.', 'Perto da ISS há muito tráfego e detritos; manobras de desvio interrompem as imagens.', 'Cerca de la ISS hay mucho tráfico y escombros; las maniobras de evasión interrumpen las imágenes.'),
      text: T('A piece of debris passed close and operations stopped for days for analysis and avoidance.', 'Um detrito passou perto e as operações pararam por vários dias para análise e desvio.', 'Un escombro pasó cerca y las operaciones se detuvieron varios días para análisis y evasión.'),
      lesson: T('Crowded orbits, like the Space Station\'s, bring more debris interruptions.', 'Órbitas cheias, como a da ISS, trazem mais interrupções por detritos.', 'Las órbitas concurridas, como la de la ISS, traen más interrupciones por escombros.') },
    { id: 'RE6', fx: 'stationDown', after: 'E8', chance: 0.3, mitigatedBy: [{ margin: 'downlink', op: '>=', value: 0.2 }], effect: { degrade: 0.85 },
      when: T('Month 8', 'Mês 8', 'Mes 8'), title: T('Station antenna under maintenance', 'Antena da estação em manutenção', 'Antena de la estación en mantenimiento'),
      description: T('The ground antenna stops for a month and the passes in that period are lost.', 'A antena em solo para por um mês e as passagens desse período são perdidas.', 'La antena terrena se detiene un mes y se pierden las pasadas de ese período.'),
      text: T('The antenna was down for a month; with no spare capacity to catch up, the stored images were thrown away.', 'A antena ficou um mês parada; sem folga para recuperar, as imagens acumuladas foram descartadas.', 'La antena estuvo parada un mes; sin margen para recuperar, las imágenes acumuladas se descartaron.'),
      mitigatedText: T('The antenna was down for a month, but the downlink margin caught up afterwards.', 'A antena ficou um mês parada, mas a folga de envio de dados recuperou o atraso depois.', 'La antena estuvo parada un mes, pero el margen de envío de datos recuperó el retraso después.'),
      lesson: T('A downlink margin (20% or more) protects against lost passes.', 'Folga de envio de dados (20% ou mais) protege contra passagens perdidas.', 'Un margen de envío de datos (20% o más) protege contra pasadas perdidas.') }
  ];

  // Modo equipe (multiplayer cooperativo): cada papel cuida de algumas escolhas.
  //   slots       escolhas que só quem tem o papel pode mudar
  //   canAdvance  quem tem este papel conduz as fases (avançar, voltar, simular de novo)
  // Papel sem dono: qualquer um da sala pode mexer nas escolhas dele.
  var TEAM = {
    maxPlayers: 4,
    roles: [
      { id: 'manager', canAdvance: true, slots: ['orbit', 'launcher'],
        name: T('Mission manager', 'Gerente de missão', 'Gerente de misión'),
        description: T('Picks the orbit and the launcher, watches budget and schedule, and leads the team through the phases.', 'Escolhe a órbita e o lançador, cuida do orçamento e do prazo e conduz a equipe pelas fases.', 'Elige la órbita y el lanzador, cuida el presupuesto y el plazo y guía al equipo por las fases.') },
      { id: 'payload', slots: ['payload', 'obc'],
        name: T('Payload scientist', 'Carga útil', 'Carga útil'),
        description: T('Picks the instrument and the onboard computer: what takes and prepares the images.', 'Escolhe o instrumento e o computador de bordo: o que tira e prepara as imagens.', 'Elige el instrumento y la computadora de a bordo: lo que toma y prepara las imágenes.') },
      { id: 'bus', slots: ['structure', 'power', 'adcs'],
        name: T('Spacecraft engineer', 'Plataforma', 'Plataforma'),
        description: T('Handles structure, power and pointing: the satellite that carries the instrument.', 'Cuida da estrutura, da energia e do apontamento: o satélite que carrega o instrumento.', 'Cuida la estructura, la energía y el apuntamiento: el satélite que lleva el instrumento.') },
      { id: 'ground', slots: ['comms', 'groundStation'],
        name: T('Communications and ground', 'Comunicações e solo', 'Comunicaciones y tierra'),
        description: T('Picks the radio and the ground station: the path of the images down to Earth.', 'Escolhe o rádio e a estação em solo: o caminho das imagens até a Terra.', 'Elige la radio y la estación terrena: el camino de las imágenes hasta la Tierra.') }
    ]
  };

  var GRADES = [
    { min: 90, label: T('Outstanding mission', 'Missão exemplar', 'Misión ejemplar') },
    { min: 70, label: T('Successful mission', 'Missão bem-sucedida', 'Misión exitosa') },
    { min: 40, label: T('Partial success', 'Sucesso parcial', 'Éxito parcial') },
    { min: 0,  label: T('Failed mission', 'Missão fracassada', 'Misión fallida') }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ------------------------------------------------ Cenário 1: desmatamento
  var BASE = {
    id: 'eo_cubesat',
    card: { icon: '🌳',
      pitch: T('Find new deforestation in the Amazon every month.', 'Achar desmatamento novo na Amazônia todo mês.', 'Encontrar deforestación nueva en la Amazonía cada mes.'),
      challenge: T('Hard: sharp images AND a full map every month.', 'Difícil: imagens nítidas E mapa completo todo mês.', 'Difícil: imágenes nítidas Y mapa completo cada mes.') },
    title: T('Deforestation watch', 'Vigilância do desmatamento', 'Vigilancia de la deforestación'),
    customer: T('Environmental agency', 'Agência ambiental', 'Agencia ambiental'),
    need: T('The agency needs to know, every month, where new clearings appeared in the Amazon. Today it buys expensive images from others and wants its own small, cheap satellite.',
      'A agência precisa saber, todo mês, onde surgiram novas áreas desmatadas na Amazônia. Hoje ela compra imagens caras de terceiros e quer um satélite próprio, pequeno e barato.',
      'La agencia necesita saber, cada mes, dónde aparecieron nuevos claros en la Amazonía. Hoy compra imágenes caras a terceros y quiere un satélite propio, pequeño y barato.'),
    goals: [
      { id: 'G1', text: T('See clearings from 1 hectare up (100 m × 100 m).', 'Enxergar clareiras a partir de 1 hectare (100 m × 100 m).', 'Ver claros desde 1 hectárea (100 m × 100 m).') },
      { id: 'G2', text: T('Have a new map of the whole area every month.', 'Ter um mapa novo de toda a área a cada mês.', 'Tener un mapa nuevo de toda el área cada mes.') },
      { id: 'G3', text: T('Receive on the ground every image produced.', 'Receber em solo todas as imagens produzidas.', 'Recibir en tierra todas las imágenes producidas.') },
      { id: 'G4', text: T('Operate for at least 1 year.', 'Operar por pelo menos 1 ano.', 'Operar al menos 1 año.') }
    ],
    constraints: [
      T('Total budget of 750 k$: satellite, launch and ground station.', 'Orçamento total de 750 k$: satélite, lançamento e estação em solo.', 'Presupuesto total de 750 k$: satélite, lanzamiento y estación terrena.'),
      T('Launch within 24 months from the start of the project ([[schedule|schedule]]).', 'Lançar em até 24 meses do início do projeto ([[schedule|prazo]]).', 'Lanzar en un máximo de 24 meses desde el inicio del proyecto ([[schedule|plazo]]).'),
      T('[[cubesat|CubeSat]] format (3U or 6U).', 'Formato [[cubesat|CubeSat]] (3U ou 6U).', 'Formato [[cubesat|CubeSat]] (3U o 6U).')
    ],
    aoi: { name: T('Legal Amazon', 'Amazônia Legal', 'Amazonía Legal'), area_km2: 5000000, latitude_deg: -5, longitude_deg: -60, radius_deg: 13 },
    budget_k: 750,

    params: {
      contactEfficiency: 0.8,       // fração útil de cada passagem (aquisição, protocolo)
      powerStorageEfficiency: 0.85, // perdas de bateria e conversão
      storageDays: 2,               // dias de dados que o computador deve guardar
      plannedDuration_years: 1,
      targetMapsPerYear: 12,
      baseDev_months: 12,           // construir e testar com peças comerciais (CubeSat 101: 9 a 24 meses)
      deadline_months: 24,          // o cliente quer o satélite em órbita até aqui
      // Folga mínima recomendada de cada recurso (0,10 = 10%)
      margins: { mass: 0.10, volume: 0, power: 0.20, downlink: 0.10, storage: 0.10, cost: 0, time: 0.10 }
    },

    slots: SLOTS,

    requirements: [
      { id: 'R1', goal: 'G1', weight: 1, metric: 'gsd_m', op: '<=', value: 30,
        title: T('Image detail', 'Resolução', 'Resolución'),
        text: T('Images must have a ground detail (GSD) of 30 m or better.', 'As imagens devem ter resolução no solo (GSD) de 30 m ou melhor.', 'Las imágenes deben tener un detalle en el suelo (GSD) de 30 m o mejor.'),
        rationale: T('A 1 ha clearing (100 m × 100 m) must cover at least ~3 × 3 pixels to be detected: 100 m ÷ 3 ≈ 30 m.', 'Uma clareira de 1 ha (100 m × 100 m) precisa ocupar pelo menos ~3 × 3 pixels para ser detectada: 100 m ÷ 3 ≈ 30 m.', 'Un claro de 1 ha (100 m × 100 m) debe ocupar al menos ~3 × 3 píxeles para detectarse: 100 m ÷ 3 ≈ 30 m.'),
        hint: T('GSD = altitude × pixel ÷ focal length: use an instrument with a longer focal length or a lower orbit.', 'GSD = altitude × pixel ÷ focal: use um instrumento de distância focal maior ou uma órbita mais baixa.', 'GSD = altitud × píxel ÷ focal: usa un instrumento de mayor distancia focal o una órbita más baja.') },
      { id: 'R2', goal: 'G2', weight: 1, metric: 'revisit_days', op: '<=', value: 30,
        title: T('Revisit', 'Revisita', 'Revisita'),
        text: T('The satellite must cover the whole area of interest in 30 days or less.', 'O satélite deve cobrir toda a área de interesse em 30 dias ou menos.', 'El satélite debe cubrir toda el área de interés en 30 días o menos.'),
        rationale: T('To deliver a new map every month, every point of the area must be photographed at least once every 30 days.', 'Para entregar um mapa novo por mês, cada ponto da área precisa ser fotografado pelo menos uma vez a cada 30 dias.', 'Para entregar un mapa nuevo cada mes, cada punto del área debe fotografiarse al menos una vez cada 30 días.'),
        hint: T('A wider swath and a sun-synchronous orbit (good light on every pass) shorten the revisit.', 'Faixa imageada mais larga e órbita heliossíncrona (boa iluminação em todas as passagens) diminuem a revisita.', 'Una franja más ancha y una órbita heliosíncrona (buena luz en cada pasada) acortan la revisita.') },
      { id: 'R3', goal: 'G3', weight: 1, metric: 'downlink_Gbit_day', op: '>=', ref: 'dataPerDay_Gbit',
        title: T('Data delivery', 'Entrega de dados', 'Entrega de datos'),
        text: T('The daily downlink capacity must be greater than or equal to the data made per day.', 'A capacidade diária de envio de dados ao solo deve ser maior ou igual aos dados gerados por dia.', 'La capacidad diaria de envío de datos a tierra debe ser mayor o igual a los datos generados por día.'),
        rationale: T('If the satellite makes more data than it can send, images pile up in memory and end up thrown away.', 'Se o satélite gera mais dados do que consegue enviar, as imagens se acumulam na memória e acabam descartadas.', 'Si el satélite genera más datos de los que puede enviar, las imágenes se acumulan en la memoria y terminan descartadas.'),
        hint: T('Use a faster radio, a station that sees more passes, or more compression on board.', 'Use um rádio mais rápido, uma estação que veja mais passagens ou mais compressão a bordo.', 'Usa una radio más rápida, una estación que vea más pasadas o más compresión a bordo.') },
      { id: 'R4', goal: 'G4', weight: 1, metric: 'lifetime_years', op: '>=', value: 1,
        title: T('Lifetime', 'Vida útil', 'Vida útil'),
        text: T('The satellite must stay in orbit and working for at least 1 year.', 'O satélite deve permanecer em órbita, operando, por pelo menos 1 ano.', 'El satélite debe permanecer en órbita y operando al menos 1 año.'),
        rationale: T('The agency needs at least 12 monthly maps to justify the investment.', 'A agência precisa de pelo menos 12 mapas mensais para justificar o investimento.', 'La agencia necesita al menos 12 mapas mensuales para justificar la inversión.'),
        hint: T('Lower orbits fall faster because of air drag: choose a higher orbit.', 'Órbitas mais baixas caem mais rápido por causa do arrasto atmosférico: escolha uma órbita mais alta.', 'Las órbitas más bajas caen más rápido por el arrastre atmosférico: elige una órbita más alta.') }
    ],

    verification: VERIFICATION,
    events: EVENTS,
    randomEvents: RANDOM_EVENTS,
    team: TEAM,

    // Pontuação (0–100): requisitos + resultado da missão + orçamento + margens.
    scoring: { requirements: 40, mission: 40, budget: 10, margins: 10 },
    grades: GRADES
  };
  MS.data.scenarios.eo_cubesat = BASE;

  // Variação de um cenário: copia o BASE e troca só o que é diferente.
  //   requirements e events: mescla por id (só os campos indicados).
  function variant(id, patch) {
    var s = clone(BASE);
    Object.keys(patch).forEach(function (k) {
      if (k === 'requirements' || k === 'events') {
        s[k] = s[k].map(function (x) { return patch[k][x.id] ? Object.assign(x, clone(patch[k][x.id])) : x; });
      } else if (k === 'params') {
        Object.assign(s.params, clone(patch.params));
      } else {
        s[k] = clone(patch[k]);
      }
    });
    s.id = id;
    MS.data.scenarios[id] = s;
    return s;
  }

  // ------------------------------------------------ Cenário 2: queimadas
  variant('fire_watch', {
    card: { icon: '🔥',
      pitch: T('Map fire scars and plant health in the Cerrado every month.', 'Mapear queimadas e a saúde da vegetação do Cerrado todo mês.', 'Mapear quemas y la salud de la vegetación del Cerrado cada mes.'),
      challenge: T('Easier on detail, tight on money: several designs can win.', 'Menos exigente no detalhe, apertado no dinheiro: vários projetos vencem.', 'Menos exigente en detalle, ajustado en dinero: varios diseños pueden ganar.') },
    title: T('Fire scar watch', 'Vigilância de queimadas', 'Vigilancia de quemas'),
    customer: T('Climate and fire institute', 'Instituto de clima e queimadas', 'Instituto de clima e incendios'),
    need: T('The institute wants to follow, every month, the burned areas and the health of the vegetation in the Cerrado. Large burn scars matter, so 60 m of detail is enough, but the budget is tight.',
      'O instituto quer acompanhar, todo mês, as áreas queimadas e a saúde da vegetação do Cerrado. Importam as cicatrizes grandes, então 60 m de detalhe bastam, mas o orçamento é apertado.',
      'El instituto quiere seguir, cada mes, las áreas quemadas y la salud de la vegetación del Cerrado. Importan las cicatrices grandes, así que 60 m de detalle bastan, pero el presupuesto es ajustado.'),
    goals: [
      { id: 'G1', text: T('See burn scars from 4 hectares up (200 m × 200 m).', 'Enxergar cicatrizes de queimada a partir de 4 hectares (200 m × 200 m).', 'Ver cicatrices de quema desde 4 hectáreas (200 m × 200 m).') },
      { id: 'G2', text: T('Have a new map of the whole area every month.', 'Ter um mapa novo de toda a área a cada mês.', 'Tener un mapa nuevo de toda el área cada mes.') },
      { id: 'G3', text: T('Receive on the ground every image produced.', 'Receber em solo todas as imagens produzidas.', 'Recibir en tierra todas las imágenes producidas.') },
      { id: 'G4', text: T('Operate for at least 1 year.', 'Operar por pelo menos 1 ano.', 'Operar al menos 1 año.') }
    ],
    constraints: [
      T('Total budget of 650 k$: satellite, launch and ground station.', 'Orçamento total de 650 k$: satélite, lançamento e estação em solo.', 'Presupuesto total de 650 k$: satélite, lanzamiento y estación terrena.'),
      T('Launch within 24 months from the start of the project ([[schedule|schedule]]).', 'Lançar em até 24 meses do início do projeto ([[schedule|prazo]]).', 'Lanzar en un máximo de 24 meses desde el inicio del proyecto ([[schedule|plazo]]).'),
      T('[[cubesat|CubeSat]] format (3U or 6U).', 'Formato [[cubesat|CubeSat]] (3U ou 6U).', 'Formato [[cubesat|CubeSat]] (3U o 6U).')
    ],
    aoi: { name: T('Cerrado (Brazilian savanna)', 'Cerrado', 'Cerrado (sabana brasileña)'), area_km2: 2000000, latitude_deg: -14, longitude_deg: -48, radius_deg: 9 },
    budget_k: 650,
    requirements: {
      R1: { value: 60,
        text: T('Images must have a ground detail (GSD) of 60 m or better.', 'As imagens devem ter resolução no solo (GSD) de 60 m ou melhor.', 'Las imágenes deben tener un detalle en el suelo (GSD) de 60 m o mejor.'),
        rationale: T('A 4 ha burn scar (200 m × 200 m) must cover at least ~3 × 3 pixels: 200 m ÷ 3 ≈ 67 m, rounded down to 60 m.', 'Uma cicatriz de 4 ha (200 m × 200 m) precisa ocupar pelo menos ~3 × 3 pixels: 200 m ÷ 3 ≈ 67 m, arredondado para 60 m.', 'Una cicatriz de 4 ha (200 m × 200 m) debe ocupar al menos ~3 × 3 píxeles: 200 m ÷ 3 ≈ 67 m, redondeado a 60 m.') },
      R4: { rationale: T('The institute needs at least 12 monthly maps to compare the dry and rainy seasons.', 'O instituto precisa de pelo menos 12 mapas mensais para comparar a seca e a chuva.', 'El instituto necesita al menos 12 mapas mensuales para comparar la sequía y la lluvia.') }
    },
    events: {
      E6: { title: T('Spotting burn scars', 'Detecção de queimadas', 'Detección de quemas'),
        success: T('At {gsd_m} m per pixel, burn scars of 4 hectares show up in the images.', 'Com {gsd_m} m por pixel, cicatrizes de queimada de 4 hectares aparecem nas imagens.', 'Con {gsd_m} m por píxel, las cicatrices de quema de 4 hectáreas aparecen en las imágenes.'),
        failure: T('At {gsd_m} m per pixel only the biggest burn scars show up: about half of the burned area goes unnoticed.', 'Com {gsd_m} m por pixel só as maiores cicatrizes aparecem: cerca de metade da área queimada passa despercebida.', 'Con {gsd_m} m por píxel solo aparecen las cicatrices más grandes: cerca de la mitad del área quemada pasa desapercibida.') }
    }
  });

  // ------------------------------------------------ Cenário 3: cidades
  variant('city_map', {
    card: { icon: '🏙️',
      pitch: T('A very detailed yearly map of a metropolitan region.', 'Um mapa anual muito detalhado de uma região metropolitana.', 'Un mapa anual muy detallado de una región metropolitana.'),
      challenge: T('Needs a big telescope: watch volume, money and schedule.', 'Exige um telescópio grande: cuidado com volume, dinheiro e prazo.', 'Exige un telescopio grande: cuidado con el volumen, el dinero y el plazo.') },
    title: T('Urban growth map', 'Mapa do crescimento urbano', 'Mapa del crecimiento urbano'),
    customer: T('Metropolitan planning office', 'Secretaria de planejamento metropolitano', 'Oficina de planificación metropolitana'),
    need: T('The planning office wants a very detailed map of the São Paulo region once a year, to find new buildings and homes in risk areas. A map per year is enough, but each building must be visible.',
      'A secretaria quer um mapa muito detalhado da região de São Paulo uma vez por ano, para achar construções novas e moradias em áreas de risco. Um mapa por ano basta, mas cada construção precisa aparecer.',
      'La oficina quiere un mapa muy detallado de la región de São Paulo una vez al año, para encontrar construcciones nuevas y viviendas en zonas de riesgo. Basta un mapa al año, pero cada construcción debe verse.'),
    goals: [
      { id: 'G1', text: T('See buildings from 15 m × 15 m up.', 'Enxergar construções a partir de 15 m × 15 m.', 'Ver construcciones desde 15 m × 15 m.') },
      { id: 'G2', text: T('Have a new map of the whole region every year.', 'Ter um mapa novo da região inteira a cada ano.', 'Tener un mapa nuevo de toda la región cada año.') },
      { id: 'G3', text: T('Receive on the ground every image produced.', 'Receber em solo todas as imagens produzidas.', 'Recibir en tierra todas las imágenes producidas.') },
      { id: 'G4', text: T('Operate for at least 1 year.', 'Operar por pelo menos 1 ano.', 'Operar al menos 1 año.') }
    ],
    constraints: [
      T('Total budget of 1,200 k$: satellite, launch and ground station.', 'Orçamento total de 1.200 k$: satélite, lançamento e estação em solo.', 'Presupuesto total de 1.200 k$: satélite, lanzamiento y estación terrena.'),
      T('Launch within 24 months from the start of the project ([[schedule|schedule]]).', 'Lançar em até 24 meses do início do projeto ([[schedule|prazo]]).', 'Lanzar en un máximo de 24 meses desde el inicio del proyecto ([[schedule|plazo]]).'),
      T('[[cubesat|CubeSat]] format (3U or 6U).', 'Formato [[cubesat|CubeSat]] (3U ou 6U).', 'Formato [[cubesat|CubeSat]] (3U o 6U).')
    ],
    aoi: { name: T('São Paulo region', 'Região de São Paulo', 'Región de São Paulo'), area_km2: 50000, latitude_deg: -23.5, longitude_deg: -46.6, radius_deg: 1.5 },
    budget_k: 1200,
    params: { targetMapsPerYear: 1 },
    requirements: {
      R1: { value: 5,
        text: T('Images must have a ground detail (GSD) of 5 m or better.', 'As imagens devem ter resolução no solo (GSD) de 5 m ou melhor.', 'Las imágenes deben tener un detalle en el suelo (GSD) de 5 m o mejor.'),
        rationale: T('A 15 m building must cover about 3 × 3 pixels: 15 m ÷ 3 = 5 m.', 'Uma construção de 15 m precisa ocupar cerca de 3 × 3 pixels: 15 m ÷ 3 = 5 m.', 'Una construcción de 15 m debe ocupar unos 3 × 3 píxeles: 15 m ÷ 3 = 5 m.') },
      R2: { value: 365,
        text: T('The satellite must cover the whole region in 365 days or less.', 'O satélite deve cobrir toda a região em 365 dias ou menos.', 'El satélite debe cubrir toda la región en 365 días o menos.'),
        rationale: T('One complete map per year is enough to see how the city grew.', 'Um mapa completo por ano basta para ver como a cidade cresceu.', 'Un mapa completo por año basta para ver cómo creció la ciudad.'),
        hint: T('A narrow, detailed camera takes long to cover everything: a wider swath or more orbits per day help.', 'Uma câmera estreita e detalhada demora para cobrir tudo: faixa mais larga ou mais órbitas por dia ajudam.', 'Una cámara estrecha y detallada tarda en cubrir todo: una franja más ancha o más órbitas por día ayudan.') },
      R4: { rationale: T('The office needs at least one full yearly map to justify the investment.', 'A secretaria precisa de pelo menos um mapa anual completo para justificar o investimento.', 'La oficina necesita al menos un mapa anual completo para justificar la inversión.') }
    },
    events: {
      E6: { title: T('Spotting buildings', 'Detecção de construções', 'Detección de construcciones'),
        success: T('At {gsd_m} m per pixel, new buildings show up one by one.', 'Com {gsd_m} m por pixel, construções novas aparecem uma a uma.', 'Con {gsd_m} m por píxel, las construcciones nuevas aparecen una a una.'),
        failure: T('At {gsd_m} m per pixel buildings blur into blocks: the map cannot tell new homes apart.', 'Com {gsd_m} m por pixel as construções viram borrões: o mapa não separa as moradias novas.', 'Con {gsd_m} m por píxel las construcciones se vuelven manchas: el mapa no distingue las viviendas nuevas.') },
      E7: { title: T('Yearly coverage', 'Cobertura anual', 'Cobertura anual') }
    }
  });
})(globalThis);
