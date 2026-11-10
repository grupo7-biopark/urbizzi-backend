# Propostas — BE-23 e BE-24

Dono da tabela Proposta. Depende de ReservasModule, ConfiguracoesModule e AuditoriaModule e exporta PropostaService. A tabela e o índice parcial de uma proposta EM_ANALISE por reserva já existem, sem migration ou dependência nova.

| Método | Rota | Perfis | Resultado |
| --- | --- | --- | --- |
| POST | /v1/reservas/:reservaId/propostas | Administrador, Gestor e Comercial responsável | 201 |
| GET | /v1/propostas/:id | Administrador, Gestor e Comercial responsável | 200 |
| GET | /v1/propostas/pendentes | Administrador e Gestor | Lista paginada |
| GET | /v1/propostas/minhas | Administrador, Gestor e Comercial | Lista paginada |
| POST | /v1/propostas/:id/aprovar | Administrador e Gestor | 200 |
| POST | /v1/propostas/:id/rejeitar | Administrador e Gestor | 200 |
| GET | /v1/reservas/:reservaId/propostas | Administrador, Gestor e Comercial responsável | Lista paginada |

Criação recebe valor monetário positivo (texto com até 12 dígitos inteiros e 2 decimais), condições obrigatórias e observações opcionais. Condições/observações têm limite de 10.000 caracteres. Campos extras, incluindo vendedorId e status, são rejeitados. Observação vazia vira null. Valores são devolvidos com duas casas e não são convertidos em ponto flutuante. Respostas usam Cache-Control no-store.

ReservaService.findById(id, usuario, tx) aplica propriedade e bloqueia a reserva antes de verificar status e vencimento. Somente ATIVA com vencimento estritamente futuro recebe proposta. A mesma linha coordena criação com a expiração automática. O índice parcial existente protege contra inserções concorrentes. Proposta em análise impede novo envio. Proposta aprovada também impede novo envio; a alternativa prevista pela RN11 é o reenvio após rejeição, preservando as versões anteriores.

vendedorId permanece o vendedor responsável pela reserva, mesmo quando o ator é Gestor/Administrador. PrazoLimite usa a configuração prazo_analise_dias_uteis e adicionarDiasUteis da BE-12, excluindo dia inicial, finais de semana e feriados do calendário existente.

Decisão de propostas (BE-24):
- Somente Administrador e Gestor podem aprovar ou rejeitar uma proposta (RF22, RN10).
- Exige justificativa/motivo obrigatório (com até 10.000 caracteres, sem dados pessoais).
- Registra `decididoPorId`, `dataDecisao` e `motivoDecisao`.
- Proposta já decidida não pode ser decidida novamente (409 PROPOSTA_JA_DECIDIDA).
- A aprovação não altera o status do lote, que permanece RESERVADO (RN17).
- Após bloquear a reserva, a aprovação exige status ATIVA e vencimento futuro, mesmo se o job de expiração ainda não tiver rodado. Retorna 409 RESERVA_INVALIDA_PARA_PROPOSTA se a reserva já estiver vencida ou encerrada. Uma proposta atrasada ainda pode ser aprovada se a reserva estiver válida.
- A gestão pode rejeitar uma proposta pendente de uma reserva encerrada. A rejeição registra a decisão sem alterar a reserva ou o lote.

Acompanhamento de propostas (BE-24):
- `GET /v1/propostas/pendentes` (Administrador e Gestor): lista propostas em análise (status EM_ANALISE) ordenadas por prazo limite crescente (`prazoLimite asc, id asc`), destacando as atrasadas com a flag booleana `atrasada: true` quando o prazo limite passou (`prazoLimite <= agora`) sem alterar seu status no banco (RF21, RN09).
- `GET /v1/propostas/minhas` (Administrador, Gestor e Comercial): lista as propostas criadas pelo usuário autenticado (`vendedorId`), ordenadas por data de envio decrescente (`dataEnvio desc, id asc`), permitindo acompanhar seus status (RF23).

Auditoria:
- Operações de CRIAR, APROVAR e REJEITAR compartilham a transação com a proposta.
- APROVAR e REJEITAR registram status anterior EM_ANALISE, novo status (APROVADA ou REJEITADA) e o motivo da decisão.
- Condições, observações e dados pessoais de cliente não são enviados à auditoria. Falha na auditoria desfaz a operação.

Erros de entrada 400 DADOS_INVALIDOS/PROPOSTA_INVALIDA/MOTIVO_OBRIGATORIO. Autenticação 401 e autorização 403 ACESSO_NEGADO. Recursos ausentes 404 PROPOSTA_NAO_ENCONTRADA/RESERVA_NAO_ENCONTRADA. Conflitos 409 RESERVA_INVALIDA_PARA_PROPOSTA, PROPOSTA_EM_ANALISE, PROPOSTA_JA_APROVADA e PROPOSTA_JA_DECIDIDA. Configuração inválida retorna os erros existentes do módulo de configurações (422).
