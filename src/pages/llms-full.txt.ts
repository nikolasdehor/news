import { getCollection } from 'astro:content';
import { publicIndex } from '../lib/public-index';
export async function GET() {
  return new Response(publicIndex(await getCollection('posts')), {
    headers: {'Content-Type':'text/plain; charset=utf-8'},
  });
}
