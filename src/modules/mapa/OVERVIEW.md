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

Exporta MarcadorService para futuros consumidores. BE-36 permanece em sua issue.

## Mapa interno (BE-35)

GET /v1/mapa exige login, aceita loteamentoId, status separados por vírgula e page/pageSize. Responde { planta, marcadores: { data, meta } }. Sem planta ativa retorna 404 PLANTA_ATIVA_NAO_ENCONTRADA; entrada inválida 400 DADOS_INVALIDOS; sem login 401 NAO_AUTENTICADO. Cache-Control no-store garante atualização do status em cada consulta.

Planta contém só id, nome, versão, dimensões e URL/zoom/tamanho dos tiles. Cada marcador traz ids, coordenadas, número, quadra, loteamento, área, valor decimal, status do lote e ações. Consulta só lê; Comercial reserva lotes disponíveis e vê a própria reserva; Admin/Gestor também bloqueiam/desbloqueiam e vendem quando há reserva ativa com proposta aprovada. Vendido não tem ação. A aprovação não vira status do lote (RN17). Esta lista orienta a UI; as ações serão revalidadas nos comandos correspondentes.

Projeção SQL de leitura documentada em architecture.md, com uma consulta para página e total, sem N+1 e sem acessar dados de clientes. Cadastros excluídos e plantas inativas não aparecem. Ordem estável pelo UUID do marcador. MapaService exportado atende a consulta; marcadores paginados permitem percorrer milhares de lotes sem resposta ilimitada.

BE-38: MapaService.consultarPublico reutiliza a projeção paginada com escopo recebido do serviço de links, mas devolve DTO público próprio com lista explícita de campos e valor somente autorizado. Não importa LinksPublicosModule; dependência segue em uma direção.

## Eventos de status (BE-36)

GET /v1/mapa/eventos exige autenticação. GET /v1/publico/:token/eventos valida o link, filtra pelo loteamento e encerra o fluxo se o link for desativado. Eventos status-lote têm somente loteId e status. Heartbeats saem a cada 15 segundos. O PostgreSQL publica mudanças após o commit, por gatilho. Após reconectar, o cliente deve recarregar o mapa, pois eventos não são armazenados para replay.
## Revisão por versão (BE-34)

Os marcadores incluem o booleano `revisar`. Marcadores novos e existentes na migração começam com false. Cada cópia recebe id próprio, preservando lote, x, y e eventuais revisões pendentes. Para confirmar a posição, Administrador ou Gestor chama `POST /v1/plantas/:plantaId/marcadores/:id/revisar` (200). A confirmação é idempotente e gera auditoria REVISAR na primeira mudança. O marcador precisa pertencer à planta indicada (404).
