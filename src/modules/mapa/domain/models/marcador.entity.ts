import { randomUUID } from 'node:crypto';
import { InvalidInputError } from '../../../../shared/domain/errors/domain.error.js';
export interface MarcadorProps {
  revisar: boolean;
  id: string;
  plantaId: string;
  loteId: string;
  x: number;
  y: number;
}
export class Marcador {
  private constructor(private props: MarcadorProps) {}
  static create(input: Omit<MarcadorProps, 'id' | 'revisar'>): Marcador {
    const marcador = new Marcador({
      ...input,
      revisar: false,
      id: randomUUID(),
    });
    marcador.mover(input);
    return marcador;
  }
  static restore(props: MarcadorProps): Marcador {
    return new Marcador({ ...props });
  }
  mover({ x, y }: { x: number; y: number }): void {
    if (
      ![x, y].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1,
      )
    )
      throw new InvalidInputError(
        'COORDENADAS_INVALIDAS',
        'Coordenadas devem estar entre 0 e 1',
      );
    this.props = { ...this.props, x, y };
  }
  confirmarRevisao(): void {
    this.props.revisar = false;
  }
  get dados(): MarcadorProps {
    return { ...this.props };
  }
}
