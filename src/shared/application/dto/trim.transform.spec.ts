import { plainToInstance } from 'class-transformer';
import { Trim } from './trim.transform.js';

class ExemploDto {
  @Trim()
  nome: unknown;

  @Trim({ vazioComoNulo: true })
  descricao: unknown;
}

describe('Trim', () => {
  it('remove os espaços das pontas', () => {
    const dto = plainToInstance(ExemploDto, {
      nome: '  Bela Vista ',
      descricao: ' Perto do centro ',
    });

    expect(dto).toMatchObject({
      nome: 'Bela Vista',
      descricao: 'Perto do centro',
    });
  });

  it('converte texto vazio em null só quando configurado', () => {
    const dto = plainToInstance(ExemploDto, { nome: '   ', descricao: '   ' });

    expect(dto.nome).toBe('');
    expect(dto.descricao).toBeNull();
  });

  it('mantém valores que não são texto', () => {
    const dto = plainToInstance(ExemploDto, { nome: 10, descricao: null });

    expect(dto.nome).toBe(10);
    expect(dto.descricao).toBeNull();
  });
});
