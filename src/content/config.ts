import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const appPrivacy = defineCollection({
  type: 'content',
  schema: z.object({
    app: z.string(),
    platforms: z.string(),
    effective: z.coerce.date(),
    contact: z.string().default('dashgin@praxis.az'),
  }),
});

export const collections = { blog, 'app-privacy': appPrivacy };
