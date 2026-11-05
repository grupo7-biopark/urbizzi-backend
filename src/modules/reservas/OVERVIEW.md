# Reservas (BE-19)

Dono de Reserva e ReservaRenovacao. Importa LoteamentosModule, ClientesModule, ConfiguracoesModule e AuditoriaModule; exporta ReservaService. POST /v1/reservas recebe loteId/clienteId, vincula o usuário logado como vendedor e exige ADMINISTRADOR/GESTOR/COMERCIAL. GET /v1/reservas/:id tem os mesmos perfis; Comercial só consulta reserva própria. Retorna prazo e tempoRestanteSegundos limitado a zero.

Prazo em dias corridos (24 horas UTC por dia), obtido de ConfiguracaoService dentro da transação; padrão sete dias. LoteService bloqueia a linha ao ler em transação, valida DISPONIVEL, atualiza condicionalmente RESERVADO e teveReserva=true. O mesmo bloqueio protege exclusão/bloqueio concorrentes. Cliente é validado por serviço exportado. Reserva, lote e as duas auditorias compartilham o commit; snapshots não recebem dados pessoais de cliente. Índice parcial existente é a segunda proteção para uma única reserva ATIVA por lote; colisão retorna 409 RESERVA_LOTE_JA_RESERVADO.

Erros: 400 DADOS_INVALIDOS, 401 NAO_AUTENTICADO, 403 ACESSO_NEGADO, 404 RESERVA_NAO_ENCONTRADA/LOTE_NAO_ENCONTRADO/CLIENTE_NAO_ENCONTRADO, 409 LOTE_NAO_DISPONIVEL/LOTE_STATUS_ALTERADO/RESERVA_LOTE_JA_RESERVADO, 422 CONFIGURACAO_INVALIDA. Sem migration/dependência nova. Renovação, cancelamento, expiração e listagem seguem nas respectivas issues.

## Listagem (BE-22)

GET /v1/reservas e /v1/reservas/minhas são paginados (page/pageSize) e exigem Admin/Gestor/Comercial. Consulta recebe 403. Comercial só vê próprias nos dois endpoints; /minhas sempre força usuário logado, inclusive gestor/admin. Filtros combináveis: status (vírgulas), vendedorId (restrito ao próprio para Comercial), loteamentoId e vencimentoDe/vencimentoAte em ISO8601 com fuso, extremos inclusivos. Período invertido retorna 400 PERIODO_INVALIDO; demais entradas inválidas 400 DADOS_INVALIDOS.

Ordenação estável por vencimento crescente e id. Retorna resumo do lote, cliente (só id/nome; nome nulo quando removido) e última proposta (id/status/valor decimal, sem condições). Cache-Control no-store. A projeção SQL documentada em architecture.md faz página/contagem num snapshot, sem N+1, preserva cadastros históricos e não escreve em tabelas alheias.

## Expiração automática (BE-21)

ExpiracaoReservasJob usa @nestjs/schedule, intervalo de cinco minutos após iniciar a aplicação. Não sobrepõe ciclos na mesma instância e aguarda o ciclo atual ao encerrar. ExpiracaoReservaService percorre candidatas em páginas de 100 por UUID, com horário fixo do início do ciclo, até terminar a seleção. Não há limite de 100 expirações por ciclo nem loop infinito sobre uma candidata com falha.

Somente ATIVA com vencimento <= agora e sem proposta APROVADA. Cada candidata tem transação própria: bloqueia a reserva com FOR UPDATE SKIP LOCKED, reconsulta status/prazo/aprovação num novo snapshot, libera o lote por LoteService, expira a reserva e registra ambas as auditorias com usuarioId=null. Inconsistência de lote não é sobrescrita (LOTE_NAO_RESERVADO), e falha de auditoria desfaz lote/reserva; as demais candidatas continuam. Falhas são contadas e a candidata será tentada no próximo ciclo. Repetição ou concorrência não gera duplicidade.

Projeção de elegibilidade só lê a existência de aprovação em propostas, exceção documentada de leitura; nunca altera propostas. Novos comandos de renovação/cancelamento/aprovação deverão bloquear primeiro a mesma reserva pelo serviço exportado (ReservaService.findById(id, usuario, tx)), revalidar estado e executar todas as escritas no mesmo tx. Ordem de bloqueio desses comandos: reserva, lote; criação de reserva só bloqueia lote antes de inserir uma nova reserva.

Logs contêm somente quantidades e erros genéricos. RESERVA_NAO_VENCIDA protege domínio contra expiração antecipada/repetida. A dependência @nestjs/schedule é a ferramenta pedida pela issue; sem nova tabela/migration/variável de ambiente.

BE-23 consome ReservaService.findById(id, usuario, tx) para autorizar e bloquear a reserva antes de criar propostas. A aprovação e os demais comandos continuam sujeitos à mesma ordem de bloqueios documentada.
