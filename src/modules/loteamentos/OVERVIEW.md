# Módulo loteamentos

Cadastro dos loteamentos comercializados pela Urbizzi (RF05) e das suas quadras (RF06). Nas próximas issues, o módulo recebe lotes (BE-16) e importação por planilha (BE-17).

## Modelo de domínio

- `Loteamento`: `nome` (obrigatório, até 150 caracteres), `descricao` (texto livre, opcional) e `localizacao` (até 255 caracteres, opcional). Usa soft delete (`deletedAt`).
- `Quadra`: pertence a um loteamento (`loteamentoId`, imutável) e tem `numero` (até 20 caracteres). Usa soft delete.

## Regras de negócio

1. O nome é obrigatório e único entre os loteamentos não excluídos, sem diferenciar maiúsculas. A unicidade exata também é garantida pelo índice parcial `loteamentos_nome_key`.
2. Espaços nas pontas são removidos. Em `descricao` e `localizacao`, texto vazio vira `null`, e `null` no PATCH limpa o campo.
3. Um loteamento com quadras não excluídas não pode ser excluído (`409 LOTEAMENTO_COM_QUADRAS`).
4. A exclusão é lógica: o registro fica no banco com `deletedAt` preenchido e o nome pode ser reutilizado.
5. O número da quadra é único no loteamento entre as quadras não excluídas, sem diferenciar maiúsculas (índice parcial `quadras_loteamento_id_numero_key`). Não é possível mover uma quadra para outro loteamento.
6. Uma quadra com lotes não excluídos não pode ser excluída (`409 QUADRA_COM_LOTES`).
7. Criação, edição e exclusão são auditadas na mesma transação, com `entidadeTipo` `Loteamento` ou `Quadra` e ações `CRIAR`, `ALTERAR` e `EXCLUIR`. Os valores anterior e novo são os campos editáveis (loteamento: nome, descrição e localização; quadra: `loteamentoId` e número).

## Endpoints

| Método | Rota | Perfis | Descrição |
| --- | --- | --- | --- |
| `POST` | `/v1/loteamentos` | ADMINISTRADOR, GESTOR | cria um loteamento |
| `GET` | `/v1/loteamentos` | todos os autenticados | lista paginada; busca por nome com `q` |
| `GET` | `/v1/loteamentos/:id` | todos os autenticados | detalha um loteamento |
| `PATCH` | `/v1/loteamentos/:id` | ADMINISTRADOR, GESTOR | atualiza parcialmente |
| `DELETE` | `/v1/loteamentos/:id` | ADMINISTRADOR, GESTOR | exclui (soft delete) se não houver quadras |
| `POST` | `/v1/loteamentos/:loteamentoId/quadras` | ADMINISTRADOR, GESTOR | cria uma quadra no loteamento |
| `GET` | `/v1/loteamentos/:loteamentoId/quadras` | todos os autenticados | lista paginada das quadras do loteamento; busca por número com `q` |
| `GET` | `/v1/quadras/:id` | todos os autenticados | detalha uma quadra |
| `PATCH` | `/v1/quadras/:id` | ADMINISTRADOR, GESTOR | altera o número |
| `DELETE` | `/v1/quadras/:id` | ADMINISTRADOR, GESTOR | exclui (soft delete) se não houver lotes |

## Códigos de erro

| code | HTTP | Quando |
| --- | --- | --- |
| `LOTEAMENTO_NAO_ENCONTRADO` | 404 | id inexistente ou excluído (inclusive nas rotas de quadras do loteamento) |
| `LOTEAMENTO_JA_EXISTE` | 409 | outro loteamento não excluído já usa o nome |
| `LOTEAMENTO_COM_QUADRAS` | 409 | exclusão de loteamento com quadras |
| `QUADRA_NAO_ENCONTRADA` | 404 | id inexistente ou excluído |
| `QUADRA_JA_EXISTE` | 409 | outra quadra do loteamento já usa o número |
| `QUADRA_COM_LOTES` | 409 | exclusão de quadra com lotes |

## Dependências

- Importa `AuditoriaModule` e usa `AuditoriaService.registrar`.
- Exporta `LoteamentoService` (ainda sem consumidores).
- Não emite nem consome eventos.
