import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleError,
  ForbiddenError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import {
  HISTORICO_CONSULTA_REPOSITORY,
  type HistoricoConsultaRepository,
} from '../../domain/repositories/historico-consulta.repository.interface.js';
import type { ListHistoricoQueryDto } from '../dto/list-historico-query.dto.js';
import type { HistoricoDto } from '../dto/historico.dto.js';
@Injectable()
export class HistoricoService {
  constructor(
    @Inject(HISTORICO_CONSULTA_REPOSITORY)
    private readonly repository: HistoricoConsultaRepository,
  ) {}
  async list(
    query: ListHistoricoQueryDto,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedDto<HistoricoDto>> {
    if (usuario.perfil === 'CONSULTA')
      throw new ForbiddenError(
        'ACESSO_NEGADO',
        'Você não tem permissão para executar esta ação',
      );
    const dataDe = query.dataDe ? new Date(query.dataDe) : undefined;
    const dataAte = query.dataAte ? new Date(query.dataAte) : undefined;
    if (dataAte && /^\d{4}-\d{2}-\d{2}$/.test(query.dataAte!))
      dataAte.setUTCHours(23, 59, 59, 999);
    if (
      (dataDe && !Number.isFinite(dataDe.getTime())) ||
      (dataAte && !Number.isFinite(dataAte.getTime())) ||
      (dataDe && dataAte && dataDe > dataAte)
    )
      throw new BusinessRuleError(
        'PERIODO_INVALIDO',
        'Informe um período válido',
      );
    const page = await this.repository.list(
      {
        entidadeTipo: query.entidadeTipo,
        entidadeId: query.entidadeId,
        usuarioId: query.usuarioId,
        dataDe,
        dataAte,
        ...(usuario.perfil === 'COMERCIAL' ? { vendedorId: usuario.id } : {}),
      },
      query,
    );
    return PaginatedDto.of(page, query);
  }
}
