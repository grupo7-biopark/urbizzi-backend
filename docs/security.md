# Segurança

> Status: autenticação (BE-07), recuperação de senha (BE-08) e autorização (BE-09) **ainda não estão implementadas**. Este documento define como elas devem ser feitas. A matriz de permissões segue o [escopo v2](<Urbizzi - Escopo do Sistema v2.md>).

## Autenticação

- Login por e-mail e senha em `POST /v1/auth/login`, que devolve um **access token JWT** (`Authorization: Bearer <token>`).
- JWT assinado com HS256 e `JWT_SECRET` (mínimo 32 caracteres, validado no schema de ambiente). Expiração configurável por `JWT_EXPIRES_IN` (padrão `8h`). A necessidade de refresh token será avaliada na BE-07.
- Payload mínimo: `{ sub: usuarioId, perfil, nome }`. Nunca coloque dados pessoais além do necessário (sem CPF, telefone etc.).
- Usuário com `ativo = false` não autentica, e um token emitido antes da desativação deixa de valer (o guard consulta o usuário).
- Senhas com hash **argon2id** (pacote `argon2`, parâmetros padrão). Nunca armazene, registre em log ou devolva a senha ou o hash.
- Erro de login sempre com a mesma resposta (`401 CREDENCIAIS_INVALIDAS`), sem revelar se o e-mail existe.
- Limite de tentativas no login e na recuperação de senha (`@nestjs/throttler`): `429 MUITAS_REQUISICOES`.

### Recuperação de senha (BE-08)

- `POST /v1/auth/recuperar-senha` sempre responde `202`, exista ou não o e-mail.
- Token aleatório de 32 bytes (`randomBytes`), enviado por e-mail; no banco fica só o **hash SHA-256** em `TokenRecuperacaoSenha`, com expiração de 1 hora e uso único.
- Ao redefinir a senha, todos os tokens de recuperação do usuário são invalidados.

## Autorização por perfil

### Perfis

| Perfil | Enum | Papel |
| --- | --- | --- |
| Administrador | `ADMINISTRADOR` | configura o sistema e gerencia usuários; tudo o que o Gestor faz |
| Gestor | `GESTOR` | gerencia cadastros, planta e links públicos; analisa propostas; vê auditoria e painel |
| Comercial | `COMERCIAL` | vendedor: cadastra clientes, cria e gerencia as **próprias** reservas e propostas, gera links públicos |
| Consulta | `CONSULTA` | somente leitura do mapa, dos lotes e do painel |

### Estratégia

A implementação fica em `src/shared/infra/auth/` (BE-07/BE-09):

1. **`JwtAuthGuard` global** (registrado como `APP_GUARD`): toda rota exige token válido. Rotas abertas são marcadas explicitamente com `@Public()` (ex.: login, recuperação de senha, `GET /health`, mapa público por token).
2. **`PerfisGuard` global** (segundo `APP_GUARD`): lê o decorator `@Perfis(...)` do método ou do controller. Sem `@Perfis`, a rota é permitida a qualquer usuário autenticado. Com `@Perfis`, o perfil do usuário precisa estar na lista; caso contrário, `403 ACESSO_NEGADO`.
3. **`ADMINISTRADOR` não é coringa automático**: inclua-o explicitamente em `@Perfis` quando ele puder executar a ação. Assim a matriz abaixo é a fonte de verdade e o código fica igual a ela.
4. **Regras de propriedade** (ex.: Comercial só altera as próprias reservas) não ficam no guard, que não conhece o recurso. Ficam em uma **policy** no `domain/policies/` do módulo, chamada pelo service depois de carregar o recurso:

```ts
// src/modules/reservas/domain/policies/reserva-propriedade.policy.ts (ilustrativo)
import { ForbiddenError } from '../../../../shared/domain/errors/domain.error.js';
import type { Reserva } from '../models/reserva.entity.js';

export interface UsuarioAutenticado {
  id: string;
  perfil: 'ADMINISTRADOR' | 'GESTOR' | 'COMERCIAL' | 'CONSULTA';
}

export class ReservaPropriedadePolicy {
  static assertPodeAlterar(usuario: UsuarioAutenticado, reserva: Reserva): void {
    if (usuario.perfil === 'COMERCIAL' && reserva.vendedorId !== usuario.id) {
      throw new ForbiddenError(
        'RESERVA_DE_OUTRO_VENDEDOR',
        'Você só pode alterar as suas próprias reservas',
      );
    }
  }
}
```

```ts
// controller
@Post(':id/renovar')
@Perfis(Perfil.ADMINISTRADOR, Perfil.GESTOR, Perfil.COMERCIAL)
renovar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() usuario: UsuarioAutenticado) {
  return this.reservaService.renovar(id, usuario);
}

// service
const reserva = await this.getOrFail(id);
ReservaPropriedadePolicy.assertPodeAlterar(usuario, reserva);
```

5. O usuário autenticado chega ao controller por `@CurrentUser()` e é passado ao service como parâmetro. Services nunca leem o `Request`.
6. Listagens também filtram por propriedade quando a regra exigir (ex.: "Minhas reservas" filtra `vendedorId = usuario.id`).
7. Resposta de permissão negada (guard ou policy):

```json
{
  "statusCode": 403,
  "code": "ACESSO_NEGADO",
  "message": "Você não tem permissão para executar esta ação",
  "path": "/v1/usuarios",
  "timestamp": "2026-10-28T12:00:00.000Z"
}
```

### Matriz de permissões

