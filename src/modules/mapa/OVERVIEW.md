# Mapa — Marcadores (BE-33)

Dono de Marcador. Importa PlantasModule, LoteamentosModule e AuditoriaModule. Consulta plantas e lotes exclusivamente pelos services exportados. O repositório acessa apenas marcadores. A lista de lotes sem marcador consulta os ids já associados e delega o filtro de exclusão ao LoteService, preservando os limites entre módulos e a paginação no banco.

| Método | Rota                                     | Perfis               | Resultado                           |
| ------ | ---------------------------------------- | -------------------- | ----------------------------------- |
| GET    | /v1/plantas/:plantaId/marcadores         | Autenticados         | Lista paginada                      |
| POST   | /v1/plantas/:plantaId/marcadores         | Administrador/Gestor | 201, marcador                       |
| POST   | /v1/plantas/:plantaId/marcadores/lote    | Administrador/Gestor | 201, array de marcadores            |
| PATCH  | /v1/plantas/:plantaId/marcadores/:id     | Administrador/Gestor | Move x/y, 200                       |
| DELETE | /v1/plantas/:plantaId/marcadores/:id     | Administrador/Gestor | 204                                 |
| GET    | /v1/plantas/:plantaId/lotes-sem-marcador | Autenticados         | Lista paginada; filtro loteamentoId |

Criação recebe `{ loteId, x, y }`; movimentação recebe `{ x, y }`. Coordenadas finitas entre 0 e 1, incluindo limites. Lote/planta devem existir. Movimento e remoção validam a associação do marcador à planta da rota. Listagens aceitam page/pageSize. Lotes sem marcador retornam id, número, quadraId e loteamentoId, excluindo lotes removidos pelo filtro existente do módulo de loteamentos.

Criação em lote recebe `{ marcadores: [...] }`, de 1 a 500 itens. Todos os itens e auditorias são gravados numa única transação. Repetição de lote na requisição ou no banco retorna 409. O índice único existente (plantaId,loteId) garante unicidade inclusive em concorrência. O mesmo lote pode ter marcador em versões diferentes da planta. Coordenadas fora do intervalo retornam 400. Movimentação e remoção bloqueiam a linha antes de ler o estado anterior para auditoria consistente.

Auditoria atômica CRIAR/MOVER/EXCLUIR com ids e coordenadas. Falha na auditoria desfaz a escrita. Schema e migrations existentes já suportam a funcionalidade.

Erros: 400 DADOS_INVALIDOS/COORDENADAS_INVALIDAS; 401 NAO_AUTENTICADO; 403 ACESSO_NEGADO; 404 PLANTA_NAO_ENCONTRADA/LOTE_NAO_ENCONTRADO/MARCADOR_NAO_ENCONTRADO; 409 MARCADOR_DUPLICADO.

Exporta MarcadorService para futuros consumidores. BE-34, BE-35 e BE-36 permanecem em suas issues.
