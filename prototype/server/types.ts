import { z } from 'zod';

export interface Env {
  API_SECRET: string;
  ED25519_PRIVATE_KEY: string; // Required for playlist signing

  // Cloudflare KV bindings for serverless storage
  DP1_PLAYLISTS: KVNamespace;
  DP1_PLAYLIST_GROUPS: KVNamespace;
  DP1_METADATA: KVNamespace;

  // Optional environment variables
  ENVIRONMENT?: string;
  IPFS_GATEWAY_URL?: string;
  ARWEAVE_GATEWAY_URL?: string;
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
        chain: z.enum(['evm', 'tezos', 'other']),
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
          chain: z.enum(['evm', 'tezos', 'other']),
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

// Playlist Schema
export const PlaylistSchema = z.object({
  dpVersion: z
    .string()
    .regex(/^[0-9]+\.[0-9]+\.[0-9]+$/)
    .max(16),
  id: z.string().uuid(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .max(64)
    .optional(),
  created: z.string().datetime().optional(),
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
    .max(150)
    .optional(),
});

// Playlist Group Schema
export const PlaylistGroupSchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .max(64)
    .optional(),
  title: z.string().max(256),
  curator: z.string().max(128),
  summary: z.string().max(4096).optional(),
  playlists: z
    .array(
      z
        .string()
        .regex(/^https:\/\/[^\s]+\/playlist\.json$/)
        .max(1024)
    )
    .min(1)
    .max(1024),
  created: z.string().datetime().optional(),
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
    chain: 'evm' | 'tezos' | 'other';
    standard?: 'erc721' | 'erc1155' | 'fa2' | 'other';
    address?: string;
    seriesId?: number | string;
    tokenId?: string;
    uri?: string;
    metaHash?: string;
  };
  dependencies?: Array<{
    chain: 'evm' | 'tezos' | 'other';
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

// KV Storage Keys
export const KV_KEYS = {
  PLAYLIST_PREFIX: 'playlist:',
  PLAYLIST_GROUP_PREFIX: 'playlist-group:',
  SERVER_KEYPAIR: 'server:keypair',
} as const;

// Inferred types from Zod schemas
export type PlaylistInput = z.infer<typeof PlaylistSchema>;
export type PlaylistGroupInput = z.infer<typeof PlaylistGroupSchema>;

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
