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

  var DURATIONS = { launch: 9, separation: 4, default: 4.5 };
  // Efeitos visuais que o 3D sabe desenhar (campo "fx" dos eventos nos dados).
  var FX = ['launch', 'separation', 'power', 'contact', 'image', 'coverage', 'end',
            'delay', 'storm', 'glitch', 'wobble', 'debris', 'stationDown'];

  function build(result) {
    var events = (result.mission.events || []).filter(function (e) {
      return e.status !== 'skipped' && e.status !== 'pending';
    });
    var t = 0, steps = [];
    events.forEach(function (e) {
      var d = DURATIONS[e.fx] || DURATIONS.default;
      steps.push({ event: e, t0: t, t1: t + d });
      t += d;
    });
    var launch = steps.filter(function (s) { return s.event.fx === 'launch'; })[0];
    return {
      steps: steps,
      duration: t,
      orbitStart: launch ? launch.t1 : 0,
      aborted: result.mission.aborted || null,
      launchFailed: !!(launch && launch.event.status === 'fail')
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
