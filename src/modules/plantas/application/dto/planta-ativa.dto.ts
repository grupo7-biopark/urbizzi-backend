import type { Planta } from '../../domain/models/planta.entity.js';
import { PlantaDto } from './planta.dto.js';

export class PlantaAtivaDto extends PlantaDto {
  /**
   * Modelo de URL dos tiles para o Leaflet (`L.tileLayer`), relativo ao
   * host da API. Pública, com cache longo.
   * @example '/v1/plantas/7a3e5b2c-8a52-4a8e-9d3f-2c7f1e5a9b10/tiles/{z}/{x}/{y}.webp'
   */
  tilesUrl: string;

  static override from(planta: Planta): PlantaAtivaDto {
    const dto = Object.assign(new PlantaAtivaDto(), PlantaDto.from(planta));
    dto.tilesUrl = `/v1/plantas/${planta.id}/tiles/{z}/{x}/{y}.webp`;
    return dto;
  }
}
