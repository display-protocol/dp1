# DP‑1 Specification (v1.0.0)

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
| **Exhibition / Playlist‑Group** | A curator‑authored collection of one or more playlists with shared metadata (outside DP‑1 core, see §15).                                                                                                                                               |
| **Feed Operator**               | Entity hosting and signing a playlist endpoint.                                                                                                                                                                                                         |

---

## 3 · Playlist JSON

### 3.1 Top‑Level Schema

```
{
  "dpVersion": "1.0.0",          // SemVer
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
  "signature": "ed25519:<hex>"
}
```

*Inheritance rule*: each `PlaylistItem` starts with a copy of `defaults`; any fields set in the item replace the inherited values.

**Authority model**  
The Ed25519 public key that signs the first accepted version of a playlist defines the *creator*. *See §7.1 for signature rules.*

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

---

## 4 · Display Preferences (`display`)

**Unit rule** – Length fields (e.g., `margin`) accept either:

-  **number** → pixels (CSS‑px, device‑independent)  
-  **string** → `%(vw\|vh)` units (`"5%"`, `"3vw"`, `"2vh"`) Players **MUST** support px, %, vw, vh and **MUST** reject unknown units.

| Field                   | Type             | Default    | Behaviour                                                                                                                                                                    |
| :---------------------- | :--------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaling`               | "fit"            | "fill"     | "stretch"                                                                                                                                                                    | "auto" | from defaults or "fit" | fit: entire artwork visible with letterbox; fill: fill viewport cropping if needed; stretch: fill both axes ignoring aspect; auto: player decides based on device/profile. |
| `margin`                | number or string | 0          | Even margin around artwork. Number = px; string supports %, vw, vh (computed relative to viewport).                                                                          |
| `background`            | string           | "\#000000" | Hex/RGB color used outside the artwork and beneath any transparent pixels. Special value "transparent" lets the underlying screen show through.                              |
| `autoplay`              | bool             | true       | Attempt to start playback automatically. Player MUST fall back to waiting for a first user gesture when the runtime blocks WebAudio/video autoplay (e.g., browser policies). |
| `loop`                  | bool             | true       | Repeat automatically.                                                                                                                                                        |
| `interaction.keyboard`  | string\[\]       | \[\]       | Allowed keys, using [W3C UI Events code values](https://www.w3.org/TR/uievents-code/) (e.g., `"ArrowLeft"`, `"Space"`, `"KeyW"`). Players MUST ignore unknown codes.         |
| `interaction.mouse`     | object           | all false  | `{click, scroll, drag, hover}` booleans.                                                                                                                                     |
| `userOverrides.<field>` | bool             | true       | Viewer may change field if true.                                                                                                                                             |

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

---

## 6 · Provenance (`provenance`)

Each `PlaylistItem` **MAY** embed a `provenance` object that links the rendered asset to an on-chain or off-chain source of truth. The structure separates **where** the truth lives (`type`) from **how** the contract is implemented (`standard`) and groups all contract-specific data under a single `contract` object.

```
"provenance": {
  "type": "onChain"           // onChain | seriesRegistry | offChainURI
                              // onChain     → explicit contract object
                              // seriesRegistry → parent collection in SeriesRegistry
                              // offChainURI   → uri points to canonical JSON/PDF

  /* present when type == "onChain"  OR "seriesRegistry" */
  "contract": {
    "chain":    "evm" | "tezos" | "bitmark" | "other",
    "standard": "erc721" | "erc1155" | "fa2" | "other",   // OPTIONAL
    "address":  "0x61d45475fe81ef46bdd8093b5c73efee03167e0", // OPTIONAL
    "seriesId": 777,                 // OPTIONAL
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

* `uri` and any `dependencies.uri` **SHOULD** be content-addressed (IPFS CID, Arweave TXID) to guarantee immutability.  
* If an `https://` or `eth://` URI is used, **any** change to the referenced data **MUST** result in a new manifest, and the playlist **MUST** be re-signed.  
* When `metaHash` is present, players **SHOULD** verify it; implementers **MAY** perform this check asynchronously (i.e., without blocking first render).  
* Only the **playlist signer** has authority to update the `provenance` block.

### Field guidance

| Scenario                          | How to populate                                                            |
| :-------------------------------- | :------------------------------------------------------------------------- |
| Entire series only                | `seriesRegistry` \+ `contract.seriesId`; omit `tokenId`.                   |
| One specific edition              | `seriesRegistry` or `onChain` with `seriesId` **and** `tokenId`.           |
| Contract with no “series” concept | `type:"onChain"` and provide `uri`/`address`; omit `seriesId`.             |
| Off-chain certificate / PDF       | `type:"offChainURI"` and put the canonical link in `uri`; omit `contract`. |

`dependencies` exist **solely for documentation & verification**—players **MUST NOT** fetch or execute remote code at runtime.

---

## 7 · Security & Authentication

### 7.1 Playlist Signature

Canonical form ≡ **\[JSON Canonicalization Scheme (JCS), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)\]** UTF‑8 (no BOM, LF line terminators).  
SHA‑256 → Ed25519 → embed as: `"signature": "ed25519:<hex>"`.

Players MUST verify the Ed25519 signature against a trusted key that is either **(a)** shipped with the player, **(b)** pinned to the feed endpoint during provisioning, or **(c)** stored in the root of a signed *.dp1c* capsule.  
The key itself is **not** transmitted inside the playlist.

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
  "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
  "slug": "generative‑geometry‑2025",
  "title": "Generative Geometry",
  "curator": "Alice Example",
  "summary": "Exploring procedural form…",
  "playlists": [
    "https://feed.feralfile.com/geom‑p1/playlist.json",
    "https://feed.feralfile.com/geom‑p2/playlist.json"
  ],
  "created": "2025-05-20T00:00:00Z",
  "coverImage": "ipfs://bafyb…/cover.jpg"
}
```

Players iterate playlists in `playlists[]` order by default; exhibition‐level scheduling extensions may appear in future XP‑1 spec.

---

## 16 · Changelog

* **v1.0.0 (2025-08-05)** Finalized and published the official v1.0.0.

* **v0.04 (2025‑07‑08).** Replaced ad‑hoc whitespace rules with **JCS (RFC 8785)** canonical form for playlist signatures; clarified external public‑key distribution; limited device‑level edits to fields flagged **`userOverrides`**; editorial only—no schema or wire‑format changes.

* **v0.03 (2025-06-27).** Added **`metaHash` (SHA-256)** — optional, but *required* when `uri` is mutable; players may verify it asynchronously. Clarified **Mutability & Authority** rules; removed deprecated `scheme/ref` example.

* **v0.02 (2025‑06‑06)**. Unit rule for `margin`; example updated. Clarified behaviour of `background`, `autoplay`, and keyboard enums. Renamed `border` → `margin` for consistency. Provenance refined (`seriesId`, optional `tokenId`, `dependencies`, immutability).  
    
* **v0.01 (2025‑06‑03)** – Added `defaults` inheritance, `ref` / `override`, and Playlist‑Group (Exhibition) API.


---

### Appendix A · Playlist JSON‑Schema (excerpt)

`defaults`, `ref`, and inheritance rules implemented in `playlist‑1.0.0.json`. See repository for full source.

