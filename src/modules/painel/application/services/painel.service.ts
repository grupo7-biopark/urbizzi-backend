import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { LoteamentoService } from '../../../loteamentos/application/services/loteamento.service.js';
import {
  PAINEL_CONSULTA_REPOSITORY,
  type PainelConsultaRepository,
} from '../../domain/repositories/painel-consulta.repository.interface.js';
import type { PainelPendenciasQueryDto } from '../dto/painel-pendencias-query.dto.js';
import { PainelPendenciasDto } from '../dto/painel-pendencias.dto.js';
import type { PainelResumoQueryDto } from '../dto/painel-resumo-query.dto.js';
import { PainelResumoDto } from '../dto/painel-resumo.dto.js';
import type { PainelVendasQueryDto } from '../dto/painel-vendas-query.dto.js';
import { PainelVendasDto } from '../dto/painel-vendas.dto.js';

@Injectable()
export class PainelService {
  constructor(
    @Inject(PAINEL_CONSULTA_REPOSITORY)
    private readonly repository: PainelConsultaRepository,
    private readonly loteamentoService: LoteamentoService,
  ) {}

  async obterResumo(
    query: PainelResumoQueryDto,
    _usuario: UsuarioAutenticado,
  ): Promise<PainelResumoDto> {
    const { dataDe, dataAte } = this.parsePeriodo(query.dataDe, query.dataAte);

    if (query.loteamentoId) {
      await this.loteamentoService.findById(query.loteamentoId);
    }

    const resumo = await this.repository.obterResumo({
      loteamentoId: query.loteamentoId,
      dataDe,
      dataAte,
    });

    return PainelResumoDto.from(resumo);
  }

  async obterVendas(
    query: PainelVendasQueryDto,
    usuario: UsuarioAutenticado,
  ): Promise<PainelVendasDto> {
    const { dataDe, dataAte } = this.parsePeriodo(query.dataDe, query.dataAte);

    if (query.loteamentoId) {
      await this.loteamentoService.findById(query.loteamentoId);
    }

    const vendedorId =
      usuario.perfil === 'COMERCIAL' && query.vendedorId
        ? usuario.id
        : query.vendedorId;

    const vendas = await this.repository.obterVendas({
      loteamentoId: query.loteamentoId,
      vendedorId,
      dataDe,
      dataAte,
      agrupamento: query.agrupamento,
    });

    return PainelVendasDto.from(vendas);
  }

  async obterPendencias(
    query: PainelPendenciasQueryDto,
    usuario: UsuarioAutenticado,
  ): Promise<PainelPendenciasDto> {
    const { dataDe, dataAte } = this.parsePeriodo(query.dataDe, query.dataAte);

    if (query.loteamentoId) {
      await this.loteamentoService.findById(query.loteamentoId);
    }

    const vendedorId =
      usuario.perfil === 'COMERCIAL' ? usuario.id : query.vendedorId;

    const diasBreve = query.diasVencimentoEmBreve ?? 3;
    const agora = new Date();
    const limiteBreve = new Date(
      agora.getTime() + diasBreve * 24 * 60 * 60 * 1000,
    );

    const pendencias = await this.repository.obterPendencias({
      loteamentoId: query.loteamentoId,
      vendedorId,
      dataDe,
      dataAte,
      limiteBreve,
    });

    return PainelPendenciasDto.from(pendencias);
  }

  private parsePeriodo(
    dataDeStr?: string,
    dataAteStr?: string,
  ): { dataDe?: Date; dataAte?: Date } {
    const dataDe = dataDeStr ? new Date(dataDeStr) : undefined;
    const dataAte = dataAteStr ? new Date(dataAteStr) : undefined;

    if (dataAte && /^\d{4}-\d{2}-\d{2}$/.test(dataAteStr!)) {
      dataAte.setUTCHours(23, 59, 59, 999);
    }

    if (
      (dataDe && !Number.isFinite(dataDe.getTime())) ||
      (dataAte && !Number.isFinite(dataAte.getTime())) ||
      (dataDe && dataAte && dataDe > dataAte)
    ) {
      throw new BusinessRuleError(
        'PERIODO_INVALIDO',
        'Informe um período válido',
      );
    }

    return { dataDe, dataAte };
  }
}
