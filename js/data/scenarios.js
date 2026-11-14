/* =====================================================================
 * CENÁRIOS — cada cenário é uma missão completa.
 *
 * Cenário novo: copie o bloco "eo_cubesat", troque a chave e o campo id,
 * e edite textos, opções e requisitos. Nada no motor muda.
 *
 *   need, goals, constraints  textos da fase Need & Goals
 *   aoi                       área de interesse (área e latitude)
 *   budget_k                  orçamento total (k$)
 *   params                    parâmetros do modelo e margens recomendadas
 *   slots                     escolhas do jogador: fase em que aparecem,
 *                             seção do catálogo (source) e opções (ids)
 *   requirements              métrica do motor + operador + valor
 *                             (ou ref: comparar com outra métrica)
 *   verification              plano de verificação (Build & Verify)
 *   events                    linha do tempo da missão (Implement)
 *   scoring, grades           pesos da pontuação e faixas do relatório
 *
 * Métricas e verificações disponíveis: MS.sim.metricDefs e
 * MS.sim.checkIds (js/sim.js). Nos textos dos eventos, {métrica} é
 * trocado pelo valor calculado, ex.: {gsd_m}.
 *
 * Condições (em eventos):  { check: 'power' }  { requirement: 'R1' }
 *                          { metric: 'mass_kg', op: '<=', value: 3 }
 * onFail (em eventos):     'abort' (missão termina) · 'none' (só relata)
 *                          { degrade: 0.3 } (multiplica o resultado)
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  MS.data = MS.data || {};
  MS.data.scenarios = MS.data.scenarios || {};

  MS.data.scenarios.eo_cubesat = {
    id: 'eo_cubesat',
    title: 'CubeSat de observação da Terra',
    customer: 'Agência ambiental',
    need: 'A agência precisa saber, todo mês, onde surgiram novas áreas desmatadas na Amazônia. Hoje ela compra imagens caras de terceiros e quer um satélite próprio, pequeno e barato.',
    goals: [
      { id: 'G1', text: 'Enxergar clareiras a partir de 1 hectare (100 m × 100 m).' },
      { id: 'G2', text: 'Ter um mapa novo de toda a área a cada mês.' },
      { id: 'G3', text: 'Receber em solo todas as imagens produzidas.' },
      { id: 'G4', text: 'Operar por pelo menos 1 ano.' }
    ],
    constraints: [
      'Orçamento total de 750 k$: satélite, lançamento e estação em solo.',
      'Formato CubeSat (3U ou 6U).'
    ],
    aoi: { name: 'Amazônia Legal', area_km2: 5000000, latitude_deg: -5 },
    budget_k: 750,

    params: {
      contactEfficiency: 0.8,      // fração útil de cada passagem (aquisição, protocolo)
      powerStorageEfficiency: 0.85, // perdas de bateria e conversão
      storageDays: 2,              // dias de dados que o computador deve guardar
      plannedDuration_years: 1,
      targetMapsPerYear: 12,
      // Folga mínima recomendada de cada recurso (0,10 = 10%)
      margins: { mass: 0.10, volume: 0, power: 0.20, downlink: 0.10, storage: 0.10, cost: 0 }
    },

    // Ordem aqui = ordem na tela. "phase" diz em que fase a escolha é feita.
    slots: [
      { id: 'orbit',         phase: 'concept', source: 'orbits',         label: 'Órbita',              options: ['sso500', 'iss400'] },
      { id: 'launcher',      phase: 'concept', source: 'launchers',      label: 'Lançador',            options: ['rideshare_sso', 'iss_cargo'] },
      { id: 'groundStation', phase: 'concept', source: 'groundStations', label: 'Estação em solo',     options: ['gs_polar', 'gs_national'] },
      { id: 'payload',       phase: 'design',  source: 'components',     label: 'Instrumento',         options: ['cam_wide', 'cam_mid', 'cam_hr'] },
      { id: 'structure',     phase: 'design',  source: 'components',     label: 'Estrutura',           options: ['struct_3u', 'struct_6u'] },
      { id: 'power',         phase: 'design',  source: 'components',     label: 'Energia',             options: ['eps_body', 'eps_deploy'] },
      { id: 'adcs',          phase: 'design',  source: 'components',     label: 'Controle de atitude', options: ['adcs_mag', 'adcs_wheels'] },
      { id: 'comms',         phase: 'design',  source: 'components',     label: 'Comunicação',         options: ['com_uhf', 'com_sband'] },
      { id: 'obc',           phase: 'design',  source: 'components',     label: 'Computador de bordo', options: ['obc_basic', 'obc_adv'] }
    ],

    requirements: [
      {
        id: 'R1', goal: 'G1', title: 'Resolução', weight: 1,
        text: 'As imagens devem ter resolução no solo (GSD) de 30 m ou melhor.',
        metric: 'gsd_m', op: '<=', value: 30,
        rationale: 'Uma clareira de 1 ha (100 m × 100 m) precisa ocupar pelo menos ~3 × 3 pixels para ser detectada: 100 m ÷ 3 ≈ 30 m.',
        hint: 'GSD = altitude × pixel ÷ focal: use um instrumento de distância focal maior ou uma órbita mais baixa.'
      },
      {
        id: 'R2', goal: 'G2', title: 'Revisita', weight: 1,
        text: 'O satélite deve cobrir toda a área de interesse em 30 dias ou menos.',
        metric: 'revisit_days', op: '<=', value: 30,
        rationale: 'Para entregar um mapa novo por mês, cada ponto da área precisa ser fotografado pelo menos uma vez a cada 30 dias.',
        hint: 'Faixa imageada mais larga e órbita heliossíncrona (boa iluminação em todas as passagens) diminuem a revisita.'
      },
      {
        id: 'R3', goal: 'G3', title: 'Entrega de dados', weight: 1,
        text: 'A capacidade diária de envio de dados ao solo deve ser maior ou igual aos dados gerados por dia.',
        metric: 'downlink_Gbit_day', op: '>=', ref: 'dataPerDay_Gbit',
        rationale: 'Se o satélite gera mais dados do que consegue enviar, as imagens se acumulam na memória e acabam descartadas.',
        hint: 'Use um rádio mais rápido, uma estação que veja mais passagens ou mais compressão a bordo.'
      },
      {
        id: 'R4', goal: 'G4', title: 'Vida útil', weight: 1,
        text: 'O satélite deve permanecer em órbita, operando, por pelo menos 1 ano.',
        metric: 'lifetime_years', op: '>=', value: 1,
        rationale: 'A agência precisa de pelo menos 12 mapas mensais para justificar o investimento.',
        hint: 'Órbitas mais baixas caem mais rápido por causa do arrasto atmosférico: escolha uma órbita mais alta.'
      }
    ],

    // Build & Verify: cada linha cobre requisitos e/ou verificações do motor.
    verification: [
      { id: 'V1', title: 'Análise de desempenho óptico',  method: 'Análise',  requirements: ['R1'], description: 'Cálculo do GSD a partir da óptica do instrumento e da altitude.' },
      { id: 'V2', title: 'Simulação de cobertura',        method: 'Análise',  requirements: ['R2'], description: 'Simulação das faixas fotografadas sobre a área de interesse.' },
      { id: 'V3', title: 'Teste de comunicação ponta a ponta', method: 'Teste', requirements: ['R3'], checks: ['band', 'contact', 'downlink', 'storage'], description: 'Satélite e estação trocam dados em bancada; orçamento de enlace e de dados.' },
      { id: 'V4', title: 'Análise de vida orbital',       method: 'Análise',  requirements: ['R4'], description: 'Previsão do decaimento da órbita pelo arrasto atmosférico.' },
      { id: 'V5', title: 'Inspeção de encaixe e massa',   method: 'Inspeção', checks: ['volume', 'mass', 'launch'], description: 'O satélite é pesado, medido e encaixado no dispensador do lançador.' },
      { id: 'V6', title: 'Teste de balanço de energia',   method: 'Teste',    checks: ['power'], description: 'O satélite opera em ciclos de sol e sombra simulados.' },
      { id: 'V7', title: 'Teste de apontamento',          method: 'Teste',    checks: ['pointing'], description: 'Mesa de rolamento mede a precisão do controle de atitude.' },
      { id: 'V8', title: 'Revisão de custos',             method: 'Revisão',  checks: ['cost'], description: 'Soma de equipamentos, lançamento e estação contra o orçamento.' }
    ],

    // Implement: avaliados em ordem. Um 'abort' encerra a missão.
    events: [
      {
        id: 'E1', when: 'Dia 0', title: 'Lançamento',
        conditions: [{ check: 'launch' }, { check: 'mass' }, { check: 'volume' }], onFail: 'abort',
        success: 'O foguete levou o CubeSat até a órbita de {altitude_km} km.',
        failure: 'O satélite não pôde ser lançado.'
      },
      {
        id: 'E2', when: 'Dia 1', title: 'Separação e estabilização',
        conditions: [],
        success: 'O satélite foi ejetado, parou de girar e abriu as antenas.'
      },
      {
        id: 'E3', when: 'Semana 1', title: 'Energia em órbita',
        conditions: [{ check: 'power' }], onFail: { degrade: 0.3 },
        success: 'Os painéis geram {powerGen_W} W e o satélite consome {powerUse_W} W: a bateria se mantém carregada.',
        failure: 'A bateria se esgota: o satélite entra em modo de segurança e só opera cerca de 30% do tempo.'
      },
      {
        id: 'E4', when: 'Semana 1', title: 'Primeiro contato',
        conditions: [{ check: 'contact' }, { check: 'band' }], onFail: 'abort',
        success: 'A estação recebeu a telemetria: {passesPerDay} passagens e {contactMinPerDay} min de contato por dia.',
        failure: 'A estação nunca conseguiu falar com o satélite. Sem contato, a missão está perdida.'
      },
      {
        id: 'E5', when: 'Semana 3', title: 'Primeira imagem',
        conditions: [{ check: 'pointing' }], onFail: { degrade: 0 },
        success: 'Primeira imagem nítida da área, com {gsd_m} m por pixel.',
        failure: 'As imagens saem borradas e fora do alvo: o controle de atitude não aponta com a precisão que o instrumento exige.'
      },
      {
        id: 'E6', when: 'Mês 1', title: 'Detecção de clareiras',
        conditions: [{ requirement: 'R1' }], onFail: { degrade: 0.5 },
        success: 'Com {gsd_m} m por pixel, clareiras de 1 hectare aparecem nas imagens.',
        failure: 'Com {gsd_m} m por pixel as clareiras pequenas não aparecem: só cerca de metade do desmatamento é detectada.'
      },
      {
        id: 'E7', when: 'Meses 1–12', title: 'Cobertura mensal',
        conditions: [{ requirement: 'R2' }], onFail: 'none',
        success: 'Um mapa completo da área a cada {revisit_days} dias.',
        failure: 'A área completa só é coberta a cada {revisit_days} dias: os mapas atrasam.'
      },
      {
        id: 'E8', when: 'Meses 1–12', title: 'Entrega de dados',
        conditions: [{ requirement: 'R3' }], onFail: 'none',
        success: 'Os {dataPerDay_Gbit} Gbit gerados por dia chegam todos ao solo.',
        failure: 'O satélite gera {dataPerDay_Gbit} Gbit por dia, mas só consegue enviar {downlink_Gbit_day}: o resto é descartado.'
      },
      {
        id: 'E9', when: 'Ano 1', title: 'Fim da missão',
        conditions: [{ requirement: 'R4' }], onFail: 'none',
        success: 'A missão completou o ano previsto; a órbita ainda dura cerca de {lifetime_years} anos.',
        failure: 'O arrasto atmosférico derrubou o satélite após {lifetime_years} ano, antes do previsto.'
      }
    ],

    // Pontuação (0–100): requisitos + resultado da missão + orçamento + margens.
    scoring: { requirements: 40, mission: 40, budget: 10, margins: 10 },
    grades: [
      { min: 90, label: 'Missão exemplar' },
      { min: 70, label: 'Missão bem-sucedida' },
      { min: 40, label: 'Sucesso parcial' },
      { min: 0,  label: 'Missão fracassada' }
    ]
  };
})(globalThis);
