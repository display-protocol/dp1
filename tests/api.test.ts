import { describe, it, expect } from 'vitest';
import { handlePlaylists } from '../prototype/src/api/playlists';
import { handlePlaylistGroup } from '../prototype/src/api/playlistGroups';
import type { Env } from '../prototype/src/types';

const env: Env = { API_SECRET: 'secret' } as Env;
const sign = async (key: string) => {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(env.API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(key));
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2,'0')).join('');
};

describe('API', () => {
  it('playlists returns data', async () => {
    const key = 'demo';
    const sig = await sign(key);
    const req = new Request('http://localhost/api/v1/playlists', {
      headers: { 'X-API-Key': key, 'X-Signature': sig }
    });
    const res = await handlePlaylists(req, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('playlist group returns 404 for missing', async () => {
    const key = 'demo';
    const sig = await sign(key);
    const req = new Request('http://localhost/api/v1/playlist-groups/missing', {
      headers: { 'X-API-Key': key, 'X-Signature': sig }
    });
    const res = await handlePlaylistGroup(req, env, 'missing');
    expect(res.status).toBe(404);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
