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
  "artists": [ { "name": "Artist Name", "id": "", "url": "" } ],
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

---

**End of DP-1 Ref Manifest Specification (v0.1.0)**
