import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { intakeSchema, updateSchema } from '../shared/domain.js';
import { Problem, type Store } from './store.js';

function idParam(params: unknown) {
  const id = Number((params as {id: string}).id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Problem(400, 'Geçersiz kayıt numarası.');
  return id;
}
export function createApp(store: Store, options: {static?: boolean; origin?: string} = {}) {
  const app = Fastify({bodyLimit: 8192, logger: false});
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'same-origin');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) {
      const expected = options.origin || `${req.protocol}://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== expected) throw new Problem(403, 'Bu kaynaktan işlem yapılamaz.');
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Problem(415, 'JSON biçiminde veri gönderin.');
    }
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) return reply.code(422).send({error: 'Alanları kontrol edin.', fields: Object.fromEntries(error.issues.map(i => [i.path.join('.'), i.message]))});
    const known = error as {statusCode?: number; code?: string; message?: string};
    const status = error instanceof Problem ? error.statusCode : known.statusCode && known.statusCode >= 400 && known.statusCode < 500 ? known.statusCode : 500;
    const message = error instanceof Problem ? error.message : status === 413 ? 'İstek 8 KB sınırını aşıyor.' : status === 400 ? 'Geçerli bir JSON isteği gönderin.' : status === 415 ? 'JSON biçiminde veri gönderin.' : 'İşlem tamamlanamadı. Tekrar deneyin.';
    if (status === 500) console.error(error);
    return reply.code(status).send({error: message});
  });
  app.get('/api/health', async () => ({ok: true}));
  app.get('/api/repairs', async () => ({repairs: await store.list(), now: new Date().toISOString()}));
  app.get('/api/repairs/:id', async req => store.detail(idParam(req.params)));
  app.post('/api/repairs', async (req, reply) => reply.code(201).send(await store.create(intakeSchema.parse(req.body))));
  app.patch('/api/repairs/:id', async req => store.change(idParam(req.params), updateSchema.parse(req.body)));
  if (options.static) {
    app.addHook('onSend', async (_req, reply) => {reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");});
    app.register(fastifyStatic, {root: resolve('dist')});
  }
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({error: 'Sayfa veya API yolu bulunamadı.'}));
  return app;
}
