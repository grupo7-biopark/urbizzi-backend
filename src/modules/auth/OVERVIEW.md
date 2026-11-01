# Autenticação

Implementa RF01/RNF05 e fornece a infraestrutura de autorização RF04/RNF06 (BE-09). Depende de `usuarios` e usa somente o `UsuarioService` exportado; é dono de `Sessao` e `TokenRecuperacaoSenha` (BE-08).

| Método | Rota | Perfis | Resultado |
| --- | --- | --- | --- |
| POST | /v1/auth/login | Público | 200: accessToken, refreshToken, tokenType, expiresIn |
| POST | /v1/auth/refresh | Público, exige refresh token válido | 200: novos tokens |
| POST | /v1/auth/logout | Público, exige refresh token no corpo | 204: revogação idempotente |
| GET | /v1/auth/me | Qualquer usuário ativo autenticado | 200: id, nome, e-mail e perfil atuais |

Senhas usam Argon2id. Login errado, e-mail ausente e usuário inativo têm resposta idêntica. Access JWT HS256 dura 15 minutos por padrão; refresh opaco dura 7 dias, possui hash SHA-256 persistido e é rotacionado atomicamente. Todas as rotas são protegidas pelo guard global salvo `@Public()`. `/health` continua aberto. Desativação invalida tokens existentes na próxima requisição; mudança de perfil é observada imediatamente.

Login e refresh têm limite de 5 tentativas por IP/rota por minuto (memória local). Logout revoga apenas o refresh informado; o access token já emitido permanece válido até expirar, salvo desativação. Não há CRUD de sessões.

## Códigos de erro

- 400 `DADOS_INVALIDOS`: corpo inválido.
- 401 `CREDENCIAIS_INVALIDAS`: login negado, sem revelar existência do e-mail.
- 401 `NAO_AUTENTICADO`: token ausente, inválido, expirado ou usuário desativado.
- 401 `REFRESH_TOKEN_INVALIDO`: refresh ausente no banco, expirado, revogado, já consumido ou usuário desativado.
- 429 `MUITAS_REQUISICOES`: limite de tentativas.

Configuração e orientações de uso em `docs/security.md`, `.env.example` e README. Dependências novas: `argon2` para hash de senha, `@nestjs/jwt` para JWT e `@nestjs/throttler` para limite de tentativas.

## Autorização (BE-09)

O módulo registra PerfisGuard global após JwtAuthGuard. `@Perfis(...)` restringe a rota aos perfis declarados; método substitui controller, lista vazia nega todos, ausência de decorator permite qualquer autenticado. `@Public()` dispensa ambos. Administrador deve aparecer explicitamente na lista.

403 ACESSO_NEGADO é a resposta padronizada para perfil não permitido ou propriedade negada. O perfil é o atual consultado pelo guard JWT, não o valor antigo do token. Policies de domínio podem usar `shared/domain/policies/propriedade.policy.ts` para permitir Admin/Gestor ou Comercial responsável; Consulta nunca altera. A matriz completa e exemplos estão em `docs/security.md`.

Não há endpoints de exemplo na API de produção: as rotas usadas para comprovar a matriz/propriedade são fixtures apenas do teste e2e. CRUD de outros módulos permanece fora deste escopo.

## Recuperação de senha (BE-08 / RF02)

| Método | Rota | Perfis | Resultado |
| --- | --- | --- | --- |
| POST | /v1/auth/forgot-password | Público | 202 sem corpo, para conta existente, ausente ou inativa |
| POST | /v1/auth/reset-password | Público | 204, senha alterada e refresh tokens revogados |

A solicitação recebe `{ "email": "usuario@exemplo.com" }`. A redefinição recebe `{ "token": "<token do e-mail>", "senha": "NovaSenha123!" }`; a nova senha deve ter entre 8 e 1024 caracteres. Ambas as rotas usam no-store e limite de 5 tentativas por IP/rota/minuto.

Tokens opacos de 32 bytes, com apenas SHA-256 persistido, expiram após uma hora. Token inexistente, expirado, usado ou de conta desativada gera `401 TOKEN_RECUPERACAO_INVALIDO`. Redefinição, consumo, invalidação de todos os links anteriores e revogação de todas as sessões do usuário usam a mesma transação; falha reverte tudo. Access JWT já emitido continua válido até expirar.

O contrato `Email` fica em `shared/application/email`; `EmailModule` fornece o adapter SMTP Nodemailer (dependência necessária para SMTP/TLS/autenticação sem protocolo próprio). O envio ocorre fora da transação. Falha SMTP mantém o mesmo 202 para evitar enumeração de contas; o usuário pode solicitar novo link. O link usa exclusivamente PASSWORD_RESET_URL configurada, nunca o Host da requisição. A página do frontend não faz parte desta entrega.
