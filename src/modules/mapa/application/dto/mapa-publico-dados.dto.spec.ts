import { MarcadorPublicoDto } from './mapa-publico-dados.dto.js';
import type { ItemMapa } from '../../domain/repositories/mapa-consulta.repository.interface.js';
describe('Contrato do marcador público', () => {
  const base = {
    id: 'm',
    loteId: 'l',
    x: 0,
    y: 1,
    numero: '1',
    quadraId: 'q',
    quadra: 'A',
    loteamentoId: 'e',
    loteamento: 'Norte',
    areaM2: '100.00',
    status: 'RESERVADO',
    valor: '999.99',
    vendedorId: 'interno',
    propostaAprovada: true,
    exibirValorPublico: false,
  } as ItemMapa;
  it('omite valor sem autorização e usa lista exata de campos permitidos', () => {
    expect(Object.keys(MarcadorPublicoDto.from(base)).sort()).toEqual(
      [
        'id',
        'loteId',
        'x',
        'y',
        'numero',
        'quadraId',
        'quadra',
        'loteamentoId',
        'loteamento',
        'areaM2',
        'status',
      ].sort(),
    );
    expect(MarcadorPublicoDto.from(base)).not.toHaveProperty('valor');
    expect(JSON.stringify(MarcadorPublicoDto.from(base))).not.toContain(
      '999.99',
    );
  });
  it.each(['999.99', null])('inclui valor autorizado %s', (valor) => {
    expect(
      MarcadorPublicoDto.from({ ...base, valor, exibirValorPublico: true }),
    ).toHaveProperty('valor', valor);
  });
});
