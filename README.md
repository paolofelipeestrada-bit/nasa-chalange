# Simulador de missão espacial — base

HTML + JavaScript puro, sem build e sem dependências.

## Jogar e testar
- Jogo: abra `index.html` no navegador (duplo clique serve).
- Testes: abra `tests.html`. Erros de sintaxe nos dados também aparecem lá
  como teste falho.

## Estrutura
```
index.html            o jogo
css/style.css         visual (cores em variáveis no topo; claro/escuro automático)
js/data/phases.js     fases do fluxo (ordem, títulos, fase do "ajustar e simular de novo")
js/data/catalog.js    órbitas, lançadores, estações em solo e componentes
js/data/scenarios.js  cenários: necessidade, escolhas, requisitos, verificação, eventos, pontuação
js/sim.js             motor puro: MS.sim.run(state) → resultados + explicações
js/state.js           estado único + ações + localStorage (MS.store)
js/ui/core.js         render(), cliques (data-action) e peças reutilizáveis
js/ui/screen*.js      uma tela por fase, registrada com MS.ui.register(id, tela)
js/viz/schedule.js    roteiro da animação 3D (puro, testado)
js/viz/mission3d.js   visual 3D da missão (Three.js via CDN; sem internet o jogo funciona sem o 3D)
js/main.js            liga interface e estado
tests.html, tests/    testes do motor, do estado e das telas
```

Regra da arquitetura: as telas só **leem** `MS.store.state`, só **mudam** o
estado chamando ações (`MS.store.setOrbit`, `selectComponent`, `nextPhase`…)
e calculam resultados com `MS.sim.run(state)`. O state guarda só escolhas
e progresso; resultados são sempre recalculados.

## Onde acrescentar cada coisa
| Coisa nova | Onde |
|---|---|
| Componente, órbita, lançador, estação | `catalog.js` + o id em `options` do slot em `scenarios.js` |
| Requisito | `scenarios.js` → `requirements` (métricas em `MS.sim.metricDefs`) |
| Evento da missão | `scenarios.js` → `events` (condição: `check`, `requirement` ou `metric`) |
| Imprevisto (evento aleatório) | `scenarios.js` → `randomEvents` (chance, `appliesIf`, `mitigatedBy`, `effect`, `after`). Sorteio pela semente `state.seed`: mesma semente, mesmos imprevistos |
| Efeito visual de um evento no 3D | campo `fx` do evento em `scenarios.js` (lista em `MS.vizSchedule.FX`); efeito novo de verdade: `update()` em `js/viz/mission3d.js` |
| Linha do plano de verificação | `scenarios.js` → `verification` |
| Cenário | copiar o bloco `eo_cubesat` em `scenarios.js` e trocar o id |
| Fase | `phases.js` + uma tela nova com `MS.ui.register('id', { render })` num arquivo em `js/ui/` (e a tag `<script>` no `index.html`) |
| Campo novo aparecendo nos cartões de opção | `SPEC_FIELDS` em `js/ui/core.js` |
| Ação nova de botão | `ACTIONS` em `js/ui/core.js` + a função em `state.js` |
| Regra física, métrica ou tipo de verificação novo | `sim.js` (`METRICS` + `computeMetrics`, `CHECKS` + `computeChecks`): único caso que mexe no motor |

Depois de mexer nos dados, rode `tests.html`: o teste de validação aponta
campos faltando ou ids errados.
