import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  ForbiddenError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PropriedadePolicy } from '../../../../shared/domain/policies/propriedade.policy.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { LoteamentoService } from '../../../loteamentos/application/services/loteamento.service.js';
import { LinkPublico } from '../../domain/models/link-publico.entity.js';
import {
  LINK_PUBLICO_REPOSITORY,
  type LinkPublicoRepository,
} from '../../domain/repositories/link-publico.repository.interface.js';
import type { CreateLinkPublicoDto } from '../dto/create-link-publico.dto.js';
import type { LinkPublicoDto } from '../dto/link-publico.dto.js';
@Injectable()
export class LinkPublicoService {
  constructor(
    @Inject(LINK_PUBLICO_REPOSITORY)
    private readonly repository: LinkPublicoRepository,
    private readonly transactions: TransactionManager,
    private readonly auditoria: AuditoriaService,
    private readonly loteamentos: LoteamentoService,
  ) {}
  private assertPerfil(usuario: UsuarioAutenticado): void {
    if (usuario.perfil === 'CONSULTA')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
  }
  async create(
    dto: CreateLinkPublicoDto,
    usuario: UsuarioAutenticado,
  ): Promise<LinkPublicoDto> {
    this.assertPerfil(usuario);
    if (dto.loteamentoId) await this.loteamentos.findById(dto.loteamentoId);
    const link = LinkPublico.create(usuario.id, dto.loteamentoId ?? null);
    const dados = link.dados;
    await this.transactions.run(async (tx) => {
      await this.repository.create(link, tx);
      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'LinkPublico',
          entidadeId: dados.id,
          acao: 'CRIAR',
          valorNovo: { ativo: true, loteamentoId: dados.loteamentoId },
        },
        tx,
      );
    });
    return dados;
  }
  async list(
    query: Pagination,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<LinkPublicoDto>> {
    this.assertPerfil(usuario);
    const result = await this.repository.list(
      usuario.perfil === 'COMERCIAL' ? usuario.id : undefined,
      query,
    );
    return PaginatedDto.of(
      { items: result.items.map((link) => link.dados), total: result.total },
      query,
    );
  }
  async desativar(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<LinkPublicoDto> {
    const link = await this.repository.findById(id);
    if (!link)
      throw new NotFoundError('LINK_NAO_ENCONTRADO', 'Link não encontrado');
    PropriedadePolicy.assertPodeAlterar(usuario, link.dados.criadoPorId);
    if (!link.dados.ativo) return link.dados;
    link.desativar();
    await this.transactions.run(async (tx) => {
      if (await this.repository.desativar(id, tx))
        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            entidadeTipo: 'LinkPublico',
            entidadeId: id,
            acao: 'DESATIVAR',
            valorAnterior: { ativo: true },
            valorNovo: { ativo: false },
          },
          tx,
        );
    });
    return link.dados;
  }
  /** Usado pelo mapa público: valida ativo e incrementa atomicamente. */
  async estaAtivo(id: string): Promise<boolean> {
    return (await this.repository.findById(id))?.dados.ativo === true;
  }

  async registrarAcesso(token: string): Promise<LinkPublicoDto> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new NotFoundError('LINK_NAO_ENCONTRADO', 'Link não encontrado');
    const link = await this.repository.registrarAcesso(token);
    if (!link)
      throw new NotFoundError('LINK_NAO_ENCONTRADO', 'Link não encontrado');
    return link.dados;
  }
}
