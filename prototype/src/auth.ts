import { Buffer } from 'node:buffer';

export interface Env {
  API_SECRET: string;
}

export async function authenticate(request: Request, env: Env): Promise<boolean> {
  const apiKey = request.headers.get('X-API-Key');
  const signature = request.headers.get('X-Signature');
  if (!apiKey || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(env.API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(apiKey));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  return signature === hex;
}
