# DP‑1 Specification (v1.1.0)

*A platform‑neutral protocol for distributing, verifying, and preserving blockchain‑native digital art (BNDA).*

---

## 1 · Scope & Goals

**DP‑1** defines:

1. A **playlist format** (JSON 2020‑12) that tells any compliant player *what* to render, *when*, and *under which rights*.
2. A **deterministic capsule** (`*.dp1c`) for long‑term preservation of **code‑based art**.
3. A minimal **transport & auth profile** so playlists work across HTTP(S), IPFS, and offline media.
4. A **compliance suite & badging** model to ensure interoperability.

---

## 2 · Terminology

| Term                            | Definition                                                                                                                                                                                                                                              |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BNDA**                        | *Blockchain‑Native Digital Art* – any artwork whose canonical ownership record lives on a public blockchain (EVM chains, Tezos, etc.).  Future revisions may broaden “chain” to any publicly verifiable ledger; the chain enum is therefore open-ended. |
| **Code‑based art**              | BNDA where the payload is executable code producing real‑time output.                                                                                                                                                                                   |
| **Playlist**                    | Ordered list of *playlist items* specifying assets, timing, and rights.                                                                                                                                                                                 |
| **Playlist Defaults**           | Top‑level object whose values pre‑populate items unless explicitly overridden.                                                                                                                                                                          |
| **Capsule (`*.dp1c`)**          | Tar+Zstd container bundling a playlist with its immutable asset tree \+ optional engine layer.                                                                                                                                                          |
| **Player**                      | Software or device capable of rendering a DP‑1 playlist.                                                                                                                                                                                                |
| **Feed Operator**               | Entity hosting and signing a playlist endpoint.                                                                                                                                                                                                         |

---

## 3 · Playlist JSON

### 3.1 Top‑Level Schema

```
{
  "dpVersion": "1.1.0",          // SemVer
  "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
  "title": "Sunset Collector Loop", // REQUIRED – 1‑200 chars
  "slug": "summer‑mix‑01",
  "created": "2025-06-03T17:01:00Z",
  "defaults": {                   // OPTIONAL – inherited by items
    "display": {
      "scaling": "fit",
      "background": "#000000",
      "margin": "5%"
    },
    "license" : "open",
    "duration": 300
  },
  "items": [ PlaylistItem, ... ],

  // Multi-signature (v1.1.0+, recommended)
  "signatures": [
    {
      "alg": "ed25519",
      "kid": "did:key:z6Mk…",
      "ts": "2025-10-17T07:02:03Z",
      "payload_hash": "sha256:0f4c0d87…",
      "role": "curator",
      "sig": "X2b7cX2sOe7lJ…"
    }
  ],

  // OR legacy single signature (v1.0.x, deprecated)
  "signature": "ed25519:<hex>"
}
```

*Inheritance rule*: each `PlaylistItem` starts with a copy of `defaults`; any fields set in the item replace the inherited values.

**Authority model**
For playlists using **multi-signature** (v1.1.0+): the `curator` role signature defines the primary creator, and additional signatures from other roles establish the trust chain and distribution authority.

For playlists using **legacy signature** (v1.0.x): the Ed25519 public key that signs the first accepted version of a playlist defines the *creator*.

*See §7.1 for complete signature rules and verification requirements.*

### 3.2 PlaylistItem Schema (excerpt)

