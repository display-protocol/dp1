# DP-1 Channel Extension (v1.0.0)

*A formal extension to DP-1 v1.0.0+ for collaborative, persistent feeds of playlists with enhanced metadata and curation capabilities.*

**Specification version:** 1.0.0  
**Status:** Released Extension  
**DP-1 compatibility:** v1.0.0+  
**Published:** 2026-03-11

---

## 1 · Purpose & Scope

The **Channel Extension** formalizes higher-level groupings of playlists as persistent, branded feeds with rich metadata. Channels address use cases including:

- **Multi-curator exhibitions** with shared or distributed authorship
- **Publisher attribution** for institutions, galleries, and collectives
- **Exhibition hierarchies** preserving publisher → exhibition → playlist relationships

Channels extend the Playlist-Group concept (DP-1 §15) with additive fields only, maintaining full backward compatibility with existing DP-1 v1.0.0+ implementations.

### 1.1 Relationship to Core DP-1

- **Builds on:** Playlist-Group schema (§15) and Feed API
- **Transport:** Delivered as signed JSON per DP-1 §7.1 (via HTTP/IPFS/offline, §8)
- **Authority:** Channel signature covers the channel object; individual playlists maintain their own signatures
- **Versioning:** Additive extension, compatible with DP-1 v1.0.0+ (does not require core protocol changes)

---

## 2 · Terminology

| Term | Definition |
|:-----|:-----------|
| **Channel** | A persistent, curator-authored feed that groups playlists with shared metadata and publisher attribution. |
| **Publisher** | The entity responsible for distributing the channel (e.g., gallery, institution, collective). |
| **Curator** | Individual or entity who authored/selected the playlists within a channel. Channels support multiple curators. |

---

## 3 · Channel Schema

Channels extend the Playlist-Group object from DP-1 §15 with **optional** additive fields. All new fields are backward-compatible.

### 3.1 Channel JSON

```json
{
  "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
  "slug": "generative-geometry-2025",
  "title": "Generative Geometry",
  "version": "1.0.0",
  
  "curators": [
    {
      "name": "Alice Example",
      "key": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
      "url": "https://alice.example.com"
    },
    {
      "name": "Bob Collaborator",
      "key": "did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rqqC2DoEvwW"
    },
    {
      "name": "Guest Curator",
      "key": "did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rqqC2DoEvwW"
    }
  ],
  
  "publisher": {
    "name": "Example Institution",
    "key": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "url": "https://example.com"
  },
  
  "summary": "Exploring procedural form through generative algorithms…",
  "coverImage": "ipfs://bafybeig.../cover.jpg",
  
  "playlists": [
    "https://feed.example.com/geom-p1/playlist.json",
    "https://feed.example.com/geom-p2/playlist.json"
  ],
  
  "created": "2025-05-20T00:00:00Z",
  
  "signatures": [
    {
      "alg": "ed25519",
      "kid": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
      "ts": "2025-10-17T12:00:00Z",
      "payload_hash": "sha256:0f4c0d87a1b2c3d4e5f6071829a1b2c3d4e5f6071829a1b2",
      "role": "curator",
      "sig": "X2b7cX2sOe7lJrN2R2d1xgIBt2m5jXvKxQx3k8Cq9fU"
    },
    {
      "alg": "ed25519",
      "kid": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "ts": "2025-10-17T12:15:00Z",
      "payload_hash": "sha256:0f4c0d87a1b2c3d4e5f6071829a1b2c3d4e5f6071829a1b2",
      "role": "institution",
      "sig": "Y7d3aY9tPf2mKsO3S5e2yhJCu3n6kYwLyRy4l9Dr0gV"
    }
  ]
}
```

### 3.2 Field Reference

#### Core Fields (from DP-1 §15)

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `id` | string (UUID) | **REQUIRED** | Unique identifier for the channel. |
| `slug` | string | **REQUIRED** | URL-friendly identifier (lowercase, hyphens). |
| `title` | string | **REQUIRED** | Display name (1-200 characters). |
| `version` | string | **REQUIRED** | Channel extension version (SemVer, e.g., `"1.0.0"`). |
| `created` | string (ISO 8601) | **REQUIRED** | Channel creation timestamp (UTC). |
| `playlists` | array of strings | **REQUIRED** | Ordered array of playlist URLs or identifiers. |
| `signatures` | array of objects | **REQUIRED** | Multi-signature chain per DP-1 §7.1. Legacy `signature` field supported but deprecated. |

