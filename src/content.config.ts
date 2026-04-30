import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const exhibits = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exhibits' }),
  schema: z.object({
    title: z.string(),
    capturedAt: z.coerce.date(),
    eventName: z.string(),
    description: z.string(),
    // Path under /public, e.g. "models/my-exhibit.glb" or "models/my-exhibit/scene.gltf"
    model: z.string(),
    // Optional poster image shown before the 3D viewer loads
    poster: z.string().optional(),
  }),
});

export const collections = { exhibits };
