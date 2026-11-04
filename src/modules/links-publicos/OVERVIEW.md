# Links públicos (BE-37)

POST /v1/links-publicos gera token criptográfico base64url de 32 bytes, ativo e contador zero. loteamentoId é opcional, validado pelo LoteamentoService exportado; null representa todos. O campo é opcional conforme premissa da issue, mantendo escopo explícito para validação futura do cliente. GET /v1/links-publicos é paginado: Comercial vê os próprios, Admin/Gestor veem todos. POST /v1/links-publicos/:id/desativar é idempotente; Comercial só desativa os próprios. Consulta não acessa essas rotas.

Exporta LinkPublicoService. registrarAcesso(token) é chamado pelo mapa público (BE-38): valida token ativo e incrementa atomicamente, rejeitando inativo/inexistente com 404 LINK_NAO_ENCONTRADO. BE-38 consome esse método no endpoint público. Criar/desativar e auditoria usam a mesma transação; token nunca entra no histórico. Respostas com tokens usam Cache-Control no-store.

Depende de auditoria e loteamentos (BE-14) para validar o escopo por serviço, sem consultar tabelas alheias. Autorizações usam Perfis e policy de propriedade. As permissões, escopo, contagem concorrente, idempotência e rollback são cobertos em testes. Sem alteração no schema.

## Mapa público (BE-38)

GET /v1/publico/:token dispensa login e devolve planta ativa, marcadores { data, meta } e contatoComercial. Query aceita somente page/pageSize (máximo 100); escopo é o loteamento do link ou todos. Não permite ampliar o escopo por query. Cada página válida incrementa o contador de acessos uma vez; requests bloqueadas por validação/rate limit e tokens inválidos/inativos não incrementam. O contador mede consultas com token ativo, mesmo se ainda não existir planta ativa e a consulta do mapa terminar em 404.

60 requisições por IP por minuto, independentemente do token. Limite em memória por processo, como autenticação; réplicas exigem storage compartilhado. Não confia em X-Forwarded-For por padrão. Cache-Control no-store impede cache do token, da autorização do valor e de status antigos; Referrer-Policy no-referrer evita encaminhar o endereço como referência. Erros mascaram o path /v1/publico/:token; falhas inesperadas dessa rota têm log genérico, sem stack/argumentos com tokens.

Lista pública explícita: id do marcador, loteId, x/y, número, quadra/id, loteamento/id, área e status do lote. Valor só existe quando exibirValorPublico=true; não há ações, reservas, clientes, propostas, observações, ids de usuários ou tokens na resposta. Planta tem só identificação, dimensões, zoom e URL dos tiles. Contato geral PUBLICO_CONTATO_COMERCIAL pode ser URL, e-mail ou texto de atendimento. Sem configuração, orienta falar com a equipe que compartilhou o link, sem inventar número ou e-mail real.

Erros: 400 DADOS_INVALIDOS; 404 LINK_NAO_ENCONTRADO para token inválido/inexistente/inativo e PLANTA_ATIVA_NAO_ENCONTRADA sem planta; 429 MUITAS_REQUISICOES. Depende de MapaModule via MapaService exportado, além de loteamentos/auditoria. Sem novas dependências ou migrations.
