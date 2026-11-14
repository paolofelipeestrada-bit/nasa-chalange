/* =====================================================================
 * GLOSSÁRIO — termos técnicos explicados em linguagem simples.
 *
 * Aparecem como dica ao passar o mouse (ou tocar, ou focar com Tab) em
 * termos sublinhados e no botão "Glossário" do topo.
 *   chave: { term: T(en, pt, es), text: T(en, pt, es) }
 * Para sublinhar numa tela: MS.ui.h.term('chave') ou, em textos dos
 * dados, escreva [[chave]] ou [[chave|texto exibido]].
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};

  MS.data.glossary = {
    cubesat: { term: T('CubeSat', 'CubeSat', 'CubeSat'),
      text: T('A small satellite made of 10 cm cubes (1U). A 3U has three cubes in a row; a 6U has six.', 'Satélite pequeno feito de cubos de 10 cm (1U). Um 3U tem três cubos em fila; um 6U tem seis.', 'Satélite pequeño hecho de cubos de 10 cm (1U). Un 3U tiene tres cubos en fila; un 6U tiene seis.') },
    u: { term: T('U (unit)', 'U (unidade)', 'U (unidad)'),
      text: T('One 10 × 10 × 10 cm cube. It measures the room inside a CubeSat.', 'Um cubo de 10 × 10 × 10 cm. Mede o espaço dentro do CubeSat.', 'Un cubo de 10 × 10 × 10 cm. Mide el espacio dentro del CubeSat.') },
    orbit: { term: T('Orbit', 'Órbita', 'Órbita'),
      text: T('The path the satellite follows around Earth. Higher: it lasts longer, but images are less sharp.', 'O caminho que o satélite faz em volta da Terra. Mais alta: dura mais, mas as imagens ficam menos nítidas.', 'El camino que sigue el satélite alrededor de la Tierra. Más alta: dura más, pero las imágenes son menos nítidas.') },
    sso: { term: T('Sun-synchronous orbit', 'Órbita heliossíncrona', 'Órbita heliosíncrona'),
      text: T('An orbit that passes over each place at the same time of day. Great for photos: the sunlight always looks alike.', 'Órbita que passa sobre cada lugar sempre no mesmo horário do dia. Ótima para fotos: a luz do Sol é sempre parecida.', 'Órbita que pasa sobre cada lugar siempre a la misma hora del día. Ideal para fotos: la luz del Sol siempre es parecida.') },
    inclination: { term: T('Inclination', 'Inclinação', 'Inclinación'),
      text: T('The tilt of the orbit relative to the equator. It sets how far north and south the satellite goes.', 'O ângulo da órbita em relação ao equador. Define até que latitude o satélite chega.', 'El ángulo de la órbita respecto al ecuador. Define hasta qué latitud llega el satélite.') },
    eclipse: { term: T('Shadow (eclipse)', 'Sombra (eclipse)', 'Sombra (eclipse)'),
      text: T('The part of each lap when Earth blocks the Sun. The panels make no power and the satellite runs on its battery.', 'Parte da volta em que a Terra tapa o Sol. Os painéis não geram energia e o satélite usa a bateria.', 'La parte de cada vuelta en que la Tierra tapa el Sol. Los paneles no generan energía y el satélite usa la batería.') },
    lifetime: { term: T('Orbital lifetime', 'Vida orbital', 'Vida orbital'),
      text: T('How long the satellite stays up before the thin air slows it down and it falls.', 'Quanto tempo o satélite fica em órbita antes que o ar rarefeito o freie e ele caia.', 'Cuánto tiempo se queda el satélite en órbita antes de que el aire tenue lo frene y caiga.') },
    gsd: { term: T('Ground detail (GSD)', 'Detalhe no solo (GSD)', 'Detalle en el suelo (GSD)'),
      text: T('How much ground one image pixel covers. GSD 25 m: each pixel shows a 25 × 25 m square. Smaller = more detail.', 'O tamanho de um pixel da imagem no chão. GSD de 25 m: cada pixel mostra um quadrado de 25 × 25 m. Menor = mais detalhe.', 'El tamaño de un píxel de la imagen en el suelo. GSD de 25 m: cada píxel muestra un cuadrado de 25 × 25 m. Menor = más detalle.') },
    swath: { term: T('Swath', 'Faixa imageada', 'Franja de imagen'),
      text: T('How wide a strip of ground fits in one photo. A wide swath covers the whole area faster.', 'A largura do chão que aparece numa foto. Faixa larga cobre a área toda mais rápido.', 'El ancho del suelo que cabe en una foto. Una franja ancha cubre toda el área más rápido.') },
    revisit: { term: T('Revisit', 'Revisita', 'Revisita'),
      text: T('How many days the satellite needs to photograph the whole area again.', 'Quantos dias o satélite leva para fotografar a área inteira de novo.', 'Cuántos días necesita el satélite para fotografiar toda el área de nuevo.') },
    downlink: { term: T('Downlink', 'Envio de dados (downlink)', 'Envío de datos (downlink)'),
      text: T('Sending the images from the satellite to the ground station. It only happens while the satellite passes over the station.', 'Mandar as imagens do satélite para a estação em solo. Só acontece quando o satélite passa por cima da estação.', 'Enviar las imágenes del satélite a la estación terrena. Solo ocurre cuando el satélite pasa sobre la estación.') },
    groundStation: { term: T('Ground station', 'Estação em solo', 'Estación terrena'),
      text: T('An antenna on Earth that talks to the satellite: it receives images and sends commands.', 'Antena na Terra que conversa com o satélite: recebe imagens e envia comandos.', 'Antena en la Tierra que habla con el satélite: recibe imágenes y envía comandos.') },
    adcs: { term: T('Attitude control', 'Controle de atitude', 'Control de actitud'),
      text: T('The system that turns and points the satellite. The camera must stay steady or the image blurs.', 'O sistema que gira e aponta o satélite. A câmera precisa ficar apontada firme para a imagem não borrar.', 'El sistema que gira y apunta el satélite. La cámara debe quedarse firme o la imagen sale borrosa.') },
    mel: { term: T('Equipment list (MEL)', 'Lista de equipamentos (MEL)', 'Lista de equipos (MEL)'),
      text: T('Master Equipment List: every part with its mass, power, volume and cost. The satellite\'s "spreadsheet".', 'Master Equipment List: a lista de todos os equipamentos com massa, energia, volume e custo. É a "planilha" do satélite.', 'Master Equipment List: la lista de todas las piezas con masa, energía, volumen y costo. La "planilla" del satélite.') },
    contingency: { term: T('Contingency', 'Contingência', 'Contingencia'),
      text: T('An allowance added to mass and power because estimates are always off. Less-tested parts get a bigger allowance.', 'Uma reserva somada à massa e à energia porque as estimativas sempre erram. Peças menos testadas recebem reserva maior.', 'Una reserva sumada a la masa y la energía porque las estimaciones siempre fallan. Las piezas menos probadas reciben más reserva.') },
    margin: { term: T('Margin', 'Folga (margem)', 'Margen'),
      text: T('How much of a resource is left over. 20% power margin: the satellite makes 20% more than it uses. Margin protects against surprises.', 'Quanto sobra de um recurso. Folga de 20% na energia: o satélite gera 20% mais do que consome. Folga protege contra imprevistos.', 'Cuánto sobra de un recurso. Margen de 20% en energía: el satélite genera 20% más de lo que consume. El margen protege contra imprevistos.') },
    maturity: { term: T('Maturity', 'Maturidade', 'Madurez'),
      text: T('How much a part has been tested in space. Off-the-shelf (COTS) parts have flown many times; new developments are risky and slow.', 'O quanto uma peça já foi testada no espaço. Comercial (COTS) já voou muitas vezes; desenvolvimento novo é arriscado e demorado.', 'Cuánto se ha probado una pieza en el espacio. Lo comercial (COTS) ya voló muchas veces; un desarrollo nuevo es arriesgado y lento.') },
    requirement: { term: T('Requirement', 'Requisito', 'Requisito'),
      text: T('A measurable rule the design must meet, like "30 m of ground detail or better".', 'Uma regra medível que o projeto precisa cumprir, como "detalhe de 30 m ou melhor".', 'Una regla medible que el diseño debe cumplir, como "detalle de 30 m o mejor".') },
    verification: { term: T('Verification', 'Verificação', 'Verificación'),
      text: T('A test, analysis or inspection that proves the design meets a requirement before launch.', 'Teste, análise ou inspeção que prova que o projeto cumpre um requisito antes do lançamento.', 'Prueba, análisis o inspección que demuestra que el diseño cumple un requisito antes del lanzamiento.') },
    risk: { term: T('Risk', 'Risco', 'Riesgo'),
      text: T('Something that can go wrong during the mission. A good design has margins or choices that limit the damage.', 'Algo que pode dar errado durante a missão. Um bom projeto tem folga ou escolhas que reduzem o estrago.', 'Algo que puede salir mal durante la misión. Un buen diseño tiene márgenes o elecciones que limitan el daño.') },
    compression: { term: T('Compression', 'Compressão', 'Compresión'),
      text: T('Shrinking the images on the onboard computer before sending them. 4:1 compression = 4 times less data.', 'Diminuir o tamanho das imagens no computador de bordo antes de enviar. Compressão 4:1 = dados 4 vezes menores.', 'Reducir el tamaño de las imágenes en la computadora de a bordo antes de enviarlas. Compresión 4:1 = 4 veces menos datos.') },
    schedule: { term: T('Schedule', 'Prazo', 'Plazo'),
      text: T('Months from the start of the project until launch: building and testing the parts, then waiting for a seat on a rocket. New parts take longer.', 'Meses do começo do projeto até o lançamento: construir e testar as peças e depois esperar uma vaga num foguete. Peças novas demoram mais.', 'Meses desde el inicio del proyecto hasta el lanzamiento: construir y probar las piezas y luego esperar un lugar en un cohete. Las piezas nuevas tardan más.') },
    payload: { term: T('Payload', 'Carga útil', 'Carga útil'),
      text: T('The instrument that does the science. The rest of the satellite exists to serve it.', 'O instrumento que faz a ciência. O resto do satélite existe para servi-lo.', 'El instrumento que hace la ciencia. El resto del satélite existe para servirlo.') },
    rideshare: { term: T('Rideshare', 'Carona (rideshare)', 'Viaje compartido (rideshare)'),
      text: T('Many small satellites share one rocket and split the cost. Cheap, but the rocket picks the orbit and the date.', 'Vários satélites pequenos dividem o mesmo foguete e o custo. Barato, mas o foguete escolhe a órbita e a data.', 'Varios satélites pequeños comparten un cohete y el costo. Barato, pero el cohete elige la órbita y la fecha.') },
    segments: { term: T('Mission segments', 'Segmentos da missão', 'Segmentos de la misión'),
      text: T('NASA splits every science mission into 4 parts: launch, space (the spacecraft), ground (stations) and user (who uses the data).', 'A NASA divide toda missão científica em 4 partes: lançamento, espaço (a nave), solo (estações) e usuário (quem usa os dados).', 'La NASA divide toda misión científica en 4 partes: lanzamiento, espacio (la nave), tierra (estaciones) y usuario (quien usa los datos).') },
    cml: { term: T('Concept maturity (CML)', 'Maturidade do conceito (CML)', 'Madurez del concepto (CML)'),
      text: T('A NASA JPL scale for how developed a mission idea is: from 1 (a sketch on a napkin) to 4 (one detailed design with margins) and beyond.', 'Uma escala do JPL da NASA que mede o quanto a ideia de missão está desenvolvida: de 1 (um rabisco no guardanapo) a 4 (um projeto detalhado, com folgas) e além.', 'Una escala del JPL de la NASA que mide cuánto está desarrollada una idea de misión: de 1 (un boceto en una servilleta) a 4 (un diseño detallado, con márgenes) y más.') }
  };
})(globalThis);
