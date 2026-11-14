/* =====================================================================
 * CATÁLOGO — tudo o que pode ser escolhido, em qualquer cenário.
 *
 * Como acrescentar um item:
 *   1. Copie um item parecido da mesma seção, troque o id e os números.
 *   2. Ponha o id na lista "options" do slot certo em scenarios.js.
 *   3. Abra tests.html: o teste de validação aponta campos faltando.
 *
 * Textos (name, description, pros, cons, source) em { en, pt, es }:
 * T('inglês', 'português', 'espanhol').
 *
 * Valores que dependem do tamanho do satélite podem ser escritos por
 * formato: { '3U': 0.8, '6U': 1.3 }. O motor usa o formato da estrutura
 * escolhida.
 *
 * Unidades: massa kg · potência W · volume U (1U = 10×10×10 cm) ·
 * custo k$ (milhares de dólares) · taxa kbps · memória GB · prazo meses.
 * Números de ordem de grandeza realista, simplificados para o jogo.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};

  MS.data.catalog = {

    // Maturidade → contingência (reserva) aplicada na MEL sobre massa e
    // potência, e meses a mais de desenvolvimento. Quanto menos testado
    // o item, maior a reserva e mais longo o desenvolvimento.
    maturity: {
      cots:     { label: T('Off the shelf (COTS)', 'Comercial (COTS)', 'Comercial (COTS)'), contingency: 0.05, devMonths: 0 },
      modified: { label: T('Adapted', 'Adaptado', 'Adaptado'), contingency: 0.10, devMonths: 4 },
      new:      { label: T('New development', 'Desenvolvimento novo', 'Desarrollo nuevo'), contingency: 0.20, devMonths: 8 }
    },

    // ------------------------------------------------------------ Órbitas
    // lightingFactor: fração das passagens diurnas com boa iluminação.
    // lifetime_years: tempo até o arrasto derrubar um CubeSat (aproximado).
    orbits: {
      sso500: {
        name: T('Sun-synchronous 500 km', 'Heliossíncrona 500 km', 'Heliosíncrona 500 km'),
        description: T('Passes over every place at the same solar time (~10:30): steady light, great for images. Covers the whole planet.',
          'Passa sempre no mesmo horário solar (~10h30): iluminação constante, ideal para imagens. Cobre o planeta todo.',
          'Pasa siempre a la misma hora solar (~10:30): luz constante, ideal para imágenes. Cubre todo el planeta.'),
        pros: T('Good light on every pass and a long life (5 years).', 'Luz boa em toda passagem e vida longa (5 anos).', 'Buena luz en cada pasada y vida larga (5 años).'),
        cons: T('Only the SSO rideshare goes there.', 'Só a carona para SSO chega lá.', 'Solo el viaje compartido a SSO llega allí.'),
        altitude_km: 500, inclination_deg: 97.4, lightingFactor: 1.0, lifetime_years: 5
      },
      sso600: {
        name: T('Sun-synchronous 600 km', 'Heliossíncrona 600 km', 'Heliosíncrona 600 km'),
        description: T('Same steady light as 500 km, but higher: wider images with less detail, and almost no air drag.',
          'Mesma luz constante da de 500 km, porém mais alta: imagens mais largas e com menos detalhe, e quase sem arrasto do ar.',
          'La misma luz constante que a 500 km, pero más alta: imágenes más anchas y con menos detalle, y casi sin arrastre del aire.'),
        pros: T('Lasts about 10 years and covers more ground per pass.', 'Dura cerca de 10 anos e cobre mais chão por passagem.', 'Dura unos 10 años y cubre más suelo por pasada.'),
        cons: T('Needs a space tug to get there, and images lose detail.', 'Precisa de um rebocador espacial para chegar, e as imagens perdem detalhe.', 'Necesita un remolcador espacial para llegar, y las imágenes pierden detalle.'),
        altitude_km: 600, inclination_deg: 97.8, lightingFactor: 1.0, lifetime_years: 10
      },
      iss400: {
        name: T('Space Station orbit 400 km', 'Órbita da ISS 400 km', 'Órbita de la ISS 400 km'),
        description: T('Tilted 51.6°. The pass time changes every day and air drag is much stronger.',
          'Inclinação de 51,6°. O horário de passagem muda a cada dia e o arrasto é bem maior.',
          'Inclinación de 51,6°. La hora de paso cambia cada día y el arrastre es mucho mayor.'),
        pros: T('Cheapest launch and slightly sharper images.', 'Lançamento mais barato e imagens um pouco mais nítidas.', 'Lanzamiento más barato e imágenes un poco más nítidas.'),
        cons: T('Falls in less than 1 year, and the polar station cannot see it.', 'Cai em menos de 1 ano e a estação polar não enxerga.', 'Cae en menos de 1 año y la estación polar no la ve.'),
        altitude_km: 400, inclination_deg: 51.6, lightingFactor: 0.6, lifetime_years: 0.8
      }
    },

    // --------------------------------------------------------- Lançadores
    // orbits: órbitas que o lançador alcança. site: base (usada no 3D).
    // maxMass_kg e cost_k por formato; formato ausente = não aceito.
    // waitMonths: espera média pela próxima vaga, depois do satélite pronto.
    launchers: {
      rideshare_sso: {
        name: T('SSO rideshare', 'Carona para SSO (rideshare)', 'Viaje compartido a SSO (rideshare)'),
        description: T('Flies with dozens of other satellites on a rocket heading to sun-synchronous orbit.',
          'Vai com dezenas de outros satélites num foguete que segue para a órbita heliossíncrona.',
          'Viaja con decenas de otros satélites en un cohete que va a la órbita heliosíncrona.'),
        pros: T('Reaches sun-synchronous orbit at 500 km.', 'Leva à órbita heliossíncrona de 500 km.', 'Llega a la órbita heliosíncrona de 500 km.'),
        cons: T('Costs more than the Space Station ride; fixed dates.', 'Mais caro que a carona para a ISS; datas fixas.', 'Más caro que el viaje a la ISS; fechas fijas.'),
        source: T('Real rideshares to SSO fly about 4 times a year (SpaceX Transporter, 2026).', 'Caronas reais para SSO voam cerca de 4 vezes por ano (SpaceX Transporter, 2026).', 'Los viajes compartidos reales a SSO vuelan unas 4 veces al año (SpaceX Transporter, 2026).'),
        site: { name: T('Vandenberg (USA)', 'Vandenberg (EUA)', 'Vandenberg (EE. UU.)'), latitude_deg: 34.7, longitude_deg: -120.6 },
        orbits: ['sso500'], maxMass_kg: { '3U': 4.0, '6U': 8.0 }, cost_k: { '3U': 170, '6U': 300 }, waitMonths: 3
      },
      rideshare_tug: {
        name: T('Rideshare + space tug', 'Carona + rebocador espacial', 'Viaje compartido + remolcador espacial'),
        description: T('Same rideshare rocket, then a small "space tug" carries the satellite up to 600 km.',
          'O mesmo foguete de carona; depois um pequeno "rebocador espacial" leva o satélite até 600 km.',
          'El mismo cohete compartido; luego un pequeño "remolcador espacial" sube el satélite a 600 km.'),
        pros: T('Reaches the higher, longer-lasting 600 km orbit.', 'Leva à órbita de 600 km, mais alta e duradoura.', 'Llega a la órbita de 600 km, más alta y duradera.'),
        cons: T('More expensive and one more month of waiting.', 'Mais caro e um mês a mais de espera.', 'Más caro y un mes más de espera.'),
        source: T('Orbital transfer vehicles ("space tugs") already deliver rideshare satellites to custom orbits.', 'Veículos de transferência orbital ("rebocadores") já levam satélites de carona a órbitas sob medida.', 'Los vehículos de transferencia orbital ("remolcadores") ya llevan satélites compartidos a órbitas a medida.'),
        site: { name: T('Vandenberg (USA)', 'Vandenberg (EUA)', 'Vandenberg (EE. UU.)'), latitude_deg: 34.7, longitude_deg: -120.6 },
        look: { tug: true }, // 3D: foguete + rebocador (js/viz/looks.js)
        orbits: ['sso600'], maxMass_kg: { '3U': 4.0, '6U': 8.0 }, cost_k: { '3U': 250, '6U': 400 }, waitMonths: 4
      },
      iss_cargo: {
        name: T('Space Station cargo', 'Carga para a ISS', 'Carga a la ISS'),
        description: T('Rides up on a cargo ship and is released from the Space Station. Only reaches the Station orbit.',
          'Sobe numa nave de carga e é ejetado da estação espacial. Só alcança a órbita da ISS.',
          'Sube en una nave de carga y se libera desde la estación espacial. Solo llega a la órbita de la ISS.'),
        pros: T('The cheapest launch.', 'O lançamento mais barato.', 'El lanzamiento más barato.'),
        cons: T('Only goes to the Space Station orbit.', 'Só vai para a órbita da ISS.', 'Solo va a la órbita de la ISS.'),
        source: T('NASA\'s CubeSat Launch Initiative releases CubeSats from the ISS (CubeSat 101).', 'O programa de CubeSats da NASA ejeta CubeSats a partir da ISS (CubeSat 101).', 'El programa de CubeSats de la NASA libera CubeSats desde la ISS (CubeSat 101).'),
        site: { name: T('Cape Canaveral (USA)', 'Cabo Canaveral (EUA)', 'Cabo Cañaveral (EE. UU.)'), latitude_deg: 28.5, longitude_deg: -80.6 },
        look: { upper: 'capsule' }, // 3D: nave de carga no topo do foguete
        orbits: ['iss400'], maxMass_kg: { '3U': 4.0, '6U': 8.0 }, cost_k: { '3U': 110, '6U': 190 }, waitMonths: 2
      }
    },

    // ------------------------------------------- Estação Espacial (só 3D)
    // Sempre em órbita na simulação; com o lançador de carga (look.upper =
    // 'capsule') a nave faz o encontro e o acoplamento antes de soltar o CubeSat.
    spaceStation: {
      name: T('International Space Station', 'Estação Espacial Internacional', 'Estación Espacial Internacional'),
      altitude_km: 418, inclination_deg: 51.64,
      chaseBelow_km: 40, // a nave de carga chega 40 km abaixo e sobe até a estação (transferência de Hohmann)
      source: T('Typical orbit from NASA ISS Trajectory Data (spaceflight.nasa.gov).', 'Órbita típica dos dados de trajetória da ISS da NASA (spaceflight.nasa.gov).', 'Órbita típica de los datos de trayectoria de la ISS de la NASA (spaceflight.nasa.gov).')
    },

    // --------------------------------------------------- Estações em solo
    groundStations: {
      gs_polar: {
        name: T('Polar station (78° N)', 'Estação polar (78° N)', 'Estación polar (78° N)'),
        description: T('Rented antenna near the North Pole: sees almost every polar orbit. One-year contract.',
          'Antena alugada perto do Polo Norte: vê quase todas as órbitas polares. Contrato de 1 ano.',
          'Antena alquilada cerca del Polo Norte: ve casi todas las órbitas polares. Contrato de 1 año.'),
        pros: T('Sees the satellite on almost every lap: lots of contact time.', 'Vê o satélite em quase toda volta: muito tempo de contato.', 'Ve el satélite en casi cada vuelta: mucho tiempo de contacto.'),
        cons: T('Expensive (110 k$) and cannot see the Space Station orbit.', 'Cara (110 k$) e não enxerga a órbita da ISS.', 'Cara (110 k$) y no ve la órbita de la ISS.'),
        latitude_deg: 78, longitude_deg: 15.4, minElevation_deg: 10, bands: ['UHF', 'S', 'X'], cost_k: 110
      },
      gs_national: {
        name: T('National station (15° S)', 'Estação nacional (15° S)', 'Estación nacional (15° S)'),
        description: T('Our own antenna in central Brazil: cheap, but sees few passes per day.',
          'Antena própria no Brasil Central: barata, mas vê poucas passagens por dia.',
          'Antena propia en el centro de Brasil: barata, pero ve pocas pasadas por día.'),
        pros: T('Cheap (25 k$) and works with every orbit.', 'Barata (25 k$) e funciona em todas as órbitas.', 'Barata (25 k$) y funciona con todas las órbitas.'),
        cons: T('Few passes per day: little time to download images.', 'Poucas passagens por dia: pouco tempo para baixar imagens.', 'Pocas pasadas por día: poco tiempo para descargar imágenes.'),
        latitude_deg: -15, longitude_deg: -56, minElevation_deg: 10, bands: ['UHF', 'S'], cost_k: 25
      }
    },

    // ------------------------------------------- Componentes do satélite
    // Todos: name, description, pros (vantagem), cons (cuidado) — aparecem nos cartões.
    // Comuns: role, name, description, maturity, mass_kg, power_W (ligado),
    //         duty (fração do tempo ligado), volume_U, cost_k.
    // Por papel (lista oficial em MS.sim.roleFields):
    //   payload   pixel_um, focal_mm, pixelsAcross, bands, bitDepth, requiredPointing_deg
    //   structure formFactor, capacity_U
    //   power     solarPower_W (geração ao sol, por formato)
    //   adcs      accuracy_deg
    //   comms     band, dataRate_kbps
    //   obc       storage_GB, compressionRatio
    components: {
      // Instrumentos
      cam_wide: {
        role: 'payload', maturity: 'cots',
        name: T('Wide-angle camera', 'Câmera grande-angular', 'Cámara gran angular'),
        description: T('50 mm lens and 2,048 pixels per line. Light, cheap and covers a wide strip.',
          'Lente de 50 mm e 2.048 pixels por linha. Leve, barata e de faixa larga.',
          'Lente de 50 mm y 2.048 píxeles por línea. Ligera, barata y de franja ancha.'),
        pros: T('Light, cheap, wide strip, and works with simple pointing.', 'Leve, barata, faixa larga e funciona com apontamento simples.', 'Ligera, barata, franja ancha y funciona con apuntamiento simple.'),
        cons: T('About 55 m per pixel: small details disappear.', 'Cerca de 55 m por pixel: detalhes pequenos somem.', 'Unos 55 m por píxel: los detalles pequeños desaparecen.'),
        mass_kg: 0.35, power_W: 2.0, duty: 0.2, volume_U: 0.5, cost_k: 35,
        pixel_um: 5.5, focal_mm: 50, pixelsAcross: 2048, bands: 4, bitDepth: 10, requiredPointing_deg: 10
      },
      cam_mid: {
        role: 'payload', maturity: 'modified',
        name: T('Medium multispectral camera', 'Câmera multiespectral média', 'Cámara multiespectral media'),
        description: T('110 mm lens, 4,096 pixels per line and 4 color bands. Needs steady pointing.',
          'Lente de 110 mm, 4.096 pixels por linha e 4 bandas. Precisa de apontamento estável.',
          'Lente de 110 mm, 4.096 píxeles por línea y 4 bandas. Necesita apuntamiento estable.'),
        pros: T('About 25 m per pixel with a wide strip: a good balance.', 'Cerca de 25 m por pixel com faixa larga: equilíbrio.', 'Unos 25 m por píxel con franja ancha: equilibrio.'),
        cons: T('Needs precise pointing (reaction wheels) and 4 extra months to adapt.', 'Exige apontamento preciso (rodas de reação) e 4 meses a mais para adaptar.', 'Exige apuntamiento preciso (ruedas de reacción) y 4 meses más para adaptarla.'),
        mass_kg: 0.9, power_W: 4.0, duty: 0.2, volume_U: 1.2, cost_k: 140,
        pixel_um: 5.5, focal_mm: 110, pixelsAcross: 4096, bands: 4, bitDepth: 10, requiredPointing_deg: 1.0
      },
      cam_hr: {
        role: 'payload', maturity: 'new',
        name: T('High-resolution telescope', 'Telescópio de alta resolução', 'Telescopio de alta resolución'),
        description: T('580 mm telescope: very detailed images, but a narrow strip and lots of data.',
          'Telescópio de 580 mm: imagens muito detalhadas, mas faixa estreita e muitos dados.',
          'Telescopio de 580 mm: imágenes muy detalladas, pero franja estrecha y muchos datos.'),
        pros: T('Very detailed images (about 3 m per pixel).', 'Imagens muito detalhadas (cerca de 3 m por pixel).', 'Imágenes muy detalladas (unos 3 m por píxel).'),
        cons: T('Big, expensive, narrow strip, does not fit a 3U and takes 8 extra months to develop.', 'Grande, caro, faixa estreita, não cabe num 3U e leva 8 meses a mais para desenvolver.', 'Grande, caro, franja estrecha, no cabe en un 3U y tarda 8 meses más en desarrollarse.'),
        mass_kg: 2.0, power_W: 7.0, duty: 0.2, volume_U: 2.5, cost_k: 320,
        pixel_um: 3.45, focal_mm: 580, pixelsAcross: 4096, bands: 4, bitDepth: 12, requiredPointing_deg: 0.1
      },

      // Estrutura
      struct_3u: {
        role: 'structure', maturity: 'cots',
        name: T('3U structure', 'Estrutura 3U', 'Estructura 3U'),
        description: T('10 × 10 × 34 cm, about the size of a loaf of bread. Cheap and easy to launch.',
          '10 × 10 × 34 cm, mais ou menos um pão de forma. Barata e fácil de lançar.',
          '10 × 10 × 34 cm, más o menos un pan de molde. Barata y fácil de lanzar.'),
        pros: T('Cheap, light and cheaper to launch.', 'Barata, leve e lançamento mais em conta.', 'Barata, ligera y más barata de lanzar.'),
        cons: T('Little room: 2.8 U for everything.', 'Pouco espaço: 2,8 U para tudo.', 'Poco espacio: 2,8 U para todo.'),
        source: T('CubeSat sizes from NASA CubeSat 101.', 'Tamanhos de CubeSat do CubeSat 101 da NASA.', 'Tamaños de CubeSat del CubeSat 101 de la NASA.'),
        formFactor: '3U', capacity_U: 2.8, mass_kg: 0.4, power_W: 0, volume_U: 0, cost_k: 15
      },
      struct_6u: {
        role: 'structure', maturity: 'cots',
        name: T('6U structure', 'Estrutura 6U', 'Estructura 6U'),
        description: T('10 × 22 × 34 cm: two 3U side by side. Twice the room, but launch costs more.',
          '10 × 22 × 34 cm: dois 3U lado a lado. O dobro de espaço, mas o lançamento custa mais.',
          '10 × 22 × 34 cm: dos 3U lado a lado. El doble de espacio, pero el lanzamiento cuesta más.'),
        pros: T('Twice the room and twice the area for solar panels.', 'O dobro de espaço e de área para painéis.', 'El doble de espacio y de área para paneles.'),
        cons: T('Structure and launch cost much more.', 'Lançamento e estrutura bem mais caros.', 'Estructura y lanzamiento mucho más caros.'),
        source: T('CubeSat sizes from NASA CubeSat 101.', 'Tamanhos de CubeSat do CubeSat 101 da NASA.', 'Tamaños de CubeSat del CubeSat 101 de la NASA.'),
        formFactor: '6U', capacity_U: 5.6, mass_kg: 1.0, power_W: 0, volume_U: 0, cost_k: 35
      },

      // Energia (painéis + bateria + eletrônica)
      eps_body: {
        role: 'power', maturity: 'cots',
        name: T('Body-mounted panels', 'Painéis fixos no corpo', 'Paneles fijos en el cuerpo'),
        description: T('Solar cells on the satellite\'s sides plus a battery. Simple, no moving parts.',
          'Células solares nas faces do satélite + bateria. Simples, sem partes móveis.',
          'Células solares en las caras del satélite + batería. Simple, sin partes móviles.'),
        pros: T('Simple and cheaper.', 'Simples e mais barato.', 'Simple y más barato.'),
        cons: T('Makes little power, especially on a 3U.', 'Gera pouca energia, sobretudo num 3U.', 'Genera poca energía, sobre todo en un 3U.'),
        solarPower_W: { '3U': 7, '6U': 14 },
        mass_kg: { '3U': 0.45, '6U': 0.7 }, power_W: 0.2, duty: 1, volume_U: 0.3, cost_k: { '3U': 25, '6U': 40 }
      },
      eps_deploy: {
        role: 'power', maturity: 'cots',
        name: T('Deployable panels (wings)', 'Painéis abertos (asas)', 'Paneles desplegables (alas)'),
        description: T('Panels that unfold in orbit: almost 3× more power, but more expensive.',
          'Painéis que se abrem em órbita: quase 3× mais energia, porém mais caros.',
          'Paneles que se abren en órbita: casi 3× más energía, pero más caros.'),
        pros: T('Almost 3 times more power.', 'Quase 3 vezes mais energia.', 'Casi 3 veces más energía.'),
        cons: T('More expensive and a bit heavier.', 'Mais caro e um pouco mais pesado.', 'Más caro y un poco más pesado.'),
        solarPower_W: { '3U': 20, '6U': 40 },
        mass_kg: { '3U': 0.8, '6U': 1.3 }, power_W: 0.3, duty: 1, volume_U: 0.4, cost_k: { '3U': 55, '6U': 85 }
      },

      // Controle de atitude (ADCS)
      adcs_mag: {
        role: 'adcs', maturity: 'cots',
        name: T('Magnetorquers', 'Magnetorques', 'Magnetopares'),
        description: T('Coils that push against Earth\'s magnetic field. Points to within ~5°.',
          'Bobinas que usam o campo magnético da Terra. Aponta com ~5° de precisão.',
          'Bobinas que usan el campo magnético de la Tierra. Apunta con ~5° de precisión.'),
        pros: T('Cheap, light and uses little power.', 'Barato, leve e econômico.', 'Barato, ligero y económico.'),
        cons: T('Only ~5° pointing: good enough for the wide-angle camera only.', 'Aponta com só ~5°: só serve para a câmera grande-angular.', 'Solo ~5° de apuntamiento: sirve solo para la cámara gran angular.'),
        accuracy_deg: 5, mass_kg: 0.2, power_W: 0.4, duty: 1, volume_U: 0.2, cost_k: 20
      },
      adcs_wheels: {
        role: 'adcs', maturity: 'cots',
        name: T('Reaction wheels + star tracker', 'Rodas de reação + rastreador de estrelas', 'Ruedas de reacción + rastreador estelar'),
        description: T('3-axis control to within 0.05°. Expensive and uses more power.',
          'Controle em 3 eixos com precisão de 0,05°. Caro e consome mais energia.',
          'Control en 3 ejes con precisión de 0,05°. Caro y consume más energía.'),
        pros: T('Points to 0.05°: works with any camera.', 'Aponta com 0,05°: serve para qualquer câmera.', 'Apunta con 0,05°: sirve para cualquier cámara.'),
        cons: T('Expensive, uses 2 W and has moving parts.', 'Caro, consome 2 W e tem peças móveis.', 'Caro, consume 2 W y tiene piezas móviles.'),
        accuracy_deg: 0.05, mass_kg: 0.7, power_W: 2.0, duty: 1, volume_U: 0.6, cost_k: 110
      },

      // Comunicação
      com_uhf: {
        role: 'comms', maturity: 'cots',
        name: T('UHF radio', 'Rádio UHF', 'Radio UHF'),
        description: T('9.6 kbps. Cheap and reliable, great for health data (telemetry).',
          '9,6 kbps. Barato e confiável, ótimo para telemetria.',
          '9,6 kbps. Barato y fiable, ideal para telemetría.'),
        pros: T('Cheap and uses little power.', 'Barato e econômico.', 'Barato y económico.'),
        cons: T('Far too slow (9.6 kbps) to download images.', 'Lento demais (9,6 kbps) para baixar imagens.', 'Demasiado lento (9,6 kbps) para descargar imágenes.'),
        band: 'UHF', dataRate_kbps: 9.6, mass_kg: 0.1, power_W: 1.5, duty: 0.2, volume_U: 0.2, cost_k: 8
      },
      com_sband: {
        role: 'comms', maturity: 'cots',
        name: T('S-band transmitter', 'Transmissor banda S', 'Transmisor banda S'),
        description: T('5 Mbps. Sends images, but uses a lot of power while transmitting.',
          '5 Mbps. Envia imagens, mas consome bastante energia quando transmite.',
          '5 Mbps. Envía imágenes, pero consume mucha energía al transmitir.'),
        pros: T('Fast (5 Mbps): downloads the images.', 'Rápido (5 Mbps): baixa as imagens.', 'Rápido (5 Mbps): descarga las imágenes.'),
        cons: T('Uses a lot of power while transmitting.', 'Consome muita energia enquanto transmite.', 'Consume mucha energía al transmitir.'),
        band: 'S', dataRate_kbps: 5000, mass_kg: 0.25, power_W: 10, duty: 0.08, volume_U: 0.3, cost_k: 55
      },

      // Computador de bordo (OBC)
      obc_basic: {
        role: 'obc', maturity: 'cots',
        name: T('Basic computer', 'Computador básico', 'Computadora básica'),
        description: T('4 GB of memory and 2:1 lossless compression.', '4 GB de memória e compressão sem perdas 2:1.', '4 GB de memoria y compresión sin pérdidas 2:1.'),
        pros: T('Cheap and uses little power.', 'Barato e econômico.', 'Barata y económica.'),
        cons: T('2:1 compression: twice as much data to send.', 'Compressão 2:1: gera o dobro de dados para enviar.', 'Compresión 2:1: el doble de datos para enviar.'),
        storage_GB: 4, compressionRatio: 2, mass_kg: 0.1, power_W: 0.4, duty: 1, volume_U: 0.2, cost_k: 15
      },
      obc_adv: {
        role: 'obc', maturity: 'cots',
        name: T('Image-processing computer', 'Computador com processamento de imagem', 'Computadora con procesamiento de imagen'),
        description: T('64 GB of memory and 4:1 compression on board. Costs more and uses more power.',
          '64 GB de memória e compressão 4:1 a bordo. Mais caro e consome mais.',
          '64 GB de memoria y compresión 4:1 a bordo. Más cara y consume más.'),
        pros: T('4:1 compression and lots of memory.', 'Compressão 4:1 e muita memória.', 'Compresión 4:1 y mucha memoria.'),
        cons: T('Costs more and uses more power.', 'Mais caro e consome mais energia.', 'Más cara y consume más energía.'),
        storage_GB: 64, compressionRatio: 4, mass_kg: 0.2, power_W: 1.2, duty: 1, volume_U: 0.3, cost_k: 40
      }
    }
  };
})(globalThis);
