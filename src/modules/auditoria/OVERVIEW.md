# Auditoria

Registra histórico de alterações (RF42, RN20, RNF09). Exporta `AuditoriaService` e não depende de outros módulos de domínio. A tabela pertence exclusivamente a este módulo.

`registrar(input, tx?)` grava usuário (nulo para sistema), entidade, ação, valores JSON e motivo opcional. Use a mesma transação da alteração para garantir atomicidade. Erros de persistência são propagados ao chamador.

Valores são copiados e campos de senha, tokens, segredos, autorização, cookies, documentos, e-mail e telefone são mascarados recursivamente, inclusive em arrays e com variações de caixa. Campos livres como motivo devem conter apenas justificativas de negócio sem dados pessoais ou segredos; envie snapshots mínimos, nunca corpos completos de requisição.

Não há endpoints nesta issue nem operações de edição ou exclusão. Consulta será implementada na BE-13. Não é necessária migration: a tabela já existe na BE-04.
