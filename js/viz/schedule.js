/* =====================================================================
 * viz/schedule.js — ROTEIRO DA ANIMAÇÃO (puro, sem Three.js, testável)
 *
 *   MS.vizSchedule.build(result) → { steps: [{ event, t0, t1 }], duration,
 *                                     orbitStart, aborted, launchFailed }
 *   MS.vizSchedule.at(schedule, t) → passo atual (ou null)
 *
 * Transforma a linha do tempo do motor (result.mission.events) em tempos
 * de animação em segundos. Durações por efeito em DURATIONS.
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  // Segundos de animação a 1× (o botão de tempo acelera para 5× ou 20×).
  var DURATIONS = { launch: 20, separation: 6, docking: 16, default: 7, lunarLaunch: 40 };
  // Efeitos visuais que o 3D sabe desenhar (campo "fx" dos eventos nos dados).
  var FX = ['launch', 'separation', 'power', 'contact', 'image', 'coverage', 'end',
            'delay', 'storm', 'glitch', 'wobble', 'debris', 'stationDown'];

  function build(result) {
    var events = (result.mission.events || []).filter(function (e) {
      return e.status !== 'skipped' && e.status !== 'pending';
    });
    // Lançador de carga para a estação: a separação vira encontro + acoplamento com a ISS.
    var L = result.selection && result.selection.launcher;
    var docking = !!(L && MS.looks && MS.looks.resolve('launchers', L).upper === 'capsule');
    // Missões lunares: o "lançamento" inclui a viagem Terra → Lua (subida, injeção translunar, cruzeiro, freada).
    var O = result.selection && result.selection.orbit, lunar = !!(O && O.body === 'moon');
    var t = 0, steps = [];
    events.forEach(function (e) {
      var d = (docking && e.fx === 'separation') ? DURATIONS.docking : (lunar && e.fx === 'launch') ? DURATIONS.lunarLaunch : (DURATIONS[e.fx] || DURATIONS.default);
      steps.push({ event: e, t0: t, t1: t + d });
      t += d;
    });
    var launch = steps.filter(function (s) { return s.event.fx === 'launch'; })[0];
    return {
      steps: steps,
      duration: t,
      orbitStart: launch ? launch.t1 : 0,
      aborted: result.mission.aborted || null,
      launchFailed: !!(launch && launch.event.status === 'fail'),
      docking: docking,
      lunar: lunar
    };
  }

  function at(schedule, t) {
    for (var i = 0; i < schedule.steps.length; i++) {
      var s = schedule.steps[i];
      if (t >= s.t0 && t < s.t1) return s;
    }
    return null;
  }

  // Primeiro passo (já iniciado até t) com um certo efeito, ou null.
  function firstStarted(schedule, fx, t) {
    for (var i = 0; i < schedule.steps.length; i++) {
      var s = schedule.steps[i];
      if (s.event.fx === fx && t >= s.t0) return s;
    }
    return null;
  }

  MS.vizSchedule = { build: build, at: at, firstStarted: firstStarted, DURATIONS: DURATIONS, FX: FX };
})(globalThis);
