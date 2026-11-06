# Painel de Indicadores (BE-39)

Módulo somente leitura responsável por agregar e expor métricas gerenciais e operacionais da aplicação: resumo de estoque de lotes por status (RF39), vendas realizadas por período e por vendedor (RF40) e acompanhamento de pendências de reservas e propostas (RF41).

Importa `LoteamentosModule` para validação de escopo opcional de loteamento através do `LoteamentoService.findById`. A persistência utiliza um read model SQL agregador otimizado no adapter `PrismaPainelConsultaRepository`, que realiza consultas agregadas parametrizadas eficientes diretamente no banco, sem N+1 e sem escrita em nenhuma tabela.

## Endpoints

| Método | Rota                | Perfis                                        | Resposta                     |
| ------ | ------------------- | --------------------------------------------- | ---------------------------- |
| `GET`  | `/v1/painel/resumo`     | `ADMINISTRADOR`, `GESTOR`, `COMERCIAL`, `CONSULTA` | Contagem de lotes por status |
| `GET`  | `/v1/painel/vendas`     | `ADMINISTRADOR`, `GESTOR`, `COMERCIAL`, `CONSULTA` | Vendas por período e vendedor|
| `GET`  | `/v1/painel/pendencias` | `ADMINISTRADOR`, `GESTOR`, `COMERCIAL`, `CONSULTA` | Indicadores de pendências    |

Todas as respostas possuem cabeçalho `Cache-Control: no-store` para assegurar que os indicadores reflitam o estado mais recente do banco de dados.

## Regras de Negócio e Comportamento

1. **Acesso por perfil**:
   - Todos os quatro perfis internos (`ADMINISTRADOR`, `GESTOR`, `COMERCIAL`, `CONSULTA`) possuem acesso aos endpoints do painel, em conformidade com a matriz de segurança.
   - Requisições sem token de autenticação recebem `401 NAO_AUTENTICADO`.

2. **GET /v1/painel/resumo (RF39)**:
   - Apresenta o consolidado geral de lotes e o detalhamento individual por loteamento.
   - Contabiliza lotes não excluídos (`deletedAt: null`) nos quatro status do sistema (`DISPONIVEL`, `RESERVADO`, `VENDIDO`, `BLOQUEADO`).
   - Filtro opcional `loteamentoId`: quando informado, valida a existência do loteamento e restringe o resumo aos lotes pertencentes a ele.
   - Filtros opcionais de intervalo `dataDe` e `dataAte`: quando invertidos (`dataDe > dataAte`), respondem `422 PERIODO_INVALIDO`.

3. **GET /v1/painel/vendas (RF40)**:
   - Consolida vendas efetuadas a partir de reservas convertidas (`status = 'CONVERTIDA'`) e lotes vendidos.
   - Devolve o total consolidado (quantidade e `valorTotal` decimal com duas casas), totais por período de referência (`dia`, `semana`, `mes`), séries temporais (`porDia`, `porSemana`, `porMes`, e `porPeriodo` conforme o agrupamento selecionado: `dia`, `semana` ou `mes`) e o ranking `porVendedor`.
   - Filtros aceitos: `loteamentoId`, `vendedorId`, `dataDe`, `dataAte`, `agrupamento`.

4. **GET /v1/painel/pendencias (RF41)**:
   - Consolida as pendências operacionais:
     - `reservasAtivas`: quantidade de reservas com `status = 'ATIVA'`.
     - `reservasVencendoEmBreve`: reservas ativas com data de vencimento próxima (padrão: até 3 dias futuros, configurável via `diasVencimentoEmBreve`).
     - `propostasPendentes`: propostas com `status = 'EM_ANALISE'`.
     - `propostasAtrasadas`: propostas em análise cujo `prazoLimite` expirou (`prazoLimite < agora`).
   - **Escopo do Comercial**: Quando o usuário autenticado possui o perfil `COMERCIAL`, visualiza estritamente as suas próprias pendências (`vendedorId = usuario.id`), mesmo que outro `vendedorId` seja passado na query string. Perfis gestores (`ADMINISTRADOR`, `GESTOR`) e `CONSULTA` visualizam o consolidado geral.

## Códigos de Erro

- `400 DADOS_INVALIDOS`: Parâmetros de rota ou query inválidos (ex.: UUID malformado).
- `401 NAO_AUTENTICADO`: Ausência de token JWT válido.
- `403 ACESSO_NEGADO`: Perfil sem autorização.
- `404 LOTEAMENTO_NAO_ENCONTRADO`: `loteamentoId` fornecido não foi encontrado.
- `422 PERIODO_INVALIDO`: Intervalo de datas inconsistente (`dataDe > dataAte` ou data inválida).
