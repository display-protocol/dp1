# DP‑1 Specification (v0.02‑draft)

*A platform‑neutral protocol for distributing, verifying, and preserving blockchain‑native digital art (BNDA).* 

---

## 1 · Scope & Goals

**DP‑1** defines:

1. A **playlist format** (JSON 2020‑12) that tells any compliant player *what* to render, *when*, and *under which rights*.  
2. A **deterministic capsule** (`*.dp1c`) for long‑term preservation of **code‑based art**.  
3. A minimal **transport & auth profile** so playlists work across HTTP(S), IPFS, and offline media.  
4. A **compliance suite & badging** model to ensure interoperability.

---

## 2 · Terminology  (Glossary excerpt)

| Term | Definition |
| :---- | :---- |
| **BNDA** | *Blockchain‑Native Digital Art* – any artwork whose canonical ownership record lives on a public blockchain (EVM chains, Tezos, etc.).  Future revisions may broaden “chain” to any publicly verifiable ledger; the chain enum is therefore open-ended. |
| **Code‑based art** | BNDA where the payload is executable code producing real‑time output. |
| **Playlist** | Ordered list of *playlist items* specifying assets, timing, and rights. |
| **Playlist Defaults** | Top‑level object whose values pre‑populate items unless explicitly overridden. |
| **Capsule (`*.dp1c`)** | Tar+Zstd container bundling a playlist with its immutable asset tree \+ optional engine layer. |
| **Player** | Software or device capable of rendering a DP‑1 playlist. |
| **Exhibition / Playlist‑Group** | A curator‑authored collection of one or more playlists with shared metadata (outside DP‑1 core, see §15). |
| **Feed Operator** | Entity hosting and signing a playlist endpoint. |

---

## 3 · Playlist JSON

### 3.1 Top‑Level Schema

```
{
  "dpVersion": "1.0.0",          // SemVer
  "id": "summer‑mix‑01",
  "created": "2025-06-03T17:01:00Z",
  "defaults": {                   // OPTIONAL – inherited by items
    "display": {
      "scaling": "fit",
      "background": "#111",
      "margin": "5%"
    }
  },
  "items": [ PlaylistItem, ... ],
  "signature": "ed25519:0x…"
}
```

*Inheritance rule*: each `PlaylistItem` starts with a copy of `defaults`; any fields set in the item replace the inherited values.

### 3.2 PlaylistItem Schema (excerpt)

```
{
  "id": "payphone‑v2",
  "title": "Payphone",
  "source": "https://cdn.ff.com/payphone/index.html",
  "duration": 300,
  "license": "open" | "token" | "subscription",

  // OPTIONAL – pull metadata / controls from external manifest
  "ref": "ipfs://bafybeigd…/manifest.json",
  "override": { "duration": 180 },   // fields that override the ref

  "display": DisplayPrefs?,           // local overrides win over defaults/ref
  "repro": ReproBlock?,
  "provenance": ProvenanceBlock?
}
```

*Resolution order*: **defaults → ref → item.local** (last write wins).

### 3.3 DisplayPrefs

See §4.

---

## 4 · Display Preferences (`display`)

**Unit rule** – Length fields (e.g., `margin`) accept either:

-  **number** → pixels (CSS‑px, device‑independent)  
-  **string** → `%(vw\|vh)` units (`"5%"`, `"3vw"`, `"2vh"`) Players **MUST** support px, %, vw, vh and **MUST** reject unknown units.

