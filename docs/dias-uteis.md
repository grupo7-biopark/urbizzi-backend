# Dias úteis (BE-12)

`src/shared/domain/dias-uteis.ts` exporta funções sem dependências externas para os prazos de análise de propostas (RN09, RNF10). Datas de entrada e saída são instantes `Date`; o calendário sempre usa `America/Sao_Paulo`, independentemente do fuso do processo.

```ts
import { adicionarDiasUteis, diasUteisEntre } from '../src/shared/domain/dias-uteis.js';

const envio = new Date('2026-02-13T15:00:00Z');
const prazo = adicionarDiasUteis(envio, 1); // 2026-02-18T15:00:00Z
const decorridos = diasUteisEntre(envio, prazo); // 1
const prazoLocal = adicionarDiasUteis(envio, 1, ['2026-02-18']);
```

## Contrato

- `adicionarDiasUteis(data, n, feriadosAdicionais?)`: `n` é inteiro seguro não negativo. Exclui o dia inicial e avança até contar n dias úteis. Preserva o horário local e os milissegundos, recalculando o offset no destino (inclui o antigo horário de verão). Zero devolve cópia sem deslocamento, mesmo em dia não útil. Não altera a entrada.
- `diasUteisEntre(inicio, fim, feriadosAdicionais?)`: conta datas locais no intervalo `(inicio, fim]`, ignorando horários. No mesmo dia retorna zero. Para intervalo invertido, conta no intervalo cronologicamente crescente e inverte o sinal; zero permanece zero.
- Feriados adicionais são datas locais no formato `YYYY-MM-DD`, informadas por chamada, sem alterar o calendário global. Datas repetidas não duplicam a exclusão. Permite incluir feriados estaduais/municipais no futuro sem alterar as funções.

Erros usam BusinessRuleError: DATA_INVALIDA, QUANTIDADE_DIAS_INVALIDA e FERIADO_INVALIDO. Não há dependência de NestJS, banco, rede ou novos endpoints.

## Calendário

Exclui sábados e domingos, 1º de janeiro, 21 de abril, 1º de maio, 7 de setembro, 12 de outubro, 2 e 15 de novembro e 25 de dezembro. Inclui 20 de novembro como nacional a partir de 2024, após a Lei 14.759/2023; feriados locais anteriores podem ser informados na lista adicional. Os demais feriados fixos representam o calendário nacional atual, sem modelagem completa de alterações legais históricas.

Feriados móveis são calculados pela Páscoa gregoriana: segunda e terça de Carnaval (-48 e -47 dias), Sexta-feira Santa (-2) e Corpus Christi (+60). Carnaval e Corpus Christi são tratados como dias não úteis por exigência explícita da issue, embora o calendário federal os classifique como pontos facultativos. Quarta-feira de Cinzas é considerada dia útil integral; não há contagem de meio expediente.

Os testes cobrem anos diferentes, finais de semana, feriados consecutivos, virada de ano, diferença de dia entre UTC e São Paulo, preservação de horário/entrada, horário de verão histórico, extensões municipais e validação das entradas.

## Referências

- [Lei 14.759/2023 — 20 de novembro](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm).
- [Calendário oficial de 2026 e pontos facultativos](https://agenciagov.ebc.com.br/noticias/202512/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026).
