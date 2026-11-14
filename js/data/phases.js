/* =====================================================================
 * FLUXO DE FASES — ordem de navegação do jogo.
 *
 * Para acrescentar, remover ou reordenar fases: edite "phases".
 *   id       identificador guardado no state (state.phase)
 *   screen   qual tela desenha esta fase (js/ui/screen*.js)
 *   title    nome exibido · subtitle: descrição curta
 *   guide    caixa "O que fazer aqui" no topo da fase
 *   tips     dicas curtas da caixa (opcional)
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
      { id: 'need', screen: 'need', title: 'Need & Goals', short: 'Necessidade', subtitle: 'Necessidade e objetivos da missão',
        guide: 'Tudo começa com um problema real de um cliente. Leia o que ele precisa: isso vira os objetivos da missão e, depois, os requisitos que o seu satélite terá de cumprir.',
        tips: ['Não há nada para escolher aqui.', 'Quando estiver pronto, clique em "Começar o conceito" lá embaixo.'] },
      { id: 'concept', screen: 'concept', title: 'Concept', short: 'Conceito', subtitle: 'Órbita, lançador e estação em solo',
        guide: 'Decida onde o satélite vai ficar (órbita), como ele chega lá (lançador) e de onde a equipe fala com ele (estação em solo).',
        tips: ['Clique num cartão para escolher. Leia "Vantagem" e "Cuidado".', 'O painel ao lado calcula na hora o que cada escolha muda.', 'Se algo aparecer em vermelho em "Compatibilidade", as escolhas não combinam.'] },
      { id: 'requirements', screen: 'requirements', title: 'Requirements', short: 'Requisitos', subtitle: 'O que o sistema deve cumprir',
        guide: 'Os objetivos do cliente viraram requisitos: números que dá para medir. No fim, o projeto é aprovado ou reprovado por eles.',
        tips: ['Leia o "Por que este valor" de cada um.', 'No Design, o painel mostra ao vivo se cada requisito está sendo cumprido.'] },
      { id: 'design', screen: 'design', title: 'Design', short: 'Projeto', subtitle: 'Componentes, MEL e recursos',
        guide: 'Monte o satélite escolhendo uma opção para cada subsistema. Tudo tem custo: mais desempenho quase sempre pesa mais, consome mais energia ou custa mais.',
        tips: ['Barras verdes: sobra. Amarelas: no limite. Vermelhas: não cabe.', 'Tente cumprir os 4 requisitos dentro do orçamento.', 'Passe o mouse nos termos sublinhados para ver o que significam.'] },
      { id: 'build', screen: 'build', title: 'Build & Verify', short: 'Verificação', subtitle: 'Integração e verificação',
        guide: 'Antes do lançamento, a equipe testa o satélite. Cada verificação confere um requisito ou um limite do projeto. Também aparecem os riscos: o que pode dar errado em órbita.',
        tips: ['Vermelho: vai dar problema. Volte ao Design para corrigir.', 'Você também pode lançar assim mesmo e ver o que acontece.'] },
      { id: 'implement', screen: 'implement', title: 'Implement', short: 'Missão', subtitle: 'Lançamento e operação',
        guide: 'Assista à missão: o lançamento, a órbita e cada acontecimento do ano de operação, inclusive os imprevistos sorteados.',
        tips: ['Arraste o 3D para girar e use a rodinha para dar zoom.', 'A linha do tempo embaixo explica cada evento.'] },
      { id: 'report', screen: 'report', title: 'Mission Report', short: 'Relatório', subtitle: 'Resultado e lições',
        guide: 'Veja a nota da missão, o que deu certo e o que falhou. As lições dizem o que mudar na próxima tentativa.',
        tips: ['"Ajustar e simular de novo" volta ao Design mantendo as escolhas.', 'Cada tentativa sorteia imprevistos novos.'] }
    ]
  };
})(globalThis);
