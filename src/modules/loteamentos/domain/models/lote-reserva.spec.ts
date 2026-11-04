import { Lote } from './lote.entity.js';
describe('Lote: reserva', () => {
  const criar = () =>
    Lote.create({
      quadraId: 'q',
      loteamentoId: 'e',
      numero: '1',
      areaM2: '100',
    });
  it('marca histórico permanente de reserva e impede exclusão', () => {
    const l = criar();
    l.reservar();
    expect(l.status).toBe('RESERVADO');
    expect(l.teveReserva).toBe(true);
    expect(() => l.assertPodeExcluir()).toThrow();
  });
  it('libera somente reservado e preserva o histórico permanente', () => {
    const l = criar();
    expect(() => l.liberarReserva()).toThrow('O lote não está reservado');
    l.reservar();
    l.liberarReserva();
    expect(l.status).toBe('DISPONIVEL');
    expect(l.teveReserva).toBe(true);
    expect(() => l.assertPodeExcluir()).toThrow('histórico de reservas');
  });
  it.each(['RESERVADO', 'BLOQUEADO', 'VENDIDO'] as const)(
    'não reserva lote %s',
    (status) => {
      const l = criar();
      const antigo = Lote.restore({
        ...l,
        id: l.id,
        quadraId: l.quadraId,
        loteamentoId: l.loteamentoId,
        numero: l.numero,
        areaM2: l.areaM2,
        valor: l.valor,
        status,
        observacoes: null,
        exibirValorPublico: false,
        teveReserva: false,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      });
      expect(() => antigo.reservar()).toThrow('Só é possível reservar');
    },
  );
});
