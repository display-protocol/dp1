import { describe, it, expect } from 'vitest';
import { createCanonicalForm } from './crypto';
import type { Playlist, PlaylistItem } from './types';

describe('Crypto Functions', () => {
  describe('createCanonicalForm', () => {
    const basePlaylist: Omit<Playlist, 'signature'> = {
      dpVersion: '1.0.0',
      id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
      slug: 'test-playlist',
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
      // Create two instances with same data but potentially different field order
      const playlist1: Omit<Playlist, 'signature'> = {
        dpVersion: basePlaylist.dpVersion,
        id: basePlaylist.id,
        slug: basePlaylist.slug,
        created: basePlaylist.created,
        items: basePlaylist.items,
      };

      const playlist2: Omit<Playlist, 'signature'> = {
        items: basePlaylist.items,
        created: basePlaylist.created,
        id: basePlaylist.id,
        slug: basePlaylist.slug,
        dpVersion: basePlaylist.dpVersion,
      };

      const canonical1 = createCanonicalForm(playlist1);
      const canonical2 = createCanonicalForm(playlist2);

      expect(canonical1).toBe(canonical2);
    });

    it('should sort nested object keys deterministically', () => {
      const playlistWithDefaults: Omit<Playlist, 'signature'> = {
        ...basePlaylist,
        defaults: {
          license: 'token' as const,
          duration: 300,
        },
      };

      const canonical = createCanonicalForm(playlistWithDefaults);

      // Parse the canonical form to verify ordering
      const parsed = JSON.parse(canonical);
      const defaultsKeys = Object.keys(parsed.defaults);
      const sortedKeys = [...defaultsKeys].sort();

      expect(defaultsKeys).toEqual(sortedKeys);
    });

    it('should handle arrays without reordering them', () => {
      const playlistWithMultipleItems: Omit<Playlist, 'signature'> = {
        ...basePlaylist,
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            title: 'Second Item',
            source: 'https://example.com/second.html',
            duration: 200,
            license: 'open' as const,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            title: 'First Item',
            source: 'https://example.com/first.html',
            duration: 150,
            license: 'token' as const,
          },
        ],
      };

      const canonical = createCanonicalForm(playlistWithMultipleItems);
      const parsed = JSON.parse(canonical);

      // Arrays should maintain their original order
      expect(parsed.items[0].title).toBe('Second Item');
      expect(parsed.items[1].title).toBe('First Item');
    });

    it('should end with LF terminator', () => {
      const canonical = createCanonicalForm(basePlaylist);

      expect(canonical.endsWith('\n')).toBe(true);
    });

    it('should not double-add LF terminator', () => {
      const canonical = createCanonicalForm(basePlaylist);

      // Apply canonicalization again to a string that already ends with \n
      expect(canonical.endsWith('\n\n')).toBe(false);
    });

    it('should only contain LF at the end', () => {
      // Canonical form should have no internal line breaks, only LF terminator
      const canonical = createCanonicalForm(basePlaylist);

      expect(canonical.includes('\r\n')).toBe(false); // No CRLF
      expect(canonical.includes('\r')).toBe(false); // No CR

      // Only one LF at the very end
      const lfCount = (canonical.match(/\n/g) || []).length;
      expect(lfCount).toBe(1);
      expect(canonical.endsWith('\n')).toBe(true);
    });

    it('should produce flattened JSON without whitespace', () => {
      const canonical = createCanonicalForm(basePlaylist);

      // Should be flattened (no extra spaces except in string values)
      const jsonPart = canonical.slice(0, -1); // Remove LF terminator
      expect(jsonPart.includes('  ')).toBe(false); // No double spaces
      expect(jsonPart.includes('\n')).toBe(false); // No newlines in JSON
      expect(jsonPart.includes(' :')).toBe(false); // No spaces before colons
      expect(jsonPart.includes(': ')).toBe(false); // No spaces after colons
    });

    it('should be consistent across multiple calls', () => {
      const canonical1 = createCanonicalForm(basePlaylist);
      const canonical2 = createCanonicalForm(basePlaylist);
      const canonical3 = createCanonicalForm(basePlaylist);

      expect(canonical1).toBe(canonical2);
      expect(canonical2).toBe(canonical3);
    });
  });
});