```
{
  "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
  "slug": "payphone‑v2",
  "title": "Payphone",
  "source": "https://cdn.feralfile.com/payphone/index.html",
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

*Resolution order*: **defaults → ref → item.local** (last write wins). Device‑level overrides come after that only if the artist set userOverrides.\<field\> \= true.

### 3.3 DisplayPrefs

See §4.

### 3.4 Metadata/controls manifest

See [document](ref-manifest.md)

---

## 4 · Display Preferences (`display`)

**Unit rule** – Length fields (e.g., `margin`) accept either:

-  **number** → pixels (CSS‑px, device‑independent)
-  **string** → `%(vw\|vh)` units (`"5%"`, `"3vw"`, `"2vh"`) Players **MUST** support px, %, vw, vh and **MUST** reject unknown units.

| Field                   | Type             | Default    | Behaviour                                                                                                                                                                    |
| :---------------------- | :--------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaling`               | "fit" \| "fill" \| "stretch" \| "auto" | from defaults or "fit" | fit: entire artwork visible with letterbox; fill: fill viewport cropping if needed; stretch: fill both axes ignoring aspect; auto: player decides based on device/profile. |
| `margin`                | number or string | 0          | Even margin around artwork. Number = px; string supports %, vw, vh (computed relative to viewport).                                                                          |
| `background`            | string           | "\#000000" | Hex/RGB color used outside the artwork and beneath any transparent pixels. Special value "transparent" lets the underlying screen show through.                              |
| `autoplay`              | bool             | true       | Attempt to start playback automatically. Player MUST fall back to waiting for a first user gesture when the runtime blocks WebAudio/video autoplay (e.g., browser policies). |
| `loop`                  | bool             | true       | When `true`, time-based sources (video, audio) repeat continuously. When `false`, players **MUST** advance to the next playlist item at end-of-stream (see §4.1). Has no effect on non-time-based sources. |
| `imageRendering`        | "auto" \| "pixelated" | "auto"   | How raster images are resampled when scaled. `pixelated` keeps hard pixel edges (nearest-neighbour) for pixel art and bitmaps; `auto` lets the player smooth. Independent of `scaling`, which decides how the artwork fits. |
| `interaction.keyboard`  | string\[\]       | \[\]       | Allowed keys, using [W3C UI Events code values](https://www.w3.org/TR/uievents-code/) (e.g., `"ArrowLeft"`, `"Space"`, `"KeyW"`). Players MUST ignore unknown codes.         |
| `interaction.mouse`     | object           | all false  | `{click, scroll, drag, hover}` booleans.                                                                                                                                     |
| `userOverrides.<field>` | bool             | true       | Viewer may change field if true.                                                                                                                                             |

### 4.1 Playback advance

How a player decides when to move from one playlist item to the next depends on the source type and `display.loop`:

- **Code-based and static sources** (HTML, image, generative). No natural end-of-stream exists. Players advance after `duration` seconds — resolved from the item's `duration`, then `defaults.duration`. When neither is set, the player **SHOULD** continue rendering until externally instructed.
- **Time-based sources** (video, audio).
  - `loop: true` (default): the source repeats continuously. If `duration` is set, the player advances when it elapses; the source repeats during that interval.
  - `loop: false`: the player **MUST** advance to the next playlist item at end-of-stream. If `duration` is also set, the player **MUST** advance on whichever trigger fires first.

Transitions between items are implementation-defined.

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

Players **MUST** compute the first‑frame SHA‑256; discrepancy triggers `reproMismatch`. If an artwork requires a derived seed, the logic **MUST** be contained within the artwork payload; DP-1 does not standardize seedScript execution at this time.

`frameHash.phash` is **OPTIONAL**. When present it is the first frame's 64-bit DCT perceptual hash: the frame scaled to 64×64 pixels with bilinear interpolation, converted to luma (0.299 R + 0.587 G + 0.114 B), transformed by an unscaled two-dimensional DCT-II, and the top-left 8×8 coefficients read row by row; bit 63 − *i* is set when coefficient *i* is greater than the 33rd smallest of the 64. Producers **MUST** write it as `0x` and 16 lowercase hex digits, zero-padded. Two pHashes are compared by Hamming distance (0 = identical, 64 = every bit differs); thresholds are implementation-defined. The reference implementation is `PerceptionHash` in [corona10/goimagehash](https://github.com/corona10/goimagehash) v1.1.0; where this description leaves a detail open, it decides.

---

## 6 · Provenance (`provenance`)

Each `PlaylistItem` **MAY** embed a `provenance` object that links the rendered asset to an on-chain or off-chain source of truth. The structure separates **where** the truth lives (`type`) from **how** the contract is implemented (`standard`) and groups all contract-specific data under a single `contract` object.

```
"provenance": {
  "type": "onChain"           // onChain | seriesRegistry | offChainURI
                              // onChain     → explicit contract object
                              // seriesRegistry → parent collection in SeriesRegistry
                              // offChainURI   → contract.uri names the canonical record

  /* REQUIRED when type == "onChain" OR "seriesRegistry"; for "offChainURI", carries uri */
  "contract": {
    "chain":    "evm" | "tezos" | "bitmark" | "other",
    "standard": "erc721" | "erc1155" | "fa2" | "other",   // OPTIONAL
    "address":  "0x61d45475fe81ef46bdd8093b5c73efee03167e0", // OPTIONAL
    "seriesId": 777,                 // OPTIONAL; integer, or string when too large for a JSON number
    "tokenId":  "42",                // OPTIONAL (one specific edition)
    "uri":      "ipfs://bafybeih...",// ipfs://  eth://  https://…
    "metaHash": "c517b7e8dc9c4d5a…"  // OPTIONAL; REQUIRED if uri is mutable
  },

  /* OPTIONAL — documentary only, never executed at runtime */
  "dependencies": [
    {
      "chain":    "evm",
      "standard": "erc721",
      "uri":      "eth://0xABCDEF..."
    }
  ]
}
```

### Mutability & authority

* `contract.uri` and any `dependencies.uri` **SHOULD** be content-addressed (IPFS CID, Arweave TXID) to guarantee immutability.
* If an `https://` or `eth://` URI is used, **any** change to the referenced data **MUST** result in a new manifest, and the playlist **MUST** be re-signed.
* When `metaHash` is present, players **SHOULD** verify it; implementers **MAY** perform this check asynchronously (i.e., without blocking first render).
* Only the **playlist signer** has authority to update the `provenance` block.

### Field guidance

| Scenario                          | How to populate                                                            |
| :-------------------------------- | :------------------------------------------------------------------------- |
| Entire series only                | `seriesRegistry` \+ `contract.seriesId`; omit `tokenId`.                   |
| One specific edition              | `seriesRegistry` or `onChain` with `seriesId` **and** `tokenId`.           |
| Contract with no “series” concept | `type:"onChain"` and provide `contract.uri`/`contract.address`; omit `seriesId`. |
| Edition published, not yet on chain | `type:"offChainURI"` with `contract.seriesId` **and** `contract.tokenId`; `contract.uri` names the published record. |
| Off-chain certificate / PDF       | `type:"offChainURI"` and put the canonical link in `contract.uri`, with `contract.metaHash` when the link is mutable; omit the chain fields. |

The link to the record is always `contract.uri`, whatever the `type`. `provenance` has no `uri` of its own, and `dependencies[].uri` names documentary dependencies, not the record.

`seriesId` is the identifier the contract itself uses for the series — whatever name the contract gives it (a series, a project, an artwork with editions). Write it as an integer when it fits in a JSON number exactly; otherwise as a decimal string.

An edition a publisher has announced but not minted — one that mints when it sells — has no token to name, and is still one of the editions a consumer groups by its series. State it as `offChainURI` keeping the `seriesId` and the `tokenId` it will take: the identity is settled, only the chain has not caught up, and leaving it out drops the edition from the series instead. `contract.uri` names whatever record stands for it until then. Consumers **MUST NOT** read such a `tokenId` as a claim that the token exists on chain; verify it only when `type` says the chain holds it.

`dependencies` exist **solely for documentation & verification**—players **MUST NOT** fetch or execute remote code at runtime.

---

## 7 · Security & Authentication

### 7.1 Playlist Signature

#### 7.1.1 Multi-Signature Chain (v1.1.0+)

DP-1 supports a **signature chain** model where multiple entities can independently sign a playlist, establishing trust through multiple attestations. Each signature is computed over the canonical form of the entire playlist (excluding the `signature` and `signatures` fields themselves).

**Canonical form** ≡ [JSON Canonicalization Scheme (JCS), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)] UTF‑8 (no BOM, LF line terminators).

