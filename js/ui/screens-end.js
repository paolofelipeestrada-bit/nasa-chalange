/* Telas: Build & Verify, Implement, Mission Report. */
(function (root) {
  'use strict';
  var MS = root.MS, ui = MS.ui, h = ui.h, U = MS.sim.util;
  var t = MS.i18n.t, L = MS.i18n.L;

  function count(list, status) { return list.filter(function (x) { return x.status === status; }).length; }
  function riskText(status) { return t({ ok: 'risk.protected', warn: 'risk.exposed', na: 'risk.na' }[status] || 'st.' + status); }

  // Registro de riscos: o que pode dar errado e se o projeto aguenta.
  function riskCard(result) {
    if (!result.risks.length) return '';
    var rows = result.risks.map(function (r) {
      return '<li><div class="row-head"><strong>' + h.esc(r.title) + '</strong>' + h.badge(r.status, riskText(r.status)) + '</div>' +
        '<div class="small">' + h.esc(r.description) + '</div>' +
        (r.applies ? '<div class="small muted">' + h.esc(t('risk.chance', { pct: U.pct(r.chance), impact: r.impact })) + '</div>' : '') +
        h.explain(r.explanation, t('ui.why')) + '</li>';
    }).join('');
    var exposed = count(result.risks, 'warn');
    return '<div class="card"><h2>' + h.term('risk', t('risk.title')) + '</h2><p class="small muted">' + h.esc(t('risk.note')) + ' ' +
      h.esc(exposed ? t('risk.exposedN', { n: exposed }) : t('risk.noneExposed')) + '</p>' +
      '<ul class="rows">' + rows + '</ul></div>';
  }

  // Voto da equipe: cada conselheiro vota pela própria meta (MS.advice).
  function goNoGo(state, result, title) {
    var list = MS.advice.crew(state, result), tl = MS.advice.tally(list);
    var line = tl.open ? t('gonogo.open') : tl.unanimous ? t('gonogo.all') : t('gonogo.some', { nogo: tl.nogo, n: list.length });
    var st = tl.open ? 'pending' : tl.unanimous ? 'ok' : 'warn';
    return '<div class="ck-panel gonogo"><div class="ck-head"><h2>' + h.icon('team', { size: 16 }) + h.esc(title || t('gonogo.title')) + '</h2>' +
      '<span class="gng-count">' + h.icon('ok', { size: 14, stroke: 3 }) + tl.go + ' · ' + h.icon('fail', { size: 14, stroke: 2.6 }) + tl.nogo + '</span></div>' +
      (title ? '' : '<p class="section-note">' + h.esc(t('gonogo.note')) + '</p>') +
      '<div class="alert s-' + st + '">' + h.stateTag(st, line) + '</div>' + h.crewList(list, { votes: true }) + '</div>';
  }

  // "Prever antes de lançar": o palpite fica no state e volta no relatório.
  function predictPanel(state, lock) {
    var opts = MS.store.PREDICTIONS.map(function (id) {
      var on = state.prediction === id;
      return '<button type="button" class="pred-opt' + (on ? ' on' : '') + '" data-action="predict" data-id="' + id + '" aria-pressed="' + on + '"' + (lock ? ' disabled' : '') + '>' +
        (on ? h.icon('ok', { size: 16, stroke: 3 }) : '') + h.esc(t('pred.' + id)) + '</button>';
    }).join('');
    return '<div class="ck-panel predict"><div class="ck-head"><h2>' + h.icon('eye', { size: 16 }) + h.esc(t('pred.title')) + '</h2></div>' +
      '<p class="pred-q">' + h.esc(t('pred.q')) + '</p><div class="pred-opts" role="group" aria-label="' + h.esc(t('pred.title')) + '">' + opts + '</div>' +
      '<p class="section-note">' + h.esc(t('pred.note')) + '</p></div>';
  }

  // ------------------------------------------------- GO da equipe (sala)
  // Em equipe, o lançamento só sai quando TODOS dizem GO para este projeto
  // (usa o "Todos prontos?" de js/net/room.js; mudou o projeto, vota de novo).
  var ROLE_CHAR = { payload: 'sci', bus: 'eng', ground: 'com', manager: 'mgr' };
  function charOf(m) { var r = (m.roles || [])[0]; return ROLE_CHAR[r] || 'dir'; }
  ui.teamGo = function (state) {
    var inf = MS.net && MS.net.active() ? MS.net.info() : null;
    if (!inf || (inf.members || []).length < 2) return { need: false };
    var rd = inf.ready, valid = !!(rd && rd.phase === state.phase && rd.key === MS.net.readyKey(state));
    var ans = valid ? rd.answers || {} : {};
    var yes = inf.members.filter(function (m) { return ans[m.id] === true; }).length;
    var no = inf.members.filter(function (m) { return ans[m.id] === false; }).length;
    return { need: true, asked: valid, yes: yes, no: no, total: inf.members.length, all: yes === inf.members.length, answers: ans, members: inf.members, me: inf.me };
  };
  ui.teamGo.charOf = charOf;
  function goPanel(state) {
    var g = ui.teamGo(state);
    if (!g.need) return '';
    var seats = g.members.map(function (m) {
      var a = g.answers[m.id], cls = a === true ? 'go' : a === false ? 'nogo' : 'wait';
      return '<li class="gp-seat gp-' + cls + (m.id === g.me ? ' me' : '') + '">' + h.character(charOf(m), 72, { anim: true }) +
        '<b>' + h.esc(m.name) + '</b><span class="gp-st pixel">' + h.esc(a === true ? t('ck.go') : a === false ? t('go.no') : t('go.waitOne')) + '</span></li>';
    }).join('');
    var mine = g.answers[g.me];
    var btns = !g.asked
      ? '<button type="button" class="btn primary big-go" data-action="next">' + h.icon('rocket', { size: 18 }) + h.esc(t('go.ask')) + '</button>'
      : '<button type="button" class="btn big-go go-yes' + (mine === true ? ' on' : '') + '" data-action="ready-yes">' + h.esc(t('go.yes')) + '</button>' +
        '<button type="button" class="btn big-go go-no' + (mine === false ? ' on' : '') + '" data-action="ready-no">' + h.esc(t('go.no')) + '</button>' +
        (g.no ? '<button type="button" class="btn big-go" data-action="next">' + h.esc(t('go.again')) + '</button>' : '');
    var line = !g.asked ? t('go.notAsked') : g.all ? t('go.all') : g.no ? t('go.someNo', { n: g.no }) : t('go.wait', { n: g.yes, total: g.total });
    return '<section class="go-panel' + (g.all ? ' all' : '') + '" aria-live="polite"><div class="gp-head"><h2>' + h.icon('team', { size: 18 }) + h.esc(t('go.title')) + '</h2>' +
      '<span class="gp-count pixel">' + g.yes + ' / ' + g.total + '</span></div><p class="section-note">' + h.esc(t('go.note')) + '</p>' +
      '<ul class="gp-seats">' + seats + '</ul><p class="gp-line">' + h.esc(line) + '</p><div class="gp-btns">' + btns + '</div></section>';
  }

  // ------------------------------------------------------ Build & Verify
  ui.register('build', {
    nextLabel: 'scr.build.next',
    nextClass: 'launch',
    render: function (state, result) {
      var v = result.verification, fails = count(v, 'fail'), warns = count(v, 'warn');
      var alert = fails
        ? '<div class="alert s-fail"><strong>' + h.esc(t('build.fails', { n: fails })) + '</strong> ' + h.esc(t('build.failsNote')) + '</div>'
        : warns
          ? '<div class="alert s-warn"><strong>' + h.esc(t('build.warnsHead')) + '</strong> ' + h.esc(t('build.warns', { n: warns })) + '</div>'
          : '<div class="alert s-ok"><strong>' + h.esc(t('build.allOk')) + '</strong> ' + h.esc(t('build.allOkNote')) + '</div>';
      var rows = v.map(function (x) {
        var items = x.items.map(function (it) {
          return '<li><div class="row-head"><span class="small">' + h.esc(it.label) + '</span>' + h.badge(it.status) + '</div>' +
            h.explain(it.explanation, t('build.result')) + '</li>';
        }).join('');
        return '<div class="card"><div class="row-head"><h3>' + h.esc(x.id + ' · ' + x.title) + '</h3>' + h.badge(x.status) + '</div>' +
          '<p class="small muted">' + h.esc(t('build.method', { m: x.method })) + ' — ' + h.esc(x.description) + '</p>' +
          '<ul class="rows">' + items + '</ul></div>';
      }).join('');
      var lock = ui.phaseLock ? ui.phaseLock(state) : null;
      var hasLife = !!(MS.life && MS.data.spaceWeather);
      var checks = alert + '<details class="fold"' + (fails ? ' open' : '') + '><summary>' + h.esc(t('build.seeChecks', { n: v.length, f: fails })) + '</summary>' +
        '<div class="verif-grid">' + rows + '</div></details>' +
        (result.risks.length ? '<details class="fold"><summary>' + h.esc(t('build.seeRisks', { n: count(result.risks, 'warn') })) + '</summary>' + riskCard(result) + '</details>' : '');
      var parts = {
        check: '<div class="sc-check">' + checks + goNoGo(state, result) + '</div>',
        predict: predictPanel(state, !!lock),
        window: hasLife ? '<div class="launch-window">' + ui.life.periodPicker(state, !!lock) + '</div>' : '',
        go: goPanel(state), fails: fails
      };
      if (this && this.parts) return parts; // modo cena (js/ui/scene.js) monta uma parte por cena
      return parts.go + '<div class="launch-deck">' + goNoGo(state, result) + '<div>' + parts.predict + parts.window + '</div></div>' + checks;
    }
  });
  // As partes da Construção, para o modo cena (checar → palpite → data → lançar).
  var buildRender = ui.screens.build.render; // o original (scene.js embrulha o render da tela)
  ui.buildParts = function (state, result) { return buildRender.call({ parts: true }, state, result); };

  // ----------------------------------------------------------- Implement
  ui.register('implement', {
    nextLabel: 'scr.implement.next',
    render: function (state, result) {
      var m = result.mission, life = result.life, lock = ui.phaseLock ? ui.phaseLock(state) : null;
      var alt0 = result.metrics.altitude_km.value;
      // 1. Data de lançamento (clima espacial real) antes de tudo.
      var hasLife = !!(MS.life && MS.data.spaceWeather);
      if (hasLife && !state.period) return ui.life.periodPicker(state, !!lock);
      // 2. Missão parada esperando uma decisão do jogador.
      if (m.status === 'decide') {
        return '<div class="card viz-card"><div data-viz="mission"></div></div>' +
          '<div class="alert s-warn">' + h.esc(t('life.stopped', { day: m.decision.day + 1, total: life.days })) + '</div>' +
          ui.life.decision(m.decision, !!lock) + ui.life.chart(life, alt0) + ui.life.diary(life) + ui.life.periodPicker(state, !!lock);
      }
      var events = m.events.map(function (e) {
        var causes = e.causes && e.causes.length ? h.explain(e.causes.join(' '), t('impl.cause')) : '';
        return '<li><div class="when">' + h.esc(e.when) + '</div><div><div class="row-head"><span>' +
          (e.random ? '<span class="tag">' + h.esc(t('impl.random')) + '</span>' : '') + '<strong>' + h.esc(e.title) + '</strong></span>' +
          h.badge(e.status) + '</div><p class="small">' + h.esc(e.text) + '</p>' + causes + '</div></li>';
      }).join('');
      var o = m.outcome;
      var summary = o ? '<div class="alert s-' + m.status + '"><strong>' +
        h.esc(m.aborted ? t('impl.lost') : t('impl.maps', { maps: U.fmt(o.maps, 1), target: U.fmt(o.target, 0) })) +
        '</strong> ' + h.esc(o.explanation) + '</div>' : '';
      return '<div class="card viz-card"><div data-viz="mission"></div></div>' + summary +
        (life ? ui.life.chart(life, alt0) + ui.life.diary(life) : '') +
        '<div class="card"><h2>' + h.esc(t('impl.timeline')) + '</h2><ol class="timeline">' + events + '</ol></div>' +
        (hasLife ? ui.life.periodPicker(state, !!lock) : '');
    }
  });

  // ------------------------------------------------------ Mission Report
  // "Por que" da missão: as causas das falhas, em frases.
  // Por que deu esse resultado: primeiro o que deu errado (com a causa),
  // depois o que deu certo. Sempre aparece, mesmo numa missão perfeita.
  function whyList(result) {
    var order = { fail: 0, warn: 1, ok: 2 };
    var evs = result.mission.events.filter(function (e) { return order[e.status] != null; })
      .sort(function (a, b) { return order[a.status] - order[b.status]; }).slice(0, 6);
    if (!evs.length) return '';
    var out = evs.map(function (e) {
      return '<li class="s-' + e.status + '">' + h.icon(h.stateIcon(e.status), { size: 16, stroke: 2.6 }) + '<span><b>' + h.esc(e.title) + ':</b> ' + h.esc(e.text) +
        (e.causes && e.causes.length && e.status !== 'ok' ? ' <span class="muted">' + h.esc(t('rep.because')) + ' ' + h.esc(e.causes[0]) + '</span>' : '') + '</span></li>';
    });
    return '<div class="card"><h2>' + h.esc(t('rep.whyTitle')) + '</h2><ul class="why why-all">' + out.join('') + '</ul></div>';
  }

  // Valor científico do instrumento escolhido, com o melhor da lista para comparar.
  function sciLine(state) {
    var sv = MS.advice.scienceValue && MS.advice.scienceValue(state), id = state.design.payload;
    if (!sv || !id || !sv.options[id] || sv.options[id].value == null) return '';
    var cat = MS.data.catalog.components, best = id;
    Object.keys(sv.options).forEach(function (k) { if ((sv.options[k].value || 0) > (sv.options[best].value || 0)) best = k; });
    var v = sv.options[id].value;
    return '<p class="rep-sci s-' + (v >= 90 ? 'ok' : v >= 60 ? 'warn' : 'fail') + '">' + h.icon('sci', { size: 16 }) + ' <span>' +
      h.esc(t('sv.report', { v: v, name: L(cat[id].name) })) + (best !== id ? ' ' + h.esc(t('sv.better', { name: L(cat[best].name), v: sv.options[best].value })) : '') + '</span></p>';
  }

  // A missão no tempo, resumida: gráficos + números + o ano escolhido.
  function lifeReport(result) {
    var life = result.life;
    if (!life) return '';
    var per = MS.data.spaceWeather.periods[life.periodId];
    return '<div class="card"><h2>' + h.esc(t('life.rep.title', { name: MS.i18n.L(per.name) })) + '</h2>' +
      '<p>' + h.esc(ui.life.stats(life)) + '</p>' +
      '<p class="small muted">' + h.esc(t('life.rep.compare')) + '</p></div>' + ui.life.chart(life, result.metrics.altitude_km.value);
  }

  // Palpite × resultado (prever antes de lançar).
  function predictionCard(state, result) {
    var f = MS.advice.dataFraction(result);
    if (f == null) return '';
    if (!state.prediction) return '<div class="ck-panel"><div class="ck-head"><h2>' + h.icon('eye', { size: 16 }) + h.esc(t('rep.pred.title')) + '</h2></div><p class="section-note">' + h.esc(t('rep.pred.none')) + '</p></div>';
    var hit = MS.advice.bucket(f) === state.prediction;
    return '<div class="ck-panel pred-result ' + (hit ? 's-ok' : 's-warn') + '"><div class="ck-head"><h2>' + h.icon('eye', { size: 16 }) + h.esc(t('rep.pred.title')) + '</h2></div>' +
      '<div class="pred-vs"><div><span class="eyebrow">' + h.esc(t('rep.pred.result')) + '</span><b>' + h.esc(U.pct(f)) + '</b></div>' +
      '<div><span class="eyebrow">' + h.esc(t('rep.pred.you')) + '</span><b>' + h.esc(t('pred.' + state.prediction)) + '</b></div></div>' +
      '<p>' + h.esc(t('rep.pred.line', { g: t('pred.' + state.prediction), pct: U.pct(f) })) + '</p>' +
      '<p>' + h.stateTag(hit ? 'ok' : 'warn', t(hit ? 'rep.pred.hit' : 'rep.pred.miss')) + '</p></div>';
  }

  // Tentativa anterior lado a lado: o que mudou e o que isso causou.
  function compareCard(state, result) {
    var prev = MS.advice.previous(state);
    if (!prev) return '';
    var pr = prev.result, ch = MS.advice.changes(prev.state, state);
    function row(label, a, b, better) {
      var cls = a === b ? '' : better ? ' up' : ' down';
      return '<tr><td>' + h.esc(label) + '</td><td class="num">' + h.esc(a) + '</td><td class="num cmp-now' + cls + '">' + h.esc(b) + '</td></tr>';
    }
    var fa = MS.advice.dataFraction(pr), fb = MS.advice.dataFraction(result);
    var sa = pr.score.total, sb = result.score.total;
    var ca = pr.metrics.cost_k.value, cb = result.metrics.cost_k.value, ma = pr.metrics.mass_kg.value, mb = result.metrics.mass_kg.value;
    var rows = row(t('rep.cmp.score'), sa == null ? '—' : String(sa), sb == null ? '—' : String(sb), sb > sa) +
      row(t('rep.cmp.data'), fa == null ? '—' : U.pct(fa), fb == null ? '—' : U.pct(fb), fb > fa) +
      row(t('rep.cmp.cost'), h.value(pr.metrics.cost_k), h.value(result.metrics.cost_k), cb < ca) +
      row(t('rep.cmp.mass'), h.value(pr.metrics.mass_kg), h.value(result.metrics.mass_kg), mb < ma);
    var changed = ch.length
      ? '<ul class="cmp-changes">' + ch.map(function (c) { return '<li><b>' + h.esc(c.label) + ':</b> ' + h.esc(c.from) + ' ' + h.icon('arrow', { size: 14 }) + ' ' + h.esc(c.to) + '</li>'; }).join('') + '</ul>'
      : '<p class="section-note">' + h.esc(t('rep.cmp.nothing')) + '</p>';
    return '<div class="ck-panel compare"><div class="ck-head"><h2>' + h.icon('restart', { size: 16 }) + h.esc(t('rep.cmp.title', { n: prev.attempt.attempt })) + '</h2></div>' +
      '<h3>' + h.esc(t('rep.cmp.changed')) + '</h3>' + changed +
      '<div class="table-wrap"><table><thead><tr><th></th><th class="num">' + h.esc(t('rep.cmp.then', { n: prev.attempt.attempt })) + '</th><th class="num">' + h.esc(t('rep.cmp.now')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  // Cartas de aprendizado (leis de Senge) desbloqueadas pelo que aconteceu.
  function cardsCard(state, result) {
    var list = MS.advice.cards(state, result, MS.advice.previous(state));
    return '<div class="ck-panel"><div class="ck-head"><h2>' + h.icon('card', { size: 16 }) + h.esc(t('cards.title')) + '</h2></div>' +
      '<p class="section-note">' + h.esc(t('cards.note')) + '</p><div class="lcards">' + list.map(function (c, i) {
        return c.unlocked
          ? '<div class="lcard on"><span class="lc-n pixel">' + '#' + (i + 1) + '</span><b class="lc-law">' + h.esc(t('card.' + c.id + '.law')) + '</b>' +
            '<p>' + h.esc(c.why) + '</p><span class="lc-by">' + h.esc(t('cards.by')) + '</span></div>'
          : '<div class="lcard"><span class="lc-q pixel" aria-hidden="true">?</span><b>' + h.esc(t('cards.locked')) + '</b><p class="small muted">' + h.esc(t('cards.lockedHint')) + '</p></div>';
      }).join('') + '</div></div>';
  }

  ui.register('report', {
    render: function (state, result) {
      var s = result.score;
      if (s.status === 'pending') return '<div class="alert s-warn">' + h.esc(t('rep.pending')) + '</div>';
      var parts = s.parts.map(function (p) {
        return '<tr><td>' + h.esc(p.label) + '<div class="small muted">' + h.esc(p.explanation) + '</div></td>' +
          '<td class="num">' + U.fmt(p.points, 0) + ' / ' + U.fmt(p.max, 0) + '</td></tr>';
      }).join('');
      var lessons = result.lessons.length
        ? '<ul>' + result.lessons.map(function (l) { return '<li>' + h.esc(l.text) + '</li>'; }).join('') + '</ul>'
        : '<p>' + h.esc(t('rep.noLessons')) + '</p>';
      var cost = result.metrics.cost_k;
      var happened = result.risks.filter(function (r) { return r.occurs; });
      var luck = '<div class="card"><h2>' + h.esc(t('rep.random')) + '</h2>' + (happened.length
        ? '<ul class="rows">' + happened.map(function (r) {
            return '<li><div class="row-head"><strong>' + h.esc(r.title) + '</strong>' +
              h.badge(r.mitigated ? 'ok' : 'warn', r.mitigated ? t('rep.mitigated') : t('rep.damaged')) + '</div>' +
              '<div class="small muted">' + h.esc(t('rep.impact', { i: r.impact })) + '</div></li>';
          }).join('') + '</ul>'
        : '<p>' + h.esc(t('rep.noRandom')) + '</p>') + '</div>';
      var ringColor = s.total >= 70 ? 'var(--ok)' : s.total >= 40 ? 'var(--warn)' : 'var(--fail)';
      // Estrelas: 1 a partir de 40%, 2 a partir de 70%, 3 a partir de 90% da nota.
      var pct = s.total / s.max * 100, nStars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
      var confetti = '';
      if (nStars >= 2) for (var ci = 0; ci < 28; ci++) {
        confetti += '<i style="left:' + ((ci * 37) % 100) + '%;animation-delay:' + ((ci % 7) * 0.12).toFixed(2) + 's;background:' +
          ['#ffd23f', '#4ade80', '#7fb2ff', '#ff7ac6', '#ff9a3c'][ci % 5] + '"></i>';
      }
      var stars = '<div class="rep-stars n-' + nStars + '" aria-label="' + h.esc(t('rep.stars', { n: nStars })) + '">' +
        (confetti ? '<div class="rep-confetti" aria-hidden="true">' + confetti + '</div>' : '') +
        '<div class="rs-row">' + [1, 2, 3].map(function (k) { return '<span class="rs-star' + (k <= nStars ? ' on' : '') + '" style="animation-delay:' + (0.25 + k * 0.3).toFixed(2) + 's">★</span>'; }).join('') + '</div>' +
        '<p class="rs-line">' + h.esc(t('rep.starsLine.' + nStars)) + '</p></div>';
      // Ordem pensada para ler de cima para baixo: nota → por quê → o que
      // tentar agora. O resto (contas, requisitos, sorte, diário) fica em
      // "Ver todos os detalhes", aberto só por quem quiser.
      return stars + '<div class="card"><div class="score"><div class="score-ring" style="--p:' + Math.round(s.total / s.max * 100) + ';--ring:' + ringColor + '">' +
        '<span>' + s.total + '</span></div><div><div class="small muted">' + h.esc(t('rep.of', { max: s.max })) + '</div><h2 style="margin:2px 0 0">' + h.esc(s.grade || '') + '</h2></div></div>' +
        '<p class="small muted">' + h.esc(t('rep.line', { n: state.attempt, cost: h.value(cost), sched: h.value(result.metrics.schedule_months) })) + '</p>' +
        h.explain(result.mission.explanation, t('ui.seeMath')) + sciLine(state) + '</div>' +
        whyList(result) +
        '<div class="card"><h2>' + h.esc(t('rep.lessons')) + '</h2>' + lessons +
        '<div class="actions"><button type="button" class="btn primary" data-action="retry">' + h.esc(t('ui.retry')) + '</button>' +
        '<button type="button" class="btn" data-action="reset">' + h.esc(t('rep.restart')) + '</button></div></div>' +
        '<div class="report-deck">' + predictionCard(state, result) + compareCard(state, result) + '</div>' +
        cardsCard(state, result) +
        '<details class="card rep-more"><summary>' + h.esc(t('rep.more')) + '</summary>' +
        '<div class="report-crew">' + goNoGo(state, result, t('rep.crew.title')) + '</div>' + lifeReport(result) +
        '<div class="card"><h2>' + h.esc(t('rep.score')) + '</h2><div class="table-wrap"><table><tbody>' + parts + '</tbody></table></div></div>' +
        '<div class="card"><h2>' + h.esc(t('scr.design.reqs')) + '</h2>' + h.statusRows(result.requirements, { prefixId: true }) + '</div>' + luck +
        '<p class="small muted">' + h.esc(t('rep.realWorld')) + '</p></details>' +
        '<details class="card sources sources-rep"><summary>' + h.icon('info', { size: 18 }) + h.esc(t('src.title')) + '</summary>' + h.sourcesBody(state, result) + '</details>' +
        '<details class="card credits"><summary>' + h.icon('book', { size: 18 }) + h.esc(t('rep.credits')) + '</summary>' + h.credits() + '</details>';
    }
  });
})(globalThis);
