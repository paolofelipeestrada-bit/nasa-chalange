/* =====================================================================
 * FLUXO DE FASES — ordem de navegação do jogo.
 *
 * Para acrescentar, remover ou reordenar fases: edite "phases".
 *   id       identificador guardado no state (state.phase)
 *   screen   qual tela desenha esta fase (Etapa B)
 *   title    nome exibido · subtitle: descrição curta
 *
 * As escolhas obrigatórias de cada fase NÃO ficam aqui: vêm do cenário
 * (campo "phase" de cada slot em scenarios.js). Só dá para avançar de
 * uma fase quando todas as escolhas dela e das anteriores estão feitas.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  MS.data = MS.data || {};

  MS.data.flow = {
    defaultScenario: 'eo_cubesat',
    retryPhase: 'design', // para onde "Ajustar e simular de novo" leva

    phases: [
      { id: 'need',         screen: 'need',         title: 'Need & Goals',   subtitle: 'Necessidade e objetivos da missão' },
      { id: 'concept',      screen: 'concept',      title: 'Concept',        subtitle: 'Órbita, lançador e estação em solo' },
      { id: 'requirements', screen: 'requirements', title: 'Requirements',   subtitle: 'O que o sistema deve cumprir' },
      { id: 'design',       screen: 'design',       title: 'Design',         subtitle: 'Componentes, MEL e recursos' },
      { id: 'build',        screen: 'build',        title: 'Build & Verify', subtitle: 'Integração e verificação' },
      { id: 'implement',    screen: 'implement',    title: 'Implement',      subtitle: 'Lançamento e operação' },
      { id: 'report',       screen: 'report',       title: 'Mission Report', subtitle: 'Resultado e lições' }
    ]
  };
})(globalThis);
