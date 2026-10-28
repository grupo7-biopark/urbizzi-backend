# Urbizzi - Escopo do Sistema v2

Oct 27, 2026 · @Victor

## Visão geral

O sistema é uma ferramenta web de gestão da disponibilidade dos lotes da Urbizzi, centrada em um mapa interativo. Ele garante que o status de cada lote seja único e confiável para toda a equipe, e registra reservas, propostas e vendas com responsável e histórico.

Este documento é a base para quebrar o trabalho em tarefas. Ele substitui a proposta anterior, que tratava o sistema como um CRM completo.

Mudanças após a validação com o cliente:

| Antes | Agora |
| --- | --- |
| CRM completo de negociação | A negociação detalhada fica no CRM que a Urbizzi já usa. O sistema controla status, reserva e proposta simplificada. |
| Fila de interessados com várias reservas por lote | Uma única reserva ativa por lote |
| Status separados para lote e negociação | Status do lote (Disponível, Reservado, Vendido, Bloqueado) e status da proposta |
| Status Aprovada visível no mapa | Aprovação não aparece no mapa. O lote fica Reservado até o gestor marcar Vendido. |
| Planta em DXF com georreferenciamento | Planta humanizada em imagem, com marcadores posicionados pela equipe |
| Link público fixo por loteamento | Link público gerado pelo vendedor |

Não haverá integração com o CRM nesta versão. As atualizações entre os dois sistemas são manuais.

## Escopo

| Faixa | Itens |
| --- | --- |
| Primeira versão | Usuários e perfis; cadastro de loteamentos, quadras e lotes; cadastro de clientes; reserva com prazo configurável, renovação e expiração automática; proposta com aprovação ou rejeição do gestor; marcação de venda e bloqueio pelo gestor; upload da planta e editor de marcadores; mapa interativo interno; link público gerado pelo vendedor; painel com lotes reservados e vendas; histórico de alterações |
| Evoluções futuras | Integração com o CRM da Urbizzi; alinhamento da planta sobre o mapa de satélite (georreferenciamento); outros tipos de imóvel; reversão de lote vendido (distrato); fotos e documentos por lote; notificações |
| Fora do escopo | Captação e contato com leads; negociação detalhada (fica no CRM); contrato, pagamento e parcelamento; reserva feita pelo próprio cliente; aplicativo nativo |

## Perfis e permissões

Administradores definidos pelo cliente: Vinicius e Victor. Clientes finais não têm login; eles acessam apenas o link público.

| Ação | Administrador | Gestor | Comercial | Consulta |
| --- | --- | --- | --- | --- |
| Gerenciar usuários e configurações | Sim | Não | Não | Não |
| Cadastrar loteamentos, quadras e lotes | Sim | Sim | Não | Não |
| Enviar planta e posicionar marcadores | Sim | Sim | Não | Não |
| Cadastrar e editar clientes | Sim | Sim | Sim | Não |
| Reservar, renovar e cancelar reserva | Sim | Sim | Sim (suas reservas) | Não |
| Criar proposta | Sim | Sim | Sim (suas reservas) | Não |
| Aprovar ou rejeitar proposta | Sim | Sim | Não | Não |
| Marcar lote como Vendido | Sim | Sim | Não | Não |
| Bloquear e desbloquear lote | Sim | Sim | Não | Não |
| Gerar link público | Sim | Sim | Sim | Não |
| Ver mapa, lotes e painel | Sim | Sim | Sim | Sim |
| Ver histórico de alterações | Sim | Sim | Apenas dos seus registros | Não |

O perfil Consulta é interno e somente leitura. Ainda não há usuário definido para ele.

## Status do lote e da proposta

O lote tem quatro status, visíveis no mapa e no link público. A proposta tem status próprio, visível apenas internamente.

&#91;embedded content: status do lote e da proposta, com quem executa cada transição\]

Enquanto houver reserva ativa, o lote fica Reservado, inclusive com proposta aprovada. A aprovação apenas habilita o gestor a marcar Vendido depois da assinatura do contrato.

