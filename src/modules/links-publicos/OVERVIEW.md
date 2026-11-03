# Links públicos (BE-37)

POST /v1/links-publicos gera token criptográfico base64url de 32 bytes, ativo e contador zero. loteamentoId é opcional, validado pelo LoteamentoService exportado; null representa todos. O campo é opcional conforme premissa da issue, mantendo escopo explícito para validação futura do cliente. GET /v1/links-publicos é paginado: Comercial vê os próprios, Admin/Gestor veem todos. POST /v1/links-publicos/:id/desativar é idempotente; Comercial só desativa os próprios. Consulta não acessa essas rotas.

Exporta LinkPublicoService. registrarAcesso(token) será chamado pelo mapa público (BE-38): valida token ativo e incrementa atomicamente, rejeitando inativo/inexistente com 404 LINK_NAO_ENCONTRADO. Não adiciona endpoint público nem antecipa BE-38. Criar/desativar e auditoria usam a mesma transação; token nunca entra no histórico. Respostas com tokens usam Cache-Control no-store.

Depende de auditoria e loteamentos (BE-14) para validar o escopo por serviço, sem consultar tabelas alheias. Autorizações usam Perfis e policy de propriedade. As permissões, escopo, contagem concorrente, idempotência e rollback são cobertos em testes. Sem alteração no schema.
