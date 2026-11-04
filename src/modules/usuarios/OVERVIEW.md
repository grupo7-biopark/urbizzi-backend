# Usuários (BE-10 / RF03)

Dono de Usuario e Perfil. Depende de AuditoriaModule. Preserva UsuarioService exportado para autenticação e recuperação; GestaoUsuarioService concentra a gestão administrativa e usa contratos de repositórios sem acessar Prisma.

| Método | Rota | Perfis | Resultado |
| --- | --- | --- | --- |
| GET | /v1/usuarios | ADMINISTRADOR | Lista paginada; filtros perfil e ativo |
| GET | /v1/usuarios/:id | ADMINISTRADOR | Dados do usuário, inclusive inativo |
| POST | /v1/usuarios | ADMINISTRADOR | 201; cria ativo com senha inicial |
| PATCH | /v1/usuarios/:id | ADMINISTRADOR | Altera nome, e-mail e perfil |
| POST | /v1/usuarios/:id/ativar | ADMINISTRADOR | 200; ativa |
| POST | /v1/usuarios/:id/desativar | ADMINISTRADOR | 200; desativa |

Não existe exclusão física: usuários preservam referências e histórico. A criação exige senha de 8 a 1024 caracteres, armazenada somente como Argon2id pelo contrato existente. Convite por e-mail é a alternativa ao fluxo de senha inicial na issue e não foi implementado. E-mail é normalizado para minúsculas e sem espaços nas extremidades. Senha e hash não aparecem nas respostas, logs ou auditoria. PATCH não aceita senha, ativo nem valores nulos; as ações explícitas mudam a situação.

Não é permitido desativar ou mudar o perfil do último administrador ativo. A proteção inclui rebaixamento do próprio usuário e operações concorrentes. Alterações administrativas adquirem pg_advisory_xact_lock(10,10) em transação, antes do bloqueio individual usado na BE-08. O bloqueio global limita somente escritas administrativas, de baixo volume; evita decisões com contagem obsoleta. A exclusividade do e-mail também é garantida pela constraint já existente. Não há migração nem dependência nova.

Criação, edição (incluindo alteração de perfil), ativação e desativação são auditadas na mesma transação. Os snapshots contêm perfil, ativo e nomes dos campos alterados, sem valores pessoais. Falha de auditoria desfaz a escrita.

## Erros

- 400 DADOS_INVALIDOS: validação, UUID, filtro ou campo indevido.
- 401 NAO_AUTENTICADO: ausência de autenticação ou usuário inativo.
- 403 ACESSO_NEGADO: perfil diferente de Administrador.
- 404 USUARIO_NAO_ENCONTRADO: usuário ausente.
- 404 PERFIL_NAO_ENCONTRADO: perfil válido ainda não cadastrado no banco.
- 409 USUARIO_EMAIL_DUPLICADO: e-mail já utilizado.
- 409 ULTIMO_ADMINISTRADOR: desativação/rebaixamento eliminaria o último administrador ativo.

## Integração BE-07/BE-08

UsuarioService exporta autenticar(email, senha, tx?), findAtivoById(id, tx?), findAtivoByEmail, gerarSenhaHash, redefinirSenha e bloquearAutenticacao. Não retorna senha/hash em consultas de autenticação. O repositório de usuários permanece o único a acessar usuarios e perfis; autenticação em transação bloqueia por e-mail antes de ler a senha. A gestão bloqueia a mesma linha antes da edição. O guard consulta perfil e ativo atuais, portanto desativação e mudança de perfil são observadas nas requisições seguintes.