| Field | Type | Default | Behaviour |
| :---- | :---- | :---- | :---- |
| `scaling` | "fit" | "fill" | "stretch" | "auto" | from defaults or "fit" | fit: entire artwork visible with letterbox; fill: fill viewport cropping if needed; stretch: fill both axes ignoring aspect; auto: player decides based on device/profile.  |
| `margin` | number or string | 0 | Even margin around artwork. Number = px; string supports %, vw, vh (computed relative to viewport). |
| `background` | string | "\#000" | Hex/RGB color used outside the artwork and beneath any transparent pixels. Special value "transparent" lets the underlying screen show through. |
| `autoplay` | bool | true | Attempt to start playback automatically. Player MUST fall back to waiting for a first user gesture when the runtime blocks WebAudio/video autoplay (e.g., browser policies). |
| `loop` | bool | true | Repeat automatically. |
| `interaction.keyboard` | string\[\] | \[\] | Allowed keys, using [W3C UI Events code values](https://www.w3.org/TR/uievents-code/) (e.g., `"ArrowLeft"`, `"Space"`, `"KeyW"`). Players MUST ignore unknown codes. |
| `interaction.mouse` | object | all false | `{click, scroll, drag, hover}` booleans. |
| `userOverrides.<field>` | bool | true | Viewer may change field if true. |

---

## 5 · Deterministic Reproduction (`repro`)

```
"repro": {
  "engineVersion": { "chromium": "123.0.6312.58" },
  "seed": "0x84a39ef5…",
  "assetsSHA256": [ "473…", "9be…" ],
  "frameHash": { "sha256": "bf20f9…", "phash": "0xaf39…" }
}
```

Players **MUST** compute the first‑frame SHA‑256; discrepancy triggers `reproMismatch`.

---

## 6 · Provenance (`provenance`)

Each PlaylistItem MAY embed a `provenance` object that links the work to an on‑chain or off‑chain source of truth.

```
"provenance": {
  "type": "seriesRegistry" | "onChainURI" | "offChainURI",
  "chain": "evm" | "tezos" | "other",
  "seriesId": 1234,          // required – collection / series identifier
  "tokenId": "42",          // optional – edition / token; omit for series‑level
  "uri": "ipfs://…",        // canonical contract or metadata URI
  "dependencies": [          // optional – external on‑chain libs / registries
    { "chain": "evm", "uri": "eth://0xABC…" },
    { "chain": "evm", "uri": "eth://0xDEF…" }
  ]
}
```

**Mutability & authority**

- `uri` and any listed `dependencies` SHOULD be content‑addressed (IPFS CID, Arweave TXID) to guarantee immutability.  
- If an HTTPS or `eth://` URI is used, any change to the referenced data MUST result in a new manifest and the playlist MUST be re‑signed.  
- Only the **playlist signer** has authority to update the `provenance` block.

If `tokenId` is omitted the playlist refers to the entire series; players MAY surface a generic provenance link. Dependencies are for documentation & verification only—players MUST NOT fetch or execute remote code at runtime.

---

## 7 · Security & Authentication

### 7.1 Playlist Signature

*Canonical form ≡ UTF‑8 (no BOM), LF terminators.* *SHA‑256 → Ed25519 → embed as:* `"signature": "ed25519:<hex>"`.

### 7.2 License Modes

| Mode | Behaviour |
| :---- | :---- |
| `open` | No viewer auth. |
| `token` | Wallet proof (EIP‑4361, Tezos Signed Payload, etc.). |
| `subscription` | Bearer JWT to operator’s `/verify`. |

---

## 8 · Transport Profile

| Aspect | Requirement |
| :---- | :---- |
| HTTP | 1.1 & 2, TLS ≥1.2. |
| Range | **SHOULD** support `Range: bytes=`. |
| IPFS | Gateways OK; native libp2p optional. |
| Offline | `file://` and UNC paths allowed. |
| Compression | Brotli (text), Zstd (capsule), H.265/AV1 (video). |

---

## 9 · Capsule Format (`*.dp1c`)

```
<playlist>.json
/assets/<…>
/meta/engine/<layer>
```

Tar \+ Zstd; SHA‑256 of archive \= capsule CID.

---

## 10 · Conservation Workflow

1. `feral‑conservationd` on boot \+ weekly.  
2. Render → SHA‑256 \+ pHash.  
3. Append to 500 MiB ring buffer.  
4. ≥80 % full → `feral‑archive‑push` pins to IPFS, optional Arweave mirror.  
5. Drift → `reproMismatch` DBus signal.

---

## 11 · Compliance & Badging

| Badge | Requirement |
| :---- | :---- |
| **DP‑1 Compatible** | JSON‑Schema pass \+ demo capsules display. |
| **DP‑1 Deterministic** | Plus 8‑week Regenerate 2030 test. |

---

## 12 · Versioning & Extensions

*SemVer*; players warn on major mismatch.   
*Extension Registry* (`/extensions/registry.json`) governs new chains, display fields, etc.

---

## 13 · Governance Roadmap

2025‑06 → 2026‑06: canonical repo under Feral File.   
2026‑07: 5‑seat Steering Committee.

---

## 14 · Error Codes (player → UI)

| Code | Scenario | User message |
| :---- | :---- | :---- |
| `playlistInvalid` | Schema fail | “Playlist malformed.” |
| `sigInvalid` | Signature mismatch | “Invalid feed signature.” |
| `licenseDenied` | Auth failed | “You don’t own access.” |
| `reproMismatch` | Hash drift | “Artwork may not display correctly.” |
| `sourceUnreachable` | Fetch fail | “Network error loading artwork.” |

---

## 15 · Directory & Exhibition API (beta)

*REST‑ish JSON, paginated.*

### 15.1 Playlists

```
GET /api/v1/playlists?chain=tezos&type=code&limit=50
```

Returns array of playlist summaries.

### 15.2 Playlist‑Groups (Exhibitions)

```
GET /api/v1/playlist-groups/{id}
```

```
{
  "id": "generative‑geometry‑2025",
  "title": "Generative Geometry",
  "curator": "Alice Example",
  "summary": "Exploring procedural form…",
  "playlists": [
    "https://feed.ff.com/geom‑p1/playlist.json",
    "https://feed.ff.com/geom‑p2/playlist.json"
  ],
  "created": "2025-05-20T00:00:00Z",
  "coverImage": "ipfs://bafyb…/cover.jpg"
}
```

Players iterate playlists in `playlists[]` order by default; exhibition‐level scheduling extensions may appear in future XP‑1 spec.

---

## 16 · Changelog

* **v0.02 (2025‑06‑06)**. Unit rule for `margin`; example updated. Clarified behaviour of `background`, `autoplay`, and keyboard enums. Renamed `border` → `margin` for consistency. Provenance refined (`seriesId`, optional `tokenId`, `dependencies`, immutability).  
* **v0.01 (2025‑06‑03)** – Added `defaults` inheritance, `ref` / `override`, and Playlist‑Group (Exhibition) API.

---

### Appendix A · Playlist JSON‑Schema (excerpt)

`defaults`, `ref`, and inheritance rules implemented in `playlist‑1.0.0.json`. See repository for full source.

---

## Open Items for WG discussion (updated)

1. Per‑item vs playlist‑level signature.  
2. Minimum HTTP headers for CDN caching.  
3. Hash sampling strategy for video drift detection.

End of draft.  
