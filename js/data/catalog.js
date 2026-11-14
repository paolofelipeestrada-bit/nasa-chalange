/* =====================================================================
 * CATÁLOGO — tudo o que pode ser escolhido, em qualquer cenário.
 *
 * Como acrescentar um item:
 *   1. Copie um item parecido da mesma seção, troque o id e os números.
 *   2. Ponha o id na lista "options" do slot certo em scenarios.js.
 *   3. Abra tests.html: o teste de validação aponta campos faltando.
 *
 * Valores que dependem do tamanho do satélite podem ser escritos por
 * formato: { '3U': 0.8, '6U': 1.3 }. O motor usa o formato da estrutura
 * escolhida.
 *
 * Unidades: massa kg · potência W · volume U (1U = 10×10×10 cm) ·
 * custo k$ (milhares de dólares) · taxa kbps · memória GB.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  MS.data = MS.data || {};

  MS.data.catalog = {

    // Maturidade → contingência (reserva) aplicada na MEL sobre massa e
    // potência. Quanto menos testado o item, maior a reserva.
    maturity: {
      cots:     { label: 'Comercial (COTS)',     contingency: 0.05 },
      modified: { label: 'Adaptado',             contingency: 0.10 },
      new:      { label: 'Desenvolvimento novo', contingency: 0.20 }
    },

    // ------------------------------------------------------------ Órbitas
    // lightingFactor: fração das passagens diurnas com boa iluminação.
    // lifetime_years: tempo até o arrasto derrubar um CubeSat.
    orbits: {
      sso500: {
        name: 'Heliossíncrona 500 km',
        description: 'Passa sempre no mesmo horário solar (~10h30): iluminação constante, ideal para imagens. Cobre o planeta todo.',
        altitude_km: 500, inclination_deg: 97.4, lightingFactor: 1.0, lifetime_years: 5
      },
      iss400: {
        name: 'Órbita da ISS 400 km',
        description: 'Inclinação de 51,6°. O horário de passagem muda a cada dia e o arrasto é bem maior.',
        altitude_km: 400, inclination_deg: 51.6, lightingFactor: 0.6, lifetime_years: 0.8
      }
    },

    // --------------------------------------------------------- Lançadores
    // orbits: órbitas que o lançador alcança. site: base (usada no 3D).
    // maxMass_kg e cost_k por formato; formato ausente = não aceito.
    launchers: {
      rideshare_sso: {
        name: 'Carona para SSO (rideshare)',
        description: 'Vai com dezenas de outros satélites num foguete que segue para a órbita heliossíncrona.',
        site: { name: 'Vandenberg (EUA)', latitude_deg: 34.7, longitude_deg: -120.6 },
        orbits: ['sso500'], maxMass_kg: { '3U': 4.0, '6U': 8.0 }, cost_k: { '3U': 170, '6U': 300 }
      },
      iss_cargo: {
        name: 'Carga para a ISS',
        description: 'Sobe numa nave de carga e é ejetado da estação espacial. Só alcança a órbita da ISS.',
        site: { name: 'Cabo Canaveral (EUA)', latitude_deg: 28.5, longitude_deg: -80.6 },
        orbits: ['iss400'], maxMass_kg: { '3U': 4.0, '6U': 8.0 }, cost_k: { '3U': 110, '6U': 190 }
      }
    },

    // --------------------------------------------------- Estações em solo
    groundStations: {
      gs_polar: {
        name: 'Estação polar (78° N)',
        description: 'Antena alugada perto do Polo Norte: vê quase todas as órbitas polares. Contrato de 1 ano.',
        latitude_deg: 78, longitude_deg: 15.4, minElevation_deg: 10, bands: ['UHF', 'S', 'X'], cost_k: 110
      },
      gs_national: {
        name: 'Estação nacional (15° S)',
        description: 'Antena própria no Brasil Central: barata, mas vê poucas passagens por dia.',
        latitude_deg: -15, longitude_deg: -56, minElevation_deg: 10, bands: ['UHF', 'S'], cost_k: 25
      }
    },

    // ------------------------------------------- Componentes do satélite
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
        role: 'payload', name: 'Câmera grande-angular', maturity: 'cots',
        description: 'Lente de 50 mm e 2.048 pixels por linha. Leve, barata e de faixa larga.',
        mass_kg: 0.35, power_W: 2.0, duty: 0.2, volume_U: 0.5, cost_k: 35,
        pixel_um: 5.5, focal_mm: 50, pixelsAcross: 2048, bands: 4, bitDepth: 10, requiredPointing_deg: 10
      },
      cam_mid: {
        role: 'payload', name: 'Câmera multiespectral média', maturity: 'modified',
        description: 'Lente de 110 mm, 4.096 pixels por linha e 4 bandas. Precisa de apontamento estável.',
        mass_kg: 0.9, power_W: 4.0, duty: 0.2, volume_U: 1.2, cost_k: 140,
        pixel_um: 5.5, focal_mm: 110, pixelsAcross: 4096, bands: 4, bitDepth: 10, requiredPointing_deg: 1.0
      },
      cam_hr: {
        role: 'payload', name: 'Telescópio de alta resolução', maturity: 'new',
        description: 'Telescópio de 580 mm: imagens muito detalhadas, mas faixa estreita e muitos dados.',
        mass_kg: 2.0, power_W: 7.0, duty: 0.2, volume_U: 2.5, cost_k: 320,
        pixel_um: 3.45, focal_mm: 580, pixelsAcross: 4096, bands: 4, bitDepth: 12, requiredPointing_deg: 0.1
      },

      // Estrutura
      struct_3u: {
        role: 'structure', name: 'Estrutura 3U', maturity: 'cots',
        description: '10 × 10 × 34 cm. Barata e fácil de lançar.',
        formFactor: '3U', capacity_U: 2.8, mass_kg: 0.4, power_W: 0, volume_U: 0, cost_k: 15
      },
      struct_6u: {
        role: 'structure', name: 'Estrutura 6U', maturity: 'cots',
        description: '10 × 22 × 34 cm. O dobro de espaço, mas o lançamento custa mais.',
        formFactor: '6U', capacity_U: 5.6, mass_kg: 1.0, power_W: 0, volume_U: 0, cost_k: 35
      },

      // Energia (painéis + bateria + eletrônica)
      eps_body: {
        role: 'power', name: 'Painéis fixos no corpo', maturity: 'cots',
        description: 'Células solares nas faces do satélite + bateria. Simples, sem partes móveis.',
        solarPower_W: { '3U': 7, '6U': 14 },
        mass_kg: { '3U': 0.45, '6U': 0.7 }, power_W: 0.2, duty: 1, volume_U: 0.3, cost_k: { '3U': 25, '6U': 40 }
      },
      eps_deploy: {
        role: 'power', name: 'Painéis abertos (asas)', maturity: 'cots',
        description: 'Painéis que se abrem em órbita: quase 3× mais energia, porém mais caros.',
        solarPower_W: { '3U': 20, '6U': 40 },
        mass_kg: { '3U': 0.8, '6U': 1.3 }, power_W: 0.3, duty: 1, volume_U: 0.4, cost_k: { '3U': 55, '6U': 85 }
      },

      // Controle de atitude (ADCS)
      adcs_mag: {
        role: 'adcs', name: 'Magnetorques', maturity: 'cots',
        description: 'Bobinas que usam o campo magnético da Terra. Aponta com ~5° de precisão.',
        accuracy_deg: 5, mass_kg: 0.2, power_W: 0.4, duty: 1, volume_U: 0.2, cost_k: 20
      },
      adcs_wheels: {
        role: 'adcs', name: 'Rodas de reação + rastreador de estrelas', maturity: 'cots',
        description: 'Controle em 3 eixos com precisão de 0,05°. Caro e consome mais energia.',
        accuracy_deg: 0.05, mass_kg: 0.7, power_W: 2.0, duty: 1, volume_U: 0.6, cost_k: 110
      },

      // Comunicação
      com_uhf: {
        role: 'comms', name: 'Rádio UHF', maturity: 'cots',
        description: '9,6 kbps. Barato e confiável, ótimo para telemetria.',
        band: 'UHF', dataRate_kbps: 9.6, mass_kg: 0.1, power_W: 1.5, duty: 0.2, volume_U: 0.2, cost_k: 8
      },
      com_sband: {
        role: 'comms', name: 'Transmissor banda S', maturity: 'cots',
        description: '5 Mbps. Envia imagens, mas consome bastante energia quando transmite.',
        band: 'S', dataRate_kbps: 5000, mass_kg: 0.25, power_W: 10, duty: 0.08, volume_U: 0.3, cost_k: 55
      },

      // Computador de bordo (OBC)
      obc_basic: {
        role: 'obc', name: 'Computador básico', maturity: 'cots',
        description: '4 GB de memória e compressão sem perdas 2:1.',
        storage_GB: 4, compressionRatio: 2, mass_kg: 0.1, power_W: 0.4, duty: 1, volume_U: 0.2, cost_k: 15
      },
      obc_adv: {
        role: 'obc', name: 'Computador com processamento de imagem', maturity: 'cots',
        description: '64 GB de memória e compressão 4:1 a bordo. Mais caro e consome mais.',
        storage_GB: 64, compressionRatio: 4, mass_kg: 0.2, power_W: 1.2, duty: 1, volume_U: 0.3, cost_k: 40
      }
    }
  };
})(globalThis);
