import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './index';
import type { Env } from './types';
import { generateSlug, validateDpVersion, MIN_DP_VERSION } from './types';

// Mock the crypto module to avoid ED25519 key issues in tests
vi.mock('./crypto', () => ({
  signPlaylist: vi.fn().mockResolvedValue('ed25519:0x1234567890abcdef'),
  getServerKeyPair: vi.fn().mockResolvedValue({
    publicKey: new Uint8Array(32),
    privateKey: new Uint8Array(32),
  }),
  createCanonicalForm: vi.fn((playlist: any) => JSON.stringify(playlist) + '\n'),
}));

// Mock KV implementation for testing
const createMockKV = () => {
  const storage = new Map<string, string>();

  return {
    storage, // Expose storage for clearing in tests
    get: async (key: string) => storage.get(key) || null,
    put: async (key: string, value: string) => {
      storage.set(key, value);
    },
    delete: async (key: string) => {
      storage.delete(key);
    },
    list: async (options?: { prefix?: string }) => {
      const keys = Array.from(storage.keys())
        .filter(key => !options?.prefix || key.startsWith(options.prefix))
        .map(name => ({ name }));
      return { keys };
    },
  };
};

// Test environment setup
const testEnv: Env = {
  API_SECRET: 'test-secret-key',
  ED25519_PRIVATE_KEY: 'test-private-key',
  ENVIRONMENT: 'test',
  DP1_PLAYLISTS: createMockKV() as any,
  DP1_PLAYLIST_GROUPS: createMockKV() as any,
};

// Test data with proper UUIDs
const testPlaylistUUID = '385f79b6-a45f-4c1c-8080-e93a192adccc';
const testPlaylistItemUUID = '550e8400-e29b-41d4-a716-446655440000';
const testPlaylistGroupUUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const validPlaylist = {
  dpVersion: '1.0.0',
  items: [
    {
      title: 'Test Artwork',
      source: 'https://example.com/artwork.html',
      duration: 300,
      license: 'open' as const,
    },
  ],
};

const validPlaylistGroup = {
  title: 'Test Exhibition',
  curator: 'Test Curator',
  playlists: ['https://example.com/playlist'],
};