Playlists using the multi-signature model include a top-level `signatures` array:

```json
{
  "dpVersion": "1.1.0",
  "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
  "title": "Sunset Collector Loop",
  "items": [...],
  "signatures": [
    {
      "alg": "ed25519",
      "kid": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
      "ts": "2025-10-17T07:02:03Z",
      "payload_hash": "sha256:0f4c0d87a1b2c3d4e5f6071829a1b2c3d4e5f6071829a1b2",
      "role": "curator",
      "sig": "X2b7cX2sOe7lJrN2R2d1xgIBt2m5jXvKxQx3k8Cq9fU"
    },
    {
      "alg": "ed25519",
      "kid": "did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rqqC2DoEvwW",
      "ts": "2025-10-17T09:15:22Z",
      "payload_hash": "sha256:0f4c0d87a1b2c3d4e5f6071829a1b2c3d4e5f6071829a1b2",
      "role": "feed",
      "sig": "Y7d3aY9tPf2mKsO3S5e2yhJCu3n6kYwLyRy4l9Dr0gV"
    }
  ]
}
```

**Signature Object Fields:**

| Field           | Type   | Description                                                                                                                                                                                   |
| :-------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alg`           | string | Signature algorithm. **REQUIRED.** Supported: `"ed25519"`, `"eip191"` (Ethereum signed message), `"ecdsa-secp256k1"`, `"ecdsa-p256"`, etc.                                                      |
| `kid`           | string | Key identifier in [W3C DID](https://www.w3.org/TR/did-core/) format (e.g., `did:key:z6Mk…`). **REQUIRED.** Used to retrieve the public key for verification.                                 |
| `ts`            | string | ISO 8601 timestamp (UTC) when the signature was created. **REQUIRED.** Format: `YYYY-MM-DDTHH:MM:SSZ`.                                                                                       |
| `payload_hash`  | string | SHA-256 hash of the canonical playlist payload (excluding `signature` and `signatures` fields). **REQUIRED.** Format: `sha256:<64-char-lowercase-hex>`.                                      |
| `role`          | string | Role of the signing entity. **REQUIRED.** See role definitions below.                                                                                                                         |
| `sig`           | string | Base64url-encoded signature bytes (no padding `=`). **REQUIRED.** The signature is computed over the `payload_hash` value (not the entire playlist), enabling efficient verification chains. |

**Signature Roles:**

| Role          | Definition                                                                                                                  |
| :------------ | :-------------------------------------------------------------------------------------------------------------------------- |
| `curator`     | The individual or entity who authored/curated the playlist.                                                                 |
| `feed`        | The feed server operator distributing the playlist. Feed signatures establish the distribution chain of trust.              |
| `agent`       | An automated service or AI agent that created the playlist on behalf of a user or institution.                              |
| `institution` | A museum, gallery, or cultural institution that endorses or officially publishes the playlist.                              |
| `licensor`    | An entity with licensing authority over the playlist content (e.g., rights holder, publisher).                              |

**Signature Verification:**

1. Players **MUST** verify at least one signature with role `"feed"` or `"curator"` (and `agent` if it's presented).
2. Players **SHOULD** verify all signatures present in the chain.
3. For each signature:
   - Compute the canonical form of the playlist (excluding `signature` and `signatures` fields)
   - Compute SHA-256 hash and verify it matches `payload_hash`
   - Resolve the public key from `kid` (via DID resolution, local keystore, or JWKS endpoint)
   - Verify `sig` using the specified `alg` and resolved public key
4. Players **MAY** establish role-specific trust policies (e.g., require both `curator` and `institution` signatures for institutional displays).
5. Signature timestamps (`ts`) establish ordering but are **not** enforced cryptographically; players **SHOULD** verify timestamps are reasonable (not future-dated beyond clock skew tolerance of ~5 minutes).

#### 7.1.2 Legacy Signature (v1.0.x, Deprecated)

**Deprecated as of v1.1.0.** The legacy single-signature format remains supported for backward compatibility but SHOULD NOT be used in new playlists.

```json
{
  "dpVersion": "1.0.0",
  "signature": "ed25519:a4f3c2d1b9e8f7a6b5c4d3e2f1a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1"
}
```

Legacy signature verification:
- Canonical form ≡ [JSON Canonicalization Scheme (JCS), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)] UTF‑8 (no BOM, LF line terminators)
- SHA‑256 → Ed25519 signature → embed as: `"signature": "ed25519:<hex>"`
- Players verify against a trusted Ed25519 public key obtained from:
  - **(a)** Player's embedded trust store
  - **(b)** Feed endpoint's JWKS (JSON Web Key Set) at `/.well-known/jwks.json`
  - **(c)** Root of signed *.dp1c* capsule
- The public key is **not** transmitted inside the playlist

#### 7.1.3 Player Implementation Requirements

**Dual-signature support:**

1. Players implementing v1.1.0+ **MUST** support both `signatures` (multi-sig) and `signature` (legacy).
2. When both fields are present, players **MUST** prioritize `signatures` and **MAY** ignore the legacy `signature` field (though verifying both is recommended).
3. Players **MUST** reject playlists where neither `signature` nor `signatures` is present (unless `license` mode is `"open"` and the player has been configured to allow unsigned open playlists).

**Key resolution:**

- For legacy `signature`: use feed server's JWKS endpoint (`GET /.well-known/jwks.json`) or pre-configured trust anchors.
- For `signatures`: resolve each `kid` using:
  - DID resolution (e.g., `did:key` method extracts the key directly from the identifier)
  - Feed server's JWKS endpoint (if `kid` references a JWKS key ID)
  - Local trust store or pinned keys
- Players **SHOULD** cache resolved keys and **SHOULD** implement reasonable TTLs for remote key fetches.

**Error handling:**

- If signature verification fails, emit `sigInvalid` error (see §14).
- Players **MAY** distinguish between `legacySigInvalid` and `multiSigInvalid` in logs/telemetry but SHOULD present a unified error to end users.
- Players **MAY** implement a "partial trust" mode where playlists with some (but not all) valid signatures are accepted with a warning, subject to local policy.



### 7.2 License Modes

| Mode           | Behaviour                                            |
| :------------- | :--------------------------------------------------- |
| `open`         | No viewer auth.                                      |
| `token`        | Wallet proof (EIP‑4361, Tezos Signed Payload, etc.). |
| `subscription` | Bearer JWT to operator’s `/verify`.                  |

---

## 8 · Transport Profile

| Aspect      | Requirement                                       |
| :---------- | :------------------------------------------------ |
| HTTP        | 1.1 & 2, TLS ≥1.2.                                |
| Range       | **SHOULD** support `Range: bytes=`.               |
| IPFS        | Gateways OK; native libp2p optional.              |
| Offline     | `file://` and UNC paths allowed.                  |
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