#### Extended Fields (Channel Extension)

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `curators` | array of objects | OPTIONAL | Array of curator entities. See §3.3. |
| `publisher` | object | OPTIONAL | Publisher entity. See §3.3. |
| `summary` | string | OPTIONAL | Channel description or curatorial statement (1-2000 characters). |
| `coverImage` | string (URI) | OPTIONAL | Channel cover image. Supports `ipfs://`, `https://`, `ar://` URIs. |


### 3.3 Entity Format (Curators & Publisher)

Both `curators` and `publisher` use a unified entity format with verifiable identities.
This is the same entity shape used by the Playlist Extension.

**Entity Object:**

```json
{
  "name": "Entity Name",
  "key": "did:key:z6Mk...",
  "url": "https://example.com"
}
```

**Entity Object Fields:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | string | **REQUIRED** | Entity display name. |
| `key` | string | **REQUIRED** | Verifiable identity in DID format (e.g., `did:key:z6Mk...`). |
| `url` | string | OPTIONAL | Entity website or profile URL. |

**Curators:**
- Array of entity objects
- Supports multiple curators per channel

```json
"curators": [
  {
    "name": "Alice Example",
    "key": "did:key:z6MkpTHR...",
    "url": "https://alice.example.com"
  },
  {
    "name": "Bob Collaborator",
    "key": "did:key:z6Mkf5rG..."
  }
]
```

**Publisher:**
- Single entity object
- Represents the organization or individual distributing the channel

```json
"publisher": {
  "name": "Example Institution",
  "key": "did:key:z6MkhaXg...",
  "url": "https://example.com"
}
```

---

## 4 · Transport & Distribution

Channels follow DP-1 transport requirements (§8):

### 4.1 HTTP Distribution

```http
GET /api/v1/channels/generative-geometry-2025 HTTP/2
Host: feed.example.com
Accept: application/json

HTTP/2 200 OK
Content-Type: application/json
Content-Length: 2048
Cache-Control: public, max-age=3600

{ ... channel JSON ... }
```

**Requirements:**
- **MUST** support HTTP/1.1 and HTTP/2
- **MUST** use TLS 1.2+ for HTTPS
- **SHOULD** support byte-range requests (`Range: bytes=`)
- **SHOULD** include appropriate `Cache-Control` headers

### 4.2 IPFS Distribution

Channels **MAY** be distributed via IPFS:

```
ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
```

**Requirements:**
- Use CIDv1 with SHA-256 for content addressing
- Gateway access via `https://ipfs.io/ipfs/<CID>` **MUST** be supported
- Native libp2p access is **OPTIONAL**

### 4.3 Offline Distribution

Channels **MAY** be distributed offline:

- File URIs: `file:///path/to/channel.json`
- UNC paths: `\\server\share\channels\example.json`
- Bundled with DP-1 capsules (`.dp1c`)

---

## 5 · Security & Signatures

### 5.1 Channel Signatures

Channels **MUST** be signed per DP-1 §7.1 (multi-signature chain model for DP-1 v1.1.0+).

**Canonical form:**
- JSON Canonicalization Scheme (JCS, RFC 8785)
- UTF-8 encoding (no BOM)
- LF line terminators
- Excludes `signature` and `signatures` fields

**Signature coverage:**
- Channel signature covers the **entire channel object**
- Individual playlists maintain **separate signatures**
- Signature does **not** transitively cover linked playlists

### 5.2 Multi-Party Signing

Channels support multiple signatures with distinct roles:

```json
"signatures": [
  {
    "alg": "ed25519",
    "kid": "did:key:z6Mk...",
    "role": "curator",
    "ts": "2025-10-17T12:00:00Z",
    "payload_hash": "sha256:...",
    "sig": "..."
  },
  {
    "alg": "ed25519",
    "kid": "did:key:z6Mk...",
    "role": "institution",
    "ts": "2025-10-17T12:15:00Z",
    "payload_hash": "sha256:...",
    "sig": "..."
  }
]
```

**Verification requirements:**
- Players **MUST** verify at least one signature with role `"curator"` or `"institution"`
- Players **SHOULD** verify all signatures present
- Players **MAY** establish role-specific trust policies

See DP-1 §7.1 for complete signature specification.

### 5.3 Key Management

**Entity keys:**
- All entities (curators and publisher) **MUST** include `key` fields with DID-based identifiers
- Entity keys in `curators[].key` and `publisher.key` are **informational only** (not used for signature verification)
- Actual signature verification uses `signatures[].kid` per DP-1 §7.1
- Entity keys establish identity claims; signature keys establish authority

---

## 6 · Feed API Integration

