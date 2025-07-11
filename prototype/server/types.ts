import { z } from 'zod';
import semver from 'semver';

// Minimum DP-1 protocol version supported by this server
export const MIN_DP_VERSION = '0.9.0';

/**
 * Validates that a dpVersion is valid semver and greater than or equal to MIN_DP_VERSION
 */
export function validateDpVersion(dpVersion: string): {
  isValid: boolean;
  error?: string;
} {
  // First check if it's valid semver
  if (!semver.valid(dpVersion)) {
    return {
      isValid: false,
      error: `Invalid semantic version format: ${dpVersion}`,
    };
  }

  // Check if it meets minimum version requirement
  if (semver.lt(dpVersion, MIN_DP_VERSION)) {
    return {
      isValid: false,
      error: `dpVersion ${dpVersion} is below minimum required version ${MIN_DP_VERSION}`,
    };
  }

  return { isValid: true };
}

/**
 * Validates that update request doesn't contain protected fields
 */
export function validateNoProtectedFields(
  body: any,
  operation: 'playlist' | 'playlistGroup'
): { isValid: boolean; protectedFields?: string[] } {
  const protectedPlaylistFields = ['dpVersion', 'id', 'slug', 'created', 'signature'];
  const protectedGroupFields = ['id', 'slug', 'created'];

  const protectedFields = operation === 'playlist' ? protectedPlaylistFields : protectedGroupFields;
  const foundProtectedFields = protectedFields.filter(field => field in body);

  if (foundProtectedFields.length > 0) {
    return {
      isValid: false,
      protectedFields: foundProtectedFields,
    };
  }

  return { isValid: true };
}

export interface Env {
  API_SECRET: string;
  ED25519_PRIVATE_KEY: string; // Required for playlist signing

  // Cloudflare KV bindings for serverless storage
  DP1_PLAYLISTS: KVNamespace;
  DP1_PLAYLIST_GROUPS: KVNamespace;
  DP1_PLAYLIST_ITEMS: KVNamespace;

  // Optional environment variables
  ENVIRONMENT?: string;
  SELF_HOSTED_DOMAINS?: string; // Comma-separated list of domains this worker is deployed to
}

// Zod Schemas for Request Validation