Fonte: seção "Perfis e permissões" do [escopo v2](<Urbizzi - Escopo do Sistema v2.md#perfis-e-permissões>). As linhas marcadas com † não estão na tabela do escopo e são **interpretações** do grupo a partir dos requisitos citados.

Legenda: ✅ permitido · 👤 permitido só para os próprios registros · — negado

| Ação | Administrador | Gestor | Comercial | Consulta |
| --- | --- | --- | --- | --- |
| Gerenciar usuários e configurações (prazos) | ✅ | — | — | — |
| Cadastrar, editar e excluir loteamentos, quadras e lotes; importar planilha | ✅ | ✅ | — | — |
| Enviar planta e posicionar marcadores | ✅ | ✅ | — | — |
| Cadastrar e editar clientes | ✅ | ✅ | ✅ | — |
| Ver e buscar clientes † (RF12, RNF08) | ✅ | ✅ | ✅ | — |
| Reservar, renovar e cancelar reserva (RN07) | ✅ | ✅ | 👤 (vendedor da reserva) | — |
| Listar reservas † ("Minhas reservas", RF19) | ✅ | ✅ | ✅ | — |
| Criar proposta | ✅ | ✅ | 👤 (sobre as suas reservas) | — |
| Acompanhar propostas † (RF23) | ✅ | ✅ | 👤 | — |
| Aprovar ou rejeitar proposta; ver pendências | ✅ | ✅ | — | — |
| Marcar lote como Vendido (RN14) | ✅ | ✅ | — | — |
| Bloquear e desbloquear lote (RN14) | ✅ | ✅ | — | — |
| Gerar link público | ✅ | ✅ | ✅ | — |
| Desativar link público † (RF38) | ✅ | ✅ | 👤 (links que gerou) | — |
| Ver mapa, lotes e painel | ✅ | ✅ | ✅ | ✅ |
| Ver histórico de alterações | ✅ | ✅ | 👤 (dos seus registros) | — |

"Dos seus registros", no histórico, significa as entradas de auditoria de reservas e propostas em que o usuário é o vendedor. A regra exata é definida na BE-13.

Ao implementar cada módulo, a coluna "Perfis" da tabela de endpoints do `OVERVIEW.md` precisa bater com esta matriz.

### Rotas públicas

- O mapa público (`/v1/links-publicos/:token/mapa`, BE-38) é `@Public()` e valida o token do link (ativo e não expirado). Ele expõe **só** o necessário para o mapa: identificação do lote, status e geometria/marcador. Nunca dados de cliente, vendedor, reserva ou proposta.
- Tokens de link público: aleatórios (`randomBytes(32)` em base64url), nunca sequenciais nem derivados do id.

## Dados pessoais (LGPD)

Dados pessoais tratados pelo sistema:

| Titular | Dados | Onde |
| --- | --- | --- |
| Cliente | nome, CPF/CNPJ, e-mail, telefone, endereço | `Cliente` |
| Usuário | nome, e-mail | `Usuario` |

Regras:

1. **Minimização**: só colete os campos necessários para reserva e proposta. Campo novo de dado pessoal precisa de justificativa no PR.
2. **Acesso**: dados de cliente só para os perfis da matriz (o perfil Consulta não vê clientes). Rotas que devolvem cliente nunca são `@Public()`.
3. **Exposição mínima nas respostas**: listagens e relações (ex.: reserva com cliente) devolvem só `id` e `nome` do cliente; documento, e-mail e telefone só no detalhe do cliente.
4. **Logs**: nunca registre corpo de requisição, headers `Authorization`, senhas, tokens, documentos, e-mails ou telefones. Logue ids.
5. **Auditoria**: o `AuditoriaService` mascara campos sensíveis (`senhaHash`, tokens) e não deve receber documento completo quando a alteração não for nele.
6. **Erros**: mensagens de erro não incluem dados pessoais (`'Já existe um cliente com esse documento'`, não `'... com o CPF 123...'`).
7. **Exclusão a pedido do titular**: clientes têm soft delete; se for necessário atender pedido de eliminação, os dados pessoais são **anonimizados** (substituídos), preservando reservas e propostas para histórico. O procedimento será definido no módulo `clientes`.
8. **Ambientes de desenvolvimento e seed** usam apenas dados fictícios. Nunca copie dados reais para o seu banco local.

## Segredos e configuração

- Todos os segredos vêm de variáveis de ambiente, validadas na inicialização em `src/config/env.validation.ts`. Variável nova: adicione ao schema Zod, ao `.env.example` (com valor fictício e comentário) e à tabela do README.
- `.env` e `.env.*` nunca são commitados (só `.env.example`).
- Nenhum segredo com valor padrão em produção: use `z.string().min(32)` sem `.default()` para `JWT_SECRET`, chaves do S3 etc.
- Não registre `process.env` nem o `ConfigService` inteiro em logs.
- Em código, leia configuração com `ConfigService<Env, true>`, nunca com `process.env` (exceção: `main.ts` e `prisma7.config.ts`).

## Outras práticas

- Validação de toda entrada com DTO (`whitelist` + `forbidNonWhitelisted` já estão globais).
- Upload de arquivos (BE-30): limite de tamanho, lista de tipos MIME permitidos e nome do objeto gerado pelo servidor (nunca o nome enviado pelo usuário).
- SQL cru só com `$queryRaw` usando template tag (parâmetros escapados); `$queryRawUnsafe`/`$executeRawUnsafe` só com strings fixas, nunca com entrada do usuário.
- Dependências: não adicione pacotes sem manutenção; rode `npm audit` ao atualizar.
