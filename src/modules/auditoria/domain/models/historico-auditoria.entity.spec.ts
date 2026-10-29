import { HistoricoAuditoria } from './historico-auditoria.entity.js';
const input = { entidadeTipo: 'Lote', entidadeId: 'id', acao: 'ALTERAR' };
describe('HistoricoAuditoria', () => {
  it('cria registro do sistema com valores opcionais nulos', () => {
    const h = HistoricoAuditoria.create(input);
    expect(h.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(h.usuarioId).toBeNull();
    expect(h.motivo).toBeNull();
    expect(h.valorAnterior).toBeNull();
    expect(h.valorNovo).toBeNull();
    expect(h.entidadeTipo).toBe('Lote');
    expect(h.entidadeId).toBe('id');
    expect(h.acao).toBe('ALTERAR');
    expect(h.createdAt).toBeInstanceOf(Date);
  });
  it('mascara valores aninhados e arrays sem modificar a entrada', () => {
    const valor = {
      senhaHash: 'segredo',
      itens: [{ TOKEN_HASH: 'segredo', status: 'ATIVA', email: 'pessoal' }],
      numero: 1,
      ativo: true,
      vazio: null,
    };
    const h = HistoricoAuditoria.create({
      ...input,
      usuarioId: 'usuario',
      motivo: 'Atualização',
      valorAnterior: valor,
      valorNovo: valor,
    });
    const esperado = {
      senhaHash: '[MASCARADO]',
      itens: [
        { TOKEN_HASH: '[MASCARADO]', status: 'ATIVA', email: '[MASCARADO]' },
      ],
      numero: 1,
      ativo: true,
      vazio: null,
    };
    expect(h.valorAnterior).toEqual(esperado);
    expect(h.valorNovo).toEqual(esperado);
    expect(valor.senhaHash).toBe('segredo');
    expect(h.usuarioId).toBe('usuario');
    expect(h.motivo).toBe('Atualização');
  });
  it('restaura e protege os snapshots e a data contra mutações', () => {
    const props = {
      ...input,
      id: 'registro',
      createdAt: new Date(),
      valorNovo: { status: 'ATIVA' },
    };
    const h = HistoricoAuditoria.restore(props);
    props.valorNovo.status = 'VENDIDA';
    h.createdAt.setFullYear(2000);
    expect(h.valorNovo).toEqual({ status: 'ATIVA' });
    expect(h.createdAt).toEqual(props.createdAt);
  });
});
