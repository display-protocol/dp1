import type { Env, Playlist, PlaylistGroup } from './types';
import { PlaylistSchema } from './types';

// Updated KV Storage Keys with consistent prefixes
export const STORAGE_KEYS = {
  PLAYLIST_ID_PREFIX: 'playlist:id:',
  PLAYLIST_SLUG_PREFIX: 'playlist:slug:',
  PLAYLIST_GROUP_ID_PREFIX: 'playlist-group:id:',
  PLAYLIST_GROUP_SLUG_PREFIX: 'playlist-group:slug:',
  PLAYLIST_BY_GROUP_PREFIX: 'playlist:playlist-group-id:',
  SERVER_KEYPAIR: 'server:keypair',
} as const;

export interface PaginatedResult<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

/**
 * Fetch and validate an external playlist URL with strict DP-1 validation
 */
async function fetchAndValidatePlaylist(
  url: string
): Promise<{ id: string; playlist: Playlist } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch playlist from ${url}: ${response.status}`);
      return null;
    }

    const rawPlaylist = await response.json();

    // Use Zod schema for strict DP-1 validation
    const validationResult = PlaylistSchema.safeParse(rawPlaylist);
    if (!validationResult.success) {
      console.error(
        `External playlist from ${url} failed DP-1 validation:`,
        validationResult.error.format()
      );
      return null;
    }

    const playlist = validationResult.data;
    return { id: playlist.id, playlist };
  } catch (error) {
    console.error(`Error fetching/parsing playlist from ${url}:`, error);
    return null;
  }
}

/**
 * Save a playlist with multiple indexes for efficient retrieval
 */
export async function savePlaylist(playlist: Playlist, env: Env): Promise<boolean> {
  try {
    const playlistData = JSON.stringify(playlist);

    // Create batch operations for multiple indexes
    const operations = [
      // Main record by ID
      env.DP1_PLAYLISTS.put(`${STORAGE_KEYS.PLAYLIST_ID_PREFIX}${playlist.id}`, playlistData),
      // Index by slug
      env.DP1_PLAYLISTS.put(`${STORAGE_KEYS.PLAYLIST_SLUG_PREFIX}${playlist.slug}`, playlist.id),
    ];

    await Promise.all(operations);
    return true;
  } catch (error) {
    console.error('Error saving playlist:', error);
    return false;
  }
}

/**
 * Get a playlist by ID or slug
 */
export async function getPlaylistByIdOrSlug(
  identifier: string,
  env: Env
): Promise<Playlist | null> {
  try {
    let playlistId = identifier;

    // Check if it's a UUID (if not, assume it's a slug)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    if (!isUuid) {
      // It's a slug, get the ID first
      const id = await env.DP1_PLAYLISTS.get(`${STORAGE_KEYS.PLAYLIST_SLUG_PREFIX}${identifier}`);
      if (!id) return null;
      playlistId = id;
    }

    const playlistData = await env.DP1_PLAYLISTS.get(
      `${STORAGE_KEYS.PLAYLIST_ID_PREFIX}${playlistId}`
    );
    if (!playlistData) return null;

    return JSON.parse(playlistData) as Playlist;
  } catch (error) {
    console.error('Error getting playlist:', error);
    return null;
  }
}

/**
 * List all playlists with pagination support
 */
export async function listAllPlaylists(
  env: Env,
  options: ListOptions = {}
): Promise<PaginatedResult<Playlist>> {
  try {
    let limit = options.limit || 100;
    if (limit > 100) {
      limit = 100;
    }

    const response = await env.DP1_PLAYLISTS.list({
      prefix: STORAGE_KEYS.PLAYLIST_ID_PREFIX,
      limit,
      cursor: options.cursor,
    });

    const playlists: Playlist[] = [];

    // Use Promise.all to fetch all values in parallel
    const fetchPromises = response.keys.map(async key => {
      try {
        const playlistData = await env.DP1_PLAYLISTS.get(key.name);
        if (playlistData) {
          return JSON.parse(playlistData) as Playlist;
        }
      } catch (error) {
        console.error(`Error parsing playlist ${key.name}:`, error);
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    playlists.push(...results.filter((p): p is Playlist => p !== null));

    return {
      items: playlists,
      cursor: response.list_complete ? undefined : (response as any).cursor,
      hasMore: !response.list_complete,
    };
  } catch (error) {
    console.error('Error listing playlists:', error);
    return { items: [], hasMore: false };
  }
}

/**
 * List playlists by playlist group ID with pagination
 */
export async function listPlaylistsByGroupId(
  playlistGroupId: string,
  env: Env,
  options: ListOptions = {}
): Promise<PaginatedResult<Playlist>> {
  try {
    let limit = options.limit || 100;
    if (limit > 100) {
      limit = 100;
    }

    const response = await env.DP1_PLAYLISTS.list({
      prefix: `${STORAGE_KEYS.PLAYLIST_BY_GROUP_PREFIX}${playlistGroupId}:`,
      limit,
      cursor: options.cursor,
    });

    const playlists: Playlist[] = [];

    // Use Promise.all to fetch all playlists in parallel
    const fetchPromises = response.keys.map(async key => {
      try {
        // Parse the playlist ID directly from the key (saves one KV query)
        // Key format: playlist:playlist-group-id:$playlist-group-id:$playlist-id
        const keyParts = key.name.split(':');
        const playlistId = keyParts[keyParts.length - 1]; // Last part is the playlist ID

        const playlistData = await env.DP1_PLAYLISTS.get(
          `${STORAGE_KEYS.PLAYLIST_ID_PREFIX}${playlistId}`
        );
        if (playlistData) {
          return JSON.parse(playlistData) as Playlist;
        }
      } catch (error) {
        console.error(`Error parsing playlist from group reference ${key.name}:`, error);
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    playlists.push(...results.filter((p): p is Playlist => p !== null));

    return {
      items: playlists,
      cursor: response.list_complete ? undefined : (response as any).cursor,
      hasMore: !response.list_complete,
    };
  } catch (error) {
    console.error('Error listing playlists by group:', error);
    return { items: [], hasMore: false };
  }
}

/**
 * Save a playlist group with multiple indexes
 */
export async function savePlaylistGroup(playlistGroup: PlaylistGroup, env: Env): Promise<boolean> {
  try {
    if (playlistGroup.playlists.length === 0) {
      console.error('Playlist group has no playlists');
      return false;
    }

    // First, fetch and validate all external playlists in parallel
    const playlistValidationPromises = playlistGroup.playlists.map(async playlistUrl => {
      // If it's an external URL, fetch and validate it
      if (playlistUrl.startsWith('http://') || playlistUrl.startsWith('https://')) {
        const result = await fetchAndValidatePlaylist(playlistUrl);
        if (result) {
          return result;
        }
        console.error(`Failed to fetch and validate external playlist: ${playlistUrl}`);
        return null;
      } else {
        console.error(`Invalid playlist URL format: ${playlistUrl}`);
        return null;
      }
    });

    const validatedPlaylists = await Promise.all(playlistValidationPromises);

    // Filter out failed validations
    const validPlaylists = validatedPlaylists.filter(
      (result): result is { id: string; playlist: Playlist } => result !== null
    );

    // If there are no valid playlists, fail
    if (validPlaylists.length === 0 && playlistGroup.playlists.length > 0) {
      console.error(`No playlists in group ${playlistGroup.id} could be validated`);
      return false;
    }

    // If there is at least one invalid playlist, fail
    if (validPlaylists.length < validatedPlaylists.length) {
      console.error('At least one playlist in group is invalid');
      return false;
    }

    const groupData = JSON.stringify(playlistGroup);

    // Create batch operations for multiple indexes
    const operations = [
      // Main record by ID
      env.DP1_PLAYLIST_GROUPS.put(
        `${STORAGE_KEYS.PLAYLIST_GROUP_ID_PREFIX}${playlistGroup.id}`,
        groupData
      ),
      // Index by slug
      env.DP1_PLAYLIST_GROUPS.put(
        `${STORAGE_KEYS.PLAYLIST_GROUP_SLUG_PREFIX}${playlistGroup.slug}`,
        playlistGroup.id
      ),
    ];

    // If this is an update, clean up all old playlist group indexes
    const existingGroup = await getPlaylistGroupByIdOrSlug(playlistGroup.id, env);
    if (existingGroup) {
      const groupIndexPrefix = `${STORAGE_KEYS.PLAYLIST_BY_GROUP_PREFIX}${playlistGroup.id}:`;
      const existingIndexes = await env.DP1_PLAYLISTS.list({ prefix: groupIndexPrefix });

      for (const indexKey of existingIndexes.keys) {
        operations.push(env.DP1_PLAYLISTS.delete(indexKey.name));
      }
    }

    // Store external playlists and create group indexes
    for (const validPlaylist of validPlaylists) {
      // If it's an external playlist with data, store it
      if (validPlaylist.playlist) {
        operations.push(
          env.DP1_PLAYLISTS.put(
            `${STORAGE_KEYS.PLAYLIST_ID_PREFIX}${validPlaylist.id}`,
            JSON.stringify(validPlaylist.playlist)
          ),
          env.DP1_PLAYLISTS.put(
            `${STORAGE_KEYS.PLAYLIST_SLUG_PREFIX}${validPlaylist.playlist.slug}`,
            validPlaylist.id
          )
        );
      }

      // Create group index for this playlist
      operations.push(
        env.DP1_PLAYLISTS.put(
          `${STORAGE_KEYS.PLAYLIST_BY_GROUP_PREFIX}${playlistGroup.id}:${validPlaylist.id}`,
          validPlaylist.id
        )
      );
    }

    await Promise.all(operations);
    return true;
  } catch (error) {
    console.error('Error saving playlist group:', error);
    return false;
  }
}

/**
 * Get a playlist group by ID or slug
 */
export async function getPlaylistGroupByIdOrSlug(
  identifier: string,
  env: Env
): Promise<PlaylistGroup | null> {
  try {
    let groupId = identifier;

    // Check if it's a UUID (if not, assume it's a slug)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier
    );

    if (!isUuid) {
      // It's a slug, get the ID first
      const id = await env.DP1_PLAYLIST_GROUPS.get(
        `${STORAGE_KEYS.PLAYLIST_GROUP_SLUG_PREFIX}${identifier}`
      );
      if (!id) return null;
      groupId = id;
    }

    const groupData = await env.DP1_PLAYLIST_GROUPS.get(
      `${STORAGE_KEYS.PLAYLIST_GROUP_ID_PREFIX}${groupId}`
    );
    if (!groupData) return null;

    return JSON.parse(groupData) as PlaylistGroup;
  } catch (error) {
    console.error('Error getting playlist group:', error);
    return null;
  }
}

/**
 * List all playlist groups with pagination support
 */
export async function listAllPlaylistGroups(
  env: Env,
  options: ListOptions = {}
): Promise<PaginatedResult<PlaylistGroup>> {
  try {
    const limit = options.limit || 1000; // Default KV list limit

    const response = await env.DP1_PLAYLIST_GROUPS.list({
      prefix: STORAGE_KEYS.PLAYLIST_GROUP_ID_PREFIX,
      limit,
      cursor: options.cursor,
    });

    const groups: PlaylistGroup[] = [];

    // Use Promise.all to fetch all values in parallel
    const fetchPromises = response.keys.map(async key => {
      try {
        const groupData = await env.DP1_PLAYLIST_GROUPS.get(key.name);
        if (groupData) {
          return JSON.parse(groupData) as PlaylistGroup;
        }
      } catch (error) {
        console.error(`Error parsing playlist group ${key.name}:`, error);
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    groups.push(...results.filter((g): g is PlaylistGroup => g !== null));

    return {
      items: groups,
      cursor: response.list_complete ? undefined : (response as any).cursor,
      hasMore: !response.list_complete,
    };
  } catch (error) {
    console.error('Error listing playlist groups:', error);
    return { items: [], hasMore: false };
  }
}

/**
 * Delete a playlist and all its indexes
 */
export async function deletePlaylist(playlist: Playlist, env: Env): Promise<boolean> {
  try {
    const operations = [
      env.DP1_PLAYLISTS.delete(`${STORAGE_KEYS.PLAYLIST_ID_PREFIX}${playlist.id}`),
      env.DP1_PLAYLISTS.delete(`${STORAGE_KEYS.PLAYLIST_SLUG_PREFIX}${playlist.slug}`),
    ];

    await Promise.all(operations);
    return true;
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return false;
  }
}

/**
 * Delete a playlist group and all its indexes
 */
export async function deletePlaylistGroup(
  playlistGroup: PlaylistGroup,
  env: Env
): Promise<boolean> {
  try {
    const operations = [
      env.DP1_PLAYLIST_GROUPS.delete(`${STORAGE_KEYS.PLAYLIST_GROUP_ID_PREFIX}${playlistGroup.id}`),
      env.DP1_PLAYLIST_GROUPS.delete(
        `${STORAGE_KEYS.PLAYLIST_GROUP_SLUG_PREFIX}${playlistGroup.slug}`
      ),
    ];

    // Remove playlist group indexes
    for (const playlistUrl of playlistGroup.playlists) {
      const playlistIdMatch = playlistUrl.match(/playlists([^]+)(?:|$)/);
      if (playlistIdMatch) {
        const playlistId = playlistIdMatch[1];
        operations.push(
          env.DP1_PLAYLISTS.delete(
            `${STORAGE_KEYS.PLAYLIST_BY_GROUP_PREFIX}${playlistGroup.id}:${playlistId}`
          )
        );
      }
    }

    await Promise.all(operations);
    return true;
  } catch (error) {
    console.error('Error deleting playlist group:', error);
    return false;
  }
}
