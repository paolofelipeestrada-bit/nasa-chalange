# Simulador de missão espacial — base

HTML + JavaScript puro, sem build e sem dependências.

## Testar
Abra `tests.html` no navegador (duplo clique serve). Erros de sintaxe nos
dados também aparecem lá como teste falho.

## Estrutura
```
js/data/phases.js     fases do fluxo (ordem, títulos, fase do "ajustar e simular de novo")
js/data/catalog.js    órbitas, lançadores, estações em solo e componentes
js/data/scenarios.js  cenários: necessidade, escolhas, requisitos, verificação, eventos, pontuação
js/sim.js             motor puro: MS.sim.run(state) → resultados + explicações
js/state.js           estado único + ações + localStorage (MS.store)
tests.html, tests/    testes do motor e do estado
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
| Linha do plano de verificação | `scenarios.js` → `verification` |
| Cenário | copiar o bloco `eo_cubesat` em `scenarios.js` e trocar o id |
| Fase | `phases.js` (a tela da fase fica na interface) |
| Regra física, métrica ou tipo de verificação novo | `sim.js` (`METRICS` + `computeMetrics`, `CHECKS` + `computeChecks`): único caso que mexe no motor |

Depois de mexer nos dados, rode `tests.html`: o teste de validação aponta
campos faltando ou ids errados.
