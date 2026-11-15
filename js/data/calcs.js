/* =====================================================================
 * DESAFIOS DE CÁLCULO — "Calcule você mesmo" (só no modo Difícil)
 *
 * O jogador desenvolve a equação com os números do PRÓPRIO projeto e
 * confere a resposta (tolerância de 3%). Cada desafio:
 *   phase     fase em que aparece
 *   title     nome · formula: a equação (texto)
 *   given(m)  dados do problema a partir de result.metrics (null = ainda
 *             falta escolher algo); cada item: [símbolo, valor, unidade, descrição]
 *   answer(m) resposta certa (o mesmo número que o motor calcula)
 *   unit      unidade da resposta · steps: resolução passo a passo
 *             ({chave} = valor de given/answer formatado)
 * Tela: js/ui/calcs.js. Constantes iguais às de js/sim.js.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var T = MS.i18n.T;
  MS.data = MS.data || {};

  var R = 6371, MU = 398600.4418; // raio da Terra (km) e GM da Terra (km³/s²)
  var BODY = { earth: { R: 6371, mu: 398600.4418 }, moon: { R: 1737.4, mu: 4902.8 } };
  function bodyOf(sel) { return BODY[(sel && sel.orbit && sel.orbit.body) || 'earth'] || BODY.earth; }
  function v(m, k) { var x = m[k]; return x && typeof x.value === 'number' && isFinite(x.value) ? x.value : null; }
  function all() { for (var i = 0; i < arguments.length; i++) if (arguments[i] == null) return false; return true; }

  MS.data.calcs = [
    { id: 'period', phase: 'concept', unit: 'min', decimals: 1,
      title: T('Orbital period', 'Período da órbita', 'Período de la órbita'),
      formula: 'T = 2π · √(a³ ÷ μ)   ·   a = R⊕ + h',
      why: T('Kepler’s third law: the higher the orbit, the longer one lap takes.', 'Terceira lei de Kepler: quanto mais alta a órbita, mais demora uma volta.', 'Tercera ley de Kepler: cuanto más alta la órbita, más tarda una vuelta.'),
      given: function (m, sel) {
        var h = v(m, 'altitude_km'), B = bodyOf(sel), moon = B !== BODY.earth;
        return h == null || v(m, 'period_min') == null ? null : { h: [h, 'km', T('altitude', 'altitude', 'altitud')],
          R: [B.R, 'km', moon ? T('Moon radius', 'raio da Lua', 'radio de la Luna') : T('Earth radius', 'raio da Terra', 'radio de la Tierra')],
          mu: [B.mu, 'km³/s²', moon ? T('Moon’s gravity (GM)', 'gravidade da Lua (GM)', 'gravedad de la Luna (GM)') : T('Earth’s gravity (GM)', 'gravidade da Terra (GM)', 'gravedad de la Tierra (GM)')] };
      },
      answer: function (m) { return v(m, 'period_min'); },
      work: function (m, sel) { var B = bodyOf(sel), a = B.R + v(m, 'altitude_km'), s = Math.sqrt(a * a * a / B.mu); return { a: a, a3: a * a * a, s: s, Ts: 2 * Math.PI * s }; },
      steps: [
        T('a = R⊕ + h = {R} + {h} = {a} km', 'a = R⊕ + h = {R} + {h} = {a} km', 'a = R⊕ + h = {R} + {h} = {a} km'),
        T('a³ ÷ μ = {a3} ÷ {mu} → √ = {s} s', 'a³ ÷ μ = {a3} ÷ {mu} → √ = {s} s', 'a³ ÷ μ = {a3} ÷ {mu} → √ = {s} s'),
        T('T = 2π × {s} = {Ts} s = {answer} min (divide by 60)', 'T = 2π × {s} = {Ts} s = {answer} min (divida por 60)', 'T = 2π × {s} = {Ts} s = {answer} min (divide entre 60)')
      ] },

    { id: 'laps', phase: 'concept', unit: '', decimals: 1,
      title: T('Laps per day', 'Voltas por dia', 'Vueltas por día'),
      formula: 'n = 1440 ÷ T',
      why: T('A day has 1440 minutes. More laps = more chances to photograph and to talk to the station.', 'Um dia tem 1440 minutos. Mais voltas = mais chances de fotografar e de falar com a estação.', 'Un día tiene 1440 minutos. Más vueltas = más oportunidades de fotografiar y de hablar con la estación.'),
      given: function (m) { var p = v(m, 'period_min'); return p == null ? null : { T: [p, 'min', T('period', 'período', 'período')] }; },
      answer: function (m) { return v(m, 'orbitsPerDay'); },
      steps: [T('n = 1440 ÷ {T} = {answer} laps', 'n = 1440 ÷ {T} = {answer} voltas', 'n = 1440 ÷ {T} = {answer} vueltas')] },

    { id: 'shadow', phase: 'concept', unit: 'min', decimals: 1,
      title: T('Minutes in Earth’s shadow', 'Minutos na sombra da Terra', 'Minutos en la sombra de la Tierra'),
      formula: 't = f × T',
      why: T('In the shadow the panels make nothing: the battery must hold the satellite for this long, every lap.', 'Na sombra os painéis não geram nada: a bateria precisa segurar o satélite por esse tempo, a cada volta.', 'En la sombra los paneles no generan nada: la batería debe sostener el satélite ese tiempo, cada vuelta.'),
      given: function (m) {
        var p = v(m, 'period_min'), e = v(m, 'eclipse_pct');
        return all(p, e) ? { f: [e / 100, '', T('fraction of the lap in shadow', 'fração da volta na sombra', 'fracción de la vuelta en sombra')], T: [p, 'min', T('period', 'período', 'período')] } : null;
      },
      answer: function (m) { var p = v(m, 'period_min'), e = v(m, 'eclipse_pct'); return all(p, e) ? p * e / 100 : null; },
      steps: [T('t = {f} × {T} = {answer} min', 't = {f} × {T} = {answer} min', 't = {f} × {T} = {answer} min')] },

    { id: 'gsd', phase: 'design', unit: 'm', decimals: 1,
      title: T('Image detail (GSD)', 'Detalhe da imagem (GSD)', 'Detalle de la imagen (GSD)'),
      formula: 'GSD = h × p ÷ f',
      why: T('Similar triangles: each camera pixel sees a square of GSD × GSD metres on the ground.', 'Semelhança de triângulos: cada pixel da câmera enxerga um quadrado de GSD × GSD metros no chão.', 'Triángulos semejantes: cada píxel de la cámara ve un cuadrado de GSD × GSD metros en el suelo.'),
      given: function (m, sel) {
        var h = v(m, 'altitude_km'), cam = sel && sel.payload;
        return h != null && cam ? { h: [h * 1000, 'm', T('altitude', 'altitude', 'altitud')], p: [cam.pixel_um * 1e-6, 'm', T('pixel size', 'tamanho do pixel', 'tamaño del píxel')], f: [cam.focal_mm * 1e-3, 'm', T('focal length', 'distância focal', 'distancia focal')] } : null;
      },
      answer: function (m) { return v(m, 'gsd_m'); },
      steps: [T('GSD = {h} × {p} ÷ {f} = {answer} m', 'GSD = {h} × {p} ÷ {f} = {answer} m', 'GSD = {h} × {p} ÷ {f} = {answer} m')] },

    { id: 'massMargin', phase: 'design', unit: '%', decimals: 1,
      title: T('Mass margin', 'Folga de massa', 'Margen de masa'),
      formula: 'folga = (L − M) ÷ L × 100',
      why: T('Engineers keep about 10% spare mass: parts always end up heavier than planned.', 'Engenheiros deixam uns 10% de massa sobrando: as peças sempre acabam mais pesadas que o planejado.', 'Los ingenieros dejan un 10% de masa de sobra: las piezas siempre terminan más pesadas de lo planeado.'),
      given: function (m) {
        var M = v(m, 'mass_kg'), Lm = v(m, 'massLimit_kg');
        return all(M, Lm) && !m.mass_kg.partial ? { L: [Lm, 'kg', T('launcher limit', 'limite do lançador', 'límite del lanzador')], M: [M, 'kg', T('satellite mass (with contingency)', 'massa do satélite (com contingência)', 'masa del satélite (con contingencia)')] } : null;
      },
      answer: function (m) { var M = v(m, 'mass_kg'), Lm = v(m, 'massLimit_kg'); return all(M, Lm) && Lm > 0 ? (Lm - M) / Lm * 100 : null; },
      steps: [T('({L} − {M}) ÷ {L} × 100 = {answer} %', '({L} − {M}) ÷ {L} × 100 = {answer} %', '({L} − {M}) ÷ {L} × 100 = {answer} %')] },

    { id: 'powerMargin', phase: 'design', unit: '%', decimals: 1,
      title: T('Power margin', 'Folga de energia', 'Margen de energía'),
      formula: 'folga = (G − C) ÷ G × 100',
      why: T('Panels lose power as they age and in solar storms: keep 20% or more spare.', 'Os painéis perdem força com o tempo e nas tempestades solares: deixe 20% ou mais sobrando.', 'Los paneles pierden fuerza con el tiempo y en tormentas solares: deja 20% o más de sobra.'),
      given: function (m) {
        var G = v(m, 'powerGen_W'), C = v(m, 'powerUse_W');
        return all(G, C) && !m.powerUse_W.partial ? { G: [G, 'W', T('average power generated', 'energia média gerada', 'energía media generada')], C: [C, 'W', T('average use', 'consumo médio', 'consumo medio')] } : null;
      },
      answer: function (m) { var G = v(m, 'powerGen_W'), C = v(m, 'powerUse_W'); return all(G, C) && G > 0 ? (G - C) / G * 100 : null; },
      steps: [T('({G} − {C}) ÷ {G} × 100 = {answer} %', '({G} − {C}) ÷ {G} × 100 = {answer} %', '({G} − {C}) ÷ {G} × 100 = {answer} %')] },

    { id: 'battery', phase: 'design', unit: 'Wh', decimals: 1,
      title: T('Battery for the shadow', 'Bateria para a sombra', 'Batería para la sombra'),
      formula: 'E = C × t ÷ DoD',
      why: T('Energy = power × time. Dividing by the safe depth of discharge (30%) keeps the battery alive for years.', 'Energia = potência × tempo. Dividir pela descarga segura (30%) faz a bateria durar anos.', 'Energía = potencia × tiempo. Dividir por la descarga segura (30%) hace que la batería dure años.'),
      given: function (m) {
        var C = v(m, 'powerUse_W'), p = v(m, 'period_min'), e = v(m, 'eclipse_pct');
        return all(C, p, e, v(m, 'batteryNeed_Wh')) && !m.powerUse_W.partial ? { C: [C, 'W', T('average use', 'consumo médio', 'consumo medio')], t: [p * e / 100 / 60, 'h', T('time in shadow', 'tempo na sombra', 'tiempo en sombra')], DoD: [0.3, '', T('safe depth of discharge', 'descarga segura', 'descarga segura')] } : null;
      },
      answer: function (m) { return v(m, 'batteryNeed_Wh'); },
      steps: [T('E = {C} × {t} ÷ {DoD} = {answer} Wh', 'E = {C} × {t} ÷ {DoD} = {answer} Wh', 'E = {C} × {t} ÷ {DoD} = {answer} Wh')] }
  ];
})(globalThis);
