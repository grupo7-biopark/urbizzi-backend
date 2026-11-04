import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
import type { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { MapaService } from '../../../mapa/application/services/mapa.service.js';
import { LinkPublicoService } from './link-publico.service.js';
import type { MapaPublicoDto } from '../dto/mapa-publico.dto.js';
@Injectable()
export class MapaPublicoService {
  constructor(
    private readonly links: LinkPublicoService,
    private readonly mapa: MapaService,
    private readonly config: ConfigService<Env, true>,
  ) {}
  async consultar(
    token: string,
    query: PaginationQueryDto,
  ): Promise<MapaPublicoDto> {
    // Validação e incremento são atômicos; escopo vem exclusivamente do link.
    const link = await this.links.registrarAcesso(token);
    const mapa = await this.mapa.consultarPublico({
      ...query,
      loteamentoId: link.loteamentoId ?? undefined,
    });
    return {
      ...mapa,
      contatoComercial: this.config.get('PUBLICO_CONTATO_COMERCIAL', {
        infer: true,
      }),
    };
  }
}
