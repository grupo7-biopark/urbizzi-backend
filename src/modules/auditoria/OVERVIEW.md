# Auditoria

Registra histórico de alterações (RF42, RN20, RNF09). Exporta `AuditoriaService` e não depende de outros módulos de domínio. A tabela pertence exclusivamente a este módulo.

`registrar(input, tx?)` grava usuário (nulo para sistema), entidade, ação, valores JSON e motivo opcional. Use a mesma transação da alteração para garantir atomicidade. Erros de persistência são propagados ao chamador.

Valores são copiados e campos de senha, tokens, segredos, autorização, cookies, documentos, e-mail e telefone são mascarados recursivamente, inclusive em arrays e com variações de caixa. Campos livres como motivo devem conter apenas justificativas de negócio sem dados pessoais ou segredos; envie snapshots mínimos, nunca corpos completos de requisição.

Não há endpoints nesta issue nem operações de edição ou exclusão. Consulta será implementada na BE-13. Não é necessária migration: a tabela já existe na BE-04.

## Consulta (BE-13)

GET /v1/historico aceita entidadeTipo, entidadeId, usuarioId (autor), dataDe/dataAte e paginação. Ordena por createdAt/id decrescentes e devolve somente id/nome do autor, ou null para sistema. Datas simples incluem todo o dia UTC. ADMINISTRADOR e GESTOR consultam tudo; CONSULTA não acessa. COMERCIAL vê apenas entradas de Reserva/Proposta cujo vendedor é ele, independentemente de quem executou a alteração. Não se usa usuarioId da auditoria como prova de propriedade.

A consulta polimórfica usa um read model SQL parametrizado restrito a leitura de auditoria, nome do usuário e propriedade de reservas/propostas, com EXISTS e paginação no banco. Essa projeção não escreve em tabelas alheias nem cria dependências entre módulos ou ciclos. Datas/IDs inválidos retornam 400 e intervalo invertido retorna 422 PERIODO_INVALIDO. Sem endpoints de edição/exclusão.
