/* =====================================================================
 * GLOSSÁRIO — termos técnicos explicados em linguagem simples.
 *
 * Aparecem como dica ao passar o mouse (ou tocar) em termos sublinhados
 * e no botão "Glossário" do topo. Termo novo: acrescente uma linha.
 *   chave: { term: 'Nome exibido', text: 'Explicação curta.' }
 * Para sublinhar numa tela: MS.ui.h.term('chave') ou, em textos dos
 * dados, escreva [[chave]] ou [[chave|texto exibido]].
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  MS.data = MS.data || {};

  MS.data.glossary = {
    cubesat: { term: 'CubeSat', text: 'Satélite pequeno feito de cubos de 10 cm (1U). Um 3U tem três cubos em fila; um 6U tem seis.' },
    u: { term: 'U (unidade)', text: 'Um cubo de 10 × 10 × 10 cm. Mede o espaço dentro do CubeSat.' },
    orbit: { term: 'Órbita', text: 'O caminho que o satélite faz em volta da Terra. Mais alta: dura mais, mas as imagens ficam menos nítidas.' },
    sso: { term: 'Órbita heliossíncrona', text: 'Órbita que passa sobre cada lugar sempre no mesmo horário do dia. Ótima para fotos: a luz do Sol é sempre parecida.' },
    inclination: { term: 'Inclinação', text: 'O ângulo da órbita em relação ao equador. Define até que latitude o satélite chega.' },
    eclipse: { term: 'Sombra (eclipse)', text: 'Parte da volta em que a Terra tapa o Sol. Os painéis não geram energia e o satélite usa a bateria.' },
    lifetime: { term: 'Vida orbital', text: 'Quanto tempo o satélite fica em órbita antes que o ar rarefeito o freie e ele caia.' },
    gsd: { term: 'GSD (resolução no solo)', text: 'O tamanho de um pixel da imagem no chão. GSD de 25 m: cada pixel mostra um quadrado de 25 × 25 m. Menor = mais detalhe.' },
    swath: { term: 'Faixa imageada', text: 'A largura do chão que aparece numa foto. Faixa larga cobre a área toda mais rápido.' },
    revisit: { term: 'Revisita', text: 'Quantos dias o satélite leva para fotografar a área inteira de novo.' },
    downlink: { term: 'Envio de dados (downlink)', text: 'Mandar as imagens do satélite para a estação em solo. Só acontece quando o satélite passa por cima da estação.' },
    groundStation: { term: 'Estação em solo', text: 'Antena na Terra que conversa com o satélite: recebe imagens e envia comandos.' },
    adcs: { term: 'Controle de atitude', text: 'O sistema que gira e aponta o satélite. A câmera precisa ficar apontada firme para a imagem não borrar.' },
    mel: { term: 'MEL', text: 'Master Equipment List: a lista de todos os equipamentos com massa, energia, volume e custo. É a "planilha" do satélite.' },
    contingency: { term: 'Contingência', text: 'Uma reserva somada à massa e à energia porque as estimativas sempre erram. Peças menos testadas recebem reserva maior.' },
    margin: { term: 'Folga (margem)', text: 'Quanto sobra de um recurso. Folga de 20% na energia: o satélite gera 20% mais do que consome. Folga protege contra imprevistos.' },
    maturity: { term: 'Maturidade', text: 'O quanto uma peça já foi testada no espaço. Comercial (COTS) já voou muitas vezes; desenvolvimento novo é arriscado.' },
    requirement: { term: 'Requisito', text: 'Uma regra medível que o projeto precisa cumprir, como "GSD de 30 m ou melhor".' },
    verification: { term: 'Verificação', text: 'Teste, análise ou inspeção que prova que o projeto cumpre um requisito antes do lançamento.' },
    risk: { term: 'Risco', text: 'Algo que pode dar errado durante a missão. Um bom projeto tem folga ou escolhas que reduzem o estrago.' },
    compression: { term: 'Compressão', text: 'Diminuir o tamanho das imagens no computador de bordo antes de enviar. Compressão 4:1 = dados 4 vezes menores.' }
  };
})(globalThis);
