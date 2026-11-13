import { z } from 'zod';
export const statuses = ['received', 'working', 'parts', 'ready', 'unrepairable', 'collected'] as const;
export type Status = typeof statuses[number];
export const labels: Record<Status, string> = {received: 'Sırada', working: 'İşlemde', parts: 'Parça bekliyor', ready: 'Teslime hazır', unrepairable: 'Onarılamadı', collected: 'Teslim edildi'};
export const transitions: Record<Status, Status[]> = {received: ['working'], working: ['parts', 'ready', 'unrepairable'], parts: ['working', 'unrepairable'], ready: ['collected'], unrepairable: ['collected'], collected: []};
export const categories = ['Küçük ev aleti', 'Ses & görüntü', 'Aydınlatma', 'Diğer'] as const;
export const intakeSchema = z.object({
  customer: z.string().trim().min(2, 'En az 2 karakter yazın.').max(80),
  contact: z.string().trim().max(100).default(''),
  item: z.string().trim().min(3, 'Eşyayı en az 3 karakterle tanımlayın.').max(100),
  category: z.enum(categories), issue: z.string().trim().min(8, 'Sorunu en az 8 karakterle açıklayın.').max(1000),
  requestId: z.uuid()
}).strict();
export const updateSchema = z.object({status: z.enum(statuses), note: z.string().trim().min(5, 'En az 5 karakterlik işlem notu gerekli.').max(1000), version: z.number().int().min(1)}).strict();
export type Intake = z.infer<typeof intakeSchema>;
export type Change = z.infer<typeof updateSchema>;
export type Repair = {id: number; customer: string; contact: string; item: string; category: string; issue: string; status: Status; version: number; createdAt: string; updatedAt: string};
export type RepairEvent = {id: number; repairId: number; status: Status; note: string; createdAt: string};
export type Detail = {repair: Repair; events: RepairEvent[]};
export const ticket = (id: number) => `TM-${String(id).padStart(4, '0')}`;
export const elapsedDays = (date: string, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(date)) / 86400000));
