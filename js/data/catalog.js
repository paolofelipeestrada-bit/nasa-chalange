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
      // ---- Lua (missões 5 e 6): body: 'moon'; surface: true = pousado
      moon_polar100: { body: 'moon',
        name: T('Lunar polar orbit 100 km', 'Órbita polar lunar 100 km', 'Órbita polar lunar 100 km'),
        description: T('Passes over both lunar poles every 2 hours. Like NASA\'s LRO mapping orbit.', 'Passa pelos dois polos da Lua a cada 2 horas. Como a órbita de mapeamento da LRO da NASA.', 'Pasa por los dos polos de la Luna cada 2 horas. Como la órbita de mapeo del LRO de la NASA.'),
        pros: T('Sees the whole Moon in one lunar month; about 1.5 years before it needs correcting.', 'Vê a Lua inteira em um mês lunar; cerca de 1,5 ano antes de precisar de correção.', 'Ve toda la Luna en un mes lunar; cerca de 1,5 años antes de necesitar corrección.'),
        cons: T('Behind the Moon (no contact) about 40% of each lap.', 'Atrás da Lua (sem contato) cerca de 40% de cada volta.', 'Detrás de la Luna (sin contacto) cerca del 40% de cada vuelta.'),
        altitude_km: 100, inclination_deg: 90, lifetime_years: 1.5 },
      moon_polar50: { body: 'moon',
        name: T('Low lunar orbit 50 km', 'Órbita lunar baixa 50 km', 'Órbita lunar baja 50 km'),
        description: T('Twice as close: sharper photos, but the Moon\'s lumpy gravity (mascons) pulls it down fast.', 'Duas vezes mais perto: fotos mais nítidas, mas a gravidade irregular da Lua (mascons) puxa o satélite rápido.', 'Dos veces más cerca: fotos más nítidas, pero la gravedad irregular de la Luna (mascons) lo baja rápido.'),
        pros: T('Twice the detail of 100 km.', 'O dobro de detalhe que a 100 km.', 'El doble de detalle que a 100 km.'),
        cons: T('Only about 5 months before crashing.', 'Só cerca de 5 meses antes de cair.', 'Solo unos 5 meses antes de caer.'),
        altitude_km: 50, inclination_deg: 90, lifetime_years: 0.4 },
      moon_polar200: { body: 'moon',
        name: T('Lunar polar orbit 200 km', 'Órbita polar lunar 200 km', 'Órbita polar lunar 200 km'),
        description: T('Higher and calmer: lasts years, but each pixel covers twice the ground.', 'Mais alta e estável: dura anos, mas cada pixel cobre o dobro do chão.', 'Más alta y estable: dura años, pero cada píxel cubre el doble de suelo.'),
        pros: T('About 3 years of life.', 'Cerca de 3 anos de vida.', 'Cerca de 3 años de vida.'),
        cons: T('Half the detail of 100 km.', 'Metade do detalhe que a 100 km.', 'La mitad del detalle que a 100 km.'),
        altitude_km: 200, inclination_deg: 90, lifetime_years: 3 },
      site_equator: { body: 'moon', surface: true,
        name: T('Sea of Tranquillity (equator)', 'Mar da Tranquilidade (equador)', 'Mar de la Tranquilidad (ecuador)'),
        description: T('Flat plain near the Apollo 11 site. Earth always high in the sky.', 'Planície plana perto do local da Apollo 11. A Terra sempre alta no céu.', 'Llanura plana cerca del sitio del Apolo 11. La Tierra siempre alta en el cielo.'),
        pros: T('Easiest landing (1,900 m/s) and Earth always in view.', 'Pouso mais fácil (1.900 m/s) e a Terra sempre à vista.', 'Aterrizaje más fácil (1.900 m/s) y la Tierra siempre a la vista.'),
        cons: T('Only 14 days of sunlight, then the freezing lunar night.', 'Só 14 dias de sol, depois a noite lunar congelante.', 'Solo 14 días de sol, luego la noche lunar helada.'),
        altitude_km: 0, inclination_deg: 0, lifetime_years: 0.038, sunFraction: 0.5, earthView: 1, deltaV_mps: 1900 },
      site_pole: { body: 'moon', surface: true,
        name: T('Shackleton crater rim (south pole)', 'Borda da cratera Shackleton (polo sul)', 'Borde del cráter Shackleton (polo sur)'),
        description: T('A ridge near the south pole that is lit about 80% of the time, next to craters with water ice. Artemis wants to go here.', 'Uma crista perto do polo sul iluminada cerca de 80% do tempo, ao lado de crateras com gelo de água. A Artemis quer ir para lá.', 'Una cresta cerca del polo sur iluminada cerca del 80% del tiempo, junto a cráteres con hielo de agua. Artemis quiere ir allí.'),
        pros: T('About 60 days of sunlight in a row.', 'Cerca de 60 dias de sol seguidos.', 'Cerca de 60 días de sol seguidos.'),
        cons: T('Harder landing (2,050 m/s) and Earth low on the horizon: half the contact time.', 'Pouso mais difícil (2.050 m/s) e a Terra baixa no horizonte: metade do tempo de contato.', 'Aterrizaje más difícil (2.050 m/s) y la Tierra baja en el horizonte: la mitad del tiempo de contacto.'),
        altitude_km: 0, inclination_deg: 0, lifetime_years: 0.164, sunFraction: 0.8, earthView: 0.5, deltaV_mps: 2050 },
      sso500: {
        name: T('Sun-synchronous 500 km', 'Heliossíncrona 500 km', 'Heliosíncrona 500 km'),
        description: T('Passes over every place at the same solar time (~10:30): steady light, great for images. Covers the whole planet.',
          'Passa sempre no mesmo horário solar (~10h30): iluminação constante, ideal para imagens. Cobre o planeta todo.',
          'Pasa siempre a la misma hora solar (~10:30): luz constante, ideal para imágenes. Cubre todo el planeta.'),
        pros: T('Good light on every pass and a long life (5 years).', 'Luz boa em toda passagem e vida longa (5 anos).', 'Buena luz en cada pasada y vida larga (5 años).'),
        cons: T('Only the SSO rideshare goes there.', 'Só a carona para SSO chega lá.', 'Solo el viaje compartido a SSO llega allí.'),
        altitude_km: 500, inclination_deg: 97.4, lightingFactor: 1.0, lifetime_years: 5,
        // Missões de acoplamento: mudar o plano de 97,4° para 51,6° custa Δv = 2·v·sen(Δi/2) ≈ 5,8 km/s
        deltaV_mps: 5800
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
        altitude_km: 400, inclination_deg: 51.6, lightingFactor: 0.6, lifetime_years: 0.8,
        // Missões de acoplamento: na mesma altura da ISS a nave não a alcança; precisa descer, esperar e subir de novo.
        deltaV_mps: 130, rendezvous_days: 25
      },
      // ---- Missões de acoplamento com a ISS (7 e 8)
      chase350: {
        name: T('Chase orbit 350 km (51.6°)', 'Órbita de perseguição 350 km (51,6°)', 'Órbita de persecución 350 km (51,6°)'),
        description: T('In the same plane as the Space Station, 70 km below it. A lower orbit is faster, so the CubeSat catches up on its own and then climbs (Hohmann transfer). Real cargo ships do this.',
          'No mesmo plano da ISS, 70 km abaixo. Órbita mais baixa é mais rápida: o CubeSat alcança a estação sozinho e depois sobe (transferência de Hohmann). As naves de carga reais fazem assim.',
          'En el mismo plano que la ISS, 70 km por debajo. Una órbita más baja es más rápida: el CubeSat alcanza la estación solo y luego sube (transferencia de Hohmann). Las naves de carga reales lo hacen así.'),
        pros: T('Catches the Station in about 4 days with little fuel (60 m/s).', 'Alcança a ISS em uns 4 dias com pouco combustível (60 m/s).', 'Alcanza la ISS en unos 4 días con poco combustible (60 m/s).'),
        cons: T('Air drag is strong at 350 km: it cannot wait there for long.', 'O arrasto do ar é forte a 350 km: não dá para esperar muito ali.', 'El arrastre del aire es fuerte a 350 km: no se puede esperar mucho allí.'),
        altitude_km: 350, inclination_deg: 51.6, lightingFactor: 0.6, lifetime_years: 0.3, deltaV_mps: 60, rendezvous_days: 4
      },
      iss_near: {
        name: T('Released by the Station (418 km)', 'Solto pela própria ISS (418 km)', 'Liberado por la propia ISS (418 km)'),
        description: T('The CubeSat goes up inside a cargo ship and the astronauts release it right next to the Station.',
          'O CubeSat sobe dentro de uma nave de carga e os astronautas o soltam bem ao lado da estação.',
          'El CubeSat sube dentro de una nave de carga y los astronautas lo liberan justo al lado de la estación.'),
        pros: T('Already next to the Station: only small moves are needed (25 m/s).', 'Já começa ao lado da ISS: só precisa de manobras pequenas (25 m/s).', 'Ya empieza junto a la ISS: solo necesita maniobras pequeñas (25 m/s).'),
        cons: T('Only the cargo ship goes there.', 'Só a nave de carga leva até lá.', 'Solo la nave de carga llega allí.'),
        altitude_km: 418, inclination_deg: 51.64, lightingFactor: 0.6, lifetime_years: 0.9, deltaV_mps: 25, rendezvous_days: 0
      }
    },

    // --------------------------------------------------------- Lançadores
    // orbits: órbitas que o lançador alcança. site: base (usada no 3D).
    // maxMass_kg e cost_k por formato; formato ausente = não aceito.
    // waitMonths: espera média pela próxima vaga, depois do satélite pronto.
    launchers: {
      artemis_ride: {
        name: T('Artemis secondary payload', 'Carona na Artemis (carga secundária)', 'Viaje en Artemis (carga secundaria)'),
        description: T('Rides inside the SLS rocket adapter, like the 10 CubeSats of Artemis I, and is released on the way to the Moon.', 'Vai dentro do adaptador do foguete SLS, como os 10 CubeSats da Artemis I, e é solto a caminho da Lua.', 'Va dentro del adaptador del cohete SLS, como los 10 CubeSats de Artemis I, y se suelta camino a la Luna.'),
        pros: T('Cheap (NASA program) and already on the way to the Moon.', 'Barata (programa da NASA) e já a caminho da Lua.', 'Barata (programa de la NASA) y ya camino a la Luna.'),
        cons: T('Only 6U, and Artemis flights are rare: long wait.', 'Só 6U, e os voos da Artemis são raros: espera longa.', 'Solo 6U, y los vuelos de Artemis son raros: espera larga.'),
        site: { name: T('Kennedy Space Center (USA)', 'Centro Espacial Kennedy (EUA)', 'Centro Espacial Kennedy (EE. UU.)'), latitude_deg: 28.5, longitude_deg: -80.6 },
        orbits: ['moon_polar100', 'moon_polar50', 'moon_polar200'], maxMass_kg: { '6U': 14 }, cost_k: { '6U': 250 }, waitMonths: 10
      },
      lunar_rideshare: {
        name: T('Commercial lunar rideshare', 'Carona comercial para a Lua', 'Viaje comercial a la Luna'),
        description: T('A commercial transfer vehicle drops small satellites in lunar orbit.', 'Um veículo comercial de transferência deixa satélites pequenos na órbita da Lua.', 'Un vehículo comercial de transferencia deja satélites pequeños en órbita lunar.'),
        pros: T('Flies sooner and takes 3U or 6U.', 'Voa antes e leva 3U ou 6U.', 'Vuela antes y lleva 3U o 6U.'),
        cons: T('Expensive: about 75 k$ per kg.', 'Cara: cerca de 75 k$ por kg.', 'Cara: unos 75 k$ por kg.'),
        site: { name: T('Kennedy Space Center (USA)', 'Centro Espacial Kennedy (EUA)', 'Centro Espacial Kennedy (EE. UU.)'), latitude_deg: 28.5, longitude_deg: -80.6 },
        orbits: ['moon_polar100', 'moon_polar50', 'moon_polar200'], maxMass_kg: { '3U': 6, '6U': 14 }, cost_k: { '3U': 450, '6U': 900 }, waitMonths: 4
      },
      clps_ride: {
        name: T('Ride to lunar orbit (CLPS-style)', 'Carona até a órbita lunar (tipo CLPS)', 'Viaje a la órbita lunar (tipo CLPS)'),
        description: T('A commercial lunar mission (NASA CLPS program) carries the small lander to low lunar orbit; from there it lands on its own.', 'Uma missão lunar comercial (programa CLPS da NASA) leva o pequeno módulo até a órbita baixa da Lua; de lá ele pousa sozinho.', 'Una misión lunar comercial (programa CLPS de la NASA) lleva el pequeño módulo a la órbita baja lunar; desde ahí aterriza solo.'),
        pros: T('Takes up to 40 kg: room for a descent stage.', 'Leva até 40 kg: cabe um estágio de descida.', 'Lleva hasta 40 kg: cabe una etapa de descenso.'),
        cons: T('Very expensive (1,200 k$).', 'Muito cara (1.200 k$).', 'Muy cara (1.200 k$).'),
        site: { name: T('Kennedy Space Center (USA)', 'Centro Espacial Kennedy (EUA)', 'Centro Espacial Kennedy (EE. UU.)'), latitude_deg: 28.5, longitude_deg: -80.6 },
        orbits: ['site_equator', 'site_pole'], maxMass_kg: { '6U': 40 }, cost_k: { '6U': 1200 }, waitMonths: 6
      },
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
        orbits: ['iss400', 'iss_near'], maxMass_kg: { '3U': 4.0, '6U': 8.0 }, cost_k: { '3U': 110, '6U': 190 }, waitMonths: 2
      },
      rideshare_iss: {
        name: T('Rideshare to the Station plane (51.6°)', 'Carona para o plano da ISS (51,6°)', 'Viaje compartido al plano de la ISS (51,6°)'),
        description: T('A rocket heading to the Space Station inclination drops the CubeSat in the same orbital plane, a little below the Station.',
          'Um foguete que vai para a inclinação da ISS deixa o CubeSat no mesmo plano da órbita, um pouco abaixo da estação.',
          'Un cohete que va a la inclinación de la ISS deja el CubeSat en el mismo plano orbital, un poco por debajo de la estación.'),
        pros: T('Already in the right plane: changing plane later would cost a huge Δv.', 'Já no plano certo: mudar de plano depois custaria um Δv enorme.', 'Ya en el plano correcto: cambiar de plano después costaría un Δv enorme.'),
        cons: T('More expensive than the SSO rideshare.', 'Mais cara que a carona para SSO.', 'Más cara que el viaje a SSO.'),
        site: { name: T('Cape Canaveral (USA)', 'Cabo Canaveral (EUA)', 'Cabo Cañaveral (EE. UU.)'), latitude_deg: 28.5, longitude_deg: -80.6 },
        orbits: ['chase350', 'iss400'], maxMass_kg: { '3U': 4.0, '6U': 10.0 }, cost_k: { '3U': 150, '6U': 260 }, waitMonths: 3
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
      dsn_34m: { deepSpace: true,
        name: T('NASA Deep Space Network (34 m)', 'Rede de Espaço Profundo da NASA (34 m)', 'Red de Espacio Profundo de la NASA (34 m)'),
        description: T('Three giant antennas in California, Spain and Australia: together they always see the Moon.', 'Três antenas gigantes na Califórnia, na Espanha e na Austrália: juntas sempre veem a Lua.', 'Tres antenas gigantes en California, España y Australia: juntas siempre ven la Luna.'),
        pros: T('Sees the Moon about 20 h per day; X band.', 'Vê a Lua cerca de 20 h por dia; banda X.', 'Ve la Luna unas 20 h por día; banda X.'),
        cons: T('Antenna time is expensive (250 k$ per year).', 'O tempo de antena é caro (250 k$ por ano).', 'El tiempo de antena es caro (250 k$ al año).'),
        latitude_deg: 35.4, longitude_deg: -116.9, bands: ['S', 'X'], viewHours: 20, passesPerDay: 3, cost_k: 250 },
      gs_univ18: { deepSpace: true,
        name: T('University 18 m dish', 'Antena universitária de 18 m', 'Antena universitaria de 18 m'),
        description: T('One big dish at a university: it sees the Moon only while it is above its horizon.', 'Uma antena grande numa universidade: só vê a Lua enquanto ela está acima do horizonte.', 'Una antena grande en una universidad: solo ve la Luna mientras está sobre su horizonte.'),
        pros: T('Cheap (60 k$).', 'Barata (60 k$).', 'Barata (60 k$).'),
        cons: T('About 8 h of view per day, S band only.', 'Cerca de 8 h de visada por dia, só banda S.', 'Unas 8 h de visibilidad por día, solo banda S.'),
        latitude_deg: -22.7, longitude_deg: -45, bands: ['S'], viewHours: 8, passesPerDay: 1, cost_k: 60 },
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
      // Imageador meteorológico de faixa larga (inspirado no VIIRS dos satélites JPSS/NOAA)
      cam_wx: {
        role: 'payload', maturity: 'modified',
        name: T('Weather imager (wide swath)', 'Imageador meteorológico (faixa larga)', 'Generador de imágenes meteorológico (franja ancha)'),
        description: T('6 mm lens, 3,200 pixels per line and infrared bands, like the VIIRS on NOAA weather satellites: sees clouds, rain and flooded areas over a 1,400 km strip.',
          'Lente de 6 mm, 3.200 pixels por linha e bandas no infravermelho, como o VIIRS dos satélites meteorológicos da NOAA: vê nuvens, chuva e áreas alagadas numa faixa de 1.400 km.',
          'Lente de 6 mm, 3.200 píxeles por línea y bandas infrarrojas, como el VIIRS de los satélites meteorológicos de la NOAA: ve nubes, lluvia y zonas inundadas en una franja de 1.400 km.'),
        pros: T('Covers the whole state almost every day, day and night (infrared).', 'Cobre o estado inteiro quase todo dia, de dia e de noite (infravermelho).', 'Cubre todo el estado casi cada día, de día y de noche (infrarrojo).'),
        cons: T('About 460 m per pixel: sees rivers and lakes, not streets.', 'Cerca de 460 m por pixel: vê rios e lagoas, não ruas.', 'Unos 460 m por píxel: ve ríos y lagunas, no calles.'),
        mass_kg: 0.5, power_W: 3.0, duty: 0.5, volume_U: 0.6, cost_k: 60,
        pixel_um: 5.5, focal_mm: 6, pixelsAcross: 3200, bands: 6, bitDepth: 12, requiredPointing_deg: 5
      },
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
      },

      // ---- Lua: rádios de espaço profundo e propulsão
      com_slunar: {
        role: 'comms', maturity: 'cots',
        name: T('Lunar S-band radio', 'Rádio banda S lunar', 'Radio banda S lunar'),
        description: T('16 kbps from the Moon: at 384,000 km the signal arrives 30,000 times weaker than from low orbit.', '16 kbps desde a Lua: a 384 mil km o sinal chega 30 mil vezes mais fraco que de uma órbita baixa.', '16 kbps desde la Luna: a 384.000 km la señal llega 30.000 veces más débil que desde una órbita baja.'),
        pros: T('Light and cheap.', 'Leve e barato.', 'Ligero y barato.'),
        cons: T('Very slow: few photos reach the Earth.', 'Muito lento: poucas fotos chegam à Terra.', 'Muy lento: pocas fotos llegan a la Tierra.'),
        band: 'S', dataRate_kbps: 16, mass_kg: 0.3, power_W: 6, duty: 0.3, volume_U: 0.5, cost_k: 60
      },
      com_xlunar: {
        role: 'comms', maturity: 'modified',
        name: T('Deep-space X-band transponder', 'Transponder banda X de espaço profundo', 'Transpondedor banda X de espacio profundo'),
        description: T('256 kbps to a big dish, like the Iris radio used by NASA lunar CubeSats.', '256 kbps para uma antena grande, como o rádio Iris dos CubeSats lunares da NASA.', '256 kbps a una antena grande, como la radio Iris de los CubeSats lunares de la NASA.'),
        pros: T('16 × faster than the S radio.', '16 vezes mais rápido que o rádio S.', '16 veces más rápido que la radio S.'),
        cons: T('Heavy, power-hungry and only big X-band dishes hear it.', 'Pesado, gasta energia e só antenas grandes de banda X escutam.', 'Pesado, gasta energía y solo antenas grandes de banda X lo escuchan.'),
        band: 'X', dataRate_kbps: 256, mass_kg: 1.1, power_W: 30, duty: 0.15, volume_U: 0.6, cost_k: 220
      },
      prop_cold: {
        role: 'propulsion', maturity: 'cots',
        name: T('Cold-gas thruster', 'Propulsor de gás frio', 'Propulsor de gas frío'),
        description: T('Puffs compressed gas. Simple and safe, but weak (Isp 65 s).', 'Solta gás comprimido. Simples e seguro, mas fraco (Isp 65 s).', 'Suelta gas comprimido. Simple y seguro, pero débil (Isp 65 s).'),
        pros: T('Light, cheap and simple.', 'Leve, barato e simples.', 'Ligero, barato y simple.'),
        cons: T('Gives only a few dozen m/s.', 'Dá só algumas dezenas de m/s.', 'Da solo unas decenas de m/s.'),
        isp_s: 65, propellant_kg: 0.4, mass_kg: 1.0, power_W: 0.5, duty: 0.1, volume_U: 1.0, cost_k: 40
      },
      prop_coldxl: {
        role: 'propulsion', maturity: 'cots',
        name: T('Cold gas, big tank', 'Gás frio, tanque grande', 'Gas frío, tanque grande'),
        description: T('The same simple butane thruster with a 1.2 kg tank. Gentle pushes, ideal for close approaches.', 'O mesmo propulsor simples de butano com tanque de 1,2 kg. Empurrões suaves, ideais para aproximações.', 'El mismo propulsor simple de butano con un tanque de 1,2 kg. Empujones suaves, ideales para aproximaciones.'),
        pros: T('Safe near astronauts (no toxic fuel) and cheap.', 'Seguro perto de astronautas (sem combustível tóxico) e barato.', 'Seguro cerca de astronautas (sin combustible tóxico) y barato.'),
        cons: T('Low Isp: about 120 m/s at most.', 'Isp baixo: no máximo uns 120 m/s.', 'Isp bajo: como mucho unos 120 m/s.'),
        isp_s: 70, propellant_kg: 1.2, mass_kg: 2.4, power_W: 1, duty: 0.05, volume_U: 2.0, cost_k: 80
      },
      prop_green: {
        role: 'propulsion', maturity: 'modified',
        name: T('Green monopropellant engine', 'Motor monopropelente "verde"', 'Motor monopropelente "verde"'),
        description: T('Non-toxic fuel (AF-M315E) tested by NASA: Isp 220 s, 1.5 kg of propellant.', 'Combustível não tóxico (AF-M315E) testado pela NASA: Isp 220 s, 1,5 kg de combustível.', 'Combustible no tóxico (AF-M315E) probado por la NASA: Isp 220 s, 1,5 kg de combustible.'),
        pros: T('Strong and quick burns: a few hundred m/s.', 'Forte e queima rápido: algumas centenas de m/s.', 'Fuerte y quema rápido: unos cientos de m/s.'),
        cons: T('3 kg and 2U of the box.', '3 kg e 2U da caixa.', '3 kg y 2U de la caja.'),
        isp_s: 220, propellant_kg: 1.5, mass_kg: 3.0, power_W: 2, duty: 0.05, volume_U: 2.0, cost_k: 180
      },
      prop_ion: {
        role: 'propulsion', maturity: 'new',
        name: T('Iodine ion engine', 'Motor iônico a iodo', 'Motor iónico de yodo'),
        description: T('Electric engine (like the one on Lunar IceCube): Isp 1,400 s, but tiny thrust and big power use.', 'Motor elétrico (como o do Lunar IceCube): Isp 1.400 s, mas empuxo minúsculo e muito consumo de energia.', 'Motor eléctrico (como el del Lunar IceCube): Isp 1.400 s, pero empuje diminuto y mucho consumo de energía.'),
        pros: T('Huge Δv with little propellant.', 'Δv enorme com pouco combustível.', 'Δv enorme con poco combustible.'),
        cons: T('New technology: +8 months to develop; uses a lot of power.', 'Tecnologia nova: +8 meses de desenvolvimento; gasta muita energia.', 'Tecnología nueva: +8 meses de desarrollo; gasta mucha energía.'),
        isp_s: 1400, propellant_kg: 0.6, mass_kg: 1.8, power_W: 60, duty: 0.1, volume_U: 1.0, cost_k: 250
      },
      prop_lander: {
        role: 'propulsion', maturity: 'modified',
        name: T('Descent stage (bipropellant)', 'Estágio de descida (bipropelente)', 'Etapa de descenso (bipropelente)'),
        description: T('Engine, tanks and four legs under the 6U box: Isp 310 s and 17 kg of propellant to brake down to the ground.', 'Motor, tanques e quatro pernas embaixo da caixa 6U: Isp 310 s e 17 kg de combustível para frear até o chão.', 'Motor, tanques y cuatro patas debajo de la caja 6U: Isp 310 s y 17 kg de combustible para frenar hasta el suelo.'),
        pros: T('About 2,000 m/s: enough to land.', 'Cerca de 2.000 m/s: o bastante para pousar.', 'Unos 2.000 m/s: suficiente para aterrizar.'),
        cons: T('25 kg and 600 k$; every extra kg on top costs Δv.', '25 kg e 600 k$; cada kg a mais em cima custa Δv.', '25 kg y 600 k$; cada kg extra encima cuesta Δv.'),
        isp_s: 310, propellant_kg: 17, mass_kg: 25, power_W: 3, duty: 0.05, volume_U: 0, cost_k: 600
      },

      // ---- Sensores de aproximação (missões de acoplamento com a ISS)
      // navError_cm: erro na medida da posição relativa nos últimos metros
      nav_gps: {
        role: 'sensor', maturity: 'cots',
        name: T('Relative GPS', 'GPS relativo', 'GPS relativo'),
        description: T('Compares its GPS position with the Station\'s. Works anywhere, day or night.', 'Compara a sua posição de GPS com a da estação. Funciona em qualquer lugar, de dia ou de noite.', 'Compara su posición GPS con la de la estación. Funciona en cualquier lugar, de día o de noche.'),
        pros: T('Cheap and light: great to get within a few hundred metres.', 'Barato e leve: ótimo para chegar a algumas centenas de metros.', 'Barato y ligero: ideal para llegar a unos cientos de metros.'),
        cons: T('About 50 cm of error: too coarse to hit a docking port.', 'Erro de uns 50 cm: grosseiro demais para acertar um porto de acoplamento.', 'Unos 50 cm de error: demasiado grueso para acertar un puerto de acoplamiento.'),
        navError_cm: 50, mass_kg: 0.1, power_W: 1, duty: 1, volume_U: 0.2, cost_k: 20
      },
      nav_cam: {
        role: 'sensor', maturity: 'cots',
        name: T('Navigation camera', 'Câmera de navegação', 'Cámara de navegación'),
        description: T('Finds the target marks painted around the port and computes the distance, like the cameras on cargo ships.', 'Acha as marcas pintadas em volta do porto e calcula a distância, como as câmeras das naves de carga.', 'Encuentra las marcas pintadas alrededor del puerto y calcula la distancia, como las cámaras de las naves de carga.'),
        pros: T('About 3 cm of error, light and affordable.', 'Erro de uns 3 cm, leve e acessível.', 'Unos 3 cm de error, ligera y asequible.'),
        cons: T('Needs light: in Earth\'s shadow it cannot see the marks.', 'Precisa de luz: na sombra da Terra não enxerga as marcas.', 'Necesita luz: en la sombra de la Tierra no ve las marcas.'),
        navError_cm: 3, needsLight: true, mass_kg: 0.3, power_W: 2, duty: 0.3, volume_U: 0.4, cost_k: 60
      },
      nav_lidar: {
        role: 'sensor', maturity: 'modified',
        name: T('Docking LIDAR', 'LIDAR de acoplamento', 'LIDAR de acoplamiento'),
        description: T('A laser scanner that measures distance with its own light, like the one Dragon uses to dock.', 'Um scanner a laser que mede a distância com luz própria, como o que a Dragon usa para acoplar.', 'Un escáner láser que mide la distancia con luz propia, como el que usa Dragon para acoplarse.'),
        pros: T('About 1 cm of error, day or night.', 'Erro de uns 1 cm, de dia ou de noite.', 'Unos 1 cm de error, de día o de noche.'),
        cons: T('Heavy, power-hungry and expensive.', 'Pesado, gasta energia e é caro.', 'Pesado, gasta energía y es caro.'),
        navError_cm: 1, mass_kg: 0.9, power_W: 8, duty: 0.2, volume_U: 1.0, cost_k: 200
      },

      // ---- Só no modo Difícil (js/data/levels.js): bateria e blindagem
      bat_10: {
        role: 'battery', maturity: 'cots',
        name: T('Small battery (10 Wh)', 'Bateria pequena (10 Wh)', 'Batería pequeña (10 Wh)'),
        description: T('Two lithium-ion cells: 10 Wh.', 'Duas células de íon-lítio: 10 Wh.', 'Dos celdas de ion-litio: 10 Wh.'),
        pros: T('Light and cheap.', 'Leve e barata.', 'Ligera y barata.'),
        cons: T('Drains deeply in the shadow if the satellite uses a lot of power.', 'Descarrega fundo na sombra se o satélite gasta muita energia.', 'Se descarga a fondo en la sombra si el satélite usa mucha energía.'),
        capacity_Wh: 10, mass_kg: 0.1, power_W: 0, volume_U: 0.1, cost_k: 5
      },
      bat_20: {
        role: 'battery', maturity: 'cots',
        name: T('Medium battery (20 Wh)', 'Bateria média (20 Wh)', 'Batería mediana (20 Wh)'),
        description: T('Four lithium-ion cells: 20 Wh.', 'Quatro células de íon-lítio: 20 Wh.', 'Cuatro celdas de ion-litio: 20 Wh.'),
        pros: T('Good balance for a 3U.', 'Bom equilíbrio para um 3U.', 'Buen equilibrio para un 3U.'),
        cons: T('A little more mass and volume.', 'Um pouco mais de massa e volume.', 'Un poco más de masa y volumen.'),
        capacity_Wh: 20, mass_kg: 0.2, power_W: 0, volume_U: 0.2, cost_k: 9
      },
      bat_40: {
        role: 'battery', maturity: 'cots',
        name: T('Large battery (40 Wh)', 'Bateria grande (40 Wh)', 'Batería grande (40 Wh)'),
        description: T('Eight lithium-ion cells: 40 Wh.', 'Oito células de íon-lítio: 40 Wh.', 'Ocho celdas de ion-litio: 40 Wh.'),
        pros: T('Shallow discharge: lasts for years.', 'Descarga rasa: dura anos.', 'Descarga poco profunda: dura años.'),
        cons: T('Heavier and takes space in the box.', 'Mais pesada e ocupa espaço na caixa.', 'Más pesada y ocupa espacio en la caja.'),
        capacity_Wh: 40, mass_kg: 0.4, power_W: 0, volume_U: 0.4, cost_k: 15
      },
      shield_none: {
        role: 'shield', maturity: 'cots',
        name: T('No extra shielding', 'Sem blindagem extra', 'Sin blindaje extra'),
        description: T('Only the aluminium frame protects the electronics.', 'Só a estrutura de alumínio protege a eletrônica.', 'Solo la estructura de aluminio protege la electrónica.'),
        pros: T('No extra mass or cost.', 'Sem massa nem custo extra.', 'Sin masa ni costo extra.'),
        cons: T('Radiation can corrupt data in memory.', 'A radiação pode estragar dados na memória.', 'La radiación puede dañar datos en la memoria.'),
        mass_kg: 0, power_W: 0, volume_U: 0, cost_k: 0
      },
      shield_ta: {
        role: 'shield', maturity: 'cots',
        name: T('Tantalum spot shield', 'Blindagem de tântalo', 'Blindaje de tantalio'),
        description: T('A thin tantalum plate over the computer and memory.', 'Uma placa fina de tântalo sobre o computador e a memória.', 'Una placa fina de tantalio sobre la computadora y la memoria.'),
        pros: T('Protects the data from most particles.', 'Protege os dados da maioria das partículas.', 'Protege los datos de la mayoría de las partículas.'),
        cons: T('Dense metal: adds mass and cost.', 'Metal denso: soma massa e custo.', 'Metal denso: suma masa y costo.'),
        mass_kg: 0.15, power_W: 0, volume_U: 0.1, cost_k: 18
      }
    }
  };
})(globalThis);