## Fluxos principais

### Reserva

1. O vendedor localiza um lote Disponível no mapa ou na lista.
2. O vendedor seleciona ou cadastra o cliente.
3. O vendedor confirma a reserva. O prazo padrão vem da configuração.
4. O lote passa para Reservado imediatamente, no mapa interno e no link público.

### Proposta e aprovação

1. Com o lote reservado, o vendedor cria a proposta: valor, condições e observações.
2. A proposta entra na lista de pendências do gestor, com prazo de análise de 7 dias úteis.
3. O gestor aprova ou rejeita, informando o motivo.
4. Se o prazo vencer sem decisão, a proposta aparece como atrasada na lista do gestor.

### Venda

1. Com a proposta aprovada, contrato e assinatura acontecem fora do sistema. O lote continua Reservado.
2. Após a assinatura, o gestor marca o lote como Vendido.

### Expiração, renovação e cancelamento

- Antes do vencimento, o vendedor pode renovar a reserva por mais um período.
- Quando a reserva vence sem renovação, o lote volta automaticamente para Disponível.
- O vendedor pode cancelar a reserva a qualquer momento. O lote volta para Disponível.

### Bloqueio

- O gestor bloqueia um lote Disponível por decisão administrativa, com motivo obrigatório.
- O gestor desbloqueia o lote, que volta para Disponível.

## Regras de negócio

Itens marcados como **premissa** são decisões do grupo ainda não validadas com o cliente.

| Código | Regra |
| --- | --- |
| RN01 | Um lote tem no máximo uma reserva ativa. Não existe fila de interessados. |
| RN02 | Só é possível reservar um lote Disponível. |
| RN03 | A reserva sempre está vinculada a um cliente e ao vendedor que a criou. |
| RN04 | O prazo padrão da reserva é configurado pelo administrador. |
| RN05 | A reserva pode ser renovada antes de vencer. Cada renovação fica no histórico. |
| RN06 | Reserva vencida sem renovação é encerrada automaticamente e o lote volta para Disponível. |
| RN07 | Somente o vendedor responsável, o gestor ou o administrador podem renovar ou cancelar uma reserva. |
| RN08 | Uma reserva tem no máximo uma proposta em análise por vez. |
| RN09 | O prazo de análise da proposta é de 7 dias úteis contados do envio. O vencimento não muda o status da proposta, apenas a marca como atrasada. |
| RN10 | Aprovação e rejeição exigem registro do gestor responsável e motivo. |
| RN11 | **Premissa:** proposta rejeitada não encerra a reserva. O vendedor pode enviar nova proposta enquanto a reserva estiver válida. |
| RN12 | **Premissa:** reserva com proposta aprovada não expira automaticamente. |
| RN13 | **Premissa:** o lote só pode ser marcado como Vendido se tiver uma proposta aprovada. |
| RN14 | Somente gestor ou administrador marcam Vendido, bloqueiam e desbloqueiam lotes. |
| RN15 | Bloqueio só é permitido em lote Disponível e exige motivo. |
| RN16 | Lote Vendido não volta para outro status nesta versão. |
| RN17 | O status Aprovada da proposta não aparece no mapa nem no link público. |
| RN18 | O link público exibe todos os lotes com seu status. Nunca exibe dados do cliente ou da proposta. |
| RN19 | O valor do lote só aparece no link público quando autorizado no cadastro do lote. |
| RN20 | Toda mudança de status registra usuário, data e hora, valor anterior, valor novo e motivo, quando houver. |
| RN21 | O lote é único pela combinação de loteamento, quadra e número. |

## Requisitos funcionais

### M1. Acesso e usuários

- RF01: login com e-mail e senha.
- RF02: recuperação de senha por e-mail.
- RF03: o administrador cria, edita, desativa e define o perfil dos usuários.
- RF04: o sistema aplica as permissões de cada perfil em telas e na API.

### M2. Loteamentos, quadras e lotes

