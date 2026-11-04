import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Usuario } from '../../domain/models/usuario.entity.js';
import {
  USUARIO_REPOSITORY,
  type UsuarioRepository,
} from '../../domain/repositories/usuario.repository.interface.js';
import {
  GESTAO_USUARIO_REPOSITORY,
  type GestaoUsuarioRepository,
} from '../../domain/repositories/gestao-usuario.repository.interface.js';
import { UsuarioService } from './usuario.service.js';
import { UsuarioDto } from '../dto/usuario.dto.js';
import type { CreateUsuarioDto } from '../dto/create-usuario.dto.js';
import type { UpdateUsuarioDto } from '../dto/update-usuario.dto.js';
import type { ListUsuariosQueryDto } from '../dto/list-usuarios-query.dto.js';
@Injectable()
export class GestaoUsuarioService {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(GESTAO_USUARIO_REPOSITORY)
    private readonly repository: GestaoUsuarioRepository,
    private readonly senhas: UsuarioService,
    private readonly transactions: TransactionManager,
    private readonly auditoria: AuditoriaService,
  ) {}
  async list(query: ListUsuariosQueryDto): Promise<PaginatedDto<UsuarioDto>> {
    const result = await this.repository.list(query);
    return PaginatedDto.of(
      { items: result.items.map(UsuarioDto.from), total: result.total },
      query,
    );
  }
  async findById(id: string): Promise<UsuarioDto> {
    const usuario = await this.usuarios.findById(id);
    if (!usuario)
      throw new NotFoundError(
        'USUARIO_NAO_ENCONTRADO',
        'Usuário não encontrado',
      );
    return UsuarioDto.from(usuario);
  }
  async create(dto: CreateUsuarioDto, ator: string): Promise<UsuarioDto> {
    const senhaHash = await this.senhas.gerarSenhaHash(dto.senha);
    const usuario = Usuario.create({
      nome: dto.nome.trim(),
      email: dto.email.trim().toLowerCase(),
      perfil: dto.perfil,
      senhaHash,
    });
    return this.transactions.run(async (tx) => {
      await this.repository.bloquearGestao(tx);
      if (await this.usuarios.findByEmail(usuario.dados.email, tx))
        throw new ConflictError(
          'USUARIO_EMAIL_DUPLICADO',
          'Já existe um usuário com esse e-mail',
        );
      await this.repository.save(usuario, tx);
      await this.auditoria.registrar(
        {
          usuarioId: ator,
          entidadeTipo: 'Usuario',
          entidadeId: usuario.dados.id,
          acao: 'CRIAR',
          valorNovo: { perfil: usuario.dados.perfil, ativo: true },
        },
        tx,
      );
      return UsuarioDto.from(usuario);
    });
  }
  update(id: string, dto: UpdateUsuarioDto, ator: string): Promise<UsuarioDto> {
    return this.alterar(id, dto, undefined, ator);
  }
  definirAtivo(id: string, ativo: boolean, ator: string): Promise<UsuarioDto> {
    return this.alterar(id, {}, ativo, ator);
  }
  private alterar(
    id: string,
    dto: UpdateUsuarioDto,
    ativo: boolean | undefined,
    ator: string,
  ): Promise<UsuarioDto> {
    return this.transactions.run(async (tx) => {
      await this.repository.bloquearGestao(tx);
      await this.usuarios.bloquearAutenticacao(id, tx);
      const usuario = await this.usuarios.findById(id, tx);
      if (!usuario)
        throw new NotFoundError(
          'USUARIO_NAO_ENCONTRADO',
          'Usuário não encontrado',
        );
      const anterior = { perfil: usuario.dados.perfil, ativo: usuario.ativo };
      const input = {
        ...dto,
        ...(dto.email !== undefined
          ? { email: dto.email.trim().toLowerCase() }
          : {}),
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
      };
      if (input.email) {
        const outro = await this.usuarios.findByEmail(input.email, tx);
        if (outro && outro.dados.id !== id)
          throw new ConflictError(
            'USUARIO_EMAIL_DUPLICADO',
            'Já existe um usuário com esse e-mail',
          );
      }
      usuario.atualizar(input);
      if (ativo !== undefined) usuario.definirAtivo(ativo);
      if (
        anterior.ativo &&
        anterior.perfil === 'ADMINISTRADOR' &&
        (!usuario.ativo || usuario.dados.perfil !== 'ADMINISTRADOR') &&
        (await this.repository.countAdministradores(tx)) <= 1
      )
        throw new ConflictError(
          'ULTIMO_ADMINISTRADOR',
          'Não é possível remover o último administrador ativo',
        );
      await this.repository.save(usuario, tx);
      await this.auditoria.registrar(
        {
          usuarioId: ator,
          entidadeTipo: 'Usuario',
          entidadeId: id,
          acao:
            ativo === false
              ? 'DESATIVAR'
              : ativo === true
                ? 'ATIVAR'
                : 'ALTERAR',
          valorAnterior: anterior,
          valorNovo: {
            perfil: usuario.dados.perfil,
            ativo: usuario.ativo,
            camposAlterados: Object.keys(input),
          },
        },
        tx,
      );
      return UsuarioDto.from(usuario);
    });
  }
}