// Display Preferences Schema
const DisplayPrefsSchema = z
  .object({
    scaling: z.enum(['fit', 'fill', 'stretch', 'auto']).optional(),
    margin: z
      .union([z.number().min(0), z.string().regex(/^[0-9]+(\.[0-9]+)?(px|%|vw|vh)$/)])
      .optional(),
    background: z
      .string()
      .regex(/^(#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})|transparent)$/)
      .optional(),
    autoplay: z.boolean().optional(),
    loop: z.boolean().optional(),
    interaction: z
      .object({
        keyboard: z.array(z.string()).optional(),
        mouse: z
          .object({
            click: z.boolean().optional(),
            scroll: z.boolean().optional(),
            drag: z.boolean().optional(),
            hover: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .optional();

// Reproduction Schema
const ReproSchema = z
  .object({
    engineVersion: z.record(z.string()),
    seed: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .max(130)
      .optional(),
    assetsSHA256: z
      .array(
        z
          .string()
          .regex(/^[a-fA-F0-9]+$/)
          .max(64)
      )
      .max(1024),
    frameHash: z.object({
      sha256: z
        .string()
        .regex(/^[a-fA-F0-9]+$/)
        .max(64),
      phash: z
        .string()
        .regex(/^0x[a-fA-F0-9]+$/)
        .max(32)
        .optional(),
    }),
  })
  .optional();

// Provenance Schema
const ProvenanceSchema = z
  .object({
    type: z.enum(['onChain', 'seriesRegistry', 'offChainURI']),
    contract: z
      .object({
        chain: z.enum(['evm', 'tezos', 'bitmark', 'other']),
        standard: z.enum(['erc721', 'erc1155', 'fa2', 'other']).optional(),
        address: z.string().max(48).optional(),
        seriesId: z.union([z.number().min(0).max(4294967295), z.string().max(128)]).optional(),
        tokenId: z.string().max(128).optional(),
        uri: z
          .string()
          .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
          .max(1024)
          .optional(),
        metaHash: z
          .string()
          .regex(/^[a-fA-F0-9]+$/)
          .max(64)
          .optional(),
      })
      .optional(),
    dependencies: z
      .array(
        z.object({
          chain: z.enum(['evm', 'tezos', 'bitmark', 'other']),
          standard: z.enum(['erc721', 'erc1155', 'fa2', 'other']).optional(),
          uri: z
            .string()
            .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
            .max(1024),
        })
      )
      .max(1024)
      .optional(),
  })
  .optional();

// Playlist Item Schema
const PlaylistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(256).optional(),
  source: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024),
  duration: z.number().min(1),
  license: z.enum(['open', 'token', 'subscription']),
  ref: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024)
    .optional(),
  override: z.record(z.any()).optional(),
  display: DisplayPrefsSchema,
  repro: ReproSchema,
  provenance: ProvenanceSchema,
});

// Base schemas without IDs for input validation
export const PlaylistItemInputSchema = z.object({
  title: z.string().max(256).optional(),
  source: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024),
  duration: z.number().min(1),
  license: z.enum(['open', 'token', 'subscription']),
  ref: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024)
    .optional(),
  override: z.record(z.any()).optional(),
  display: DisplayPrefsSchema,
  repro: ReproSchema,
  provenance: ProvenanceSchema,
});

export const PlaylistInputSchema = z.object({
  dpVersion: z
    .string()
    .max(16)
    .refine(
      version => {
        const validation = validateDpVersion(version);
        return validation.isValid;
      },
      version => {
        const validation = validateDpVersion(version);
        return {
          message: validation.error || 'Invalid dpVersion',
        };
      }
    ),
  defaults: z
    .object({
      display: DisplayPrefsSchema,
      license: z.enum(['open', 'token', 'subscription']).optional(),
      duration: z.number().min(1).optional(),
    })
    .optional(),
  title: z.string().max(256),
  items: z.array(PlaylistItemInputSchema).min(1).max(1024),
});

export const PlaylistGroupInputSchema = z.object({
  title: z.string().max(256),
  curator: z.string().max(128),
  summary: z.string().max(4096).optional(),
  playlists: z
    .array(
      z
        .string()
        .regex(/^http[s]?:\/\/[^\s]+$/)
        .max(1024)
    )
    .min(1)
    .max(1024),
  coverImage: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024)
    .optional(),
});

// Update schemas that exclude protected fields
export const PlaylistUpdateSchema = z.object({
  defaults: z
    .object({
      display: DisplayPrefsSchema,
      license: z.enum(['open', 'token', 'subscription']).optional(),
      duration: z.number().min(1).optional(),
    })
    .optional(),
  items: z.array(PlaylistItemInputSchema).min(1).max(1024),
  title: z.string().max(256).optional(),
});

export const PlaylistGroupUpdateSchema = z.object({
  title: z.string().max(256).optional(),
  curator: z.string().max(128).optional(),
  summary: z.string().max(4096).optional(),
  playlists: z
    .array(
      z
        .string()
        .regex(/^http[s]?:\/\/[^\s]+$/)
        .max(1024)
    )
    .min(1)
    .max(1024),
  coverImage: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024)
    .optional(),
});

// Complete schemas with server-generated fields for output
export const PlaylistSchema = z.object({
  dpVersion: z
    .string()
    .max(16)
    .refine(
      version => {
        const validation = validateDpVersion(version);
        return validation.isValid;
      },
      version => {
        const validation = validateDpVersion(version);
        return {
          message: validation.error || 'Invalid dpVersion',
        };
      }
    ),
  id: z.string().uuid(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .max(64),
  title: z.string().max(256),
  created: z.string().datetime(),
  defaults: z
    .object({
      display: DisplayPrefsSchema,
      license: z.enum(['open', 'token', 'subscription']).optional(),
      duration: z.number().min(1).optional(),
    })
    .optional(),
  items: z.array(PlaylistItemSchema).min(1).max(1024),
  signature: z
    .string()
    .regex(/^ed25519:0x[a-fA-F0-9]+$/)
    .max(150),
});

export const PlaylistGroupSchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .max(64),
  title: z.string().max(256),
  curator: z.string().max(128),
  summary: z.string().max(4096).optional(),
  playlists: z
    .array(
      z
        .string()
        .regex(/^https:\/\/[^\s]+$/)
        .max(1024)
    )
    .min(1)
    .max(1024),
  created: z.string().datetime(),
  coverImage: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024)
    .optional(),
});