describe('DP-1 Feed Operator API', () => {
  beforeEach(() => {
    // Clear storage between tests
    const mockPlaylistKV = testEnv.DP1_PLAYLISTS as any;
    const mockGroupKV = testEnv.DP1_PLAYLIST_GROUPS as any;

    mockPlaylistKV.storage.clear();
    mockGroupKV.storage.clear();
  });

  describe('Health and Info Endpoints', () => {
    it('GET /health returns healthy status', async () => {
      const req = new Request('http://localhost/health');
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.version).toBe('0.9.0');
    });

    it('GET / returns API information', async () => {
      const req = new Request('http://localhost/');
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('DP-1 Feed Operator API');
      expect(data.version).toBe('0.9.0');
      expect(data.specification).toBe('DP-1 v0.9-alpha');
    });
  });

  describe('Slug Generation', () => {
    it('should generate valid slugs from titles', () => {
      const testCases = [
        { title: 'My Amazing Art Collection', expected: /^my-amazing-art-collection-\d{4}$/ },
        { title: 'Generative Art 2024!', expected: /^generative-art-2024-\d{4}$/ },
        { title: 'Test@#$%^&*()Playlist', expected: /^test-playlist-\d{4}$/ },
        { title: '   Leading/Trailing Spaces   ', expected: /^leading-trailing-spaces-\d{4}$/ },
      ];

      testCases.forEach(({ title, expected }) => {
        const slug = generateSlug(title);
        expect(slug).toMatch(expected);
        expect(slug.length).toBeLessThanOrEqual(64);
      });
    });

    it('should handle very long titles by truncating', () => {
      const longTitle = 'A'.repeat(100);
      const slug = generateSlug(longTitle);
      expect(slug.length).toBeLessThanOrEqual(64);
      expect(slug).toMatch(/^a+-\d{4}$/);
    });

    it('should generate unique slugs for identical titles', () => {
      const title = 'Identical Title';
      const slug1 = generateSlug(title);
      const slug2 = generateSlug(title);
      expect(slug1).not.toBe(slug2);
      expect(slug1).toMatch(/^identical-title-\d{4}$/);
      expect(slug2).toMatch(/^identical-title-\d{4}$/);
    });
  });

  describe('dpVersion Validation', () => {
    it(`should validate minimum version requirement (${MIN_DP_VERSION})`, () => {
      // Valid versions (>= MIN_DP_VERSION)
      const validVersions = ['0.9.0', '0.9.1', '1.0.0', '1.2.3', '2.0.0'];

      validVersions.forEach(version => {
        const result = validateDpVersion(version);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      // Invalid versions (< MIN_DP_VERSION)
      const invalidVersions = ['0.8.9', '0.8.0', '0.1.0'];

      invalidVersions.forEach(version => {
        const result = validateDpVersion(version);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain(`below minimum required version ${MIN_DP_VERSION}`);
      });
    });

    it('should validate semantic version format', () => {
      // Invalid semver formats (what semver library actually considers invalid)
      const invalidFormats = ['invalid', '1.0', '', 'not-a-version', '1.0.x', 'x.y.z'];

      invalidFormats.forEach(version => {
        const result = validateDpVersion(version);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid semantic version format');
      });
    });

    it('should accept valid semantic versions', () => {
      // Test versions that pass both format and minimum version requirements
      const validVersions = ['1.0.0', '0.9.0', '10.20.30'];

      validVersions.forEach(version => {
        const result = validateDpVersion(version);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('Protected Fields Validation', () => {
    const validAuth = {
      Authorization: 'Bearer test-secret-key',
      'Content-Type': 'application/json',
    };

    it('should reject playlist updates with protected fields', async () => {
      const invalidUpdateData = {
        dpVersion: '2.0.0', // Protected field
        id: 'custom-id', // Protected field
        slug: 'custom-slug', // Protected field
        items: [
          {
            title: 'Test Artwork',
            source: 'https://example.com/artwork.html',
            duration: 300,
            license: 'open' as const,
          },
        ],
      };

      const req = new Request('http://localhost/playlists/test-id', {
        method: 'PUT',
        headers: validAuth,
        body: JSON.stringify(invalidUpdateData),
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('protected_fields');
      expect(data.message).toContain('dpVersion, id, slug');
    });

    it('should reject playlist group updates with protected fields', async () => {
      const invalidUpdateData = {
        id: 'custom-id', // Protected field
        slug: 'custom-slug', // Protected field
        title: 'Updated Exhibition',
        curator: 'Test Curator',
        playlists: ['https://example.com/playlist'],
      };

      const req = new Request('http://localhost/playlist-groups/test-id', {
        method: 'PUT',
        headers: validAuth,
        body: JSON.stringify(invalidUpdateData),
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('protected_fields');
      expect(data.message).toContain('id, slug');
    });

    it('should allow valid playlist updates without protected fields', async () => {
      // First create a playlist
      const createReq = new Request('http://localhost/playlists', {
        method: 'POST',
        headers: validAuth,
        body: JSON.stringify(validPlaylist),
      });
      const createResponse = await app.fetch(createReq, testEnv);
      expect(createResponse.status).toBe(201);
      const createdPlaylist = await createResponse.json();

      // Then update it with valid data
      const validUpdateData = {
        defaults: { license: 'token' as const },
        items: [
          {
            title: 'Updated Artwork',
            source: 'https://example.com/updated-artwork.html',
            duration: 400,
            license: 'subscription' as const,
          },
        ],
      };

      const updateReq = new Request(`http://localhost/playlists/${createdPlaylist.id}`, {
        method: 'PUT',
        headers: validAuth,
        body: JSON.stringify(validUpdateData),
      });
      const updateResponse = await app.fetch(updateReq, testEnv);
      expect(updateResponse.status).toBe(200);

      const updatedData = await updateResponse.json();
      expect(updatedData.id).toBe(createdPlaylist.id); // Should preserve ID
      expect(updatedData.slug).toBe(createdPlaylist.slug); // Should preserve slug
      expect(updatedData.dpVersion).toBe(createdPlaylist.dpVersion); // Should preserve dpVersion
      expect(updatedData.items[0].title).toBe('Updated Artwork');
    });
  });

  describe('Authentication', () => {
    it('should reject POST requests without Authorization header', async () => {
      const req = new Request('http://localhost/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('unauthorized');
    });

    it('should reject POST requests with invalid Bearer token', async () => {
      const req = new Request('http://localhost/playlists', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('unauthorized');
    });

    it('should allow GET requests without authentication', async () => {
      const req = new Request('http://localhost/playlists');
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(200);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      const req = new Request('http://localhost/health');
      const response = await app.fetch(req, testEnv);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, OPTIONS'
      );
    });

    it('should handle OPTIONS preflight requests', async () => {
      const req = new Request('http://localhost/playlists', {
        method: 'OPTIONS',
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(204);
    });
  });

  describe('UUID/Slug Validation', () => {
    const validAuth = {
      Authorization: 'Bearer test-secret-key',
      'Content-Type': 'application/json',
    };

    it('should accept valid UUIDs in playlist endpoints', async () => {
      const req = new Request(`http://localhost/playlists/${testPlaylistUUID}`, {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(404); // Not found is OK, means UUID was validated
    });

    it('should accept valid slugs in playlist endpoints', async () => {
      const req = new Request('http://localhost/playlists/test-playlist-1234', {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(404); // Not found is OK, means slug was validated
    });

    it('should reject invalid identifiers in playlist endpoints', async () => {
      const invalidIds = ['invalid_id_with_underscores', 'invalid@email.com'];

      for (const invalidId of invalidIds) {
        const req = new Request(`http://localhost/playlists/${invalidId}`, {
          headers: validAuth,
        });
        const response = await app.fetch(req, testEnv);
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBe('invalid_id');
      }
    });

    it('should accept valid UUIDs in playlist group endpoints', async () => {
      const req = new Request(`http://localhost/playlist-groups/${testPlaylistGroupUUID}`, {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(404); // Not found is OK, means UUID was validated
    });

    it('should accept valid slugs in playlist group endpoints', async () => {
      const req = new Request('http://localhost/playlist-groups/test-exhibition-5678', {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(404); // Not found is OK, means slug was validated
    });
  });

  describe('Playlists API', () => {
    const validAuth = {
      Authorization: 'Bearer test-secret-key',
      'Content-Type': 'application/json',
    };

    it('GET /playlists returns empty array initially', async () => {
      const req = new Request('http://localhost/playlists', {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /playlists/:id returns 404 for non-existent playlist', async () => {
      const req = new Request(`http://localhost/playlists/${testPlaylistUUID}`, {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('not_found');
    });

    it('POST /playlists with invalid data returns 400', async () => {
      const req = new Request('http://localhost/playlists', {
        method: 'POST',
        headers: validAuth,
        body: JSON.stringify({
          // Missing required fields
        }),
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('validation_error');
    });

    it('POST /playlists should create playlist with server-generated ID and slug', async () => {
      const req = new Request('http://localhost/playlists', {
        method: 'POST',
        headers: validAuth,
        body: JSON.stringify(validPlaylist),
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(data.dpVersion).toBe('1.0.0'); // Server should preserve client's dpVersion
      expect(data.slug).toMatch(/^test-artwork-\d{4}$/);
      expect(data.created).toBeTruthy();
      expect(data.signature).toBeTruthy();
      expect(data.items[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('PUT /playlists/:id should update playlist and preserve protected fields', async () => {
      // First create a playlist
      const createReq = new Request('http://localhost/playlists', {
        method: 'POST',
        headers: validAuth,
        body: JSON.stringify(validPlaylist),
      });
      const createResponse = await app.fetch(createReq, testEnv);
      expect(createResponse.status).toBe(201);

      const createdPlaylist = await createResponse.json();
      const playlistId = createdPlaylist.id;

      // Then update it with new title (only send updateable fields)
      const updatedPlaylist = {
        defaults: { license: 'token' as const },
        items: [
          {
            title: 'Updated Artwork Title',
            source: 'https://example.com/updated-artwork.html',
            duration: 400,
            license: 'subscription' as const,
          },
        ],
      };

      const updateReq = new Request(`http://localhost/playlists/${playlistId}`, {
        method: 'PUT',
        headers: validAuth,
        body: JSON.stringify(updatedPlaylist),
      });
      const updateResponse = await app.fetch(updateReq, testEnv);
      expect(updateResponse.status).toBe(200);

      const data = await updateResponse.json();
      expect(data.id).toBe(playlistId); // ID should remain the same
      expect(data.dpVersion).toBe('1.0.0'); // Server should preserve client's dpVersion
      expect(data.slug).toBe(createdPlaylist.slug);
      expect(data.items[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('Playlist Groups API', () => {
    const validAuth = {
      Authorization: 'Bearer test-secret-key',
      'Content-Type': 'application/json',
    };

    it('GET /playlist-groups returns empty array initially', async () => {
      const req = new Request('http://localhost/playlist-groups', {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /playlist-groups/:id returns 404 for non-existent group', async () => {
      const req = new Request(`http://localhost/playlist-groups/${testPlaylistGroupUUID}`, {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('not_found');
    });

    it('POST /playlist-groups should create group with server-generated ID and slug', async () => {
      const req = new Request('http://localhost/playlist-groups', {
        method: 'POST',
        headers: validAuth,
        body: JSON.stringify(validPlaylistGroup),
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(data.slug).toMatch(/^test-exhibition-\d{4}$/);
      expect(data.created).toBeTruthy();
    });

    it('PUT /playlist-groups/:id should update group and preserve slug', async () => {
      // First create a playlist group
      const createReq = new Request('http://localhost/playlist-groups', {
        method: 'POST',
        headers: validAuth,
        body: JSON.stringify(validPlaylistGroup),
      });
      const createResponse = await app.fetch(createReq, testEnv);
      expect(createResponse.status).toBe(201);

      const createdGroup = await createResponse.json();
      const groupId = createdGroup.id;

      // Then update it with new title
      const updatedGroup = {
        ...validPlaylistGroup,
        title: 'Updated Exhibition Title',
      };

      const updateReq = new Request(`http://localhost/playlist-groups/${groupId}`, {
        method: 'PUT',
        headers: validAuth,
        body: JSON.stringify(updatedGroup),
      });
      const updateResponse = await app.fetch(updateReq, testEnv);
      expect(updateResponse.status).toBe(200);

      const data = await updateResponse.json();
      expect(data.id).toBe(groupId); // ID should remain the same
      expect(data.slug).toBe(createdGroup.slug); // Slug should be preserved, not regenerated
      expect(data.title).toBe('Updated Exhibition Title'); // Title should be updated
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const req = new Request('http://localhost/unknown-route');
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('not_found');
    });

    it('should reject non-JSON content type for POST requests', async () => {
      const req = new Request('http://localhost/playlists', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-secret-key',
          'Content-Type': 'text/plain',
        },
        body: 'not json',
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(500);
    });
  });

  describe('Legacy API Routes', () => {
    const validAuth = {
      Authorization: 'Bearer test-secret-key',
      'Content-Type': 'application/json',
    };

    it('should support legacy /api/v1/playlists route', async () => {
      const req = new Request('http://localhost/api/v1/playlists', {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(200);
    });

    it('should support legacy /api/v1/playlist-groups route', async () => {
      const req = new Request('http://localhost/api/v1/playlist-groups', {
        headers: validAuth,
      });
      const response = await app.fetch(req, testEnv);
      expect(response.status).toBe(200);
    });
  });
});
