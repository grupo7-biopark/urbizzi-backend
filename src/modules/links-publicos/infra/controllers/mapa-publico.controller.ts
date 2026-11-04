import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../../shared/infra/auth/public.decorator.js';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { MapaPublicoDto } from '../../application/dto/mapa-publico.dto.js';
import { MapaPublicoService } from '../../application/services/mapa-publico.service.js';
@ApiTags('mapa público')
@Public()
@Controller('publico')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class MapaPublicoController {
  constructor(private readonly service: MapaPublicoService) {}
  /** Consulta somente leitura por token ativo, sem dados internos; até 60 acessos por IP por minuto */
  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOkResponse({ type: MapaPublicoDto })
  @ApiErrorResponses(400, 404, 429)
  consultar(
    @Param('token') token: string,
    @Query() query: PaginationQueryDto,
  ): Promise<MapaPublicoDto> {
    return this.service.consultar(token, query);
  }
}
