# Módulo loteamentos

Cadastro dos loteamentos comercializados pela Urbizzi (RF05), das suas quadras (RF06) e dos lotes (RF07, RF08), além da importação de lotes por planilha CSV ou XLSX (RF09).

## Modelo de domínio

- `Loteamento`: `nome` (obrigatório, até 150 caracteres), `descricao` (texto livre, opcional) e `localizacao` (até 255 caracteres, opcional). Usa soft delete (`deletedAt`).
- `Quadra`: pertence a um loteamento (`loteamentoId`, imutável) e tem `numero` (até 20 caracteres). Usa soft delete.
- `Lote`: pertence a uma quadra (`quadraId`, imutável); tem `numero` (até 20 caracteres), `areaM2` e `valor` (decimais trafegados como texto com 2 casas, `"360.00"`), `exibirValorPublico`, `observacoes`, `status` (`StatusLote`: `DISPONIVEL`, `RESERVADO`, `VENDIDO`, `BLOQUEADO`) e `teveReserva`. A resposta inclui o `loteamentoId` da quadra. Usa soft delete.

## Regras de negócio

1. O nome é obrigatório e único entre os loteamentos não excluídos, sem diferenciar maiúsculas. A unicidade exata também é garantida pelo índice parcial `loteamentos_nome_key`.
2. Espaços nas pontas são removidos. Em `descricao` e `localizacao`, texto vazio vira `null`, e `null` no PATCH limpa o campo.
3. Um loteamento com quadras não excluídas não pode ser excluído (`409 LOTEAMENTO_COM_QUADRAS`).
4. A exclusão é lógica: o registro fica no banco com `deletedAt` preenchido e o nome pode ser reutilizado.
5. O número da quadra é único no loteamento entre as quadras não excluídas, sem diferenciar maiúsculas (índice parcial `quadras_loteamento_id_numero_key`). Não é possível mover uma quadra para outro loteamento.
6. Uma quadra com lotes não excluídos não pode ser excluída (`409 QUADRA_COM_LOTES`).
7. O lote é único pela quadra e pelo número entre os não excluídos, sem diferenciar maiúsculas (RN21, índice parcial `lotes_quadra_id_numero_key`). Como a quadra pertence a um único loteamento, isso equivale à combinação loteamento, quadra e número. Não é possível mover um lote para outra quadra.
8. Área e valor são positivos, com até 2 casas decimais (área com até 10 dígitos inteiros e valor com até 12). O valor é opcional, e `null` no PATCH o limpa.
9. Todo lote nasce `DISPONIVEL`. O status não muda pelo CRUD: enviar `status` no corpo retorna `400 DADOS_INVALIDOS`. Ele muda só pelos fluxos de reserva, venda e bloqueio.
10. Só lote `DISPONIVEL` e sem histórico de reservas pode ser excluído (`409 LOTE_NAO_DISPONIVEL` e `409 LOTE_COM_RESERVAS`). O histórico é o campo `teveReserva`, que o fluxo de reserva (BE-19) deve marcar ao reservar o lote. Assim, este módulo não precisa ler a tabela `reservas`, que pertence a outro módulo.
11. A listagem de lotes aceita os filtros `loteamentoId`, `quadraId`, `status` (um ou mais, separados por vírgula) e `q` (parte do número), combinados entre si.
12. Criação, edição e exclusão são auditadas na mesma transação, com `entidadeTipo` `Loteamento`, `Quadra` ou `Lote` e ações `CRIAR`, `ALTERAR` e `EXCLUIR`. Os valores anterior e novo são os campos editáveis (loteamento: nome, descrição e localização; quadra: `loteamentoId` e número; lote: `quadraId`, número, área, valor, exibição do valor e observações), o que registra também as mudanças de valor.

### Importação por planilha (BE-17)

