import { webcrypto } from 'node:crypto';
import canonicalize from 'canonicalize';
import type { KeyPair, Playlist, Env } from './types';

/**
 * Cryptographic utilities for DP-1 protocol
 */

// Use node:crypto's webcrypto for Cloudflare Workers compatibility
const crypto = webcrypto;

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.replace(/^0x/, '');

  // Ensure even length
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert PKCS#8 private key to raw format if needed
 */
async function importPrivateKeyFromHex(privateKeyHex: string): Promise<Uint8Array> {
  try {
    const privateKeyBytes = hexToUint8Array(privateKeyHex);

    // Try to import as PKCS#8 first
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyBytes,
        { name: 'Ed25519', namedCurve: 'Ed25519' },
        true,
        ['sign']
      );

      // Export back to get consistent format
      const exported = await crypto.subtle.exportKey('pkcs8', cryptoKey);
      return new Uint8Array(exported);
    } catch {
      // If PKCS#8 import fails, assume it's raw 32-byte seed
      if (privateKeyBytes.length === 32) {
        // For Ed25519, we need to convert the 32-byte seed to PKCS#8 format
        // This is a simplified approach - in production you might want a more robust key format
        return privateKeyBytes;
      }
      throw new Error('Invalid private key format: must be PKCS#8 or 32-byte seed');
    }
  } catch (error: unknown) {
    throw new Error(
      `Failed to import private key: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get server's persistent key pair from environment variables
 * Throws error if ED25519_PRIVATE_KEY is not configured
 */
export async function getServerKeyPair(env: Env): Promise<KeyPair> {
  const privateKeyHex = env.ED25519_PRIVATE_KEY;

  if (!privateKeyHex) {
    throw new Error(
      'ED25519_PRIVATE_KEY environment variable is required. ' +
        'Generate a key with: openssl genpkey -algorithm Ed25519 -out private.pem && ' +
        'openssl pkey -in private.pem -outform DER | xxd -p -c 256'
    );
  }

  try {
    const privateKey = await importPrivateKeyFromHex(privateKeyHex);

    // For signing-only use case, we don't need the public key
    // Return a placeholder for the public key since we only use private key for signing
    const placeholderPublicKey = new Uint8Array(32); // Ed25519 public keys are 32 bytes

    return {
      publicKey: placeholderPublicKey,
      privateKey: privateKey,
    };
  } catch (error: unknown) {
    throw new Error(
      `Failed to load ED25519 private key from environment: ${error instanceof Error ? error.message : String(error)}. ` +
        'Ensure ED25519_PRIVATE_KEY is a valid hex-encoded PKCS#8 or raw 32-byte key.'
    );
  }
}

/**
 * Create canonical form of playlist for signing (RFC 8785 compliant)
 * Uses the canonicalize library which implements the official RFC 8785 standard
 */
export function createCanonicalForm(playlist: Omit<Playlist, 'signature'>): string {
  // Use the canonicalize library which is RFC 8785 compliant
  const canonical = canonicalize(playlist);

  if (!canonical) {
    throw new Error('Failed to canonicalize playlist');
  }

  return canonical;
}

/**
 * Sign a playlist using ed25519 as per DP-1 specification
 */
export async function signPlaylist(
  playlist: Omit<Playlist, 'signature'>,
  privateKey: Uint8Array
): Promise<string> {
  const canonicalForm = createCanonicalForm(playlist);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalForm);

  // Hash with SHA-256 first
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Import the private key for signing
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKey,
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519',
    },
    false,
    ['sign']
  );

  // Sign the hash
  const signature = await crypto.subtle.sign('Ed25519', cryptoKey, hashBuffer);
  const signatureBytes = new Uint8Array(signature);

  // Convert to hex and format as per DP-1 spec
  const hex = Array.from(signatureBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `ed25519:0x${hex}`;
}

/**
 * Verify a playlist signature
 */
export async function verifyPlaylistSignature(
  playlist: Playlist,
  publicKey: Uint8Array
): Promise<boolean> {
  if (!playlist.signature) {
    return false;
  }

  try {
    // Extract hex from signature
    const signatureHex = playlist.signature.replace(/^ed25519:0x/, '');
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []
    );

    // Create canonical form without signature
    const playlistWithoutSignature = { ...playlist };
    delete playlistWithoutSignature.signature;
    const canonicalForm = createCanonicalForm(playlistWithoutSignature);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalForm);

    // Hash with SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Import public key for verification
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      publicKey,
      {
        name: 'Ed25519',
        namedCurve: 'Ed25519',
      },
      false,
      ['verify']
    );

    // Verify signature
    return await crypto.subtle.verify('Ed25519', cryptoKey, signatureBytes, hashBuffer);
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
