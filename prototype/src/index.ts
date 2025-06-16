import { handlePlaylists, corsHeaders } from './api/playlists';
import { handlePlaylistGroup } from './api/playlistGroups';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log(JSON.stringify({ method: request.method, path: url.pathname }));

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
    }

    if (url.pathname.startsWith('/api/v1/playlists')) {
      return handlePlaylists(request, env);
    }

    if (url.pathname.startsWith('/api/v1/playlist-groups/')) {
      const id = url.pathname.split('/').pop() as string;
      return handlePlaylistGroup(request, env, id);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
