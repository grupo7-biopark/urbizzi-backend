import { randomUUID } from 'node:crypto';
import { adicionarDiasUteis } from '../../../../shared/domain/dias-uteis.js';
import {
  ConflictError,
  InvalidInputError,
} from '../../../../shared/domain/errors/domain.error.js';

export interface PropostaProps {
  id: string;
  reservaId: string;
  vendedorId: string;
  valor: string;
  condicoes: string;
  observacoes: string | null;
  status: 'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
  dataEnvio: Date;
  prazoLimite: Date;
  decididoPorId: string | null;
  dataDecisao: Date | null;
  motivoDecisao: string | null;
  dataEncerramento?: Date | null;
  motivoEncerramento?: string | null;
}

export class Proposta {
  private constructor(private props: PropostaProps) {}

  static create(
    input: Pick<
      PropostaProps,
      'reservaId' | 'vendedorId' | 'valor' | 'condicoes' | 'observacoes'
    >,
    dias: number,
    agora = new Date(),
  ): Proposta {
    if (
      !/^(?!0+(?:\.0+)?$)\d{1,12}(?:\.\d{1,2})?$/.test(input.valor) ||
      !input.condicoes.trim()
    )
      throw new InvalidInputError(
        'PROPOSTA_INVALIDA',
        'Valor e condições da proposta são obrigatórios e válidos',
      );
    const [inteiro, decimal = ''] = input.valor.split('.');
    return new Proposta({
      ...input,
      valor: inteiro.replace(/^0+(?=\d)/, '') + '.' + decimal.padEnd(2, '0'),
      condicoes: input.condicoes.trim(),
      id: randomUUID(),
      status: 'EM_ANALISE',
      dataEnvio: new Date(agora),
      prazoLimite: adicionarDiasUteis(agora, dias),
      decididoPorId: null,
      dataDecisao: null,
      motivoDecisao: null,
    });
  }

  static restore(props: {
    id: string;
    reservaId: string;
    vendedorId: string;
    valor: string;
    condicoes: string;
    observacoes: string | null;
    status: 'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
    dataEnvio: Date;
    prazoLimite: Date;
    decididoPorId?: string | null;
    dataDecisao?: Date | null;
    motivoDecisao?: string | null;
    dataEncerramento?: Date | null;
    motivoEncerramento?: string | null;
  }): Proposta {
    return new Proposta({
      ...props,
      dataEnvio: new Date(props.dataEnvio),
      prazoLimite: new Date(props.prazoLimite),
      decididoPorId: props.decididoPorId ?? null,
      dataDecisao: props.dataDecisao ? new Date(props.dataDecisao) : null,
      motivoDecisao: props.motivoDecisao ?? null,
    });
  }

  aprovar(gestorId: string, motivo: string, agora = new Date()): void {
    if (this.props.dataEncerramento)
      throw new ConflictError(
        'PROPOSTA_ENCERRADA',
        'A proposta foi encerrada pelo cancelamento da reserva',
      );
    if (this.props.status !== 'EM_ANALISE')
      throw new ConflictError(
        'PROPOSTA_JA_DECIDIDA',
        'A proposta já foi decidida',
      );
    if (!motivo?.trim())
      throw new InvalidInputError(
        'MOTIVO_OBRIGATORIO',
        'O motivo da decisão é obrigatório',
      );
    this.props = {
      ...this.props,
      status: 'APROVADA',
      decididoPorId: gestorId,
      dataDecisao: new Date(agora),
      motivoDecisao: motivo.trim(),
    };
  }

  rejeitar(gestorId: string, motivo: string, agora = new Date()): void {
    if (this.props.dataEncerramento)
      throw new ConflictError(
        'PROPOSTA_ENCERRADA',
        'A proposta foi encerrada pelo cancelamento da reserva',
      );
    if (this.props.status !== 'EM_ANALISE')
      throw new ConflictError(
        'PROPOSTA_JA_DECIDIDA',
        'A proposta já foi decidida',
      );
    if (!motivo?.trim())
      throw new InvalidInputError(
        'MOTIVO_OBRIGATORIO',
        'O motivo da decisão é obrigatório',
      );
    this.props = {
      ...this.props,
      status: 'REJEITADA',
      decididoPorId: gestorId,
      dataDecisao: new Date(agora),
      motivoDecisao: motivo.trim(),
    };
  }

  isAtrasada(agora = new Date()): boolean {
    return (
      !this.props.dataEncerramento &&
      this.props.status === 'EM_ANALISE' &&
      this.props.prazoLimite <= agora
    );
  }

  get dados(): PropostaProps {
    return { ...this.props };
  }
}
