# DP-1 Ref Manifest Specification (v0.1.0)

## Purpose

The `ref` manifest defines an **optional, data-only extension** to DP-1 playlist items. It carries structured metadata and playback control preferences that can be interpreted by compliant players. This design allows richer artwork descriptions and display guidance without depending on a live network connection.

---

## 1. Placement in Playlist

Within a DP-1 playlist item:

```json
{
  "source": "ipfs://bafy.../index.html",
  "provenance": { "type": "erc721", "contract": "eip155:1:0x...:1234" },
  "ref": "ipfs://bafy.../ref.json", // ipfs:// or https://... (content-addressed preferred)
  "refHash": "abcd" // Required if the ref is not content-addressed
}
```

When `ref` uses HTTPS, the `refHash` field is required for integrity.

---

## 2. Goals

* **Deterministic merging:** predictable behavior across devices and players.
* **Integrity-safe:** content-addressed or hash-pinned to prevent drift.
* **Forward-compatible:** uses semantic versioning for evolvability.

---

## 3. Manifest Envelope

```json
{
  "refVersion": "0.1.0",               // semantic version of manifest schema
  "id": "ref-7c3d",                    // unique identifier (for caching)
  "created": "2025-10-13T01:23:45Z",   // RFC3339 timestamp
  "locale": "en",                      // default locale

  "metadata": { ... },
  "controls": { ... },
  "i18n": { ... }
}
```

---

## 4. Metadata Block

Carries human-readable information used for labeling, crediting, and exhibition.

```json
"metadata": {
  "title": "Work Title",
  "artists": [
    {
      "name": "Artist Name",
      "id": "",                               // producer-scoped, not an identity
      "addresses": ["0x…", "tz1…"],           // the only cross-producer identity
      "avatar": { "uri": "ipfs://.../avatar.jpg", "sha256": "..." },
      "biographies": [ { "text": "One paragraph...", "source": "Publisher", "sourceUrl": "https://..." } ],
      "links": [ { "type": "website", "url": "https://..." } ]
      // "url" (1.0.0) is deprecated as of 1.1.0 — write a links entry of type "website" instead
    }
  ],
  "creditLine": "© Artist, courtesy Feral File",
  "description": "One or two paragraphs...",
  "tags": ["computational", "generative"],
  "thumbnails": {
    "small": { "uri": "ipfs://.../thumb_s.jpg", "w": 320,  "h": 180, "sha256": "..." },
    "large": { "uri": "ipfs://.../thumb_l.jpg", "w": 1280, "h": 720, "sha256": "..." },
    "xlarge": { "uri": "ipfs://.../thumb_l.jpg", "w": 1280, "h": 720, "sha256": "..." },
    "default": { "uri": "ipfs://.../thumb_l.jpg", "w": 1280, "h": 720, "sha256": "..." }
  }
}
```

All text fields are UTF-8 encoded and localizable through the `i18n` block.

Within `thumbnails`, each entry requires only `uri`. `w` and `h` are **optional**: when present they are the intrinsic image dimensions in pixels; producers that only hold a bare thumbnail URL omit them rather than guess. Consumers **MUST** treat `w` and `h` as possibly absent.

### 4.1 Artist entries

Only `name` is required. `addresses`, `avatar`, `biographies` and `links` were added in refVersion 1.1.0; together with `id` and `url` they describe the artist rather than the work, so they carry a different contract from the rest of the block.

| Field | Contract |
|:------|:---------|
| `id` | **Producer-scoped.** An opaque label such as a platform UUID or database key. Two producers publishing the same artist can and do use different ids, so consumers **MUST NOT** treat `id` as an identity or correlate artists across producers by it. Equal, non-empty ids from one producer mean one artist; an empty `id` means nothing at all. |
| `addresses` | **The only cross-producer identity.** Raw wallet addresses the producer attributes to the artist — EVM (`0x…`) and Tezos (`tz1`, `tz2`, `tz3`, `tz4`, `KT1…`) forms are distinguished by shape, so no chain field is carried: an externally owned account's key pair is chain-independent, so one EVM address is one identity wherever it mints. Producers **SHOULD** include the address that minted or is credited on-chain for the work. Consumers **MUST** compare EVM addresses case-insensitively and Tezos addresses as-is. |
| `avatar` | A `Thumbnail` (§4): `uri` required, `w`/`h`/`sha256` optional. |
| `biographies` | Ordered by the producer's preference; when only one fits, show the first. `text` is plain text with no markup. `source`/`sourceUrl` attribute where the text was taken from and are omitted when unknown. |
| `links` | `type` is one of `website`, `twitter`, `instagram`, `other`; any other value is invalid, so a destination the enumeration does not name is written as `other`. `url` is always a full URL, never a bare handle, so players carry no per-network URL rules. |
| `url` | **Deprecated as of 1.1.0.** The 1.0.0 single profile URL. It remains valid for backward compatibility but **SHOULD NOT** be emitted by new manifests; write a `links` entry of type `website` instead. A producer that still emits both **MUST** keep `url` equal to that entry. Consumers read `links` first and fall back to `url` only when `links` is absent or empty. |

