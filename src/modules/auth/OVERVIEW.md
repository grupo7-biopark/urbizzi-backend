# Autenticação

Implementa RF01 e RNF05. Depende de `usuarios` e usa somente o `UsuarioService` exportado; é dono de `Sessao` e `TokenRecuperacaoSenha` (recuperação na BE-08).

| Método | Rota | Perfis | Resultado |
| --- | --- | --- | --- |
| POST | /v1/auth/login | Público | 200: accessToken, refreshToken, tokenType, expiresIn |
| POST | /v1/auth/refresh | Público, exige refresh token válido | 200: novos tokens |
| POST | /v1/auth/logout | Público, exige refresh token no corpo | 204: revogação idempotente |
| GET | /v1/auth/me | Qualquer usuário ativo autenticado | 200: id, nome, e-mail e perfil atuais |

Senhas usam Argon2id. Login errado, e-mail ausente e usuário inativo têm resposta idêntica. Access JWT HS256 dura 15 minutos por padrão; refresh opaco dura 7 dias, possui hash SHA-256 persistido e é rotacionado atomicamente. Todas as rotas são protegidas pelo guard global salvo `@Public()`. `/health` continua aberto. Desativação invalida tokens existentes na próxima requisição; mudança de perfil é observada imediatamente.

Login e refresh têm limite de 5 tentativas por IP/rota por minuto (memória local). Logout revoga apenas o refresh informado; o access token já emitido permanece válido até expirar, salvo desativação. Não há CRUD de sessões nem recuperação de senha nesta issue.

## Códigos de erro

- 400 `DADOS_INVALIDOS`: corpo inválido.
- 401 `CREDENCIAIS_INVALIDAS`: login negado, sem revelar existência do e-mail.
- 401 `NAO_AUTENTICADO`: token ausente, inválido, expirado ou usuário desativado.
- 401 `REFRESH_TOKEN_INVALIDO`: refresh ausente no banco, expirado, revogado, já consumido ou usuário desativado.
- 429 `MUITAS_REQUISICOES`: limite de tentativas.

Configuração e orientações de uso em `docs/security.md`, `.env.example` e README. Dependências novas: `argon2` para hash de senha, `@nestjs/jwt` para JWT e `@nestjs/throttler` para limite de tentativas.
