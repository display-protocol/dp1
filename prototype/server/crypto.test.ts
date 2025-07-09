import { describe, it, expect } from 'vitest';
import { createCanonicalForm } from './crypto';
import type { Playlist, PlaylistItem } from './types';

describe('Crypto Functions', () => {
  describe('createCanonicalForm', () => {
    const basePlaylist: Omit<Playlist, 'signature'> = {
      dpVersion: '1.0.0',
      id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
      slug: 'test-playlist',
      title: 'Test Playlist',
      created: '2025-06-03T17:01:00Z',
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Test Artwork',
          source: 'https://example.com/artwork.html',
          duration: 300,
          license: 'open' as const,
        },
      ],
    };

    it('should produce deterministic output', () => {
      const canonical1 = createCanonicalForm(basePlaylist);
      const canonical2 = createCanonicalForm(basePlaylist);

      expect(canonical1).toBe(canonical2);
    });

    it('should produce the same output regardless of property order', () => {
      const playlist1: Omit<Playlist, 'signature'> = {
        dpVersion: basePlaylist.dpVersion,
        id: basePlaylist.id,
        slug: basePlaylist.slug,
        title: basePlaylist.title,
        created: basePlaylist.created,
        items: basePlaylist.items,
      };

      const playlist2: Omit<Playlist, 'signature'> = {
        items: basePlaylist.items,
        created: basePlaylist.created,
        id: basePlaylist.id,
        slug: basePlaylist.slug,
        title: basePlaylist.title,
        dpVersion: basePlaylist.dpVersion,
      };

      const canonical1 = createCanonicalForm(playlist1);
      const canonical2 = createCanonicalForm(playlist2);

      expect(canonical1).toBe(canonical2);
    });

    it('should produce valid JSON that can be parsed', () => {
      const canonical = createCanonicalForm(basePlaylist);

      // Should be valid JSON
      expect(() => JSON.parse(canonical)).not.toThrow();

      // Should contain all expected data
      const parsed = JSON.parse(canonical);
      expect(parsed.dpVersion).toBe(basePlaylist.dpVersion);
      expect(parsed.id).toBe(basePlaylist.id);
      expect(parsed.title).toBe(basePlaylist.title);
      expect(parsed.items).toHaveLength(1);
    });

    it('should handle complex playlist structures', () => {
      const complexPlaylist: Omit<Playlist, 'signature'> = {
        dpVersion: '1.0.0',
        id: 'test-id',
        slug: 'complex-test',
        title: 'Complex Test',
        created: '2025-01-01T00:00:00Z',
        defaults: {
          duration: 300,
          license: 'open' as const,
          display: {
            scaling: 'fit' as const,
            background: '#000000',
            margin: '5%',
          },
        },
        items: [
          {
            id: 'item-1',
            title: 'First Item',
            source: 'https://example.com/1',
            duration: 200,
            license: 'token' as const,
            display: {
              scaling: 'fill' as const,
              margin: 10,
            },
            repro: {
              engineVersion: { chromium: '123.0.6312.58' },
              seed: '0x123456789abcdef',
              assetsSHA256: ['hash1', 'hash2'],
              frameHash: {
                sha256: 'bf20f9a1b2c3d4e5f6789abcdef01234567890abcdef01234567890abcdef0123',
                phash: '0xaf39bc45',
              },
            },
            provenance: {
              type: 'onChain' as const,
              contract: {
                chain: 'evm' as const,
                standard: 'erc721' as const,
                address: '0x1234567890abcdef',
                tokenId: '42',
              },
            },
          },
          {
            id: 'item-2',
            title: 'Second Item',
            source: 'https://example.com/2',
            duration: 400,
            license: 'subscription' as const,
          },
        ],
      };

      const canonical = createCanonicalForm(complexPlaylist);

      // Should be valid JSON
      expect(() => JSON.parse(canonical)).not.toThrow();

      // Should be deterministic
      const canonical2 = createCanonicalForm(complexPlaylist);
      expect(canonical).toBe(canonical2);
    });

    it('should throw error for invalid input', () => {
      // Test with circular reference
      const circular: any = { a: 1 };
      circular.self = circular;

      expect(() => createCanonicalForm(circular)).toThrow();
    });

    it('should handle edge cases in data types', () => {
      const edgeCasePlaylist: Omit<Playlist, 'signature'> = {
        dpVersion: '1.0.0',
        id: 'edge-case-test',
        slug: 'edge-cases',
        title: 'Edge Cases Test',
        created: '2025-01-01T00:00:00Z',
        items: [
          {
            id: 'edge-item',
            title: 'Edge Case Item',
            source: 'https://example.com/edge',
            duration: 0, // zero duration
            license: 'open' as const,
            // Test special characters
            display: {
              background: 'transparent',
              margin: '0%',
            },
          },
        ],
      };

      const canonical = createCanonicalForm(edgeCasePlaylist);

      // Should be valid JSON
      expect(() => JSON.parse(canonical)).not.toThrow();

      const parsed = JSON.parse(canonical);
      expect(parsed.items[0].duration).toBe(0);
    });
  });
});