**Identity is a claim, not a fact.** `addresses` is covered by whatever signs or hashes the manifest, so it is exactly as trustworthy as its producer. A wallet may be shared — collectives, studios and collaborative mints all mint from one address — so two producers whose lists overlap on an address have **not** thereby described one artist. Consumers **MUST NOT** merge two artist records solely because their `addresses` intersect; they combine the producer's claim with their own registry and with the trust they extend to that producer. What `addresses` does settle is attribution of *this work* to *this entry*: a consumer that indexes works by wallet **MAY** list the work under every artist record its own registry holds for that wallet — two records that share a wallet each receive the work; they are not thereby merged into one.

**Profile fields are a snapshot.** Avatar, biographies and links change independently of the work and of the manifest that pins them. They are the offline fallback, not the source of truth: consumers **MAY** replace them with fresher data from a registry keyed by `addresses` whenever one is reachable, and producers **SHOULD NOT** reissue a manifest solely because a profile field drifted.

---

## 5. Controls Block

Defines display preference.

```json
"controls": {
  "display": {
    "scaling": "fit|fill",
    "margin": "0px", 
    "background": "#000000",
    "autoplay": true,
    "loop": false,
    "interaction": {
        "keyboard": [],
        "mouse": {}
    }
  },
  "safety": {
    "orientation": ["landscape", "portrait", "any"],
    "maxCpuPct": 90,
    "maxMemMB": 1024
  }
}
```

## 6. Localization (`i18n`)

Provides localized text overrides for specific languages.

```json
"i18n": {
  "ja": {
    "title": "日本語タイトル",
    "description": "説明...",
    "creditLine": "クレジット..."
  }
}
```

The player should use the default locale first; if not available, fall back to the manifest’s specified locale; if still unavailable, use the en locale as the final default. This ensures robust localization and a predictable fallback order.

---

## 7. Merging Order

When applying values at runtime:

1. Player defaults
2. Playlist-level defaults
3. `ref.controls`
4. User/runtime overrides (if allowed)

Last-write-wins within the same key path. Playback must continue even if some blocks fail validation.

---

## 8. Integrity & Validation

* Prefer **content-addressed URIs** (IPFS, Arweave).
* If using HTTPS, include a `sha256` checksum.
* Players must refuse to load manifests failing hash checks.
* Manifests are **data-only** — no code execution or scripts.
* Recommended maximum size: **64 KB uncompressed**.

---

## 9. Offline Behavior

* `ref`: may be cached for reuse; revalidate via CID or hash.
* Thumbnails and assets are cached similarly.

Players must remain fully functional even when manifests are unavailable.

---

## 10. Minimal Example

```json
{
  "refVersion": "1.0.0",
  "id": "ref-minimal-01",
  "created": "2025-10-13T00:00:00Z",
  "locale": "en",
  "metadata": {
    "title": "Untitled (Study)",
    "artists": [
      {
        "name": "A. Example"
      }
    ],
    "thumbnails": {
        "default": { "uri": "ipfs://.../thumb_l.jpg", "w": 1280, "h": 720, "sha256": "..." }
    }
  },
  "controls": {
    "display": {
      "scaling": "fit|fill",
      "interaction": {
        "keyboard": [],
        "mouse": {}
      }
    },
    "safety": {
      "orientation": [
        "landscape",
        "portrait"
      ],
      "maxCpuPct": 90,
      "maxMemMB": 1024
    }
  }
}
```

---

## 11. Security Requirements

* Never execute or import code from a manifest.
* Treat `ref` fields as untrusted input.
* Maintain player sandbox boundaries regardless of manifest content.
* Hash-pin every non-content-addressed URI.
* Ignore or warn on out-of-range values instead of failing.

---

## 12. Versioning

Field additions follow [Semantic Versioning 2.0](https://semver.org/):

* Minor version → backward-compatible extensions.
* Major version → breaking schema changes.

Players must ignore unknown fields from higher minor versions and continue playback.

* **1.1.0** — `metadata.artists[]` gains `addresses`, `avatar`, `biographies` and `links`; `id` is documented as producer-scoped; `url` is deprecated in favour of `links` (§4.1). Additive: every 1.0.0 manifest remains valid and a 1.0.0 consumer reads it unchanged. The one cost of the deprecation is that a 1.1.0 producer which follows the SHOULD NOT and omits `url` shows no profile link to a 1.0.0 consumer.

---

**End of DP-1 Ref Manifest Specification (v0.1.0)**
