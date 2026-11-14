/* Testes da aparência 3D das peças (js/viz/looks.js) e do mapa da Terra
 * (js/viz/earth.js + js/data/earthmask.js, gerado da imagem do nasa/mission-viz). */
(function (root) {
  'use strict';
  var T = root.T, MS = root.MS, test = T.test, assert = T.assert;
  var cat = MS.data.catalog, looks = MS.looks;
  function look(source, id) { return looks.resolve(source, cat[source][id]); }

  T.group('Peças 3D (aparência)');

  test('toda opção dos 3 clientes tem um modelo 3D conhecido', function () {
    Object.keys(MS.data.scenarios).forEach(function (sid) {
      looks.forScenario(MS.data.scenarios[sid], cat).forEach(function (o) {
        assert(o.look && looks.KINDS.indexOf(o.look.kind) !== -1, sid + ' / ' + o.slot + ' / ' + o.id + ': tipo ' + (o.look && o.look.kind));
      });
    });
  });

  test('câmeras: a lente segue a distância focal; 580 mm vira telescópio', function () {
    assert.equal(look('components', 'cam_wide').telescope, false);
    assert.equal(look('components', 'cam_hr').telescope, true);
    assert(look('components', 'cam_mid').focal_mm > look('components', 'cam_wide').focal_mm);
  });

  test('energia, atitude, rádio e computador seguem os dados', function () {
    assert.equal(look('components', 'eps_body').wings, false, 'painéis no corpo');
    assert.equal(look('components', 'eps_deploy').wings, true, 'asas abertas');
    assert.equal(look('components', 'adcs_mag').wheels, false);
    assert.equal(look('components', 'adcs_wheels').wheels, true);
    assert.equal(look('components', 'com_uhf').band, 'UHF');
    assert.equal(look('components', 'obc_adv').boards, 2);
    assert.equal(look('components', 'struct_6u').units, 6);
  });

  test('lançadores, órbitas e estações', function () {
    assert.equal(look('launchers', 'rideshare_tug').tug, true, 'rebocador (campo look do catálogo)');
    assert.equal(look('launchers', 'iss_cargo').upper, 'capsule');
    assert.equal(look('launchers', 'rideshare_sso').upper, 'fairing');
    assert.equal(look('orbits', 'iss400').station, true, 'órbita da ISS mostra a estação');
    assert.equal(look('orbits', 'sso500').station, false);
    assert.equal(look('groundStations', 'gs_polar').snow, true);
    assert(look('groundStations', 'gs_polar').dish_m > look('groundStations', 'gs_national').dish_m, 'banda X pede prato maior');
  });

  test('o campo look do catálogo sobrescreve a aparência', function () {
    var it = Object.assign({}, cat.components.cam_wide, { look: { telescope: true } });
    assert.equal(looks.resolve('components', it).telescope, true);
  });

  T.group('Mapa da Terra (NASA mission-viz)');

  test('lugares conhecidos caem na classe certa', function () {
    var E = MS.earth;
    assert(E.available(), 'mapa carregado');
    assert.equal(E.classAt(0, -30), E.OCEAN, 'Atlântico');
    assert.equal(E.classAt(-5, -60), E.GREEN, 'Amazônia');
    assert.equal(E.classAt(23, 10), E.ARID, 'Saara');
    assert.equal(E.classAt(72, -40), E.ICE, 'Groenlândia');
    assert.equal(E.classAt(-85, 0), E.ICE, 'Antártida');
  });

  test('a área de cada cliente e as estações em solo estão em terra firme', function () {
    var E = MS.earth;
    Object.keys(MS.data.scenarios).forEach(function (sid) {
      var a = MS.data.scenarios[sid].aoi;
      assert(E.classAt(a.latitude_deg, a.longitude_deg || 0) !== E.OCEAN, sid + ': área no oceano');
    });
    Object.keys(cat.groundStations).forEach(function (id) {
      var g = cat.groundStations[id];
      assert(E.classAt(g.latitude_deg, g.longitude_deg) !== E.OCEAN, id + ': estação no oceano');
    });
  });
})(globalThis);