Channels extend the DP-1 Feed API (§15) with additional endpoints.

### 6.1 List Channels

```http
GET /api/v1/channels?publisher=example-institution&limit=20
```

**Query parameters:**

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `publisher` | string | Filter by publisher slug. |
| `curator` | string | Filter by curator name. |
| `limit` | integer | Results per page (default: 50, max: 100). |
| `offset` | integer | Pagination offset. |

**Response:**
```json
{
  "total": 42,
  "limit": 20,
  "offset": 0,
  "channels": [
    {
      "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
      "slug": "generative-geometry-2025",
      "title": "Generative Geometry",
      "publisher": {
        "name": "Example Institution",
        "key": "did:key:z6Mk..."
      },
      "curators": [
        {
          "name": "Alice Example",
          "key": "did:key:z6Mk..."
        }
      ],
      "coverImage": "ipfs://...",
      "playlistCount": 3,
      "created": "2025-05-20T00:00:00Z"
    }
  ]
}
```

### 6.2 Get Channel Details

```http
GET /api/v1/channels/generative-geometry-2025
```

**Response:** Full channel JSON (as defined in §3.1)

### 6.3 Backward Compatibility

- Existing `/api/v1/playlist-groups` endpoints remain functional
- Channels are **supersets** of playlist-groups
- Players implementing channel support **MUST** also support legacy playlist-groups

---

## 7 · Use Cases & Examples

### 7.1 Multi-Curator Exhibition

**Scenario:** Three curators collaborate on a thematic exhibition.

```json
{
  "id": "b1c2d3e4-...",
  "slug": "digital-frontiers-2025",
  "title": "Digital Frontiers",
  "version": "1.0.0",
  
  "publisher": {
    "name": "Contemporary Art Collective",
    "key": "did:key:z6Mk..."
  },
  
  "curators": [
    {
      "name": "Alice Example",
      "key": "did:key:z6Mk...",
      "url": "https://alice.example.com"
    },
    {
      "name": "Bob Collaborator",
      "key": "did:key:z6Mk..."
    },
    {
      "name": "Charlie Guest",
      "key": "did:key:z6Mk..."
    }
  ],
  
  "summary": "Exploring the boundaries of digital expression...",
  "playlists": [
    "https://feed.example.com/df-section1/playlist.json",
    "https://feed.example.com/df-section2/playlist.json"
  ],
  
  "created": "2025-06-01T00:00:00Z",
  "signatures": [...]
}
```

### 7.2 Institutional Exhibition Series

**Scenario:** Museum publishes a series of related exhibitions.

```json
{
  "id": "c2d3e4f5-...",
  "slug": "museum-digital-collection",
  "title": "Digital Collection 2025",
  "version": "1.0.0",
  
  "publisher": {
    "name": "National Museum of Digital Art",
    "key": "did:key:z6Mk...",
    "url": "https://nmda.example.com"
  },
  
  "curators": [
    {
      "name": "Museum Curatorial Team",
      "key": "did:key:z6Mk..."
    }
  ],
  "summary": "Our annual digital art exhibition series...",
  
  "playlists": [
    "https://feed.nmda.example.com/generative/playlist.json",
    "https://feed.nmda.example.com/photography/playlist.json",
    "https://feed.nmda.example.com/interactive/playlist.json"
  ],
  
  "coverImage": "ipfs://bafybeig.../series-cover.jpg",
  "created": "2025-01-01T00:00:00Z",
  "signatures": [...]
}
```

---

## 8 · Implementation Guidelines

### 8.1 Player Support

**Minimum requirements:**
- Parse and display channel metadata (`title`, `publisher`, `curators`)
- Load and render linked playlists in order
- Verify channel signatures per DP-1 §7.1
- Handle missing optional fields gracefully

**Recommended features:**
- Display cover images and summaries
- Show curator information with links
- Cache channel metadata

**Optional enhancements:**
- Publisher branding integration
- Multi-curator attribution UI
- Social sharing with channel metadata

### 8.2 Feed Operator Support

**Publishing channels:**
1. Create channel JSON per §3.1
2. Sign channel per DP-1 §7.1 (multi-signature recommended)
3. Host at predictable URL (e.g., `/api/v1/channels/{slug}`)
4. Implement discovery endpoints (§6.1)
5. Provide JWKS endpoint for key verification

**Best practices:**
- Use content-addressed URIs (`ipfs://`) for immutable assets
- Include `Cache-Control` headers for HTTP distribution
- Version channels explicitly (`version` field)

---

## 9 · Compliance & Testing