| Badge                  | Requirement                                |
| :--------------------- | :----------------------------------------- |
| **DP‑1 Compatible**    | JSON‑Schema pass \+ demo capsules display. |
| **DP‑1 Deterministic** | Plus 8‑week Regenerate 2030 test.          |

*Alpha must earn the **DP‑1 Compatible** badge; Deterministic comes in RC.*

---

## 12 · Versioning & Extensions

*SemVer*; players warn on major mismatch. Major bumps signal breaking changes, minor are additive, patch is editorial.
*Extension Registry* (`/extensions/registry.json`) governs new chains, display fields, etc.

---

## 13 · Governance Roadmap

2025‑06 → 2026‑06: canonical repo under Feral File.
2026‑07: 5‑seat Steering Committee.

---

## 14 · Error Codes (player → UI)

| Code                | Scenario           | User message                         |
| :------------------ | :----------------- | :----------------------------------- |
| `playlistInvalid`   | Schema fail        | “Playlist malformed.”                |
| `sigInvalid`        | Signature mismatch | “Invalid feed signature.”            |
| `licenseDenied`     | Auth failed        | “You don’t own access.”              |
| `reproMismatch`     | Hash drift         | “Artwork may not display correctly.” |
| `sourceUnreachable` | Fetch fail         | “Network error loading artwork.”     |

