import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

describe('Formato de erro (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rota inexistente retorna 404 no formato padrão', () => {
    return request(app.getHttpServer())
      .get('/v1/rota-inexistente')
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual({
          statusCode: 404,
          code: 'RECURSO_NAO_ENCONTRADO',
          message: 'Cannot GET /v1/rota-inexistente',
          path: '/v1/rota-inexistente',
          timestamp: expect.any(String),
        });
      });
  });
});
