Closes #<!-- número da issue -->

## Objetivo

<!-- O que este PR entrega e por quê, em 2 a 4 frases. -->

## O que mudou

<!-- Lista das principais mudanças (módulos, rotas, tabelas, configuração). -->

-

## Testes realizados

- [ ] `npm run lint` sem erros
- [ ] `npm run format:check` ok
- [ ] `npm run build` ok
- [ ] `npm test` passando (unitários novos/alterados: <!-- quais -->)
- [ ] `npm run test:e2e` passando (e2e novos/alterados: <!-- quais -->)
- [ ] Cada `code` de erro novo tem um teste que o produz
- [ ] Cobertura de `domain/` e `application/` do módulo ≥ 80% (`npm run test:cov`)
- [ ] Testado manualmente no `docker compose up` (descreva abaixo, se aplicável)

<!-- Passos manuais executados e resultado. -->

## Decisões tomadas

<!-- Escolhas de design, alternativas descartadas e desvios em relação à issue ou aos docs. Escreva "Nenhuma" se não houver. -->

## Documentação

- [ ] Rotas documentadas no Swagger (`@ApiTags`, resumo JSDoc, `@ApiErrorResponses`, `@ApiPaginatedResponse`) e conferidas em `/docs`
- [ ] `OVERVIEW.md` do módulo criado/atualizado (regras, endpoints com perfis, códigos de erro, dependências)
- [ ] `docs/` atualizado se mudou arquitetura, padrão ou convenção
- [ ] Mapa de módulos (`docs/architecture.md`) atualizado se criou módulo ou dependência entre módulos
- [ ] Diagrama ER (`docs/database.md`) atualizado se alterou o schema
- [ ] `.env.example` e README atualizados se criou variável de ambiente

## Checklist de padrões

- [ ] Segue a estrutura de módulo e as regras de dependência entre camadas e módulos
- [ ] Migration nova revisada (sem editar migrations antigas)
- [ ] Sem dados pessoais ou segredos em logs, erros ou respostas indevidas
- [ ] Permissões por perfil conforme a matriz de `docs/security.md`
- [ ] Commits no padrão Conventional Commits
