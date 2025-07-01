import { Hono, Context } from 'hono';
import { z } from 'zod';
import type { Env, PlaylistInput } from '../types';
import { PlaylistSchema, generateSlug } from '../types';
import { signPlaylist, getServerKeyPair } from '../crypto';
import {
  listAllPlaylists,
  savePlaylist,
  getPlaylistByIdOrSlug,
  playlistExists,
} from '../fileUtils';

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
 * Validate request body against Zod schema
 */
async function validatePlaylistBody(
  c: Context
): Promise<PlaylistInput | { error: string; message: string; status: number }> {
  try {
    const body = await c.req.json();
    const result = PlaylistSchema.parse(body);
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
 * GET /playlists - List all playlists
 */
playlists.get('/', async c => {
  try {
    const allPlaylists = await listAllPlaylists(c.env);
    return c.json(allPlaylists);
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
 * POST /playlists - Create new playlist
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

    // Check if playlist already exists
    if (await playlistExists(validatedData.id, c.env)) {
      return c.json(
        {
          error: 'conflict',
          message: 'Playlist with this ID already exists',
        },
        409
      );
    }

    // Generate slug from title (fallback to ID if no title)
    const title = validatedData.items.find(item => item.title)?.title || validatedData.id;
    const slug = generateSlug(title);

    // Create playlist with server timestamp, generated slug, and signature
    const playlist = {
      ...validatedData,
      slug,
      created: new Date().toISOString(),
    };

    // Sign the playlist using ed25519 as per DP-1 specification
    const keyPair = await getServerKeyPair(c.env);
    const playlistWithoutSignature = { ...playlist };
    delete playlistWithoutSignature.signature;

    playlist.signature = await signPlaylist(playlistWithoutSignature, keyPair.privateKey);

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

    // Ensure the ID in the request body matches the found playlist's UUID
    if (validatedData.id !== existingPlaylist.id) {
      return c.json(
        {
          error: 'id_mismatch',
          message: 'Playlist ID in request body must match the actual playlist UUID',
        },
        400
      );
    }

    // Create updated playlist keeping original created timestamp
    const updatedPlaylist = {
      ...validatedData,
      slug: generateSlug(validatedData.items.find(item => item.title)?.title || validatedData.id),
      created: existingPlaylist.created || new Date().toISOString(),
    };

    // Re-sign the playlist
    const keyPair = await getServerKeyPair(c.env);
    const playlistWithoutSignature = { ...updatedPlaylist };
    delete playlistWithoutSignature.signature;

    updatedPlaylist.signature = await signPlaylist(playlistWithoutSignature, keyPair.privateKey);

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
