import { Cliente } from './cliente.entity.js';
describe('Cliente', () => {
  it('normaliza dados e protege informações no snapshot de auditoria', () => {
    const cliente = Cliente.create({
      nome: ' José ',
      documento: '529.982.247-25',
      email: ' TESTE@EXEMPLO.COM ',
      telefone: ' 123 ',
      observacoes: ' privado ',
    });
    expect(cliente.dados).toMatchObject({
      nome: 'José',
      documento: '52998224725',
      email: 'teste@exemplo.com',
      telefone: '123',
      observacoes: 'privado',
    });
    expect(JSON.stringify(cliente.auditoria)).not.toContain('José');
    expect(JSON.stringify(cliente.auditoria)).not.toContain('privado');
    expect(Cliente.restore(cliente.dados).id).toBe(cliente.id);
  });
  it('atualiza parcialmente e aceita limpar dados opcionais', () => {
    const cliente = Cliente.create({ nome: 'Teste', documento: '52998224725' });
    cliente.atualizar({ email: 'a@exemplo.com' });
    cliente.atualizar({ email: null, telefone: undefined });
    expect(cliente.dados.email).toBeNull();
    expect(cliente.dados.nome).toBe('Teste');
    expect(cliente.auditoria.telefone).toBeNull();
  });
  it('nega nome e documento inválidos', () => {
    expect(() =>
      Cliente.create({ nome: ' ', documento: '52998224725' }),
    ).toThrow(expect.objectContaining({ code: 'NOME_CLIENTE_INVALIDO' }));
    expect(() =>
      Cliente.create({ nome: 'Teste', documento: '11111111111' }),
    ).toThrow(expect.objectContaining({ code: 'DOCUMENTO_INVALIDO' }));
  });
});