### 9.1 Extension Badge: "DP-1 Channel v1.0"

**Requirements:**
- Parse and display all required channel fields
- Verify channel signatures per DP-1 §7.1
- Render linked playlists correctly
- Handle missing optional fields gracefully
- Pass reference test suite (10+ sample channels)

### 9.2 Test Suite

**Test scenarios:**
- Single curator with verifiable identity
- Multi-curator channels
- Publisher-attributed channels
- Channel signature verification
- Feed API queries with filtering

---

## 10 · Versioning & Future Extensions

### 10.1 Semantic Versioning

Channel extension follows SemVer:
- **Major:** Breaking changes to schema or behavior
- **Minor:** Additive features, backward-compatible
- **Patch:** Bug fixes, clarifications, editorial changes

Current version: **1.0.0**

### 10.2 Proposed Future Features

**Potential v0.2.0 additions:**
- Channel-level scheduling metadata
- Cross-channel references
- Enhanced analytics/tracking fields
- Playlist ordering strategies (shuffle, personalized)

**Potential v1.1.0 changes:**
- Production-ready status after community feedback
- Finalized compliance badge requirements
- Reference implementation validation

---

## 11 · Governance

### 11.1 Extension Stewardship

- **Maintained by:** Feral File (2025-2026)
- **Community input:** GitHub discussions and pull requests
- **Versioning:** Aligned with DP-1 core release cycle

### 11.2 Proposing Changes

1. Open GitHub issue with proposal
2. Community discussion (minimum 2 weeks)
3. Reference implementation (for breaking changes)
4. Steering committee review (if applicable)
5. Version bump and publication

---

## 12 · References

- **DP-1 Core Specification:** `/docs/spec.md`
- **DP-1 Playlist Extension:** `/docs/extension/playlist.md`
- **DID Core Specification:** https://www.w3.org/TR/did-core/
- **RFC 8785 (JCS):** https://www.rfc-editor.org/rfc/rfc8785
- **JSON Schema Draft 2020-12:** https://json-schema.org/

---

## 13 · Changelog

### v1.0.0 (2026-03-11)

**Initial stable release of Channel Extension.**

**Core Features:**
- Channel schema extending DP-1 Playlist-Group (§15)
- Unified entity format for curators and publisher (`name`, `key`, optional `url`)
- Multi-curator support with verifiable identities (DID-based)
- Publisher attribution for institutions and collectives
- Multi-signature support (aligned with DP-1 v1.1.0)

**Channel Fields:**
- `version` (required, SemVer format)
- `curators` (array of entity objects)
- `publisher` (entity object)
- `summary` (1-2000 characters)
- `coverImage` (URI)
- `updated` (ISO 8601 timestamp)

**Feed API Integration:**
- List channels endpoint: `GET /api/v1/channels`
- Get channel details: `GET /api/v1/channels/{slug}`
- Query parameters: publisher, curator, limit, offset

**Compliance:**
- Extension badge: "DP-1 Channel v1.0"
- Test suite with 10+ scenarios

**Entity Format:**
- All entities use unified format
- `name` and `key` required
- `url` optional
- No implicit string format for curators

---

## Appendix A · JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://feralfile.com/schemas/dp1-channel-1.0.0.json",
  "title": "DP-1 Channel Extension",
  "description": "Channel schema extending DP-1 Playlist-Group",
  "type": "object",
  "required": ["id", "slug", "title", "version", "created", "playlists", "signatures"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "slug": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "curators": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "key"],
        "properties": {
          "name": { "type": "string" },
          "key": { "type": "string" },
          "url": { "type": "string", "format": "uri" }
        }
      }
    },
    "publisher": {
      "type": "object",
      "required": ["name", "key"],
      "properties": {
        "name": { "type": "string" },
        "key": { "type": "string" },
        "url": { "type": "string", "format": "uri" }
      }
    },
    "summary": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "coverImage": {
      "type": "string",
      "format": "uri"
    },
    "playlists": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "string"
      }
    },
    "created": {
      "type": "string",
      "format": "date-time"
    },
    "signatures": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["alg", "kid", "ts", "payload_hash", "role", "sig"],
        "properties": {
          "alg": { "type": "string" },
          "kid": { "type": "string" },
          "ts": { "type": "string", "format": "date-time" },
          "payload_hash": { "type": "string" },
          "role": { "type": "string" },
          "sig": { "type": "string" }
        }
      }
    }
  }
}
```

---

*This specification is maintained as part of the DP-1 protocol ecosystem. For questions, feedback, or contributions, please visit the project repository or contact the maintainers.*
