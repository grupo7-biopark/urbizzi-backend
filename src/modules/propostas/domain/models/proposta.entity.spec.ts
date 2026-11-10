import { Proposta } from './proposta.entity.js';

describe('Proposta', () => {
  it('não decide nem sinaliza atraso em proposta encerrada', () => {
    const dados = Proposta.create(
      {
        reservaId: 'r',
        vendedorId: 'v',
        valor: '10',
        condicoes: 'À vista',
        observacoes: null,
      },
      1,
      new Date('2026-01-01T12:00:00Z'),
    ).dados;
    const p = Proposta.restore({
      ...dados,
      dataEncerramento: new Date(),
      motivoEncerramento: 'Cancelamento',
    });
    expect(p.isAtrasada()).toBe(false);
    expect(() => p.aprovar('g', 'Motivo')).toThrow(
      expect.objectContaining({ code: 'PROPOSTA_ENCERRADA' }),
    );
    expect(() => p.rejeitar('g', 'Motivo')).toThrow(
      expect.objectContaining({ code: 'PROPOSTA_ENCERRADA' }),
    );
  });
  const input = {
    reservaId: 'r',
    vendedorId: 'v',
    valor: '00100.5',
    condicoes: ' À vista ',
    observacoes: null,
  };

  it('calcula prazo excluindo finais de semana e Natal e mantém hora de São Paulo', () => {
    const p = Proposta.create(input, 5, new Date('2026-12-18T15:30:00Z'));
    expect(p.dados.prazoLimite.toISOString()).toBe('2026-12-28T15:30:00.000Z');
    expect(p.dados).toMatchObject({
      valor: '100.50',
      condicoes: 'À vista',
      status: 'EM_ANALISE',
    });
    expect(Proposta.restore(p.dados).dados).toEqual(p.dados);
  });

  it('restaura proposta decidida com dataDecisao e decisor', () => {
    const dataDecisao = new Date('2026-11-09T14:00:00Z');
    const p = Proposta.restore({
      id: 'prop-1',
      reservaId: 'r',
      vendedorId: 'v',
      valor: '150.00',
      condicoes: 'Condições',
      observacoes: null,
      status: 'APROVADA',
      dataEnvio: new Date('2026-11-08T10:00:00Z'),
      prazoLimite: new Date('2026-11-15T10:00:00Z'),
      decididoPorId: 'gestor-1',
      dataDecisao,
      motivoDecisao: 'Aprovado',
    });
    expect(p.dados.dataDecisao).toEqual(dataDecisao);
    expect(p.dados.decididoPorId).toBe('gestor-1');
    expect(p.dados.motivoDecisao).toBe('Aprovado');
  });

  it('não altera data inicial e preserva precisão monetária', () => {
    const data = new Date('2026-12-18T15:00:00Z');
    const p = Proposta.create({ ...input, valor: '999999999999.99' }, 1, data);
    expect(p.dados.valor).toBe('999999999999.99');
    expect(data.toISOString()).toBe('2026-12-18T15:00:00.000Z');
  });

  it.each(['0', '-1', '1.001', '1000000000000', 'NaN'])(
    'rejeita valor inválido %s',
    (valor) => {
      expect(() => Proposta.create({ ...input, valor }, 7)).toThrow(
        'Valor e condições',
      );
    },
  );

  it('rejeita condições vazias', () => {
    expect(() => Proposta.create({ ...input, condicoes: '  ' }, 7)).toThrow(
      'Valor e condições',
    );
  });

  it('aprova proposta em análise com gestor, data e motivo', () => {
    const agora = new Date('2026-11-08T12:00:00Z');
    const p = Proposta.create(input, 5, agora);
    const dataDecisao = new Date('2026-11-09T14:00:00Z');
    p.aprovar('gestor-1', ' Aprovado pela diretoria ', dataDecisao);

    expect(p.dados).toMatchObject({
      status: 'APROVADA',
      decididoPorId: 'gestor-1',
      dataDecisao,
      motivoDecisao: 'Aprovado pela diretoria',
    });
    expect(p.isAtrasada(new Date('2026-12-31T00:00:00Z'))).toBe(false);
  });

  it('rejeita proposta em análise com gestor, data e motivo', () => {
    const agora = new Date('2026-11-08T12:00:00Z');
    const p = Proposta.create(input, 5, agora);
    const dataDecisao = new Date('2026-11-09T14:00:00Z');
    p.rejeitar('gestor-2', ' Preço abaixo da tabela ', dataDecisao);

    expect(p.dados).toMatchObject({
      status: 'REJEITADA',
      decididoPorId: 'gestor-2',
      dataDecisao,
      motivoDecisao: 'Preço abaixo da tabela',
    });
    expect(p.isAtrasada(new Date('2026-12-31T00:00:00Z'))).toBe(false);
  });

  it('impede decidir proposta já decidida', () => {
    const p = Proposta.create(input, 5);
    p.aprovar('gestor-1', 'Aprovado');

    expect(() => p.aprovar('gestor-1', 'Novo motivo')).toThrow(
      'A proposta já foi decidida',
    );
    expect(() => p.rejeitar('gestor-1', 'Novo motivo')).toThrow(
      'A proposta já foi decidida',
    );

    const r = Proposta.create(input, 5);
    r.rejeitar('gestor-1', 'Rejeitado');

    expect(() => r.aprovar('gestor-1', 'Novo motivo')).toThrow(
      'A proposta já foi decidida',
    );
    expect(() => r.rejeitar('gestor-1', 'Novo motivo')).toThrow(
      'A proposta já foi decidida',
    );
  });

  it.each(['', '   '])('rejeita motivo de decisão vazio %s', (motivo) => {
    const p = Proposta.create(input, 5);
    expect(() => p.aprovar('gestor-1', motivo)).toThrow(
      expect.objectContaining({ code: 'MOTIVO_OBRIGATORIO' }),
    );
    expect(() => p.rejeitar('gestor-1', motivo)).toThrow(
      expect.objectContaining({ code: 'MOTIVO_OBRIGATORIO' }),
    );
  });

  it('calcula flag de atraso quando em análise e prazo passou', () => {
    const envio = new Date('2026-11-02T10:00:00Z');
    const p = Proposta.create(input, 5, envio);

    expect(p.isAtrasada(new Date('2026-11-03T10:00:00Z'))).toBe(false);
    expect(p.isAtrasada(new Date('2026-11-20T10:00:00Z'))).toBe(true);
  });
});
