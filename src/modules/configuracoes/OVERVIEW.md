# Configurações (BE-11)

Exporta ConfiguracaoService com getPrazoReservaDias(tx?) e getPrazoAnaliseDiasUteis(tx?). Os prazos são inteiros positivos e usam padrão 7 quando ausentes; valores inválidos no banco geram CONFIGURACAO_INVALIDA. Só acessa a tabela configuracoes e depende de AuditoriaModule.

GET /v1/configuracoes é paginado; PATCH /v1/configuracoes recebe prazoReservaDias e/ou prazoAnaliseDiasUteis e devolve os dois valores. Ambas as rotas são exclusivas de ADMINISTRADOR. Valores inválidos/null e propriedades desconhecidas geram 400 DADOS_INVALIDOS; corpo vazio gera 422 CONFIGURACAO_VAZIA.

Cache de leitura por instância com TTL de 30 segundos; atualização bem-sucedida invalida após commit, com versão para impedir repovoamento por leitura antiga concorrente. Leituras com transação ignoram cache. Outras réplicas podem manter valor por até 30 segundos; invalidação distribuída não faz parte desta versão de nó único.

Alterações usam lock transacional de configuração, persistência e auditoria na mesma transação. Não alteram reservas/propostas existentes: consumidores devem copiar o prazo para novas operações na criação. limiteRenovacoes não é exposto, pois depende de validação de negócio ainda pendente na issue.

Testes cobrem cache, leitura tipada, atualização parcial, concorrência, rollback por falha de auditoria, validação e todos os perfis.
