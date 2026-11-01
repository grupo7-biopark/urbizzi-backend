# Usuários

Base de consulta necessária à BE-07. É dono de `Usuario` e `Perfil`. CRUD e auditoria de alterações serão implementados na BE-10; não há endpoints nesta etapa nem dependências de módulos de domínio.

Exporta `UsuarioService.autenticar(email, senha)` e `findAtivoById(id)`. Ambos retornam somente dados de usuário ativo (`id`, `nome`, `email`, `perfil`) ou null; nunca hash ou senha. A autenticação normaliza e-mail, verifica Argon2id por contrato `PasswordHasher` e usa hash substituto para e-mail inexistente.

Somente o repositório consulta Prisma e a relação com perfil, pertencente ao mesmo módulo. Perfis válidos: ADMINISTRADOR, GESTOR, COMERCIAL e CONSULTA. Não há erros HTTP gerados pelo módulo: o chamador decide como tratar usuário ausente ou credenciais inválidas.

Para BE-08, exporta também `findAtivoByEmail` (dados mínimos, e-mail normalizado), `gerarSenhaHash` e `redefinirSenha(id, senhaHash, tx)`. A escrita de senha pertence a este módulo e exige a transação do chamador; somente usuários ativos podem receber nova senha.