- RF05: cadastro de loteamento: nome, descrição e localização.
- RF06: cadastro de quadra vinculada ao loteamento.
- RF07: cadastro de lote: loteamento, quadra, número, área (m²), valor, exibir valor no link público (sim/não), observações.
- RF08: listagem de lotes com filtros por loteamento, quadra e status, e busca por número.
- RF09: importação de lotes por planilha (CSV ou XLSX) com validação e relatório de erros.
- RF10: tela de detalhe do lote com status atual, reserva ativa, propostas e histórico.

### M3. Clientes

- RF11: cadastro de cliente: nome, CPF ou CNPJ, telefone, e-mail e observações.
- RF12: busca de cliente por nome ou documento no momento da reserva, com cadastro rápido se não existir.
- RF13: histórico de reservas e propostas do cliente.

### M4. Reservas

- RF14: criar reserva para um lote Disponível, vinculando cliente e vendedor.
- RF15: exibir data de início, data de vencimento e tempo restante.
- RF16: renovar reserva antes do vencimento.
- RF17: cancelar reserva com motivo.
- RF18: rotina automática que encerra reservas vencidas e devolve o lote para Disponível.
- RF19: lista "Minhas reservas" para o vendedor, ordenada por vencimento.

### M5. Propostas

- RF20: criar proposta para uma reserva ativa: valor, condições e observações.
- RF21: lista de propostas pendentes para o gestor, com destaque para as atrasadas.
- RF22: aprovar ou rejeitar proposta com motivo.
- RF23: o vendedor acompanha o status das suas propostas.

### M6. Venda e bloqueio

- RF24: o gestor marca o lote como Vendido a partir da proposta aprovada.
- RF25: o gestor bloqueia e desbloqueia lotes com motivo.

### M7. Planta e marcadores

- RF26: upload da planta como imagem única ou conjunto de fatias.
- RF27: processamento da planta em tiles para zoom progressivo.
- RF28: editor de marcação: clicar na planta para criar um marcador, arrastar para ajustar e vincular a um lote.
- RF29: lista de lotes sem marcador, para facilitar a marcação.
- RF30: envio de nova versão da planta, mantendo os marcadores existentes para revisão.

### M8. Mapa interativo

- RF31: exibir a planta com zoom e arraste, em computador e celular.
- RF32: marcadores coloridos pelo status do lote, com legenda.
- RF33: ao clicar no marcador, exibir número, quadra, área, valor e status, mais as ações permitidas ao perfil (reservar, ver reserva, marcar vendido).
- RF34: filtrar marcadores por loteamento e status.

### M9. Link público

- RF35: o vendedor gera um link público a partir do sistema.
- RF36: a página pública exibe o mapa e os lotes com status atualizado, em somente leitura.
- RF37: a página exibe a forma de contato com o comercial (vendedor que gerou o link ou contato geral).
- RF38: o vendedor pode desativar um link que gerou.

### M10. Painel

- RF39: contagem de lotes por status, geral e por loteamento.
- RF40: vendas efetuadas por período.
- RF41: reservas ativas e propostas pendentes.

### M11. Histórico e configurações

- RF42: registro de auditoria de todas as mudanças de status, reservas, propostas e cadastros.
- RF43: consulta do histórico por lote, cliente e usuário.
- RF44: o administrador configura o prazo padrão da reserva e o prazo de análise da proposta.

## Mapa interativo: abordagem técnica

A planta é uma imagem muito grande, então o mapa funciona como o Google Maps: a imagem é cortada em tiles por nível de zoom e o navegador carrega só o que está na tela.

Dados da planta recebida:

- Formato: 9 fatias PNG em grade 3 x 3, cada uma com 4404 x 3482 px e cerca de 32 MB.
- Imagem completa: cerca de 13.200 x 10.400 px (138 megapixels). Inviável de carregar inteira, principalmente no celular.
- Uma única planta cobre vários loteamentos do Biopark (Universitário Eixão Sul, Universitário Norte, Centro Industrial Arno Donaduzzi).
- A legenda do cliente já define as cores: Disponível verde, Vendido rosa, Reservado azul. O sistema adota essas cores e define uma para Bloqueado.

