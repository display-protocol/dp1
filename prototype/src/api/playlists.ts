import playlists from '../data/playlists.json';
import type { Env } from '../types';
import { authenticate } from '../auth';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'X-API-Key, X-Signature, Content-Type'
};

export async function handlePlaylists(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
  }
  if (!await authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
  }
  const url = new URL(request.url);
  let result = playlists as any[];
  if (url.searchParams.get('chain')) {
    result = result.filter(p => p.chain === url.searchParams.get('chain'));
  }
  if (url.searchParams.get('type')) {
    result = result.filter(p => p.type === url.searchParams.get('type'));
  }
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  return new Response(JSON.stringify(result.slice(0, limit)), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
