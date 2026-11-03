import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { Lote, type LoteProps } from './lote.entity.js';

describe('Lote', () => {
  const base = {
    quadraId: '1c1b8f8e-5a52-4a8e-9d3f-2c7f1e5a9b10',
    loteamentoId: '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10',
    numero: '12',
    areaM2: '360',
  };

  function restaurado(overrides: Partial<LoteProps> = {}): Lote {
    return Lote.restore({
      ...Lote.create(base).auditoria,
      id: 'id',
      loteamentoId: base.loteamentoId,
      status: 'DISPONIVEL',
      teveReserva: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  describe('create', () => {
    it('cria DISPONIVEL, sem reserva e com os padrões', () => {
      const lote = Lote.create(base);

      expect(lote.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(lote).toMatchObject({
        status: 'DISPONIVEL',
        teveReserva: false,
        exibirValorPublico: false,
        valor: null,
        observacoes: null,
        loteamentoId: base.loteamentoId,
      });
    });

    it.each([
      ['360', '360.00'],
      ['360.5', '360.50'],
      ['0360.25', '360.25'],
      ['0.5', '0.50'],
    ])('normaliza o decimal %s para %s', (entrada, esperado) => {
      const lote = Lote.create({ ...base, areaM2: entrada, valor: entrada });

      expect(lote.areaM2).toBe(esperado);
      expect(lote.valor).toBe(esperado);
    });
  });

  describe('atualizar', () => {
    it('atualiza só os campos informados', () => {
      const lote = Lote.create({
        ...base,
        valor: '250000',
        observacoes: 'Esquina',
      });

      lote.atualizar({ valor: '260000.5', exibirValorPublico: true });

      expect(lote.auditoria).toEqual({
        quadraId: base.quadraId,
        numero: '12',
        areaM2: '360.00',
        valor: '260000.50',
        exibirValorPublico: true,
        observacoes: 'Esquina',
      });
    });

    it('limpa valor e observações com null e ignora null nos obrigatórios', () => {
      const lote = Lote.create({
        ...base,
        valor: '250000',
        observacoes: 'Esquina',
      });

      lote.atualizar({
        numero: null as unknown as string,
        areaM2: null as unknown as string,
        exibirValorPublico: null as unknown as boolean,
        valor: null,
        observacoes: null,
      });

      expect(lote.auditoria).toMatchObject({
        numero: '12',
        areaM2: '360.00',
        exibirValorPublico: false,
        valor: null,
        observacoes: null,
      });
    });

    it('altera número e área', () => {
      const lote = Lote.create(base);

      lote.atualizar({ numero: '13', areaM2: '400.1' });

      expect(lote.numero).toBe('13');
      expect(lote.areaM2).toBe('400.10');
    });
  });

  describe('assertPodeExcluir', () => {
    it('permite excluir lote DISPONIVEL sem reservas', () => {
      expect(() => restaurado().assertPodeExcluir()).not.toThrow();
    });

    it.each(['RESERVADO', 'VENDIDO', 'BLOQUEADO'] as const)(
      'impede excluir lote %s',
      (status) => {
        expect(() => restaurado({ status }).assertPodeExcluir()).toThrow(
          expect.objectContaining({
            constructor: ConflictError,
            code: 'LOTE_NAO_DISPONIVEL',
          }),
        );
      },
    );

    it('impede excluir lote DISPONIVEL que já teve reserva', () => {
      expect(() =>
        restaurado({ teveReserva: true }).assertPodeExcluir(),
      ).toThrow(
        expect.objectContaining({
          constructor: ConflictError,
          code: 'LOTE_COM_RESERVAS',
        }),
      );
    });
  });
});