Pipeline proposto:

1. O administrador envia a imagem única ou as fatias.
2. O servidor junta as fatias, se for o caso, e gera a pirâmide de tiles (por exemplo, com libvips).
3. Os tiles ficam em armazenamento de objetos. A planta recebe status "processando" e depois "pronta".
4. O frontend exibe a planta com Leaflet em modo `CRS.Simple` (imagem sem coordenadas geográficas) ou com OpenSeadragon.
5. Os marcadores são guardados em coordenadas normalizadas da imagem (x e y entre 0 e 1). Assim, uma nova versão da planta com a mesma proporção reaproveita as posições.

Cuidado: a imagem atual já tem os círculos de status desenhados. Se os marcadores do sistema ficarem por cima, haverá conflito visual. O ideal é receber a planta sem esses círculos (ver Pontos em aberto).

O alinhamento da planta sobre o mapa de satélite (georreferenciamento) fica como evolução futura. Ele não é necessário para o que o cliente pediu.

## Modelo de dados revisado

O modelo ER v1 é simplificado. Saem as tabelas de georreferenciamento (PONTO\_CONTROLE, GEORREFERENCIAMENTO, GEORREF\_PONTO\_CONTROLE, LOTE\_GEOMETRIA, PLANTA\_POLIGONO), NOTIFICACAO, FOTO e DOCUMENTO. Todas as chaves são uuid.

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| PERFIL | id, nome | Administrador, Gestor, Comercial, Consulta |
| USUARIO | id, nome, email, senha\_hash, perfil\_id, ativo, created\_at | email único |
| LOTEAMENTO | id, nome, descricao, localizacao, created\_at |  |
| QUADRA | id, loteamento\_id, numero | Única por loteamento. Pode receber parâmetros urbanísticos no futuro. |
| LOTE | id, quadra\_id, numero, area\_m2, valor, exibir\_valor\_publico, status, observacoes, created\_at, updated\_at | Status: Disponível, Reservado, Vendido, Bloqueado. Único por quadra e número. |
| CLIENTE | id, nome, documento, telefone, email, observacoes, created\_at | documento único (CPF ou CNPJ) |
| RESERVA | id, lote\_id, cliente\_id, vendedor\_id, data\_inicio, data\_vencimento, status, motivo\_encerramento, created\_at | Status: ativa, cancelada, expirada, convertida (lote vendido). Uma ativa por lote. |
| RESERVA\_RENOVACAO | id, reserva\_id, usuario\_id, vencimento\_anterior, vencimento\_novo, created\_at | Histórico de renovações |
| PROPOSTA | id, reserva\_id, vendedor\_id, valor, condicoes, observacoes, status, data\_envio, prazo\_limite, decidido\_por\_id, data\_decisao, motivo\_decisao | Status: em\_analise, aprovada, rejeitada |
| PLANTA | id, nome, versao, status, largura\_px, altura\_px, tiles\_path, max\_zoom, ativa, criado\_por\_id, created\_at | Independente de loteamento. Apenas uma ativa. |
| MARCADOR | id, planta\_id, lote\_id, x, y, created\_at, updated\_at | x e y normalizados entre 0 e 1. Um marcador por lote por planta. |
| LINK\_PUBLICO | id, token, criado\_por\_id, loteamento\_id (opcional), ativo, acessos, created\_at | Token aleatório na URL |
| CONFIGURACAO | chave, valor | prazo\_reserva\_dias, prazo\_analise\_dias\_uteis |
| HISTORICO\_AUDITORIA | id, usuario\_id, entidade\_tipo, entidade\_id, acao, valor\_anterior, valor\_novo, motivo, created\_at | Referência polimórfica |

## Requisitos não funcionais

