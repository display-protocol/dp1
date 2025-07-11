import { Hono, Context } from 'hono';
import { z } from 'zod';
import type { Env, PlaylistInput, PlaylistUpdate, Playlist } from '../types';
import {
  PlaylistInputSchema,
  PlaylistUpdateSchema,
  createPlaylistFromInput,
  validateNoProtectedFields,
} from '../types';
import { signPlaylist, getServerKeyPair } from '../crypto';
import {
  listAllPlaylists,
  savePlaylist,
  getPlaylistByIdOrSlug,
  listPlaylistsByGroupId,
} from '../storage';

// Create playlist router
const playlists = new Hono<{ Bindings: Env }>();

/**
 * Validate identifier format (UUID or slug)
 */
function validateIdentifier(identifier: string): {
  isValid: boolean;
  isUuid: boolean;
  isSlug: boolean;
} {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const isSlug = /^[a-zA-Z0-9-]+$/.test(identifier);

  return {
    isValid: isUuid || isSlug,
    isUuid,
    isSlug,
  };
}

/**
 * Validate request body against Zod schema (input schema without server-generated fields)
 */
async function validatePlaylistBody(
  c: Context
): Promise<PlaylistInput | { error: string; message: string; status: number }> {
  try {
    const body = await c.req.json();
    const result = PlaylistInputSchema.parse(body);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return {
        error: 'validation_error',
        message: `Invalid playlist data: ${errorMessage}`,
        status: 400,
      };
    } else {
      return {
        error: 'invalid_json',
        message: 'Request body must be valid JSON',
        status: 400,
      };
    }
  }
}

/**
 * Validate request body for playlist updates (excludes protected fields)
 */
async function validatePlaylistUpdateBody(
  c: Context
): Promise<PlaylistUpdate | { error: string; message: string; status: number }> {
  try {
    const body = await c.req.json();

    // Check for protected fields first
    const protectedValidation = validateNoProtectedFields(body, 'playlist');
    if (!protectedValidation.isValid) {
      return {
        error: 'protected_fields',
        message: `Cannot update protected fields: ${protectedValidation.protectedFields?.join(', ')}. Protected fields are read-only.`,
        status: 400,
      };
    }

    const result = PlaylistUpdateSchema.parse(body);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return {
        error: 'validation_error',
        message: `Invalid playlist update data: ${errorMessage}`,
        status: 400,
      };
    } else {
      return {
        error: 'invalid_json',
        message: 'Request body must be valid JSON',
        status: 400,
      };
    }
  }
}

/**
 * GET /playlists - List all playlists with pagination and filtering
 * Query params:
 * - limit: number of items per page (max 100)
 * - cursor: pagination cursor from previous response
 * - playlist-group: filter by playlist group ID
 */
playlists.get('/', async c => {
  try {
    // Parse query parameters
    const limit = parseInt(c.req.query('limit') || '100');
    const cursor = c.req.query('cursor') || undefined;
    const playlistGroupId = c.req.query('playlist-group');

    // Validate limit
    if (limit < 1 || limit > 100) {
      return c.json(
        {
          error: 'invalid_limit',
          message: 'Limit must be between 1 and 100',
        },
        400
      );
    }

    let result;
    if (playlistGroupId) {
      // Filter by playlist group
      result = await listPlaylistsByGroupId(playlistGroupId, c.env, { limit, cursor });
    } else {
      // List all playlists
      result = await listAllPlaylists(c.env, { limit, cursor });
    }

    return c.json(result);
  } catch (error) {
    console.error('Error retrieving playlists:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to retrieve playlists',
      },
      500
    );
  }
});

/**
 * GET /playlists/:id - Get specific playlist by UUID or slug
 */
playlists.get('/:id', async c => {
  try {
    const playlistId = c.req.param('id');

    // Validate ID format (UUID or slug)
    const validation = validateIdentifier(playlistId);

    if (!playlistId || !validation.isValid) {
      return c.json(
        {
          error: 'invalid_id',
          message: 'Playlist ID must be a valid UUID or slug (alphanumeric with hyphens)',
        },
        400
      );
    }

    const playlist = await getPlaylistByIdOrSlug(playlistId, c.env);

    if (!playlist) {
      return c.json(
        {
          error: 'not_found',
          message: 'Playlist not found',
        },
        404
      );
    }

    return c.json(playlist);
  } catch (error) {
    console.error('Error retrieving playlist:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to retrieve playlist',
      },
      500
    );
  }
});

/**
 * POST /playlists - Create new playlist (server-generated ID)
 */
playlists.post('/', async c => {
  try {
    const validatedData = await validatePlaylistBody(c);

    // Check if validation returned an error
    if ('error' in validatedData) {
      return c.json(
        {
          error: validatedData.error,
          message: validatedData.message,
        },
        validatedData.status as 400
      );
    }

    // Create playlist with server-generated ID, timestamp, and slug
    const playlist = createPlaylistFromInput(validatedData);

    // Sign the playlist using ed25519 as per DP-1 specification
    const keyPair = await getServerKeyPair(c.env);

    playlist.signature = await signPlaylist(playlist, keyPair.privateKey);

    // Save playlist
    const saved = await savePlaylist(playlist, c.env);
    if (!saved) {
      return c.json(
        {
          error: 'save_error',
          message: 'Failed to save playlist',
        },
        500
      );
    }

    return c.json(playlist, 201);
  } catch (error) {
    console.error('Error creating playlist:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to create playlist',
      },
      500
    );
  }
});

/**
 * PUT /playlists/:id - Update existing playlist by UUID or slug
 */
playlists.put('/:id', async c => {
  try {
    const playlistId = c.req.param('id');

    // Validate ID format (UUID or slug)
    const validation = validateIdentifier(playlistId);

    if (!playlistId || !validation.isValid) {
      return c.json(
        {
          error: 'invalid_id',
          message: 'Playlist ID must be a valid UUID or slug (alphanumeric with hyphens)',
        },
        400
      );
    }

    const validatedData = await validatePlaylistUpdateBody(c);

    // Check if validation returned an error
    if ('error' in validatedData) {
      return c.json(
        {
          error: validatedData.error,
          message: validatedData.message,
        },
        validatedData.status as 400
      );
    }

    // Check if playlist exists first
    const existingPlaylist = await getPlaylistByIdOrSlug(playlistId, c.env);
    if (!existingPlaylist) {
      return c.json(
        {
          error: 'not_found',
          message: 'Playlist not found',
        },
        404
      );
    }

    // Generate new IDs for playlist items
    const itemsWithIds = validatedData.items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
    }));

    // Create updated playlist, just allow to update non-protected fields
    const updatedPlaylist: Playlist = {
      dpVersion: existingPlaylist.dpVersion,
      id: existingPlaylist.id, // Keep original server-generated ID
      slug: existingPlaylist.slug,
      title: validatedData.title || existingPlaylist.title,
      created: existingPlaylist.created,
      defaults: validatedData.defaults,
      items: itemsWithIds,
    };

    // Re-sign the playlist
    const keyPair = await getServerKeyPair(c.env);
    updatedPlaylist.signature = await signPlaylist(updatedPlaylist, keyPair.privateKey);

    // Save updated playlist
    const saved = await savePlaylist(updatedPlaylist, c.env);
    if (!saved) {
      return c.json(
        {
          error: 'save_error',
          message: 'Failed to update playlist',
        },
        500
      );
    }

    return c.json(updatedPlaylist);
  } catch (error) {
    console.error('Error updating playlist:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to update playlist',
      },
      500
    );
  }
});

export { playlists };
