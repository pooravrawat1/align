import { z } from 'zod';

export const HUB_TYPES = ['interest', 'skill', 'event'];

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['person', 'interest', 'skill', 'event']),
  label: z.string(),
  group: z.string().nullable(),
  degree: z.number().int().nonnegative(),
  avatar: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  synthetic: z.boolean().optional(),
});

export const graphLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(['tag', 'match', 'connection']),
  weight: z.number().nonnegative(),
});

export const graphMetaSchema = z.object({
  source: z.enum(['memory', 'mongo']),
  generatedAt: z.string(),
  eventId: z.string().nullable(),
  hubs: z.array(z.enum(['interest', 'skill', 'event'])),
  viewerId: z.string().nullable(),
  counts: z.object({
    people: z.number().int().nonnegative(),
    hubs: z.number().int().nonnegative(),
    matches: z.number().int().nonnegative(),
    connections: z.number().int().nonnegative(),
    orphans: z.number().int().nonnegative(),
  }),
});

export const graphResponseSchema = z.object({
  nodes: z.array(graphNodeSchema),
  links: z.array(graphLinkSchema),
  meta: graphMetaSchema,
});