// DP-1 Core Types based on specification and OpenAPI schema

export interface DisplayPrefs {
  scaling?: 'fit' | 'fill' | 'stretch' | 'auto';
  margin?: number | string;
  background?: string;
  autoplay?: boolean;
  loop?: boolean;
  interaction?: {
    keyboard?: string[];
    mouse?: {
      click?: boolean;
      scroll?: boolean;
      drag?: boolean;
      hover?: boolean;
    };
  };
}

export interface Repro {
  engineVersion: Record<string, string>;
  seed?: string;
  assetsSHA256: string[];
  frameHash: {
    sha256: string;
    phash?: string;
  };
}

export interface Provenance {
  type: 'onChain' | 'seriesRegistry' | 'offChainURI';
  contract?: {
    chain: 'evm' | 'tezos' | 'bitmark' | 'other';
    standard?: 'erc721' | 'erc1155' | 'fa2' | 'other';
    address?: string;
    seriesId?: number | string;
    tokenId?: string;
    uri?: string;
    metaHash?: string;
  };
  dependencies?: Array<{
    chain: 'evm' | 'tezos' | 'bitmark' | 'other';
    standard?: 'erc721' | 'erc1155' | 'fa2' | 'other';
    uri: string;
  }>;
}

export interface PlaylistItem {
  id: string;
  title?: string;
  source: string;
  duration: number;
  license: 'open' | 'token' | 'subscription';
  ref?: string;
  override?: Record<string, any>;
  display?: DisplayPrefs;
  repro?: Repro;
  provenance?: Provenance;
}

export interface Playlist {
  dpVersion: string;
  id: string;
  slug: string;
  title: string;
  created?: string;
  defaults?: {
    display?: DisplayPrefs;
    license?: 'open' | 'token' | 'subscription';
    duration?: number;
  };
  items: PlaylistItem[];
  signature?: string;
}

export interface PlaylistGroup {
  id: string;
  slug: string;
  title: string;
  curator: string;
  summary?: string;
  playlists: string[];
  created?: string;
  coverImage?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

// Crypto types for ed25519 signing
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

// Inferred types from Zod schemas
export type PlaylistInput = z.infer<typeof PlaylistInputSchema>;
export type PlaylistItemInput = z.infer<typeof PlaylistItemInputSchema>;
export type PlaylistGroupInput = z.infer<typeof PlaylistGroupInputSchema>;
export type PlaylistUpdate = z.infer<typeof PlaylistUpdateSchema>;
export type PlaylistGroupUpdate = z.infer<typeof PlaylistGroupUpdateSchema>;

// Utility function to generate slug from title
export function generateSlug(title: string): string {
  // Convert to lowercase, replace spaces and special chars with hyphens
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Add random 4-digit number to ensure uniqueness
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);

  // Ensure the slug doesn't exceed max length (64 chars)
  const maxBaseLength = 64 - 5; // Reserve 5 chars for "-1234"
  const trimmedBase =
    baseSlug.length > maxBaseLength ? baseSlug.substring(0, maxBaseLength) : baseSlug;

  return `${trimmedBase}-${randomSuffix}`;
}

// Utility function to transform input to complete playlist with server-generated fields
export function createPlaylistFromInput(input: PlaylistInput): Playlist {
  const playlistId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Generate IDs for all playlist items and determine slug source
  const itemsWithIds = input.items.map(item => ({
    ...item,
    id: crypto.randomUUID(),
  }));

  // Generate slug from first item title or playlist ID
  const slug = generateSlug(input.title || playlistId);

  return {
    dpVersion: input.dpVersion,
    id: playlistId,
    slug,
    title: input.title,
    created: timestamp,
    defaults: input.defaults,
    items: itemsWithIds,
  };
}

// Utility function to transform input to complete playlist group with server-generated fields
export function createPlaylistGroupFromInput(input: PlaylistGroupInput): PlaylistGroup {
  const groupId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const slug = generateSlug(input.title);

  return {
    id: groupId,
    slug,
    title: input.title,
    curator: input.curator,
    summary: input.summary,
    playlists: input.playlists,
    created: timestamp,
    coverImage: input.coverImage,
  };
}
