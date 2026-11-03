# Clientes (BE-18)

Endpoints GET/POST /v1/clientes e GET/PATCH /v1/clientes/:id para ADMINISTRADOR, GESTOR e COMERCIAL. CONSULTA recebe 403 em todas as operações e acesso anônimo recebe 401. Não há exclusão nesta issue.

CPF/CNPJ numéricos são normalizados, verificados pelos dígitos e rejeitam sequências repetidas. DTO inválido gera 400 DADOS_INVALIDOS; duplicidade gera 409 CLIENTE_DOCUMENTO_DUPLICADO inclusive em concorrência; ausente gera 404 CLIENTE_NAO_ENCONTRADO. A entidade também valida invariantes nas chamadas internas.

Busca por q aceita nome parcial sem diferenciar caixa/acentos e documento com ou sem formatação. Listagem paginada retorna apenas id/nome; contatos e documento ficam no detalhe. Busca usa extensão PostgreSQL unaccent (migration nova), parâmetros SQL e paginação estável por data/id em transação de leitura repetível.

Exporta ClienteService. Persistência e auditoria são atômicas; auditoria mascara explicitamente nome, documento, contatos e observações, registrando campos alterados sem armazenar dados pessoais. A tabela clientes é acessada apenas pelo seu repositório. Histórico de reservas/propostas fica para BE-28. O contrato atual segue o documento numérico do schema; CNPJ alfanumérico exige mudança de escopo/schema.