---

## 15 · Directory API (beta)

*REST‑ish JSON, paginated.*

### 15.1 Playlists

```
GET /api/v1/playlists?chain=tezos&type=code&limit=50
```

Returns array of playlist summaries.

A directory that implements Playlist Extension §3.7 leaves out every playlist its owner marked `"visibility": "unlisted"`. It lists a playlist only when `visibility` is absent or exactly `public`, so a value it does not recognize keeps the playlist out. An unlisted playlist is still served by its own address.

---

## 16 · Changelog

* **Editorial (2026-10-30)** §5 pins `frameHash.phash`: a 64-bit DCT perceptual hash, which producers **MUST** write as `0x` and 16 hex digits, compared by Hamming distance. The schema said only `^0x[a-f0-9]+$`, any length and no algorithm, so two conforming producers could emit hashes that cannot be compared. The schema pattern is unchanged, so nothing previously valid changes; the field description states the pin.

* **Editorial (2026-10-30)** §6 names `contract.uri` as the one place a provenance block links its record, for `offChainURI` as for the other types. The "Off-chain certificate / PDF" row said to put the link in `uri` and omit `contract`, which left it nowhere the schema declares; it now keeps `contract`, carrying `uri` (and `metaHash` when the link is mutable). Prose only — the schema already allowed `contract.uri` on `offChainURI`, and nothing previously valid changes.

