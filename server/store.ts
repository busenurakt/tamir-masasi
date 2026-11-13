import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, asc, desc, eq } from 'drizzle-orm';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { events, meta, repairs } from './schema.js';
import { intakeSchema, updateSchema, transitions, type Change, type Intake, type Repair, type Status } from '../shared/domain.js';

export class Problem extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
function publicRepair(row: typeof repairs.$inferSelect): Repair {
  const {id, customer, contact, item, category, issue, status, version, createdAt, updatedAt} = row;
  return {id, customer, contact, item, category, issue, status, version, createdAt, updatedAt};
}
// Local libSQL's native busy wait blocks Node's event loop, preventing the first
// transaction from committing. Yield between retries instead, then re-read version.
async function write<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {return await operation();}
    catch (error) {
      let cause: unknown = error;
      let busy = false;
      for (let depth = 0; cause && depth < 6; depth++) {
        const current = cause as {message?: string; code?: string; cause?: unknown};
        busy ||= /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(`${current.code} ${current.message}`);
        cause = current.cause;
      }
      if (!busy) throw error;
      if (attempt >= 7) throw new Problem(503, 'Atölye defteri şu anda meşgul. Birkaç saniye sonra tekrar deneyin.');
      await delay(Math.min(20 * 2 ** attempt, 200));
    }
  }
}
export async function openStore(url = 'file:./data/tamir.sqlite', seed = true) {
  if (!url.startsWith('file:')) throw new Error('DATABASE_URL yerel file: yolu olmalıdır.');
  await mkdir(dirname(resolve(url.slice(5))), {recursive: true});
  const client = createClient({url});
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA busy_timeout = 0');
  const version = await client.execute('PRAGMA user_version');
  if (Number(version.rows[0].user_version) > 1) {client.close(); throw new Error('Veritabanı sürümü bu uygulamadan daha yeni.');}
  await client.batch([
    `CREATE TABLE IF NOT EXISTS repairs (id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, contact TEXT NOT NULL, item TEXT NOT NULL, category TEXT NOT NULL, issue TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('received','working','parts','ready','unrepairable','collected')), version INTEGER NOT NULL CHECK(version >= 1), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, repair_id INTEGER NOT NULL REFERENCES repairs(id), status TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`,
    'CREATE INDEX IF NOT EXISTS events_repair ON events(repair_id, id)',
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
    'PRAGMA user_version = 1'
  ], 'write');
  const db = drizzle(client);
  await write(() => db.transaction(async tx => {
    const initialized = await tx.select().from(meta).where(eq(meta.key, 'initialized')).get();
    if (initialized) return;
    if (seed) {
      const demo: [string, string, string, string, Status, number, string][] = [
        ['Deniz Aksoy', 'Braun filtre kahve makinesi', 'Küçük ev aleti', 'Su ısınıyor fakat filtreye ulaşmıyor. Pompa ve hortum kontrolü istendi.', 'working', 2, 'Su hattı temizlendi. Pompa basıncı kontrol ediliyor.'],
        ['Selin Yalçın', 'Philips masa lambası', 'Aydınlatma', 'Kablo hareket edince ışık kesiliyor. Orijinal gövde korunacak.', 'ready', 3, 'Kablo değişti, bağlantılar yalıtıldı. 30 dakika çalıştırma testi tamamlandı.'],
        ['Mert Eren', 'Sony taşınabilir radyo', 'Ses & görüntü', 'Ses düğmesinde cızırtı var, sol hoparlörden ses gelmiyor.', 'parts', 8, '10k potansiyometre sipariş edildi. Parça gelince ölçüm tekrarlanacak.'],
        ['Ece Kaya', 'Arçelik el blenderı', 'Küçük ev aleti', 'Düğmeye basınca motor dönmüyor. Geçen hafta çalışıyordu.', 'received', 0, 'Eşya ve güç kablosu birlikte teslim alındı.'],
        ['Bora Aydın', 'Marshall Bluetooth hoparlör', 'Ses & görüntü', 'Şarj soketi gevşek. Kabloyu tutmadan şarj olmuyor.', 'parts', 5, 'USB soketi için ölçü ve pin uyumu doğrulanıyor.'],
        ['Aslı Demir', 'Vintage duvar saati', 'Diğer', 'Yeni pil ile de çalışmıyor. Mekanizma kontrolü istendi.', 'collected', 6, 'Yeni mekanizma takıldı. Müşteriye çalışır durumda teslim edildi.']
      ];
      for (const [customer, item, category, issue, status, days, note] of demo) {
        const createdAt = new Date(Date.now() - days * 86400000).toISOString();
        const path: Status[] = status === 'received' ? ['received'] : status === 'parts' ? ['received', 'working', 'parts'] : status === 'ready' ? ['received', 'working', 'ready'] : status === 'collected' ? ['received', 'working', 'ready', 'collected'] : ['received', 'working'];
        const [row] = await tx.insert(repairs).values({customer, contact: '', item, category, issue, status, version: path.length, createdAt, updatedAt: createdAt, requestId: randomUUID(), fingerprint: 'demo'}).returning();
        for (const [i, stage] of path.entries()) await tx.insert(events).values({repairId: row.id, status: stage, note: i === path.length - 1 ? note : i === 0 ? 'Eşya atölyeye kabul edildi.' : 'İşlem kontrol listesi tamamlandı.', createdAt});
      }
    }
    await tx.insert(meta).values({key: 'initialized', value: new Date().toISOString()});
  }, {behavior: 'immediate'}));
  return {
    close: () => client.close(),
    async list() { return (await db.select().from(repairs).orderBy(desc(repairs.createdAt), desc(repairs.id))).map(publicRepair); },
    async detail(id: number) {
      return db.transaction(async tx => {
        const row = await tx.select().from(repairs).where(eq(repairs.id, id)).get();
        if (!row) throw new Problem(404, 'İş kaydı bulunamadı.');
        return {repair: publicRepair(row), events: await tx.select().from(events).where(eq(events.repairId, id)).orderBy(asc(events.id))};
      });
    },
    async create(input: Intake) {
      input = intakeSchema.parse(input);
      return write(() => db.transaction(async tx => {
        const fingerprint = JSON.stringify({...input, requestId: undefined});
        const prior = await tx.select().from(repairs).where(eq(repairs.requestId, input.requestId)).get();
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw new Problem(409, 'Bu kayıt anahtarı farklı bilgilerle kullanıldı. Formu yeniden açın.');
          return publicRepair(prior);
        }
        const now = new Date().toISOString();
        const [row] = await tx.insert(repairs).values({...input, fingerprint, status: 'received', version: 1, createdAt: now, updatedAt: now}).returning();
        await tx.insert(events).values({repairId: row.id, status: 'received', note: 'Eşya atölyeye kabul edildi.', createdAt: now});
        return publicRepair(row);
      }, {behavior: 'immediate'}));
    },
    async change(id: number, input: Change) {
      input = updateSchema.parse(input);
      return write(() => db.transaction(async tx => {
        const row = await tx.select().from(repairs).where(eq(repairs.id, id)).get();
        if (!row) throw new Problem(404, 'İş kaydı bulunamadı.');
        if (row.version !== input.version) throw new Problem(409, 'Bu kayıt başka bir işlemle değişti. Güncel kaydı yükleyip tekrar deneyin.');
        if (!transitions[row.status].includes(input.status)) throw new Problem(409, 'Bu durum geçişine izin verilmiyor.');
        const now = new Date().toISOString();
        const [updated] = await tx.update(repairs).set({status: input.status, version: row.version + 1, updatedAt: now}).where(and(eq(repairs.id, id), eq(repairs.version, input.version))).returning();
        if (!updated) throw new Problem(409, 'Kayıt değişti. Yenileyip tekrar deneyin.');
        await tx.insert(events).values({repairId: id, status: input.status, note: input.note, createdAt: now});
        return publicRepair(updated);
      }, {behavior: 'immediate'}));
    }
  };
}
export type Store = Awaited<ReturnType<typeof openStore>>;
