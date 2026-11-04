import { Inject, Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { PlantaService } from '../../../plantas/application/services/planta.service.js';
import {
  MAPA_CONSULTA_REPOSITORY,
  type MapaConsultaRepository,
} from '../../domain/repositories/mapa-consulta.repository.interface.js';
import { acoesMapa } from '../../domain/policies/acoes-mapa.policy.js';
import {
  MarcadorMapaDto,
  type MapaDto,
  type PlantaMapaDto,
} from '../dto/mapa.dto.js';
import type { MapaQueryDto } from '../dto/mapa-query.dto.js';
@Injectable()
export class MapaService {
  constructor(
    @Inject(MAPA_CONSULTA_REPOSITORY)
    private readonly repository: MapaConsultaRepository,
    private readonly plantas: PlantaService,
  ) {}
  async consultar(
    query: MapaQueryDto,
    usuario: UsuarioAutenticado,
  ): Promise<MapaDto> {
    const planta = await this.plantaAtiva();
    const pagina = await this.repository.list(planta.id, query);
    return {
      planta,
      marcadores: PaginatedDto.of(
        {
          items: pagina.items.map((item) =>
            MarcadorMapaDto.from(item, acoesMapa(item, usuario)),
          ),
          total: pagina.total,
        },
        query,
      ),
    };
  }
  private async plantaAtiva(): Promise<PlantaMapaDto> {
    const {
      id,
      nome,
      versao,
      larguraPx,
      alturaPx,
      maxZoom,
      tamanhoTile,
      tilesUrl,
    } = await this.plantas.ativa();
    return {
      id,
      nome,
      versao,
      larguraPx,
      alturaPx,
      maxZoom,
      tamanhoTile,
      tilesUrl,
    };
  }
}
