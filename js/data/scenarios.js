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
    card: { icon: '🌳', image: 'assets/img/client-eo_cubesat.jpg',
      pitch: T('Find new deforestation in the Amazon every month.', 'Achar desmatamento novo na Amazônia todo mês.', 'Encontrar deforestación nueva en la Amazonía cada mes.'),
      challenge: T('Hard: sharp images AND a full map every month.', 'Difícil: imagens nítidas E mapa completo todo mês.', 'Difícil: imágenes nítidas Y mapa completo cada mes.') },
    title: T('Deforestation watch', 'Vigilância do desmatamento', 'Vigilancia de la deforestación'),
    customer: T('Environmental agency', 'Agência ambiental', 'Agencia ambiental'),
    // Pessoa (fictícia) que representa o cliente e fala em cada fase (MS.advice.client).
    contact: { name: 'Ana Ribeiro', role: T('Forest analyst', 'Analista florestal', 'Analista forestal'),
      skin: '#c98e63', hair: '#3b2418', shirt: '#2e8b57', long: true },
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
    card: { icon: '🔥', image: 'assets/img/client-fire_watch.jpg',
      pitch: T('Map fire scars and plant health in the Cerrado every month.', 'Mapear queimadas e a saúde da vegetação do Cerrado todo mês.', 'Mapear quemas y la salud de la vegetación del Cerrado cada mes.'),
      challenge: T('Easier on detail, tight on money: several designs can win.', 'Menos exigente no detalhe, apertado no dinheiro: vários projetos vencem.', 'Menos exigente en detalle, ajustado en dinero: varios diseños pueden ganar.') },
    title: T('Fire scar watch', 'Vigilância de queimadas', 'Vigilancia de quemas'),
    customer: T('Climate and fire institute', 'Instituto de clima e queimadas', 'Instituto de clima e incendios'),
    contact: { name: 'Caio Mendes', role: T('Fire scientist', 'Cientista de queimadas', 'Científico de incendios'),
      skin: '#8d5a3b', hair: '#1d1410', shirt: '#d9622b', long: false },
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
    card: { icon: '🏙️', image: 'assets/img/client-city_map.jpg',
      pitch: T('A very detailed yearly map of a metropolitan region.', 'Um mapa anual muito detalhado de uma região metropolitana.', 'Un mapa anual muy detallado de una región metropolitana.'),
      challenge: T('Needs a big telescope: watch volume, money and schedule.', 'Exige um telescópio grande: cuidado com volume, dinheiro e prazo.', 'Exige un telescopio grande: cuidado con el volumen, el dinero y el plazo.') },
    title: T('Urban growth map', 'Mapa do crescimento urbano', 'Mapa del crecimiento urbano'),
    customer: T('Metropolitan planning office', 'Secretaria de planejamento metropolitano', 'Oficina de planificación metropolitana'),
    contact: { name: 'Lia Santos', role: T('Urban planner', 'Urbanista', 'Urbanista'),
      skin: '#e0b48f', hair: '#7a4a1f', shirt: '#3a6fd8', long: true },
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

  // ------------------------------------------------ Cenário 4: enchentes e clima no Sul
  // Imprevisto só desta missão: semanas de nuvens; passar quase todo dia acha as brechas.
  var CLOUDS = { id: 'RE8', fx: 'coverage', after: 'E7', chance: 0.5,
    mitigatedBy: [{ metric: 'revisit_days', op: '<=', value: 2 }], effect: { degrade: 0.6 },
    when: T('Rainy season', 'Época das chuvas', 'Época de lluvias'),
    title: T('Weeks of clouds', 'Semanas de nuvens', 'Semanas de nubes'),
    description: T('A long rainy spell keeps the region under thick clouds.', 'Uma temporada longa de chuva deixa a região coberta de nuvens grossas.', 'Una temporada larga de lluvias deja la región bajo nubes gruesas.'),
    text: T('Clouds hid the rivers for weeks and the satellite passed too rarely to catch a clear gap: flood maps came late.', 'As nuvens esconderam os rios por semanas e o satélite passava pouco para pegar uma brecha: os mapas de enchente atrasaram.', 'Las nubes ocultaron los ríos durante semanas y el satélite pasaba muy poco para encontrar un hueco: los mapas de inundación se retrasaron.'),
    mitigatedText: T('Clouds covered the region, but passing almost every day the satellite found clear gaps and kept the maps updated.', 'As nuvens cobriram a região, mas passando quase todo dia o satélite achou brechas e manteve os mapas em dia.', 'Las nubes cubrieron la región, pero pasando casi cada día el satélite encontró huecos y mantuvo los mapas al día.'),
    lesson: T('Weather changes by the hour: for floods, passing often matters more than seeing small details.', 'O tempo muda de hora em hora: para enchentes, passar sempre importa mais do que ver detalhes pequenos.', 'El tiempo cambia de hora en hora: para inundaciones, pasar seguido importa más que ver detalles pequeños.') };

  variant('flood_south', {
    card: { icon: '🌧️', image: 'assets/img/client-flood_south.jpg',
      pitch: T('Watch rain, clouds and floods in southern Brazil almost every day.', 'Acompanhar chuva, nuvens e enchentes no Sul do Brasil quase todo dia.', 'Seguir lluvia, nubes e inundaciones en el sur de Brasil casi cada día.'),
      challenge: T('A weather satellite: passing every day beats sharp detail.', 'Satélite meteorológico: passar todo dia vale mais que detalhe.', 'Satélite meteorológico: pasar cada día vale más que el detalle.') },
    title: T('Floods and weather in the South', 'Enchentes e clima no Sul', 'Inundaciones y clima en el Sur'),
    customer: T('State civil defense and weather service', 'Defesa Civil e serviço de meteorologia do estado', 'Defensa Civil y servicio meteorológico del estado'),
    contact: { name: 'Marina Kessler', role: T('Meteorologist', 'Meteorologista', 'Meteoróloga'),
      skin: '#f0c9a6', hair: '#c8a16a', shirt: '#2f7fb8', long: true },
    need: T('After the big floods in Rio Grande do Sul, the civil defense wants its own weather satellite: to follow rain clouds and see, almost every day, which rivers and towns are flooding, so it can warn people in time.',
      'Depois das grandes enchentes no Rio Grande do Sul, a Defesa Civil quer um satélite meteorológico próprio: acompanhar as nuvens de chuva e ver, quase todo dia, quais rios e cidades estão alagando, para avisar a população a tempo.',
      'Tras las grandes inundaciones en Rio Grande do Sul, la Defensa Civil quiere su propio satélite meteorológico: seguir las nubes de lluvia y ver, casi cada día, qué ríos y ciudades se inundan, para avisar a la población a tiempo.'),
    goals: [
      { id: 'G1', text: T('See flooded areas and big rivers (pixels of 500 m or smaller).', 'Enxergar áreas alagadas e rios grandes (pixels de 500 m ou menos).', 'Ver zonas inundadas y ríos grandes (píxeles de 500 m o menos).') },
      { id: 'G2', text: T('Pass over the whole state at least every 2 days.', 'Passar sobre o estado inteiro pelo menos a cada 2 dias.', 'Pasar sobre todo el estado al menos cada 2 días.') },
      { id: 'G3', text: T('Receive on the ground every image produced.', 'Receber em solo todas as imagens produzidas.', 'Recibir en tierra todas las imágenes producidas.') },
      { id: 'G4', text: T('Operate for at least 1 year (one full rainy season).', 'Operar por pelo menos 1 ano (uma estação de chuvas completa).', 'Operar al menos 1 año (una temporada de lluvias completa).') }
    ],
    constraints: [
      T('Total budget of 600 k$: satellite, launch and ground station.', 'Orçamento total de 600 k$: satélite, lançamento e estação em solo.', 'Presupuesto total de 600 k$: satélite, lanzamiento y estación terrena.'),
      T('Launch within 24 months from the start of the project ([[schedule|schedule]]).', 'Lançar em até 24 meses do início do projeto ([[schedule|prazo]]).', 'Lanzar en un máximo de 24 meses desde el inicio del proyecto ([[schedule|plazo]]).'),
      T('[[cubesat|CubeSat]] format (3U or 6U).', 'Formato [[cubesat|CubeSat]] (3U ou 6U).', 'Formato [[cubesat|CubeSat]] (3U o 6U).')
    ],
    aoi: { name: T('Rio Grande do Sul', 'Rio Grande do Sul', 'Rio Grande do Sul'), area_km2: 281700, latitude_deg: -30, longitude_deg: -53, radius_deg: 4 },
    budget_k: 600,
    params: { targetMapsPerYear: 180 },
    slots: SLOTS.map(function (s) { return s.id === 'payload' ? Object.assign({}, s, { options: ['cam_wx'].concat(s.options) }) : s; }),
    randomEvents: RANDOM_EVENTS.concat([CLOUDS]),
    requirements: {
      R1: { value: 500,
        text: T('Images must have a ground detail (GSD) of 500 m or better.', 'As imagens devem ter resolução no solo (GSD) de 500 m ou melhor.', 'Las imágenes deben tener un detalle en el suelo (GSD) de 500 m o mejor.'),
        rationale: T('Flooded plains and the big rivers (Guaíba, Taquari, Jacuí) are kilometres wide: 500 m pixels show them; streets do not matter here.', 'Várzeas alagadas e os rios grandes (Guaíba, Taquari, Jacuí) têm quilômetros de largura: pixels de 500 m mostram isso; ruas não importam aqui.', 'Las llanuras inundadas y los ríos grandes (Guaíba, Taquari, Jacuí) tienen kilómetros de ancho: píxeles de 500 m los muestran; las calles no importan aquí.') },
      R2: { value: 2,
        text: T('The satellite must cover the whole state in 2 days or less.', 'O satélite deve cobrir o estado inteiro em 2 dias ou menos.', 'El satélite debe cubrir todo el estado en 2 días o menos.'),
        rationale: T('A river can flood a town in a day or two: a map every month is useless for warnings.', 'Um rio pode alagar uma cidade em um ou dois dias: um mapa por mês não serve para alertas.', 'Un río puede inundar una ciudad en uno o dos días: un mapa al mes no sirve para alertas.'),
        hint: T('Only a very wide swath (hundreds of km) passes over the state almost every day: that is how weather satellites work.', 'Só uma faixa muito larga (centenas de km) passa sobre o estado quase todo dia: é assim que os satélites meteorológicos funcionam.', 'Solo una franja muy ancha (cientos de km) pasa sobre el estado casi cada día: así funcionan los satélites meteorológicos.') },
      R4: { rationale: T('The civil defense needs at least one full rainy season of data.', 'A Defesa Civil precisa de pelo menos uma estação de chuvas completa de dados.', 'La Defensa Civil necesita al menos una temporada de lluvias completa de datos.') }
    },
    events: {
      E6: { title: T('Spotting floods', 'Detecção de enchentes', 'Detección de inundaciones'),
        success: T('At {gsd_m} m per pixel the flooded plains and swollen rivers show up clearly.', 'Com {gsd_m} m por pixel as várzeas alagadas e os rios cheios aparecem com clareza.', 'Con {gsd_m} m por píxel las llanuras inundadas y los ríos crecidos se ven con claridad.'),
        failure: T('At {gsd_m} m per pixel only the biggest lakes show up: smaller flooded rivers are missed.', 'Com {gsd_m} m por pixel só as lagoas maiores aparecem: rios menores alagados passam despercebidos.', 'Con {gsd_m} m por píxel solo se ven las lagunas mayores: los ríos menores inundados pasan desapercibidos.') },
      E7: { title: T('Near-daily coverage', 'Cobertura quase diária', 'Cobertura casi diaria'),
        success: T('A fresh image of the whole state every {revisit_days} days: warnings go out in time.', 'Uma imagem nova do estado inteiro a cada {revisit_days} dias: os alertas saem a tempo.', 'Una imagen nueva de todo el estado cada {revisit_days} días: las alertas salen a tiempo.'),
        failure: T('The whole state is only seen every {revisit_days} days: floods are spotted after they happen.', 'O estado inteiro só é visto a cada {revisit_days} dias: as enchentes são vistas depois que acontecem.', 'Todo el estado solo se ve cada {revisit_days} días: las inundaciones se ven después de ocurrir.') }
    }
  });

  // ------------------------------------------------ Lua: peças comuns às missões 5 e 6
  function moonSlots(o) {
    return SLOTS.map(function (s) {
      var c = Object.assign({}, s);
      if (o[s.id]) Object.assign(c, o[s.id]);
      return c;
    }).concat([]).reduce(function (acc, s) {
      acc.push(s);
      if (s.id === 'power') acc.push(PROPULSION);
      return acc;
    }, []);
  }
  var PROPULSION = { id: 'propulsion', phase: 'design', segment: 'space', source: 'components', options: ['prop_cold', 'prop_green', 'prop_ion'],
    label: T('Propulsion', 'Propulsão', 'Propulsión'),
    help: T('The engine that changes speed in space. Rocket equation: more propellant or a higher Isp = more [[deltav|Δv]], but every kg on board makes it harder.',
      'O motor que muda a velocidade no espaço. Equação do foguete: mais combustível ou Isp maior = mais [[deltav|Δv]], mas cada kg a bordo dificulta.',
      'El motor que cambia la velocidad en el espacio. Ecuación del cohete: más combustible o Isp mayor = más [[deltav|Δv]], pero cada kg a bordo lo dificulta.') };
  var MOON_TEAM = JSON.parse(JSON.stringify(TEAM));
  MOON_TEAM.roles.forEach(function (r) { if (r.id === 'bus') r.slots = r.slots.concat(['propulsion']); });
  var MOON_RANDOM = RANDOM_EVENTS.filter(function (e) { return e.id !== 'RE5'; }).map(function (e) {
    if (e.id !== 'RE3') return e;
    return Object.assign({}, e, { mitigatedBy: [{ slot: 'comms', is: 'com_xlunar' }],
      mitigatedText: T('A bug froze the onboard computer; the fix went up quickly over the X-band transponder.', 'Um bug travou o computador de bordo; a correção subiu rápido pelo transponder banda X.', 'Un error congeló la computadora de a bordo; la corrección subió rápido por el transpondedor banda X.'),
      lesson: T('From the Moon every byte is precious: a fast radio also lets you fix the software.', 'Da Lua cada byte é precioso: um rádio rápido também serve para corrigir o software.', 'Desde la Luna cada byte es precioso: una radio rápida también sirve para corregir el software.') });
  });
  var DV_VERIF = { id: 'V9', requirements: ['R5'], checks: ['deltav'], method: T('Test', 'Teste', 'Prueba'),
    title: T('Engine firing test and Δv budget', 'Teste de queima do motor e orçamento de Δv', 'Prueba de encendido del motor y presupuesto de Δv'),
    description: T('The engine fires on a test stand; the rocket equation gives the Δv with the real mass.', 'O motor é ligado numa bancada de teste; a equação do foguete dá o Δv com a massa real.', 'El motor se enciende en un banco de pruebas; la ecuación del cohete da el Δv con la masa real.') };
  function ev(id, fx, when, title, cond, onFail, ok, bad) {
    var e = { id: id, fx: fx, when: when, title: title, conditions: cond, success: ok };
    if (onFail) e.onFail = onFail;
    if (bad) e.failure = bad;
    return e;
  }
  var E_BY_ID = {}; EVENTS.forEach(function (e) { E_BY_ID[e.id] = e; });

  // ------------------------------------------------ Cenário 5: mapear a Lua
  variant('moon_map', {
    body: 'moon',
    card: { icon: '🌕', image: 'assets/img/client-moon_map.jpg',
      pitch: T('Map the craters near the lunar south pole, where water ice may hide.', 'Mapear as crateras perto do polo sul da Lua, onde pode haver gelo de água.', 'Mapear los cráteres cerca del polo sur de la Luna, donde puede haber hielo de agua.'),
      challenge: T('Deep space: you need an engine, a big antenna and a careful data budget.', 'Espaço profundo: precisa de motor, antena grande e cuidado com os dados.', 'Espacio profundo: necesitas motor, antena grande y cuidado con los datos.') },
    title: T('Lunar south pole mapper', 'Mapeador do polo sul da Lua', 'Cartógrafo del polo sur lunar'),
    customer: T('Lunar science consortium (Artemis)', 'Consórcio de ciência lunar (Artemis)', 'Consorcio de ciencia lunar (Artemis)'),
    contact: { name: 'Dra. Helena Duarte', role: T('Planetary geologist', 'Geóloga planetária', 'Geóloga planetaria'),
      skin: '#d9a883', hair: '#2b2b2b', shirt: '#6b5bd6', long: true },
    need: T('Before astronauts land near the lunar south pole, scientists need a detailed map of its craters, some always in shadow and possibly holding water ice. A small satellite in lunar orbit can do it, if it gets there and can send the photos home.',
      'Antes de os astronautas pousarem perto do polo sul da Lua, os cientistas precisam de um mapa detalhado das crateras, algumas sempre na sombra e talvez com gelo de água. Um satélite pequeno em órbita lunar consegue, se chegar lá e conseguir mandar as fotos para casa.',
      'Antes de que los astronautas aterricen cerca del polo sur lunar, los científicos necesitan un mapa detallado de sus cráteres, algunos siempre en sombra y quizás con hielo de agua. Un satélite pequeño en órbita lunar puede hacerlo, si llega y puede enviar las fotos a casa.'),
    goals: [
      { id: 'G1', text: T('See craters from 60 m across (pixels of 20 m or smaller).', 'Enxergar crateras a partir de 60 m (pixels de 20 m ou menos).', 'Ver cráteres desde 60 m (píxeles de 20 m o menos).') },
      { id: 'G2', text: T('Map the whole polar region every lunar month (30 days).', 'Mapear toda a região polar a cada mês lunar (30 dias).', 'Mapear toda la región polar cada mes lunar (30 días).') },
      { id: 'G3', text: T('Get every photo back to Earth, 384,000 km away.', 'Trazer todas as fotos até a Terra, a 384 mil km.', 'Traer todas las fotos a la Tierra, a 384.000 km.') },
      { id: 'G4', text: T('Work in lunar orbit for at least 1 year.', 'Funcionar em órbita lunar por pelo menos 1 ano.', 'Funcionar en órbita lunar al menos 1 año.') },
      { id: 'G5', text: T('Brake into lunar orbit with its own engine.', 'Frear para entrar na órbita da Lua com o próprio motor.', 'Frenar para entrar en la órbita lunar con su propio motor.') }
    ],
    constraints: [
      T('Total budget of 1,600 k$: satellite, ride and antenna time.', 'Orçamento total de 1.600 k$: satélite, carona e tempo de antena.', 'Presupuesto total de 1.600 k$: satélite, viaje y tiempo de antena.'),
      T('Arrive within 36 months.', 'Chegar em até 36 meses.', 'Llegar en un máximo de 36 meses.'),
      T('[[cubesat|CubeSat]] format (3U or 6U).', 'Formato [[cubesat|CubeSat]] (3U ou 6U).', 'Formato [[cubesat|CubeSat]] (3U o 6U).')
    ],
    aoi: { name: T('Lunar south pole region', 'Região do polo sul da Lua', 'Región del polo sur lunar'), area_km2: 1000000, latitude_deg: -80, longitude_deg: 0, radius_deg: 10 },
    budget_k: 1600,
    params: { baseDev_months: 18, deadline_months: 36, deltaV_mps: 350,
      deltaVWhy: T('Artemis releases the CubeSat flying past the Moon; it must brake about 350 m/s to be captured into orbit.', 'A Artemis solta o CubeSat passando pela Lua; ele precisa frear cerca de 350 m/s para ser capturado em órbita.', 'Artemis suelta el CubeSat pasando por la Luna; debe frenar unos 350 m/s para quedar en órbita.'),
      margins: { mass: 0.10, volume: 0, power: 0.20, downlink: 0.10, storage: 0.10, cost: 0, time: 0.10, deltav: 0.10 } },
    slots: moonSlots({
      orbit: { options: ['moon_polar100', 'moon_polar50', 'moon_polar200'],
        help: T('Lower = sharper photos, but the Moon\'s lumpy gravity pulls you down sooner.', 'Mais baixa = fotos mais nítidas, mas a gravidade irregular da Lua derruba antes.', 'Más baja = fotos más nítidas, pero la gravedad irregular de la Luna te baja antes.') },
      launcher: { options: ['artemis_ride', 'lunar_rideshare'] },
      groundStation: { options: ['dsn_34m', 'gs_univ18'],
        help: T('Only deep-space antennas reach the Moon. More hours of view = more photos home.', 'Só antenas de espaço profundo alcançam a Lua. Mais horas de visada = mais fotos em casa.', 'Solo las antenas de espacio profundo alcanzan la Luna. Más horas de visibilidad = más fotos en casa.') },
      comms: { options: ['com_slunar', 'com_xlunar'],
        help: T('At 384,000 km the signal is very weak: data rates fall from Mbps to kbps.', 'A 384 mil km o sinal é muito fraco: a velocidade cai de Mbps para kbps.', 'A 384.000 km la señal es muy débil: la velocidad cae de Mbps a kbps.') }
    }),
    team: MOON_TEAM,
    randomEvents: MOON_RANDOM,
    verification: VERIFICATION.concat([DV_VERIF]),
    requirements: {
      R1: { value: 20,
        text: T('Images must have a ground detail (GSD) of 20 m or better.', 'As imagens devem ter resolução no solo (GSD) de 20 m ou melhor.', 'Las imágenes deben tener un detalle en el suelo (GSD) de 20 m o mejor.'),
        rationale: T('A 60 m crater must cover about 3 × 3 pixels: 60 m ÷ 3 = 20 m.', 'Uma cratera de 60 m precisa ocupar cerca de 3 × 3 pixels: 60 m ÷ 3 = 20 m.', 'Un cráter de 60 m debe ocupar unos 3 × 3 píxeles: 60 m ÷ 3 = 20 m.'),
        hint: T('Fly lower or use a longer focal length, but watch the data: more detail = more Gbit to send from the Moon.', 'Voe mais baixo ou use foco maior, mas cuidado com os dados: mais detalhe = mais Gbit para mandar da Lua.', 'Vuela más bajo o usa más foco, pero cuidado con los datos: más detalle = más Gbit que enviar desde la Luna.') },
      R2: { value: 30,
        text: T('The satellite must cover the whole polar region in 30 days or less.', 'O satélite deve cobrir toda a região polar em 30 dias ou menos.', 'El satélite debe cubrir toda la región polar en 30 días o menos.'),
        rationale: T('The Moon turns once every 27 days: in one lunar month a polar orbit passes over every longitude.', 'A Lua dá uma volta a cada 27 dias: em um mês lunar a órbita polar passa sobre todas as longitudes.', 'La Luna gira una vez cada 27 días: en un mes lunar la órbita polar pasa sobre todas las longitudes.'),
        hint: T('The swath must be wide enough that consecutive laps overlap.', 'A faixa precisa ser larga o bastante para as voltas seguidas se sobreporem.', 'La franja debe ser lo bastante ancha para que las vueltas seguidas se solapen.') },
      R3: { hint: T('From the Moon only the X-band transponder with the 34 m antennas sends a lot of data; or pick a camera that makes fewer Gbit.', 'Da Lua só o transponder banda X com as antenas de 34 m manda muitos dados; ou escolha uma câmera que gere menos Gbit.', 'Desde la Luna solo el transpondedor banda X con las antenas de 34 m envía muchos datos; o elige una cámara que genere menos Gbit.') },
      R4: { text: T('The satellite must stay in lunar orbit and working for at least 1 year.', 'O satélite deve ficar em órbita lunar, funcionando, por pelo menos 1 ano.', 'El satélite debe permanecer en órbita lunar y funcionando al menos 1 año.'),
        rationale: T('A full year shows how the shadows in the craters change with the seasons.', 'Um ano inteiro mostra como as sombras nas crateras mudam com as estações.', 'Un año completo muestra cómo cambian las sombras de los cráteres con las estaciones.'),
        hint: T('Very low lunar orbits are unstable (mascons): 100 km or higher lasts longer.', 'Órbitas lunares muito baixas são instáveis (mascons): 100 km ou mais dura mais.', 'Las órbitas lunares muy bajas son inestables (mascons): 100 km o más dura más.') }
    },
    events: {}
  });
  (function () {
    var sc = MS.data.scenarios.moon_map;
    sc.requirements.push({ id: 'R5', goal: 'G5', weight: 1, metric: 'deltaV_mps', op: '>=', ref: 'deltaVNeed_mps',
      title: T('Lunar orbit insertion', 'Inserção na órbita lunar', 'Inserción en órbita lunar'),
      text: T('The engine must give at least the Δv needed to brake into lunar orbit.', 'O motor deve dar pelo menos o Δv necessário para frear e entrar na órbita lunar.', 'El motor debe dar al menos el Δv necesario para frenar y entrar en órbita lunar.'),
      rationale: T('Without braking, the CubeSat flies past the Moon and is lost in orbit around the Sun.', 'Sem frear, o CubeSat passa direto pela Lua e se perde numa órbita em volta do Sol.', 'Sin frenar, el CubeSat pasa de largo la Luna y se pierde en órbita alrededor del Sol.'),
      hint: T('Rocket equation: more propellant or higher Isp; or lighter parts.', 'Equação do foguete: mais combustível ou Isp maior; ou peças mais leves.', 'Ecuación del cohete: más combustible o Isp mayor; o piezas más ligeras.') });
    sc.events = [
      ev('E1', 'launch', T('Day 0', 'Dia 0', 'Día 0'), T('Launch towards the Moon', 'Lançamento rumo à Lua', 'Lanzamiento hacia la Luna'), [{ check: 'launch' }, { check: 'mass' }, { check: 'volume' }], 'abort',
        T('The rocket sent the CubeSat on its way to the Moon.', 'O foguete mandou o CubeSat a caminho da Lua.', 'El cohete envió el CubeSat camino a la Luna.'), E_BY_ID.E1.failure),
      E_BY_ID.ET, E_BY_ID.E2,
      ev('EL', 'power', T('Day 5', 'Dia 5', 'Día 5'), T('Braking into lunar orbit', 'Freio para entrar na órbita lunar', 'Frenado para entrar en órbita lunar'), [{ check: 'deltav' }], 'abort',
        T('The engine fired and gave {deltaV_mps} m/s: the Moon captured the CubeSat into orbit.', 'O motor queimou e deu {deltaV_mps} m/s: a Lua capturou o CubeSat em órbita.', 'El motor encendió y dio {deltaV_mps} m/s: la Luna capturó el CubeSat en órbita.'),
        T('The engine only gave {deltaV_mps} m/s of the {deltaVNeed_mps} needed: the CubeSat flew past the Moon and was lost.', 'O motor só deu {deltaV_mps} m/s dos {deltaVNeed_mps} necessários: o CubeSat passou direto pela Lua e se perdeu.', 'El motor solo dio {deltaV_mps} m/s de los {deltaVNeed_mps} necesarios: el CubeSat pasó de largo la Luna y se perdió.')),
      E_BY_ID.E3,
      ev('E4', 'contact', T('Week 1', 'Semana 1', 'Semana 1'), T('First contact from the Moon', 'Primeiro contato da Lua', 'Primer contacto desde la Luna'), [{ check: 'contact' }, { check: 'band' }], 'abort',
        T('The deep-space antennas heard the CubeSat: {contactMinPerDay} min of contact per day.', 'As antenas de espaço profundo ouviram o CubeSat: {contactMinPerDay} min de contato por dia.', 'Las antenas de espacio profundo escucharon el CubeSat: {contactMinPerDay} min de contacto por día.'),
        T('No antenna on Earth could hear the CubeSat at 384,000 km: the mission is lost.', 'Nenhuma antena na Terra conseguiu ouvir o CubeSat a 384 mil km: a missão está perdida.', 'Ninguna antena en la Tierra pudo escuchar el CubeSat a 384.000 km: la misión está perdida.')),
      E_BY_ID.E5,
      ev('E6', 'image', T('Month 1', 'Mês 1', 'Mes 1'), T('Mapping the craters', 'Mapeamento das crateras', 'Mapeo de los cráteres'), [{ requirement: 'R1' }], { degrade: 0.5 },
        T('At {gsd_m} m per pixel, craters from 60 m up show in the map.', 'Com {gsd_m} m por pixel, crateras a partir de 60 m aparecem no mapa.', 'Con {gsd_m} m por píxel, los cráteres desde 60 m aparecen en el mapa.'),
        T('At {gsd_m} m per pixel the small craters blur: the map misses half of them.', 'Com {gsd_m} m por pixel as crateras pequenas borram: o mapa perde metade delas.', 'Con {gsd_m} m por píxel los cráteres pequeños se borran: el mapa pierde la mitad.')),
      ev('E7', 'coverage', T('Months 1–12', 'Meses 1–12', 'Meses 1–12'), T('Polar coverage', 'Cobertura do polo', 'Cobertura del polo'), [{ requirement: 'R2' }], 'none',
        T('A full map of the polar region every {revisit_days} days.', 'Um mapa completo da região polar a cada {revisit_days} dias.', 'Un mapa completo de la región polar cada {revisit_days} días.'),
        T('The polar region is only covered every {revisit_days} days.', 'A região polar só é coberta a cada {revisit_days} dias.', 'La región polar solo se cubre cada {revisit_days} días.')),
      ev('E8', 'contact', T('Months 1–12', 'Meses 1–12', 'Meses 1–12'), T('Photos back to Earth', 'Fotos de volta à Terra', 'Fotos de vuelta a la Tierra'), [{ requirement: 'R3' }], 'none',
        T('All {dataPerDay_Gbit} Gbit made each day reached the Earth.', 'Os {dataPerDay_Gbit} Gbit gerados por dia chegaram todos à Terra.', 'Los {dataPerDay_Gbit} Gbit generados por día llegaron todos a la Tierra.'),
        T('The CubeSat makes {dataPerDay_Gbit} Gbit per day but only {downlink_Gbit_day} fit through the link from the Moon: the rest is lost.', 'O CubeSat gera {dataPerDay_Gbit} Gbit por dia, mas só {downlink_Gbit_day} passam pelo enlace da Lua: o resto se perde.', 'El CubeSat genera {dataPerDay_Gbit} Gbit por día, pero solo {downlink_Gbit_day} pasan por el enlace desde la Luna: el resto se pierde.')),
      ev('E9', 'end', T('Year 1', 'Ano 1', 'Año 1'), T('End of mission', 'Fim da missão', 'Fin de la misión'), [{ requirement: 'R4' }], 'none',
        T('The mission completed its year; the orbit still lasts about {lifetime_years} years.', 'A missão completou o ano; a órbita ainda dura cerca de {lifetime_years} anos.', 'La misión completó su año; la órbita aún dura unos {lifetime_years} años.'),
        T('The Moon\'s uneven gravity brought the CubeSat down after {lifetime_years} years, before the end.', 'A gravidade irregular da Lua derrubou o CubeSat após {lifetime_years} ano, antes do fim.', 'La gravedad irregular de la Luna bajó el CubeSat tras {lifetime_years} años, antes del final.'))
    ];
  })();

  // ------------------------------------------------ Cenário 6: pousar na Lua
  variant('moon_land', {
    body: 'moon',
    card: { icon: '🚀', image: 'assets/img/client-moon_land.jpg',
      pitch: T('Land a small robot on the Moon and send panoramic photos for a month.', 'Pousar um pequeno robô na Lua e mandar fotos panorâmicas por um mês.', 'Aterrizar un pequeño robot en la Luna y enviar fotos panorámicas durante un mes.'),
      challenge: T('Hardest: every kg costs Δv, and the lunar night freezes everything.', 'A mais difícil: cada kg custa Δv, e a noite lunar congela tudo.', 'La más difícil: cada kg cuesta Δv, y la noche lunar congela todo.') },
    title: T('Small lunar lander', 'Pequeno módulo de pouso lunar', 'Pequeño módulo de aterrizaje lunar'),
    customer: T('Lunar exploration program', 'Programa de exploração lunar', 'Programa de exploración lunar'),
    contact: { name: 'Rafael Okoye', role: T('Landing engineer', 'Engenheiro de pouso', 'Ingeniero de aterrizaje'),
      skin: '#6b4430', hair: '#141010', shirt: '#e07b39', long: false },
    need: T('The program wants to test a cheap way to reach the lunar surface: a 6U box with a descent stage that brakes from lunar orbit to a soft landing, then sends panoramic photos for about a month.',
      'O programa quer testar um jeito barato de chegar à superfície da Lua: uma caixa 6U com um estágio de descida que freia da órbita lunar até um pouso suave, e depois manda fotos panorâmicas por cerca de um mês.',
      'El programa quiere probar una forma barata de llegar a la superficie lunar: una caja 6U con una etapa de descenso que frena desde la órbita lunar hasta un aterrizaje suave y luego envía fotos panorámicas durante cerca de un mes.'),
    goals: [
      { id: 'G1', text: T('Land softly: the engine must kill about 2 km/s of speed.', 'Pousar suave: o motor precisa tirar cerca de 2 km/s de velocidade.', 'Aterrizar suave: el motor debe quitar unos 2 km/s de velocidad.') },
      { id: 'G2', text: T('Send every panoramic photo back to Earth.', 'Mandar todas as fotos panorâmicas para a Terra.', 'Enviar todas las fotos panorámicas a la Tierra.') },
      { id: 'G3', text: T('Work on the surface for at least 30 days.', 'Funcionar na superfície por pelo menos 30 dias.', 'Funcionar en la superficie al menos 30 días.') }
    ],
    constraints: [
      T('Total budget of 2,600 k$: lander, ride and antenna time.', 'Orçamento total de 2.600 k$: módulo, carona e tempo de antena.', 'Presupuesto total de 2.600 k$: módulo, viaje y tiempo de antena.'),
      T('Land within 36 months.', 'Pousar em até 36 meses.', 'Aterrizar en un máximo de 36 meses.'),
      T('A 6U box on top of a descent stage, up to 40 kg in total.', 'Uma caixa 6U em cima de um estágio de descida, até 40 kg no total.', 'Una caja 6U sobre una etapa de descenso, hasta 40 kg en total.')
    ],
    aoi: { name: T('Landing site', 'Local de pouso', 'Sitio de aterrizaje'), area_km2: 1, latitude_deg: 0, longitude_deg: 23, radius_deg: 1 },
    budget_k: 2600,
    params: { baseDev_months: 18, deadline_months: 36, deltaV_mps: 1900, plannedDuration_years: 0.082, imagesPerDay: 20, targetMapsPerYear: 365,
      deltaVWhy: T('From low lunar orbit the lander must brake about 1.7 km/s plus margin to hover and touch down.', 'Da órbita lunar baixa o módulo precisa frear cerca de 1,7 km/s mais folga para pairar e tocar o chão.', 'Desde la órbita lunar baja el módulo debe frenar unos 1,7 km/s más margen para flotar y tocar el suelo.'),
      margins: { mass: 0.10, volume: 0, power: 0.20, downlink: 0.10, storage: 0.10, cost: 0, time: 0.10, deltav: 0.05 } },
    slots: moonSlots({
      orbit: { options: ['site_equator', 'site_pole'], label: T('Landing site', 'Local de pouso', 'Sitio de aterrizaje'),
        help: T('Where to land. The equator is easy but freezes after 14 days; the polar ridge gets sun for months but is harder to reach and to talk to.', 'Onde pousar. O equador é fácil, mas congela após 14 dias; a crista polar tem sol por meses, mas é mais difícil de alcançar e de falar.', 'Dónde aterrizar. El ecuador es fácil pero se congela tras 14 días; la cresta polar tiene sol por meses pero es más difícil de alcanzar y de comunicar.') },
      launcher: { options: ['clps_ride'] },
      groundStation: { options: ['dsn_34m', 'gs_univ18'],
        help: T('Only deep-space antennas reach the Moon.', 'Só antenas de espaço profundo alcançam a Lua.', 'Solo las antenas de espacio profundo alcanzan la Luna.') },
      payload: { options: ['cam_wide', 'cam_mid'], label: T('Panoramic camera', 'Câmera panorâmica', 'Cámara panorámica') },
      structure: { options: ['struct_6u'] },
      comms: { options: ['com_slunar', 'com_xlunar'] }
    }),
    team: MOON_TEAM,
    randomEvents: MOON_RANDOM.filter(function (e) { return e.id !== 'RE4'; }).map(function (e) { return e.after === 'E6' ? Object.assign({}, e, { after: 'E5' }) : e; }),
    verification: [Object.assign({}, VERIFICATION[2], { requirements: ['R2'] }), VERIFICATION[4], VERIFICATION[5], VERIFICATION[7],
      Object.assign({}, DV_VERIF, { requirements: ['R1'] }),
      { id: 'V10', requirements: ['R3'], method: T('Analysis', 'Análise', 'Análisis'),
        title: T('Sunlight and lunar night analysis', 'Análise de sol e noite lunar', 'Análisis de sol y noche lunar'),
        description: T('How many days of sunlight the site gets before the −170 °C night.', 'Quantos dias de sol o local tem antes da noite a −170 °C.', 'Cuántos días de sol tiene el sitio antes de la noche a −170 °C.') }],
    requirements: {},
    events: {}
  });
  (function () {
    var sc = MS.data.scenarios.moon_land;
    sc.slots = sc.slots.map(function (s) { return s.id === 'propulsion' ? Object.assign({}, s, { options: ['prop_green', 'prop_lander'] }) : s; });
    sc.requirements = [
      { id: 'R1', goal: 'G1', weight: 1, metric: 'deltaV_mps', op: '>=', ref: 'deltaVNeed_mps',
        title: T('Soft landing', 'Pouso suave', 'Aterrizaje suave'),
        text: T('The descent engine must give at least the Δv the landing site needs.', 'O motor de descida deve dar pelo menos o Δv que o local de pouso pede.', 'El motor de descenso debe dar al menos el Δv que pide el sitio de aterrizaje.'),
        rationale: T('In low lunar orbit you fly at about 1.6 km/s: all of it must be braked before touching the ground.', 'Na órbita lunar baixa você voa a cerca de 1,6 km/s: tudo isso precisa ser freado antes de tocar o chão.', 'En la órbita lunar baja vuelas a unos 1,6 km/s: todo eso debe frenarse antes de tocar el suelo.'),
        hint: T('Use the descent stage, take lighter parts (every kg on top costs Δv) or choose the easier site.', 'Use o estágio de descida, leve peças mais leves (cada kg em cima custa Δv) ou escolha o local mais fácil.', 'Usa la etapa de descenso, lleva piezas más ligeras (cada kg encima cuesta Δv) o elige el sitio más fácil.') },
      { id: 'R2', goal: 'G2', weight: 1, metric: 'downlink_Gbit_day', op: '>=', ref: 'dataPerDay_Gbit',
        title: T('Photos back to Earth', 'Fotos de volta à Terra', 'Fotos de vuelta a la Tierra'),
        text: T('The daily link to Earth must carry all the photos made per day.', 'O enlace diário com a Terra deve levar todas as fotos feitas por dia.', 'El enlace diario con la Tierra debe llevar todas las fotos hechas por día.'),
        rationale: T('Photos that never reach Earth are worth nothing to the scientists.', 'Fotos que nunca chegam à Terra não valem nada para os cientistas.', 'Las fotos que nunca llegan a la Tierra no valen nada para los científicos.'),
        hint: T('The polar site sees Earth low on the horizon: half the contact time. X band and the 34 m antennas help.', 'O local polar vê a Terra baixa no horizonte: metade do tempo de contato. Banda X e as antenas de 34 m ajudam.', 'El sitio polar ve la Tierra baja en el horizonte: la mitad del tiempo de contacto. Banda X y las antenas de 34 m ayudan.') },
      { id: 'R3', goal: 'G3', weight: 1, metric: 'lifetime_years', op: '>=', value: 0.082,
        title: T('30 days on the surface', '30 dias na superfície', '30 días en la superficie'),
        text: T('The lander must work on the surface for at least 30 days (0.082 year).', 'O módulo deve funcionar na superfície por pelo menos 30 dias (0,082 ano).', 'El módulo debe funcionar en la superficie al menos 30 días (0,082 año).'),
        rationale: T('A lunar day lasts 14 Earth days; then comes a night of 14 days at −170 °C that a small lander cannot survive.', 'Um dia lunar dura 14 dias terrestres; depois vem uma noite de 14 dias a −170 °C que um módulo pequeno não aguenta.', 'Un día lunar dura 14 días terrestres; luego viene una noche de 14 días a −170 °C que un módulo pequeño no aguanta.'),
        hint: T('Only a place with almost constant sunlight (the polar ridge) gives more than 14 days.', 'Só um lugar com sol quase constante (a crista polar) dá mais de 14 dias.', 'Solo un lugar con sol casi constante (la cresta polar) da más de 14 días.') }
    ];
    sc.events = [
      ev('E1', 'launch', T('Day 0', 'Dia 0', 'Día 0'), T('Launch towards the Moon', 'Lançamento rumo à Lua', 'Lanzamiento hacia la Luna'), [{ check: 'launch' }, { check: 'mass' }, { check: 'volume' }], 'abort',
        T('The ride carried the lander to low lunar orbit.', 'A carona levou o módulo até a órbita lunar baixa.', 'El viaje llevó el módulo a la órbita lunar baja.'), E_BY_ID.E1.failure),
      E_BY_ID.ET,
      ev('E2', 'separation', T('Day 5', 'Dia 5', 'Día 5'), T('Release in lunar orbit', 'Liberação na órbita lunar', 'Liberación en órbita lunar'), [],
        null, T('The lander separated and pointed its engine forward.', 'O módulo se separou e apontou o motor para a frente.', 'El módulo se separó y apuntó el motor hacia adelante.')),
      ev('EL', 'power', T('Day 6', 'Dia 6', 'Día 6'), T('Descent and landing', 'Descida e pouso', 'Descenso y aterrizaje'), [{ check: 'deltav' }], 'abort',
        T('The engine fired for 11 minutes, gave {deltaV_mps} m/s and the lander touched down softly!', 'O motor queimou por 11 minutos, deu {deltaV_mps} m/s e o módulo tocou o chão suavemente!', '¡El motor encendió 11 minutos, dio {deltaV_mps} m/s y el módulo tocó el suelo suavemente!'),
        T('The propellant ran out with only {deltaV_mps} of the {deltaVNeed_mps} m/s braked: the lander hit the ground too fast.', 'O combustível acabou com só {deltaV_mps} dos {deltaVNeed_mps} m/s freados: o módulo bateu no chão rápido demais.', 'El combustible se acabó con solo {deltaV_mps} de los {deltaVNeed_mps} m/s frenados: el módulo chocó contra el suelo demasiado rápido.')),
      ev('E3', 'power', T('Day 6', 'Dia 6', 'Día 6'), T('Power on the surface', 'Energia na superfície', 'Energía en la superficie'), [{ check: 'power' }], { degrade: 0.3 },
        T('In sunlight the panels make {powerGen_W} W for {powerUse_W} W used.', 'No sol os painéis geram {powerGen_W} W para {powerUse_W} W de consumo.', 'Con sol los paneles generan {powerGen_W} W para {powerUse_W} W de consumo.'),
        E_BY_ID.E3.failure),
      ev('E4', 'contact', T('Day 6', 'Dia 6', 'Día 6'), T('Hello from the Moon', 'Alô da Lua', 'Hola desde la Luna'), [{ check: 'contact' }, { check: 'band' }], 'abort',
        T('The antennas heard the lander: {contactMinPerDay} min of contact per day.', 'As antenas ouviram o módulo: {contactMinPerDay} min de contato por dia.', 'Las antenas escucharon el módulo: {contactMinPerDay} min de contacto por día.'),
        T('No antenna on Earth could hear the lander: it works alone and silent.', 'Nenhuma antena na Terra conseguiu ouvir o módulo: ele funciona sozinho e em silêncio.', 'Ninguna antena en la Tierra pudo escuchar el módulo: funciona solo y en silencio.')),
      ev('E5', 'image', T('Day 7', 'Dia 7', 'Día 7'), T('First panorama', 'Primeira panorâmica', 'Primera panorámica'), [], null,
        T('The first 360° panorama of the landing site arrived on Earth.', 'A primeira panorâmica 360° do local de pouso chegou à Terra.', 'La primera panorámica 360° del sitio de aterrizaje llegó a la Tierra.')),
      ev('E8', 'contact', T('Days 7–30', 'Dias 7–30', 'Días 7–30'), T('Photos back to Earth', 'Fotos de volta à Terra', 'Fotos de vuelta a la Tierra'), [{ requirement: 'R2' }], 'none',
        T('All {dataPerDay_Gbit} Gbit of photos per day reached Earth.', 'Os {dataPerDay_Gbit} Gbit de fotos por dia chegaram todos à Terra.', 'Los {dataPerDay_Gbit} Gbit de fotos por día llegaron todos a la Tierra.'),
        T('The lander makes {dataPerDay_Gbit} Gbit per day but only {downlink_Gbit_day} reach Earth.', 'O módulo gera {dataPerDay_Gbit} Gbit por dia, mas só {downlink_Gbit_day} chegam à Terra.', 'El módulo genera {dataPerDay_Gbit} Gbit por día, pero solo {downlink_Gbit_day} llegan a la Tierra.')),
      ev('E9', 'end', T('Day 30', 'Dia 30', 'Día 30'), T('A month on the Moon?', 'Um mês na Lua?', '¿Un mes en la Luna?'), [{ requirement: 'R3' }], 'none',
        T('The lander kept working for the whole month in the sunlight of the polar ridge.', 'O módulo funcionou o mês inteiro com o sol da crista polar.', 'El módulo funcionó todo el mes con el sol de la cresta polar.'),
        T('The lunar night arrived before the month was over and the lander froze.', 'A noite lunar chegou antes do fim do mês e o módulo congelou.', 'La noche lunar llegó antes del fin del mes y el módulo se congeló.'))
    ];
  })();
})(globalThis);
