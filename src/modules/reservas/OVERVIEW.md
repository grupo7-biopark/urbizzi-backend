# Reservas (BE-19)

Dono de Reserva e ReservaRenovacao. Importa LoteamentosModule, ClientesModule, ConfiguracoesModule e AuditoriaModule; exporta ReservaService. POST /v1/reservas recebe loteId/clienteId, vincula o usuário logado como vendedor e exige ADMINISTRADOR/GESTOR/COMERCIAL. GET /v1/reservas/:id tem os mesmos perfis; Comercial só consulta reserva própria. Retorna prazo e tempoRestanteSegundos limitado a zero.

Prazo em dias corridos (24 horas UTC por dia), obtido de ConfiguracaoService dentro da transação; padrão sete dias. LoteService bloqueia a linha ao ler em transação, valida DISPONIVEL, atualiza condicionalmente RESERVADO e teveReserva=true. O mesmo bloqueio protege exclusão/bloqueio concorrentes. Cliente é validado por serviço exportado. Reserva, lote e as duas auditorias compartilham o commit; snapshots não recebem dados pessoais de cliente. Índice parcial existente é a segunda proteção para uma única reserva ATIVA por lote; colisão retorna 409 RESERVA_LOTE_JA_RESERVADO.

Erros: 400 DADOS_INVALIDOS, 401 NAO_AUTENTICADO, 403 ACESSO_NEGADO, 404 RESERVA_NAO_ENCONTRADA/LOTE_NAO_ENCONTRADO/CLIENTE_NAO_ENCONTRADO, 409 LOTE_NAO_DISPONIVEL/LOTE_STATUS_ALTERADO/RESERVA_LOTE_JA_RESERVADO, 422 CONFIGURACAO_INVALIDA. Sem migration/dependência nova. Renovação, cancelamento, expiração e listagem seguem nas respectivas issues.

## Listagem (BE-22)

GET /v1/reservas e /v1/reservas/minhas são paginados (page/pageSize) e exigem Admin/Gestor/Comercial. Consulta recebe 403. Comercial só vê próprias nos dois endpoints; /minhas sempre força usuário logado, inclusive gestor/admin. Filtros combináveis: status (vírgulas), vendedorId (restrito ao próprio para Comercial), loteamentoId e vencimentoDe/vencimentoAte em ISO8601 com fuso, extremos inclusivos. Período invertido retorna 400 PERIODO_INVALIDO; demais entradas inválidas 400 DADOS_INVALIDOS.

Ordenação estável por vencimento crescente e id. Retorna resumo do lote, cliente (só id/nome; nome nulo quando removido) e última proposta (id/status/valor decimal, sem condições). Cache-Control no-store. A projeção SQL documentada em architecture.md faz página/contagem num snapshot, sem N+1, preserva cadastros históricos e não escreve em tabelas alheias.
