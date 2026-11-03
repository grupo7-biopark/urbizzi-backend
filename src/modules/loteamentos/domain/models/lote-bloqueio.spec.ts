import { Lote, type StatusLote } from './lote.entity.js';
function lote(status: StatusLote = 'DISPONIVEL') {
  return Lote.restore({
    id: 'l',
    quadraId: 'q',
    loteamentoId: 'lt',
    numero: '1',
    areaM2: '200.00',
    valor: null,
    exibirValorPublico: false,
    status,
    observacoes: null,
    teveReserva: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
describe('Bloqueio do lote', () => {
  it('bloqueia disponível e desbloqueia sem alterar cadastro', () => {
    const entidade = lote();
    entidade.bloquear(' Decisão administrativa ');
    expect(entidade.status).toBe('BLOQUEADO');
    expect(entidade.numero).toBe('1');
    entidade.desbloquear();
    expect(entidade.status).toBe('DISPONIVEL');
  });
  it.each(['RESERVADO', 'VENDIDO', 'BLOQUEADO'] as const)(
    'não bloqueia %s',
    (status) => {
      expect(() => lote(status).bloquear('Motivo')).toThrow(
        expect.objectContaining({ code: 'LOTE_NAO_DISPONIVEL' }),
      );
    },
  );
  it.each(['DISPONIVEL', 'RESERVADO', 'VENDIDO'] as const)(
    'não desbloqueia %s',
    (status) => {
      expect(() => lote(status).desbloquear()).toThrow(
        expect.objectContaining({ code: 'LOTE_NAO_BLOQUEADO' }),
      );
    },
  );
  it('exige motivo e não permite excluir enquanto bloqueado', () => {
    expect(() => lote().bloquear(' ')).toThrow(
      expect.objectContaining({ code: 'MOTIVO_OBRIGATORIO' }),
    );
    const entidade = lote();
    entidade.bloquear('Motivo');
    expect(() => entidade.assertPodeExcluir()).toThrow();
  });
});
