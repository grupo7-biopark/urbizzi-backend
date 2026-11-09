import type { Marcador } from '../../domain/models/marcador.entity.js';
export class MarcadorDto {
  /** Indica que a posição ainda precisa de conferência. */
  revisar: boolean;
  id: string;
  plantaId: string;
  loteId: string;
  x: number;
  y: number;
  static from(marcador: Marcador): MarcadorDto {
    return marcador.dados;
  }
}
