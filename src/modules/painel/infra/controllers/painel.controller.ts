import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { Perfis } from '../../../../shared/infra/auth/perfis.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { PainelPendenciasQueryDto } from '../../application/dto/painel-pendencias-query.dto.js';
import { PainelPendenciasDto } from '../../application/dto/painel-pendencias.dto.js';
import { PainelResumoQueryDto } from '../../application/dto/painel-resumo-query.dto.js';
import { PainelResumoDto } from '../../application/dto/painel-resumo.dto.js';
import { PainelVendasQueryDto } from '../../application/dto/painel-vendas-query.dto.js';
import { PainelVendasDto } from '../../application/dto/painel-vendas.dto.js';
import { PainelService } from '../../application/services/painel.service.js';

@ApiTags('painel')
@ApiBearerAuth()
@Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'CONSULTA')
@Controller('painel')
export class PainelController {
  constructor(private readonly service: PainelService) {}

  /** Contagem de lotes por status, geral e por loteamento */
  @Get('resumo')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PainelResumoDto })
  @ApiErrorResponses(400, 401, 403, 404, 422)
  resumo(
    @Query() query: PainelResumoQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PainelResumoDto> {
    return this.service.obterResumo(query, usuario);
  }

  /** Vendas efetuadas por período e por vendedor */
  @Get('vendas')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PainelVendasDto })
  @ApiErrorResponses(400, 401, 403, 404, 422)
  vendas(
    @Query() query: PainelVendasQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PainelVendasDto> {
    return this.service.obterVendas(query, usuario);
  }

  /** Reservas ativas, vencendo em breve e propostas pendentes ou atrasadas */
  @Get('pendencias')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PainelPendenciasDto })
  @ApiErrorResponses(400, 401, 403, 404, 422)
  pendencias(
    @Query() query: PainelPendenciasQueryDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PainelPendenciasDto> {
    return this.service.obterPendencias(query, usuario);
  }
}
