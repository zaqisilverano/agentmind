import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { Takeaway } from '@/engine/types';

const ts = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: ts('created_at'),
  lastSeenAt: ts('last_seen_at'),
});

export const brains = pgTable(
  'brains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    round: integer('round').notNull().default(0),
    synth: jsonb('synth').$type<Takeaway>(),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [unique('brains_user_number_uq').on(t.userId, t.number), index('brains_user_idx').on(t.userId)],
);

export const nodes = pgTable(
  'nodes',
  {
    brainId: uuid('brain_id').notNull().references(() => brains.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    name: text('name').notNull(),
    note: text('note').notNull().default(''),
    userNote: text('user_note').notNull().default(''),
    kind: text('kind').notNull(),
    parentId: text('parent_id'),
    depth: integer('depth').notNull(),
    color: text('color').notNull(),
    by: text('by'),
    critic: boolean('critic').notNull().default(false),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.brainId, t.id] }), index('nodes_brain_parent_idx').on(t.brainId, t.parentId)],
);

export const links = pgTable(
  'links',
  {
    brainId: uuid('brain_id').notNull().references(() => brains.id, { onDelete: 'cascade' }),
    a: text('a').notNull(),
    b: text('b').notNull(),
    why: text('why').notNull().default(''),
    by: text('by').notNull(),
  },
  (t) => [primaryKey({ columns: [t.brainId, t.a, t.b] })],
);

export const logEntries = pgTable(
  'log_entries',
  {
    brainId: uuid('brain_id').notNull().references(() => brains.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    agent: text('agent').notNull(),
    text: text('text').notNull(),
    nodeId: text('node_id').notNull(),
    tag: text('tag').notNull(),
  },
  (t) => [primaryKey({ columns: [t.brainId, t.seq] })],
);
