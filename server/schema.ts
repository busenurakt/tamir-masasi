import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import type { Status } from '../shared/domain.js';
export const repairs = sqliteTable('repairs', {
  id: integer('id').primaryKey({autoIncrement: true}),
  customer: text('customer').notNull(), contact: text('contact').notNull(),
  item: text('item').notNull(), category: text('category').notNull(), issue: text('issue').notNull(),
  status: text('status').$type<Status>().notNull(), version: integer('version').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
  requestId: text('request_id').notNull().unique(), fingerprint: text('fingerprint').notNull()
});
export const events = sqliteTable('events', {
  id: integer('id').primaryKey({autoIncrement: true}), repairId: integer('repair_id').notNull().references(() => repairs.id),
  status: text('status').$type<Status>().notNull(), note: text('note').notNull(), createdAt: text('created_at').notNull()
});
export const meta = sqliteTable('meta', {key: text('key').primaryKey(), value: text('value').notNull()});
