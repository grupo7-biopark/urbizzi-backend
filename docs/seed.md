# Seed inicial e exemplos (BE-05)

Depois de instalar dependências e aplicar as migrations:

```bash
npm run db:deploy
npm run db:seed
```

O comando compila o projeto e executa o seed configurado em `prisma7.config.ts`.
Não inicia a API, workers, SMTP ou canais de eventos. O bootstrap exige somente
`DATABASE_URL`, `SEED_ADMIN_EMAIL` e `SEED_ADMIN_SENHA`. `SEED_ADMIN_NOME` é opcional,
com padrão Administrador. As variáveis são lidas do ambiente ou `.env`.

São criados os quatro perfis, os prazos `prazo_reserva_dias` e
`prazo_analise_dias_uteis` com valor 7 e o administrador inicial. O e-mail é
normalizado e a senha é armazenada com Argon2id, usando o mesmo hasher da API.
Não existe senha padrão. Nenhum valor de credencial aparece na saída do comando.

Após o primeiro seed, use `POST /v1/auth/login` com as credenciais que você definiu.
Em produção, execute o comando no pipeline/ambiente com Prisma CLI e dependências
de build disponíveis, como já acontece com as migrations. O seed não roda
automaticamente ao iniciar a API ou o Docker Compose.

## Repetição e dados existentes

Pode repetir os comandos. Perfis são identificados pelo código, configurações
pela chave e o administrador pelo e-mail. Senhas, nomes, perfis, situação das
contas e prazos já existentes são preservados. Alterar `SEED_ADMIN_SENHA` não
redefine uma senha cadastrada; use o fluxo de recuperação de senha da aplicação.
Uma conta desativada permanece desativada.

Se o e-mail inicial pertencer a um perfil diferente de Administrador, o comando
falha e desfaz as inserções. Ele não promove contas existentes. Dois processos de
seed são serializados por um bloqueio transacional do PostgreSQL.

## Exemplos de desenvolvimento

Configure `NODE_ENV=development` e `SEED_DEV_SENHA` no `.env`. Inicie Garage com seus
buckets e credenciais locais antes de executar:

```bash
docker compose up -d --build --wait garage
npm run db:seed:dev
```

O comando inclui o bootstrap e cria:

- Gestor, Comercial e Consulta fictícios, além do administrador inicial.
- Dois loteamentos, quatro quadras, doze lotes e dois clientes fictícios.
- Uma reserva ativa com proposta em análise e uma venda com proposta aprovada.
- Lotes disponíveis, reservado, vendido e bloqueado para testar filtros/fluxos.
- Uma planta fictícia de 256 × 256 px, original PNG e tile WebP reais no storage,
  com doze marcadores. É ativada somente se ainda não existir uma planta ativa.

Contas de exemplo usam a senha `SEED_DEV_SENHA` e os e-mails:

| Perfil | E-mail fictício |
| --- | --- |
| Gestor | gestor@desenvolvimento.example |
| Comercial | comercial@desenvolvimento.example |
| Consulta | consulta@desenvolvimento.example |

O comando recusa exemplos fora de `NODE_ENV=development`. Não contém credenciais
padrão e não deve ser executado contra dados de produção.

Os exemplos usam identificadores estáveis e inserção somente dos registros
faltantes. Alterações de situação, observações, senhas, prazos e posições já
existentes são preservadas. Datas das reservas não são avançadas a cada execução.
Registros com soft delete não são reativados. Se uma conta/identidade de exemplo
colidir com dados existentes, a transação falha em vez de tomar posse deles.

Uma planta já cadastrada pelo seed não tem seus arquivos sobrescritos ao repetir
o comando. Uma falha antes de registrar o mapa não deixa uma planta PRONTA com
arquivos ausentes. Se a transação de banco falhar depois dos uploads, os mesmos
dois objetos de exemplo podem permanecer; a próxima tentativa reutiliza suas
chaves. Não há limpeza de arquivos ou registros de usuários.

## Testes

`test/database/seed.e2e-spec.ts` executa o seed duas vezes num banco limpo e cobre
contagens, login, preservação de dados, conflito de perfil, concorrência, arquivos
reais e consulta do mapa. O CI também executa os comandos básicos e de
desenvolvimento repetidamente, com PostgreSQL e Garage isolados.
