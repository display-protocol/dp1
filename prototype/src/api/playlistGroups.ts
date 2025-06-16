import groups from '../data/playlist-groups.json';
import type { Env } from '../types';
import { authenticate } from '../auth';
import { corsHeaders } from './playlists';

export async function handlePlaylistGroup(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
  }
  if (!await authenticate(request, env)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
  }
  const group = (groups as any[]).find(g => g.id === id);
  if (!group) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: corsHeaders });
  }
  return new Response(JSON.stringify(group), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
