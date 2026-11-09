# Propostas — BE-23

Dono da tabela Proposta. Depende de ReservasModule, ConfiguracoesModule e AuditoriaModule e exporta PropostaService. A tabela e o índice parcial de uma proposta EM_ANALISE por reserva já existem, sem migration ou dependência nova.

| Método | Rota | Perfis | Resultado |
| --- | --- | --- | --- |
| POST | /v1/reservas/:reservaId/propostas | Administrador, Gestor e Comercial responsável | 201 |
| GET | /v1/propostas/:id | Administrador, Gestor e Comercial responsável | 200 |
| GET | /v1/reservas/:reservaId/propostas | Administrador, Gestor e Comercial responsável | Lista paginada |

Criação recebe valor monetário positivo (texto com até 12 dígitos inteiros e 2 decimais), condições obrigatórias e observações opcionais. Condições/observações têm limite de 10.000 caracteres. Campos extras, incluindo vendedorId e status, são rejeitados. Observação vazia vira null. Valores são devolvidos com duas casas e não são convertidos em ponto flutuante. Respostas usam Cache-Control no-store.

ReservaService.findById(id, usuario, tx) aplica propriedade e bloqueia a reserva antes de verificar status e vencimento. Somente ATIVA com vencimento estritamente futuro recebe proposta. A mesma linha coordena criação com a expiração automática. O índice parcial existente protege contra inserções concorrentes. Proposta em análise impede novo envio. Proposta aprovada também impede novo envio; a alternativa prevista pela RN11 é o reenvio após rejeição, preservando as versões anteriores.

vendedorId permanece o vendedor responsável pela reserva, mesmo quando o ator é Gestor/Administrador. PrazoLimite usa a configuração prazo_analise_dias_uteis e adicionarDiasUteis da BE-12, excluindo dia inicial, finais de semana e feriados do calendário existente. Aprovar/rejeitar fica na BE-24. A criação não muda o status do lote nem da reserva.

Auditoria CRIAR compartilha a transação com a proposta. Registra reservaId, status, valor e datas. Condições, observações e dados pessoais de cliente não são enviados à auditoria. Falha na auditoria desfaz a criação.

Listagens ordenadas por dataEnvio descendente e id ascendente, com page/pageSize. Leitura é permitida também em reservas encerradas para preservar o histórico e verifica o vendedor atual da reserva pelos serviços exportados.

Erros de entrada 400 DADOS_INVALIDOS/PROPOSTA_INVALIDA. Autenticação 401 e autorização 403 ACESSO_NEGADO. Recursos ausentes 404 PROPOSTA_NAO_ENCONTRADA/RESERVA_NAO_ENCONTRADA. Conflitos 409 RESERVA_INVALIDA_PARA_PROPOSTA, PROPOSTA_EM_ANALISE e PROPOSTA_JA_APROVADA. Configuração inválida retorna os erros existentes do módulo de configurações (422).
