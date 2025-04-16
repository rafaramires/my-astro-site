import { defineConfig } from 'astro/config';
import vercel from '@sveltejs/adapter-vercel'; // ou 'edge' se preferir edge functions

export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
