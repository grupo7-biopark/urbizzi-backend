import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/app.setup.js';

describe('HealthController (e2e)', () => {
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

  it('GET /health retorna 200 com o banco "up"', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 'ok',
          info: { database: { status: 'up' } },
        });
      });
  });

  it('GET /docs-json expõe o documento OpenAPI com a rota /health', () => {
    return request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
      .expect((res) => {
        expect(res.body.paths).toHaveProperty('/health');
      });
  });
});
