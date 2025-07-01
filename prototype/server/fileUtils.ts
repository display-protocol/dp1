import type { Playlist, PlaylistGroup, Env } from './types';

// KV storage operations for managing playlists and playlist groups in Cloudflare Workers

/**
 * Read a JSON object from KV storage
 */
async function readFromKV<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    const value = await kv.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Error reading from KV key ${key}:`, error);
    return null;
  }
}

/**
 * Write a JSON object to KV storage
 */
async function writeToKV<T>(kv: KVNamespace, key: string, data: T): Promise<boolean> {
  try {
    const value = JSON.stringify(data, null, 2);
    await kv.put(key, value);
    return true;
  } catch (error) {
    console.error(`Error writing to KV key ${key}:`, error);
    return false;
  }
}

/**
 * List all playlists from KV storage
 */
export async function listAllPlaylists(env: Env): Promise<Playlist[]> {
  try {
    const list = await env.DP1_PLAYLISTS.list({ prefix: 'playlist:' });
    const playlists: Playlist[] = [];

    for (const key of list.keys) {
      const playlist = await readFromKV<Playlist>(env.DP1_PLAYLISTS, key.name);
      if (playlist) {
        playlists.push(playlist);
      }
    }

    // Sort by created date, newest first
    return playlists.sort((a, b) => {
      const dateA = new Date(a.created || 0).getTime();
      const dateB = new Date(b.created || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error listing playlists:', error);
    return [];
  }
}

/**
 * List all playlist groups from KV storage
 */
export async function listAllPlaylistGroups(env: Env): Promise<PlaylistGroup[]> {
  try {
    const list = await env.DP1_PLAYLIST_GROUPS.list({ prefix: 'playlist-group:' });
    const groups: PlaylistGroup[] = [];

    for (const key of list.keys) {
      const group = await readFromKV<PlaylistGroup>(env.DP1_PLAYLIST_GROUPS, key.name);
      if (group) {
        groups.push(group);
      }
    }

    // Sort by created date, newest first
    return groups.sort((a, b) => {
      const dateA = new Date(a.created || 0).getTime();
      const dateB = new Date(b.created || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error listing playlist groups:', error);
    return [];
  }
}

/**
 * Save an individual playlist to KV
 */
export async function savePlaylist(playlist: Playlist, env: Env): Promise<boolean> {
  const key = `playlist:${playlist.id}`;
  return await writeToKV(env.DP1_PLAYLISTS, key, playlist);
}

/**
 * Save an individual playlist group to KV
 */
export async function savePlaylistGroup(group: PlaylistGroup, env: Env): Promise<boolean> {
  const key = `playlist-group:${group.id}`;
  return await writeToKV(env.DP1_PLAYLIST_GROUPS, key, group);
}

/**
 * Read an individual playlist from KV
 */
export async function getPlaylist(id: string, env: Env): Promise<Playlist | null> {
  const key = `playlist:${id}`;
  return await readFromKV<Playlist>(env.DP1_PLAYLISTS, key);
}

/**
 * Read a playlist by UUID or slug
 */
export async function getPlaylistByIdOrSlug(
  identifier: string,
  env: Env
): Promise<Playlist | null> {
  // Check if it's a UUID format
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (isUuid) {
    // Direct lookup by UUID
    return await getPlaylist(identifier, env);
  } else {
    // Search by slug - we need to iterate through all playlists
    const allPlaylists = await listAllPlaylists(env);
    return allPlaylists.find(playlist => playlist.slug === identifier) || null;
  }
}

/**
 * Read an individual playlist group from KV
 */
export async function getPlaylistGroup(id: string, env: Env): Promise<PlaylistGroup | null> {
  const key = `playlist-group:${id}`;
  return await readFromKV<PlaylistGroup>(env.DP1_PLAYLIST_GROUPS, key);
}

/**
 * Read a playlist group by UUID or slug
 */
export async function getPlaylistGroupByIdOrSlug(
  identifier: string,
  env: Env
): Promise<PlaylistGroup | null> {
  // Check if it's a UUID format
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  if (isUuid) {
    // Direct lookup by UUID
    return await getPlaylistGroup(identifier, env);
  } else {
    // Search by slug - we need to iterate through all playlist groups
    const allGroups = await listAllPlaylistGroups(env);
    return allGroups.find(group => group.slug === identifier) || null;
  }
}

/**
 * Check if a playlist exists in KV
 */
export async function playlistExists(id: string, env: Env): Promise<boolean> {
  try {
    const key = `playlist:${id}`;
    const value = await env.DP1_PLAYLISTS.get(key);
    return value !== null;
  } catch (error) {
    console.error(`Error checking playlist existence for ${id}:`, error);
    return false;
  }
}

/**
 * Check if a playlist group exists in KV
 */
export async function playlistGroupExists(id: string, env: Env): Promise<boolean> {
  try {
    const key = `playlist-group:${id}`;
    const value = await env.DP1_PLAYLIST_GROUPS.get(key);
    return value !== null;
  } catch (error) {
    console.error(`Error checking playlist group existence for ${id}:`, error);
    return false;
  }
}

/**
 * Delete a playlist from KV
 */
export async function deletePlaylist(id: string, env: Env): Promise<boolean> {
  try {
    const key = `playlist:${id}`;
    await env.DP1_PLAYLISTS.delete(key);
    return true;
  } catch (error) {
    console.error(`Error deleting playlist ${id}:`, error);
    return false;
  }
}

/**
 * Delete a playlist group from KV
 */
export async function deletePlaylistGroup(id: string, env: Env): Promise<boolean> {
  try {
    const key = `playlist-group:${id}`;
    await env.DP1_PLAYLIST_GROUPS.delete(key);
    return true;
  } catch (error) {
    console.error(`Error deleting playlist group ${id}:`, error);
    return false;
  }
}

/**
 * Get count of playlists in KV
 */
export async function getPlaylistCount(env: Env): Promise<number> {
  try {
    const list = await env.DP1_PLAYLISTS.list({ prefix: 'playlist:' });
    return list.keys.length;
  } catch (error) {
    console.error('Error getting playlist count:', error);
    return 0;
  }
}

/**
 * Get count of playlist groups in KV
 */
export async function getPlaylistGroupCount(env: Env): Promise<number> {
  try {
    const list = await env.DP1_PLAYLIST_GROUPS.list({ prefix: 'playlist-group:' });
    return list.keys.length;
  } catch (error) {
    console.error('Error getting playlist group count:', error);
    return 0;
  }
}