13. `POST /v1/lotes/importacao` recebe `multipart/form-data` com `arquivo` (`.csv` ou `.xlsx`, até 5 MB e 5000 lotes), `confirmar` e `criarCadastros` (ambos `false` por padrão). O formato é definido pela extensão do arquivo.
14. Colunas (linha 1): `loteamento`, `quadra`, `numero` e `area_m2` são obrigatórias; `valor` e `exibir_valor` são opcionais. O cabeçalho é reconhecido sem diferenciar maiúsculas, acentos e separadores, e com apelidos (`Área (m²)`, `lote`, `preço`, `Exibir valor público`). Linhas em branco são ignoradas.
15. Cada linha segue as regras do cadastro manual (tamanhos, área e valor positivos com até 2 casas). Os decimais aceitam ponto ou vírgula (`360,50`, `1.234,56`). `exibir_valor` aceita sim/não, s/n, true/false, 1/0 e x; vazio é `false`. No XLSX, os números são lidos como texto, sem passar por ponto flutuante.
16. Uma linha também é rejeitada se repetir loteamento, quadra e número de outra linha da planilha, se o lote já existir no sistema, ou se o loteamento ou a quadra não existirem e `criarCadastros` for `false`. Os nomes são comparados sem diferenciar maiúsculas.
17. A resposta (200) é sempre o relatório `{ importado, totalLinhas, lotes, loteamentosNovos, quadrasNovas, erros: [{ linha, mensagens }] }`, com o número da linha na planilha (o cabeçalho é a linha 1). Sem `confirmar`, nada é gravado (prévia). Com `confirmar`, só grava se não houver nenhum erro: tudo ou nada.
18. A gravação cria loteamentos, quadras e lotes em uma única transação e registra um histórico `CRIAR` por registro criado, com `motivo: 'Importação de planilha'`. Problemas no arquivo inteiro (formato, leitura, cabeçalho, vazio ou acima do limite) retornam `422` com `code` próprio.
19. `GET /v1/lotes/importacao/modelo?formato=xlsx|csv` baixa o modelo com o cabeçalho e uma linha de exemplo. O CSV usa `;`, vírgula decimal e BOM UTF-8, como o Excel em português; na leitura, o separador (`;`, `,` ou tabulação) é detectado e arquivos que não são UTF-8 são lidos como Windows-1252.
20. A leitura e a escrita ficam atrás da porta `Planilha` (`PLANILHA`), implementada por `ExcelPlanilha` com `read-excel-file`/`write-excel-file` (XLSX) e um leitor CSV próprio.

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
| `POST` | `/v1/lotes` | ADMINISTRADOR, GESTOR | cria um lote `DISPONIVEL` |
| `GET` | `/v1/lotes` | todos os autenticados | lista paginada com filtros `loteamentoId`, `quadraId`, `status` e `q` |
| `GET` | `/v1/lotes/:id` | todos os autenticados | detalha um lote |
| `PATCH` | `/v1/lotes/:id` | ADMINISTRADOR, GESTOR | atualiza o cadastro (sem status nem quadra) |
| `DELETE` | `/v1/lotes/:id` | ADMINISTRADOR, GESTOR | exclui (soft delete) lote disponível e sem reservas |
| `POST` | `/v1/lotes/importacao` | ADMINISTRADOR, GESTOR | valida (prévia) ou importa lotes de planilha CSV/XLSX |
| `GET` | `/v1/lotes/importacao/modelo` | ADMINISTRADOR, GESTOR | baixa o modelo de planilha (`formato=xlsx` ou `csv`) |

## Códigos de erro

| code | HTTP | Quando |
| --- | --- | --- |
| `LOTEAMENTO_NAO_ENCONTRADO` | 404 | id inexistente ou excluído (inclusive nas rotas de quadras do loteamento) |
| `LOTEAMENTO_JA_EXISTE` | 409 | outro loteamento não excluído já usa o nome |
| `LOTEAMENTO_COM_QUADRAS` | 409 | exclusão de loteamento com quadras |
| `QUADRA_NAO_ENCONTRADA` | 404 | id inexistente ou excluído (inclusive o `quadraId` na criação de lote) |
| `QUADRA_JA_EXISTE` | 409 | outra quadra do loteamento já usa o número |
| `QUADRA_COM_LOTES` | 409 | exclusão de quadra com lotes |
| `LOTE_NAO_ENCONTRADO` | 404 | id inexistente ou excluído |
| `LOTE_JA_EXISTE` | 409 | outro lote da quadra já usa o número |
| `LOTE_NAO_DISPONIVEL` | 409 | exclusão de lote que não está `DISPONIVEL` |
| `LOTE_COM_RESERVAS` | 409 | exclusão de lote que já foi reservado |
| `ARQUIVO_OBRIGATORIO` | 400 | importação sem o campo `arquivo` |
| `ARQUIVO_MUITO_GRANDE` | 413 | arquivo de importação acima de 5 MB |
| `IMPORTACAO_FORMATO_INVALIDO` | 422 | extensão diferente de `.csv` e `.xlsx` |
| `IMPORTACAO_ARQUIVO_INVALIDO` | 422 | arquivo que não pôde ser lido no formato da extensão |
| `IMPORTACAO_COLUNAS_AUSENTES` | 422 | cabeçalho sem alguma coluna obrigatória |
| `IMPORTACAO_SEM_LINHAS` | 422 | planilha sem lotes preenchidos |
| `IMPORTACAO_LIMITE_EXCEDIDO` | 422 | mais de 5000 lotes |

## Dependências

- Importa `AuditoriaModule` e usa `AuditoriaService.registrar` e `registrarVarios` (importação).
- Exporta `LoteamentoService` e `LoteService` (ainda sem consumidores; `reservas`, `propostas` e `mapa` vão usá-los).
- Não emite nem consome eventos.
