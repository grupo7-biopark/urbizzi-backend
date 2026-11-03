# Módulo loteamentos

Cadastro dos loteamentos comercializados pela Urbizzi (RF05). Nas próximas issues, o módulo recebe quadras (BE-15), lotes (BE-16) e importação por planilha (BE-17).

## Modelo de domínio

- `Loteamento`: `nome` (obrigatório, até 150 caracteres), `descricao` (texto livre, opcional) e `localizacao` (até 255 caracteres, opcional). Usa soft delete (`deletedAt`).
- Contém `Quadra` (1:N), que pertence a este módulo.

## Regras de negócio

1. O nome é obrigatório e único entre os loteamentos não excluídos, sem diferenciar maiúsculas. A unicidade exata também é garantida pelo índice parcial `loteamentos_nome_key`.
2. Espaços nas pontas são removidos. Em `descricao` e `localizacao`, texto vazio vira `null`, e `null` no PATCH limpa o campo.
3. Um loteamento com quadras não excluídas não pode ser excluído (`409 LOTEAMENTO_COM_QUADRAS`).
4. A exclusão é lógica: o registro fica no banco com `deletedAt` preenchido e o nome pode ser reutilizado.
5. Criação, edição e exclusão são auditadas na mesma transação (`entidadeTipo: 'Loteamento'`, ações `CRIAR`, `ALTERAR` e `EXCLUIR`), com nome, descrição e localização como valores anterior e novo.

## Endpoints

| Método | Rota | Perfis | Descrição |
| --- | --- | --- | --- |
| `POST` | `/v1/loteamentos` | ADMINISTRADOR, GESTOR | cria um loteamento |
| `GET` | `/v1/loteamentos` | todos os autenticados | lista paginada; busca por nome com `q` |
| `GET` | `/v1/loteamentos/:id` | todos os autenticados | detalha um loteamento |
| `PATCH` | `/v1/loteamentos/:id` | ADMINISTRADOR, GESTOR | atualiza parcialmente |
| `DELETE` | `/v1/loteamentos/:id` | ADMINISTRADOR, GESTOR | exclui (soft delete) se não houver quadras |

## Códigos de erro

| code | HTTP | Quando |
| --- | --- | --- |
| `LOTEAMENTO_NAO_ENCONTRADO` | 404 | id inexistente ou excluído |
| `LOTEAMENTO_JA_EXISTE` | 409 | outro loteamento não excluído já usa o nome |
| `LOTEAMENTO_COM_QUADRAS` | 409 | exclusão de loteamento com quadras |

## Dependências

- Importa `AuditoriaModule` e usa `AuditoriaService.registrar`.
- Exporta `LoteamentoService` (ainda sem consumidores).
- Não emite nem consome eventos.
