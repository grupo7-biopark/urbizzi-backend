import { randomUUID } from 'node:crypto';
import { adicionarDiasUteis } from '../../../../shared/domain/dias-uteis.js';
import { InvalidInputError } from '../../../../shared/domain/errors/domain.error.js';
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
}
export class Proposta {
  private constructor(private readonly props: PropostaProps) {}
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
    });
  }
  static restore(props: PropostaProps): Proposta {
    return new Proposta({ ...props });
  }
  get dados(): PropostaProps {
    return { ...this.props };
  }
}