* **Editorial (2026-10-28)** §15 Directory API: directories leave out playlists marked `"visibility": "unlisted"` (Playlist Extension §3.7), and list a playlist only when `visibility` is absent or exactly `public`. No schema change; the field is defined by the Playlist Extension.

* **Editorial (2026-10-27)** §6 Field guidance gained a row for an **edition published but not yet on chain**: `offChainURI` keeping `contract.seriesId` and the `contract.tokenId` the edition will take, so an unminted edition is still named by the series a consumer groups by. Prose only — the schema already allowed `contract` on `offChainURI`, and nothing previously valid changes.

* **Editorial (2026-10-20)** Display and identity fields that producers already hold but could not express:
  * `display.imageRendering` (`auto` | `pixelated`) on `DisplayPrefs` (§4) and on the Ref Manifest's `controls.display`, for pixel art that must keep hard edges when scaled.
  * `provenance.contract.seriesId` accepts a string as well as an integer (§6), for series identifiers too large for a JSON number to hold exactly — 256-bit ids, the same reason `tokenId` is a string. Loosening only: every previously valid document remains valid, but consumers **MUST** accept either type.
  * Ref Manifest refVersion 1.2.0: one `Entity` model for every place DP-1 names someone, plus `Link` types, `controls.permissions` and `metadata.medium` — see [ref-manifest.md](ref-manifest.md) §12.

* **Editorial (2026-08-12)** Ref-manifest schema (`schemas/ref-manifest.json`): `Thumbnail.w` and `Thumbnail.h` are now **optional** (`required` relaxed from `["uri", "w", "h"]` to `["uri"]`) — producers holding only a bare thumbnail URL omit dimensions rather than guess; when present they are the intrinsic image dimensions in pixels. Loosening only: every previously valid document remains valid, but consumers **MUST** treat `w`/`h` as possibly absent.

* **Editorial (2026-07-31)** Removed the beta Playlist-Group (Exhibition) object: §15.2, the `playlist-group.json` schema, and the terminology entry. Channels (extensions/channels) superseded it before it saw production use — zero groups were ever published; the channels extension no longer references it. Historical changelog entries below are unchanged.

* **v1.1.0 (2025-10-17)** Introduced **multi-signature chain** model with new `signatures` array field. Supports multiple signing entities with distinct roles (`curator`, `feed`, `agent`, `institution`, `licensor`). Signatures use DID-based key identifiers (`kid`) and support multiple algorithms (`ed25519`, `eip191`, `ecdsa-p256`,etc.). Legacy single `signature` field deprecated but remains supported for backward compatibility. Players can verify keys via DID resolution, JWKS endpoints, or local trust stores. See §7.1 for complete specification.

* **v1.0.1 (2025-10-16)** Published metadata and controls manifest standard format v0.1.0.

* **v1.0.0 (2025-08-05)** Finalized and published the official v1.0.0.

* **v0.04 (2025‑07‑08).** Replaced ad‑hoc whitespace rules with **JCS (RFC 8785)** canonical form for playlist signatures; clarified external public‑key distribution; limited device‑level edits to fields flagged **`userOverrides`**; editorial only—no schema or wire‑format changes.

* **v0.03 (2025-06-27).** Added **`metaHash` (SHA-256)** — optional, but *required* when `uri` is mutable; players may verify it asynchronously. Clarified **Mutability & Authority** rules; removed deprecated `scheme/ref` example.

* **v0.02 (2025‑06‑06)**. Unit rule for `margin`; example updated. Clarified behaviour of `background`, `autoplay`, and keyboard enums. Renamed `border` → `margin` for consistency. Provenance refined (`seriesId`, optional `tokenId`, `dependencies`, immutability).

* **v0.01 (2025‑06‑03)** – Added `defaults` inheritance, `ref` / `override`, and Playlist‑Group (Exhibition) API.


---

### Appendix A · Playlist JSON‑Schema (excerpt)

`defaults`, `ref`, and inheritance rules implemented in `playlist‑1.0.0.json`. See repository for full source.

