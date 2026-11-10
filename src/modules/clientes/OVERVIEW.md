# Clientes (BE-18)

Endpoints GET/POST /v1/clientes e GET/PATCH /v1/clientes/:id para ADMINISTRADOR, GESTOR e COMERCIAL. CONSULTA recebe 403 em todas as operações e acesso anônimo recebe 401. Não há exclusão nesta issue.

CPF/CNPJ numéricos são normalizados, verificados pelos dígitos e rejeitam sequências repetidas. DTO inválido gera 400 DADOS_INVALIDOS; duplicidade gera 409 CLIENTE_DOCUMENTO_DUPLICADO inclusive em concorrência; ausente gera 404 CLIENTE_NAO_ENCONTRADO. A entidade também valida invariantes nas chamadas internas.

Busca por q aceita nome parcial sem diferenciar caixa/acentos e documento com ou sem formatação. Listagem paginada retorna apenas id/nome; contatos e documento ficam no detalhe. Busca usa extensão PostgreSQL unaccent (migration nova), parâmetros SQL e paginação estável por data/id em transação de leitura repetível.

Exporta ClienteService. Persistência e auditoria são atômicas; auditoria mascara explicitamente nome, documento, contatos e observações, registrando campos alterados sem armazenar dados pessoais. A tabela clientes é acessada apenas pelos seus repositórios. O contrato atual segue o documento numérico do schema; CNPJ alfanumérico exige mudança de escopo/schema.

BE-19: ClienteService.validarExistencia(id, tx) valida cadastro não removido na transação do consumidor e não devolve dados pessoais.

## Histórico de reservas e propostas (BE-28, RF13)

`GET /v1/clientes/:id/historico?page=1&pageSize=20` devolve `{ data, meta }`, seguindo a paginação padrão. Administrador e Gestor consultam todo o histórico; Comercial consulta somente suas reservas e as propostas delas, conforme as permissões de acompanhamento de propostas. Consulta recebe `403 ACESSO_NEGADO` e anônimo recebe 401. O vendedor é definido pelo usuário autenticado, sem filtro externo que permita trocar o escopo.

Cada item é uma entrada `RESERVA` ou `PROPOSTA`, com `id`, `data`, resumo da `reserva` e `proposta` (null nas entradas de reserva). Ordenação global por início da reserva ou envio da proposta, decrescente, com desempate por id decrescente e tipo crescente. Aprovação/rejeição aparece na decisão da proposta; não cria um evento adicional na linha do tempo.

- Reserva: id, status, dataInicio, dataVencimento e lote (id, numero, quadra, loteamentoId e loteamento).
- Proposta: id, valor como texto decimal com duas casas, status, dataEnvio, prazoLimite e decisao (decididoPorId, data e motivo; null enquanto não decidida).
- Todas as datas são ISO 8601 UTC. Inclui todos os status de reserva (ATIVA, CANCELADA, EXPIRADA, CONVERTIDA) e proposta (EM_ANALISE, APROVADA, REJEITADA), sem descartar envios anteriores após rejeição.

Cliente existente sem histórico visível e página além da última retornam 200 com lista vazia; cliente ausente ou removido retorna `404 CLIENTE_NAO_ENCONTRADO`. Lote, quadra e loteamento removidos logicamente continuam identificados no histórico. Os identificadores e nomes são os atuais desses cadastros, sem snapshot de alterações passadas. A rota valida UUID e paginação, rejeita parâmetros desconhecidos e usa `Cache-Control: no-store`.

Consulta somente leitura: não grava auditoria e não modifica status. Não retorna nome, documento ou contatos do cliente/usuário, condições ou observações da proposta. O adapter de histórico usa uma projeção SQL parametrizada documentada em `docs/architecture.md`, com existência, total e página no mesmo snapshot, sem consultas por item ou dependência circular entre módulos. Não requer migration nem nova dependência.