| Código | Requisito |
| --- | --- |
| RNF01 | Sistema web responsivo, utilizável em computador, tablet e celular. |
| RNF02 | Mudanças de status aparecem no mapa interno e no link público sem precisar recarregar a página, ou no máximo ao recarregar. |
| RNF03 | O mapa carrega a primeira visualização rapidamente em conexão móvel, carregando apenas os tiles visíveis. |
| RNF04 | A criação de reserva é atômica: duas tentativas simultâneas no mesmo lote resultam em apenas uma reserva. |
| RNF05 | Senhas armazenadas com hash seguro. Sessões com expiração. |
| RNF06 | Permissões validadas no servidor, não apenas na interface. |
| RNF07 | O link público não expõe dados pessoais de clientes, propostas ou usuários. |
| RNF08 | Dados pessoais de clientes tratados conforme a LGPD: acesso restrito a perfis internos. |
| RNF09 | O registro de auditoria não pode ser editado nem apagado pela interface. |
| RNF10 | Dias úteis calculados excluindo sábados, domingos e feriados nacionais. |
| RNF11 | Rotina de expiração de reservas executada periodicamente, com tolerância de poucos minutos. |

## Épicos sugeridos

Cada épico pode ser quebrado em tarefas a partir dos requisitos listados.

| Épico | Entrega | Requisitos | Depende de |
| --- | --- | --- | --- |
| E1. Fundação | Projeto, banco, autenticação, perfis, usuários e base da auditoria | RF01 a RF04, RF42, RNF05, RNF06 | — |
| E2. Cadastros | Loteamentos, quadras, lotes, clientes e importação por planilha | RF05 a RF13 | E1 |
| E3. Reservas | Criar, renovar, cancelar, expiração automática e configuração de prazo | RF14 a RF19, RF44, RNF04, RNF11 | E2 |
| E4. Propostas e venda | Proposta, aprovação, pendências do gestor, marcar vendido e bloqueio | RF20 a RF25, RNF10 | E3 |
| E5. Planta e tiles | Upload, junção de fatias, geração e armazenamento de tiles | RF26, RF27, RF30 | E1 |
| E6. Mapa e marcação | Visualizador, editor de marcadores, cores por status e ações no marcador | RF28, RF29, RF31 a RF34, RNF03 | E2, E5 |
| E7. Link público | Geração, página pública e desativação | RF35 a RF38, RNF07 | E6 |
| E8. Painel e histórico | Indicadores e consulta do histórico | RF39 a RF41, RF43 | E3, E4 |

E5 não depende dos cadastros e pode andar em paralelo desde o início. Ele tem o maior risco técnico, então vale começar cedo.

## Pontos em aberto

| # | Questão | Quem responde | Afeta |
| --- | --- | --- | --- |
| 1 | É possível exportar a planta sem os círculos de status, só com o desenho dos lotes? | Urbizzi | E5, E6 |
| 2 | Nas quadras com números como 83, 433 e 515, esse é o número do lote ou do endereço? | Urbizzi | E2 |
| 3 | Os parâmetros urbanísticos (taxa de ocupação, altura máxima, coeficiente, permeabilidade, tipo de construção) devem aparecer ao clicar no lote? | Urbizzi | E2, E6 |
| 4 | Áreas institucionais aparecem no mapa como não comercializáveis ou ficam sem marcador? | Urbizzi | E2, E6 |
| 5 | O link gerado pelo vendedor mostra o Biopark inteiro, um loteamento ou uma seleção de lotes? | Urbizzi | E7 |
| 6 | Faltam 4 das 9 fatias da planta. | Urbizzi | E5 |
| 7 | Validar as premissas RN11, RN12 e RN13 (rejeição, expiração com proposta aprovada, venda só com aprovação). | Urbizzi | E3, E4 |
| 8 | Qual o prazo padrão da reserva e há limite de renovações? | Urbizzi | E3 |
| 9 | Qual cor representa Bloqueado no mapa? | Grupo | E6 |
| 10 | O georreferenciamento entra no projeto como evolução, ou sai do escopo da disciplina? | Grupo | E5 |
