# DP-1 Prototype API

This document describes the RESTful endpoints implemented in the Cloudflare Worker prototype.

## Authentication

Requests must include the following headers:

```
X-API-Key: <client key>
X-Signature: <hex HMAC-SHA256 of API key using server secret>
```

All responses include CORS headers so the browser client can call the API directly:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: X-API-Key, X-Signature, Content-Type
```

## Endpoints

### GET `/api/v1/playlists`

Return a list of playlist summaries. Each playlist contains `items[]` with `source` and `duration` fields used by the demo player.

Example:

```
GET /api/v1/playlists?chain=tezos&type=code&limit=50
```

### GET `/api/v1/playlist-groups/{id}`

Return details for a playlist group.

Example:

```
GET /api/v1/playlist-groups/generative-geometry-2025
```

Example response snippet:

```json
{
  "id": "generative-geometry-2025",
  "title": "Generative Geometry",
  "playlists": ["https://feed.ff.com/geom-p1/playlist.json"]
}
```

### POST `/api/v1/playlists`

Submit a playlist for validation. The body must include `items[]`, `signature`, and the Ed25519 `pubkey` used to sign the SHA-256 hash of the JSON.

```bash
curl -X POST /api/v1/playlists \
  -d '{"items":[{"id":"a","source":"https://example.com/a","duration":5}],"signature":"ed25519:<hex>","pubkey":"<hex>"}'
```

## Deployment

The API worker runs on Cloudflare Workers. The accompanying Next.js client is hosted on Cloudflare Pages. See the [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/llms-full.txt) for deployment steps.
