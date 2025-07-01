import { Hono, Context } from 'hono';
import { z } from 'zod';
import type { Env, PlaylistGroupInput, PlaylistGroup } from '../types';
import { PlaylistGroupInputSchema, generateSlug, createPlaylistGroupFromInput } from '../types';
import { listAllPlaylistGroups, savePlaylistGroup, getPlaylistGroupByIdOrSlug } from '../fileUtils';

// Create playlist groups router
const playlistGroups = new Hono<{ Bindings: Env }>();

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
async function validatePlaylistGroupBody(
  c: Context
): Promise<PlaylistGroupInput | { error: string; message: string; status: number }> {
  try {
    const body = await c.req.json();
    const result = PlaylistGroupInputSchema.parse(body);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return {
        error: 'validation_error',
        message: `Invalid playlist group data: ${errorMessage}`,
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
 * GET /playlist-groups - List all playlist groups
 */
playlistGroups.get('/', async c => {
  try {
    const allGroups = await listAllPlaylistGroups(c.env);
    return c.json(allGroups);
  } catch (error) {
    console.error('Error retrieving playlist groups:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to retrieve playlist groups',
      },
      500
    );
  }
});

/**
 * GET /playlist-groups/:id - Get specific playlist group by UUID or slug
 */
playlistGroups.get('/:id', async c => {
  try {
    const groupId = c.req.param('id');

    // Validate ID format (UUID or slug)
    const validation = validateIdentifier(groupId);

    if (!groupId || !validation.isValid) {
      return c.json(
        {
          error: 'invalid_id',
          message: 'Playlist group ID must be a valid UUID or slug (alphanumeric with hyphens)',
        },
        400
      );
    }

    const group = await getPlaylistGroupByIdOrSlug(groupId, c.env);

    if (!group) {
      return c.json(
        {
          error: 'not_found',
          message: 'Playlist group not found',
        },
        404
      );
    }

    return c.json(group);
  } catch (error) {
    console.error('Error retrieving playlist group:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to retrieve playlist group',
      },
      500
    );
  }
});

/**
 * POST /playlist-groups - Create new playlist group
 */
playlistGroups.post('/', async c => {
  try {
    const validatedData = await validatePlaylistGroupBody(c);

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

    // Create playlist group with server-generated ID, timestamp, and slug
    const playlistGroup = createPlaylistGroupFromInput(validatedData);

    // Save playlist group
    const saved = await savePlaylistGroup(playlistGroup, c.env);
    if (!saved) {
      return c.json(
        {
          error: 'save_error',
          message: 'Failed to save playlist group',
        },
        500
      );
    }

    return c.json(playlistGroup, 201);
  } catch (error) {
    console.error('Error creating playlist group:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to create playlist group',
      },
      500
    );
  }
});

/**
 * PUT /playlist-groups/:id - Update existing playlist group by UUID or slug
 */
playlistGroups.put('/:id', async c => {
  try {
    const groupId = c.req.param('id');

    // Validate ID format (UUID or slug)
    const validation = validateIdentifier(groupId);

    if (!groupId || !validation.isValid) {
      return c.json(
        {
          error: 'invalid_id',
          message: 'Playlist group ID must be a valid UUID or slug (alphanumeric with hyphens)',
        },
        400
      );
    }

    const validatedData = await validatePlaylistGroupBody(c);

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

    // Check if playlist group exists first
    const existingGroup = await getPlaylistGroupByIdOrSlug(groupId, c.env);
    if (!existingGroup) {
      return c.json(
        {
          error: 'not_found',
          message: 'Playlist group not found',
        },
        404
      );
    }

    // Create updated playlist group keeping original ID and created timestamp
    const updatedGroup: PlaylistGroup = {
      id: existingGroup.id, // Keep original server-generated ID
      slug: generateSlug(validatedData.title),
      title: validatedData.title,
      curator: validatedData.curator,
      summary: validatedData.summary,
      playlists: validatedData.playlists,
      created: existingGroup.created,
      coverImage: validatedData.coverImage,
    };

    // Save updated playlist group
    const saved = await savePlaylistGroup(updatedGroup, c.env);
    if (!saved) {
      return c.json(
        {
          error: 'save_error',
          message: 'Failed to update playlist group',
        },
        500
      );
    }

    return c.json(updatedGroup, 200);
  } catch (error) {
    console.error('Error updating playlist group:', error);
    return c.json(
      {
        error: 'internal_error',
        message: 'Failed to update playlist group',
      },
      500
    );
  }
});

export { playlistGroups };
