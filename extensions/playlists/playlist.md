# DP-1 Playlist Extension (v0.2.0)

*Extensions to DP-1 playlists for dynamic item fetching, enhanced metadata, and time-based scheduling.*

**Specification version:** 0.2.0  
**Status:** Draft Extension  
**DP-1 compatibility:** v1.0.0+  
**Published:** 2026-03-11  
**Updated:** 2026-07-21

---

## 1 · Purpose & Scope

The **Playlist Extension** provides the following enhancements to DP-1 playlists:

1. **Dynamic Query**: Machine-executable interface for fetching playlist items dynamically from external indexers
2. **Enhanced Metadata**: Additional fields for curators, summary, and cover images
3. **Note (experimental)**: Optional intermission card with short artist-authored text, shown before the playlist or before an item
4. **displayAt Scheduling**: Optional time-based filtering so the device control layer can determine which items are active at a given time (for example, Daily-style one artwork per day)

These extensions enable playlists to transition from static collections to live, personalized feeds while maintaining backwards compatibility with DP-1 core.

### 1.1 Relationship to Core DP-1

- **Extends:** Playlist schema (DP-1 §3)
- **Transport:** Standard DP-1 transport (§8)
- **Signatures:** Covered by DP-1 playlist signatures (§7.1)
- **Versioning:** Independent extension versioning

---

## 2 · Terminology

| Term | Definition |
|:-----|:-----------|
| **Dynamic Query** | Machine-executable configuration for fetching playlist items from external indexers in real-time. |
| **Resolution Profile** | Versioned interface contract defining request/response format (e.g., `graphql-v1`, `https-json-v1`). |
| **Template Variable** | Placeholder in query configuration that gets hydrated with runtime data (e.g., `{{viewer_address}}`). |
| **Indexer** | External service providing blockchain data or content discovery via standardized query interfaces. |
| **Entity Format** | Unified structure for representing people or organizations with verifiable identities. |
| **Note** | Optional intermission object (`text`, optional `duration`). Experimental; may be removed or changed in a later version. |
| **Intermission** | A dedicated player screen or page that shows the note before the playlist starts or before an individual item loads. |
| **displayAt** | Optional ISO 8601 datetime on a playlist item indicating when that item becomes eligible for the active set. |
| **Active Set** | When `schedule.byDisplayAt` is `true`, the subset of playlist items the device control layer sends to the player at the current time. |
| **Schedule** | Playlist-level object that opts into scheduling behavior (currently `byDisplayAt`). |
| **Playback device** | The display device whose control layer runs `byDisplayAt` filtering and whose local clock defines timezone-less `displayAt` values. |

---

## 3 · Extended Playlist Schema

### 3.1 Playlist JSON with Extensions

```json
{
  "dpVersion": "1.0.0",
  "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
  "title": "Generative Geometry: Part 1",
  "slug": "generative-geometry-part-1",
  "created": "2025-06-01T00:00:00Z",
  
  "curators": [
    {
      "name": "Guest Curator",
      "key": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
      "url": "https://guest-curator.example.com"
    }
  ],
  "summary": "Part 1 explores fundamental geometric forms through algorithmic processes…",
  "coverImage": "ipfs://bafybeig.../p1-cover.jpg",

  "note": {
    "text": "Rhythm and stillness are paired—treat the pauses as part of the work.",
    "duration": 15
  },

  "dynamicQuery": {
    "profile": "graphql-v1",
    "endpoint": "https://indexer.example.com/graphql",
    "query": "query { works(seriesId: {{series_id}}) { id title source duration provenance { contract { chain address tokenId } } } }",
    "responseMapping": {
      "itemsPath": "data.works",
      "itemSchema": "dp1/1.0"
    }
  },
  
  "items": [...],
  "signatures": [...]
}
```

### 3.2 Extended Field Reference

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `curators` | array of objects | OPTIONAL | Playlist-specific curators (who curated this playlist). Uses entity format (§3.3). |
| `summary` | string | OPTIONAL | Playlist description (1-2000 characters). |
| `coverImage` | string (URI) | OPTIONAL | Playlist cover image. Supports `ipfs://`, `https://`, `ar://` URIs. |
| `note` | object | OPTIONAL | Intermission card shown **before the playlist begins**. See §3.4. **Experimental.** |
| `schedule` | object | OPTIONAL | Scheduling controls. See §3.5. When `byDisplayAt` is `true`, the device control layer filters items by `displayAt` before playback. |
| `dynamicQuery` | object | OPTIONAL | Dynamic item fetching configuration. See §4. |

Playlist items **MAY** include an optional `note` field with the same object shape; when present, players **SHOULD** show that intermission **before loading that item** (after any prior item or intermission). Items **MAY** also include an optional top-level `displayAt` datetime (same level as `source`, **not** inside `display`). These fields are **not** part of canonical DP-1 core; they are defined only by this extension. In JSON Schema, item-level `note` and `displayAt` are validated by an **`allOf` overlay**: `extensions/playlists/schema.json` adds optional `properties.items.items.properties.note` and `properties.items.items.properties.displayAt` (see Appendix A), composed with `extensions/playlists/bundles/playlist-core-v1.1.0.json` via `playlist_with_extension.json`—the bundle’s `PlaylistItem` definition is not forked for these fields.

### 3.3 Entity Format (Curators)

This extension uses the same unified entity shape as the Channel Extension.

**Entity Object:**

```json
{
  "name": "Curator Name",
  "key": "did:key:z6Mk...",
  "url": "https://curator.example.com"
}
```

**Entity Object Fields:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | string | **REQUIRED** | Entity display name. |
| `key` | string | **REQUIRED** | Verifiable identity in DID format (e.g., `did:key:z6Mk...`). |
| `url` | string | OPTIONAL | Entity website or profile URL. |

In the Playlist Extension, this entity shape is currently used by `curators[]`.

**Example:**

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

### 3.4 Note (experimental intermission)

The **`note`** object is an **optional** intermission card: short, **artist-authored** text that can travel with the show. It is meant for moments **between works** (a label, caption, or interlude), **not** for social-style threads or comments.

**Status:** This feature is **experimental**. It **MAY** be revised, narrowed, or **deprecated in a future Playlist Extension version**. Players and publishers **SHOULD** treat it as best-effort and avoid hard dependencies on long-term stability.

**Object shape:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `text` | string | **REQUIRED** | Body copy for the intermission (1–500 characters). |
| `duration` | number (seconds) | OPTIONAL | How long the intermission page stays visible **before** the player continues. **Default: 20** when omitted. **MUST** be greater than zero when present. |

**Playlist-level `note`:** When present, players **SHOULD** render a **dedicated intermission page** (full-screen or player-defined “card”) **before** starting playback of the playlist body (including before the first static or dynamic item), for the effective duration.

**Item-level `note`:** When present on a `PlaylistItem`, players **SHOULD** render the intermission **before loading or displaying that item’s** `source`, for the effective duration, then proceed with the item as usual.

**Presentation:** Rendering (typography, progress, skip affordances) is **implementation-defined**. Players **MAY** allow the viewer to dismiss or skip early unless a future specification adds stricter rules.

**Example (item with note):**

```json
{
  "title": "Study in Blue",
  "source": "https://example.com/art/blue.html",
  "note": {
    "text": "Painted in 2024; the loop references early net art palettes.",
    "duration": 20
  }
}
```

### 3.5 displayAt Scheduling

Time-based scheduling lets a playlist carry its full catalog (including archive and future items) while the player only plays items that are **active** at the current time. This supports Daily-style playlists (one artwork per day) without Daily-specific player logic.

**Architecture (normative split):**

| Component | Responsibility |
|:----------|:---------------|
| **Publisher / app** | Ship the **full** playlist (`items` include archive and future; `schedule.byDisplayAt: true` when filtering is desired). |
| **Device control layer** (e.g. controld) | Parse `displayAt`, compute the active set, manage the timer, and **push only the active set** to the player. |
| **Player** | Play the received list with normal `duration` / `loop` rules. The player **MUST NOT** be required to interpret `displayAt` or `byDisplayAt`. |

Catalog UIs (hero, archive scroll) **MAY** keep the full playlist; only the list sent for playback **MUST** be the active set when `byDisplayAt` is `true`.

#### 3.5.1 Playlist-level `schedule.byDisplayAt`

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `schedule` | object | OPTIONAL | Playlist-level scheduling controls. |
| `schedule.byDisplayAt` | boolean | OPTIONAL | When `true`, the device control layer **MUST** filter items to an **active set** based on each item’s `displayAt` before playback. When `false` or absent, play all items normally (core behavior) and ignore `displayAt` for filtering. |

```json
{
  "title": "Daily",
  "schedule": { "byDisplayAt": true },
  "items": [ ... ]
}
```

#### 3.5.2 Item-level `displayAt`

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `displayAt` | string (ISO 8601 subset) | OPTIONAL | When this item becomes eligible for the active set. Accepted wire forms: date only (`YYYY-MM-DD`), local datetime with seconds and no timezone (`YYYY-MM-DDThh:mm:ss[.frac]`), or absolute RFC 3339 `date-time` (with `Z` or numeric offset). |

**Field location:** `displayAt` is a **top-level** field on the item (same level as `source`). It is **not** inside `display`. The `display` object is for render preferences (scaling, loop, margin); `displayAt` is scheduling metadata.

**Timezone rules (normative):** Implementations that filter by `displayAt` **MUST** resolve wire values as follows:

| Format | Example | Behavior |
|:-------|:--------|:---------|
| With timezone (`Z`) | `2026-07-21T00:00:00Z` | Absolute — global sync |
| With offset | `2026-07-21T09:00:00+07:00` | Absolute — global sync |
| Without timezone | `2026-07-21T00:00:00` | Playback-device local time |
| Date only | `2026-07-21` | Treat as `T00:00:00` playback-device local |

**Clock authority:** “Device local” **MUST** mean the local timezone of the **playback device** that runs the schedule filter (the device control layer on the wall display), **not** the casting client or phone. Absolute (`Z` / offset) values **MUST** compare as the same UTC instant on every device.

**Publisher controls behavior:**

- Global release (same instant worldwide): include timezone (`Z` or offset)
- Local release (each playback device’s local time): omit timezone

**Example item:**

```json
{
  "title": "Study in Blue",
  "source": "https://example.com/art/blue.html",
  "displayAt": "2026-07-21T00:00:00Z",
  "note": { "text": "Curated by Casey Reas." },
  "display": {
    "scaling": "fit",
    "loop": true
  }
}
```

#### 3.5.3 Active set logic

When `schedule.byDisplayAt` is `true`, the device control layer **MUST** compute the **active set** from the **effective item list** (see §3.5.6 for `dynamicQuery`) as follows:

1. **MUST** resolve each item’s `displayAt` to an **instant** using §3.5.2. Comparisons against `now` **MUST** use those instants — **not** lexical string comparison of the wire values.
2. Let *past* be the set of items that have a resolvable `displayAt` whose instant ≤ now. If *past* is empty, there is no same-release timed cohort; skip to step 4 with an empty timed cohort.
3. Otherwise **MUST** set `max_instant` to the maximum resolved instant in *past*, and take the **timed cohort** = all items whose resolved instant equals `max_instant` (same release even when wire strings differ, e.g. `2026-07-21T00:00:00Z` and `2026-07-21T07:00:00+07:00`).
4. **MUST** form the active set as: timed cohort **plus** every item with **no** `displayAt` (evergreen / always eligible).
5. **MUST** preserve original playlist order among the selected items.
6. **MUST** send **only** the active set to the player for playback. Older archive and future items **MUST** remain in the full playlist document for catalog UIs but **MUST NOT** be included in the playback list.
7. **MUST** arm a transition timer per §3.5.4.

**One-sentence summary:** Active set = items from the most recent release that has already happened + items with no time restriction.

**Concrete example** (now = 2026-07-22 14:00 playback-device local):

```text
Playlist items (in order):
  [0] Intro      — no displayAt
  [1] Work A     — displayAt: 2026-07-21
  [2] Work B     — displayAt: 2026-07-22
  [3] Work C     — displayAt: 2026-07-22  (same day as B)
  [4] Outro      — no displayAt
  [5] Work D     — displayAt: 2026-07-23
```

- Items with resolved instant ≤ now: A, B, C → `max_instant` = start of 2026-07-22 (playback-device local)
- Timed cohort (same `max_instant`): B, C
- Evergreen: Intro, Outro
- Active set (original order): **Intro, Work B, Work C, Outro**
- Excluded: Work A (older archive), Work D (future)

#### 3.5.4 Timer-based transitions

After computing the active set, the device control layer **MUST**:

1. Find `next_instant` = the minimum resolved `displayAt` instant where that instant > now (if any).
2. If `next_instant` exists, set a timer for (`next_instant` − now).
3. When the timer fires (or when the device wakes / boots while a scheduled playlist is loaded): recompute the active set, **push the new list to the player immediately**, and set a new timer.
4. If there is no future `displayAt` instant, do not set a timer; hold the current active set until the playlist changes.

There is no polling and no midnight-specific logic. Scheduling is driven by the actual `displayAt` values (midnight, 09:00, global launch, etc.).

**Apply policy when the active set changes (normative):** Pushing a new active set **MUST** replace the player’s current playback list **immediately**. It **MUST NOT** wait for the current item’s `duration` or `loop` cycle to finish. Crossing a `displayAt` threshold is **not** duration expiry: even if the current item would otherwise loop indefinitely or has `duration` longer than the remaining time until the next release, the new active set **MUST** take effect when the timer fires (artwork changes).

#### 3.5.5 Duration, loop, and edge cases

- `duration` and `loop` **MUST** apply **only within** the current active set (advancing among concurrently active items).
- If every resolvable `displayAt` is still in the future, the active set **MUST** be only items without `displayAt`.
- If the active set is empty, the player **MAY** idle or hold the last frame (implementation-defined).
- Multiple items with the same resolved `displayAt` instant **MUST** all be included.
- An item whose `displayAt` cannot be resolved to an instant (invalid calendar/clock value after accepting the wire pattern) **MUST** be treated as **not eligible** for the timed cohort and **MUST NOT** contribute a timer candidate (it is excluded until corrected; it is **not** evergreen).
- Implementations that do not understand `byDisplayAt` **SHOULD** ignore it and play the full list (degraded but functional).

#### 3.5.6 Composition with `dynamicQuery`

When both `schedule.byDisplayAt` and `dynamicQuery` are present:

1. Fast-start static items (§4.6.1) **MUST** still be filtered to an active set before they are sent for playback — do not flash archive or future static items, then filter later.
2. After dynamic enrichment merges or appends items, the device control layer **MUST** recompute the active set over the **full effective item list** (static + accepted dynamic items) and **MUST** retarget the transition timer.
3. Recompute after enrichment **MUST** follow the same immediate-push apply policy as §3.5.4 (replace the playback list; do not wait for duration/loop solely because enrichment completed). Mid-item disruption rules from §4.6.1 still apply only to *how* the player swaps media after it receives the new list — the control layer **MUST** still send the updated active set promptly.

#### 3.5.7 Example: Daily playlist

See also `extensions/playlists/examples/daily-by-display-at.json` (same item order and days as below).

```json
{
  "title": "Daily",
  "schedule": { "byDisplayAt": true },
  "items": [
    {
      "title": "Evergreen Intro",
      "source": "https://cdn.example.com/intro.html"
    },
    {
      "title": "Day 1 Work",
      "source": "https://cdn.example.com/day1.html",
      "displayAt": "2026-07-21T00:00:00",
      "note": { "text": "Curated by Casey Reas." }
    },
    {
      "title": "Day 2 Work",
      "source": "https://cdn.example.com/day2.html",
      "displayAt": "2026-07-22T00:00:00",
      "note": { "text": "Exploring generative landscapes." }
    },
    {
      "title": "Day 3 Work",
      "source": "https://cdn.example.com/day3.html",
      "displayAt": "2026-07-23T00:00:00",
      "note": { "text": "A study in color and form." }
    }
  ]
}
```

**Behavior** (playback-device local time; no timezone on `displayAt`):

| Playback-device local time | Active set (original order) |
|:--------------------------|:----------------------------|
| 2026-07-21, 10:00 | Evergreen Intro, Day 1 Work |
| 2026-07-22, 00:00 (timer fires → immediate push) | Evergreen Intro, Day 2 Work |
| 2026-07-23, 00:00 (timer fires → immediate push) | Evergreen Intro, Day 3 Work |

---

## 4 · Dynamic Query

The `dynamicQuery` extension enables playlists to fetch items dynamically from external indexers. It provides a **deterministic, machine-executable interface** for real-time content discovery.

### 4.1 Core Principles

**Machine-Executable Interface**  
Defines a rigid contract for request construction and response parsing, moving beyond opaque metadata.

**Fast Start, Rich Upgrade**  
Players **MUST** render static playlist items immediately and execute the `dynamicQuery` asynchronously to enrich the view.

**Deterministic Resolution**  
Standardized template variables and protocol profiles ensure different players produce identical requests for the same user context.

### 4.2 Dynamic Query Schema

```json
"dynamicQuery": {
  "profile": "graphql-v1",
  "endpoint": "https://indexer.example.com/graphql",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "query": "query { userWorks(address: \"{{viewer_address}}\", chain: \"{{chain}}\", limit: {{limit}}) { id title source duration } }",
  "responseMapping": {
    "itemsPath": "data.userWorks",
    "itemSchema": "dp1/1.0"
  }
}
```

**Dynamic Query Fields:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `profile` | string | **REQUIRED** | Resolution profile with version: `"https-json-v1"`, `"graphql-v1"`. |
| `endpoint` | string (URI) | **REQUIRED** | Indexer service endpoint URL. |
| `method` | string | OPTIONAL | HTTP method (`"GET"`, `"POST"`). Default: `"POST"` for graphql-v1, `"GET"` for https-json-v1. |
| `headers` | object | OPTIONAL | HTTP headers to include in the request. |
| `query` | string | OPTIONAL | Query payload. For `graphql-v1`: GraphQL query string. For `https-json-v1`: URL query parameters (GET) or request body template (POST). |
| `responseMapping` | object | **REQUIRED** | Instructions for parsing the response. See §4.6. |

### 4.3 Resolution Profiles (v1)

The `v1` suffix defines the versioned interface contract for reliability and long-term hardware support.

#### 4.3.1 `https-json-v1`

REST-style profile supporting standard HTTP methods with JSON payloads.

**Request format:**
- Method: `GET` or `POST`
- Headers: Custom headers from `headers` field
- Query string (GET): Players hydrate `{{...}}` templates in `query` field, then append to endpoint URL
- Body (POST): Players hydrate `{{...}}` templates in `query` field, then parse as JSON body

**Response format:**
- JSON object
- Items extracted via `responseMapping.itemsPath`

**Example (GET with query parameters):**
```json
"dynamicQuery": {
  "profile": "https-json-v1",
  "endpoint": "https://api.example.com/artworks",
  "method": "GET",
  "query": "chain=ethereum&owner={{viewer_address}}&limit=20",
  "responseMapping": {
    "itemsPath": "artworks",
    "itemSchema": "dp1/1.0"
  }
}
```

**Hydration example:**
- Before: `"query": "chain=ethereum&owner={{viewer_address}}&limit=20"`
- After: `GET https://api.example.com/artworks?chain=ethereum&owner=0xabc123...&limit=20`

**Example (POST with JSON body):**
```json
"dynamicQuery": {
  "profile": "https-json-v1",
  "endpoint": "https://api.example.com/artworks/query",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "query": "{\"filter\": {\"owner\": \"{{viewer_address}}\", \"chain\": \"ethereum\"}}",
  "responseMapping": {
    "itemsPath": "data.artworks",
    "itemSchema": "dp1/1.0"
  }
}
```

**Hydration example:**
- Before: `"query": "{\"filter\": {\"owner\": \"{{viewer_address}}\", \"chain\": \"ethereum\"}}"`
- After: Request body `{"filter": {"owner": "0xabc123...", "chain": "ethereum"}}`

#### 4.3.2 `graphql-v1`

Profile for executing GraphQL queries with versioned schema.

**Request format:**
- Method: `POST`
- Headers: `Content-Type: application/json`
- Players hydrate `{{...}}` templates in `query` field
- Body: GraphQL query sent in standard envelope format

**Response format:**
- Standard GraphQL response envelope:
  ```json
  {
    "data": { ... },
    "errors": [ ... ]
  }
  ```

**Example:**
```json
"dynamicQuery": {
  "profile": "graphql-v1",
  "endpoint": "https://indexer.example.com/graphql",
  "query": "query { ownedWorks(address: \"{{viewer_address}}\") { id title source } }",
  "responseMapping": {
    "itemsPath": "data.ownedWorks",
    "itemSchema": "dp1/1.0"
  }
}
```

**Hydration example:**
- Before: `"query": "query { ownedWorks(address: \"{{viewer_address}}\") { id title source } }"`
- After: Request body `{"query": "query { ownedWorks(address: \"0xabc123...\") { id title source } }"}`

### 4.4 Template Variable Hydration

Players **MUST** hydrate template placeholders directly in the `query` string before execution.

**Standard Template Variables:**

| Variable | Type | Description | Example |
|:---------|:-----|:------------|:--------|
| `{{viewer_address}}` | string | Active wallet address of the user. | `"tz1..."` or `"0x..."` |
| `{{chain}}` | string | Target blockchain. | `"ethereum"`, `"tezos"`, `"bitmark"` |
| `{{limit}}` | integer | Maximum number of items to return. | `20`, `50` |
| `{{series_id}}` | integer | Series or collection identifier. | `42`, `777` |

**Hydration rules:**
- Template variables use double curly braces: `{{variable_name}}`
- Players **MUST** replace all `{{...}}` templates in the `query` field before sending request
- If a template cannot be resolved, players **MUST** fail gracefully (skip query, show static content)
- If no `{{...}}` templates are present in query, it is used as-is (static query)
- Custom variables beyond the standard set are **NOT** supported in v0.2.0

**Example hydration (GraphQL):**

Before:
```json
"query": "query { works(address: \"{{viewer_address}}\", limit: {{limit}}) { id title } }"
```

After (with user wallet connected):
```json
"query": "query { works(address: \"0xabc123...\", limit: 20) { id title } }"
```

**Example hydration (REST):**

Before:
```json
"query": "owner={{viewer_address}}&chain={{chain}}"
```

After (with user wallet connected):
```json
"query": "owner=0xabc123...&chain=ethereum"
```

### 4.5 Response Mapping

The `responseMapping` object defines how to extract playlist items from the indexer response.

**Response Mapping Fields:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `itemsPath` | string | **REQUIRED** | JSON path to the array of items (dot notation). |
| `itemSchema` | string | **REQUIRED** | Schema identifier referencing DP-1 version: `"dp1/1.0"`, `"dp1/1.1"`, etc. |
| `itemMap` | object | OPTIONAL | Field mapping from response to DP-1 item schema. See §4.5.1. |

**Example:**
```json
"responseMapping": {
  "itemsPath": "data.userWorks",
  "itemSchema": "dp1/1.0"
}
```

#### 4.5.1 Item Schema Validation

Response items **MUST** conform to the DP-1 PlaylistItem schema specified by the `itemSchema` version reference.

**Supported schema versions:**
- `"dp1/1.0"`: PlaylistItem schema from DP-1 v1.0.x (§3.2)
- `"dp1/1.1"`: PlaylistItem schema from DP-1 v1.1.x (§3.2)

**Minimum required fields in response:**
- `id` (UUID)
- `title` (string)
- `source` (URI)

**Optional fields:**
- `duration` (number)
- `license` (string)
- `display` (object)
- `provenance` (object)
- `note` (object; experimental intermission per §3.4)
- `displayAt` (string; ISO 8601 scheduling datetime per §3.5)
- All other PlaylistItem fields per DP-1 §3.2

**Field mapping (optional):**

If the indexer returns different field names, use `itemMap`:

```json
"responseMapping": {
  "itemsPath": "artworks",
  "itemSchema": "dp1/1.0",
  "itemMap": {
    "id": "artwork_id",
    "title": "name",
    "source": "media_url"
  }
}
```

Players **MUST** transform response items using the mapping before validating against the specified DP-1 schema version.

### 4.6 Player Implementation Requirements

#### 4.6.1 Rendering Strategy

**Fast start:**
1. Players **MUST** render static playlist items immediately (target <2s)
2. Players **MUST** execute `dynamicQuery` asynchronously (non-blocking)
3. Players **MUST** continue showing static content until dynamic items are ready

**Dynamic enrichment:**
1. Validate response structure and item schema against specified DP-1 version
2. Transform items using `itemMap` (if present)
3. Merge or append dynamic items to playlist (implementation-defined)
4. Update display without disrupting current playback

#### 4.6.2 Error Handling

Players **MUST** handle failures gracefully:

| Error Condition | Required Behavior |
|:----------------|:------------------|
| Network failure | Continue playing static content, retry with exponential backoff (optional). |
| Invalid response | Log error, continue with static content, do not crash. |
| Missing template placeholder | Skip query execution, show static content. |
| Signature verification failed | Reject entire playlist per DP-1 §7.1. |
| Schema validation failed | Log error, discard invalid items, show valid items only. |

**Players MUST ensure the screen never goes dark due to dynamic query failures.**

#### 4.6.3 Caching & Rate Limiting

**Recommendations:**
- Cache dynamic query results for reasonable TTL (e.g., 5-15 minutes)
- Respect HTTP cache headers from indexer responses
- Implement rate limiting to prevent excessive API calls
- Use request deduplication for concurrent queries

### 4.7 Security & Trust

#### 4.7.1 Signed Intent

The entire `dynamicQuery` block **MUST** be:
- Part of the JCS canonical form (RFC 8785)
- Covered by the DP-1 playlist signature (§7.1)
- Verified before execution

This prevents request-tampering and ensures curator intent is preserved.

#### 4.7.2 Rights-Awareness

Players **MUST** verify `license` fields before executing queries that result in public display:

- Check license mode (`open`, `token`, `subscription`) per DP-1 §7.2
- Verify wallet ownership or subscription status before displaying restricted content
- Apply license restrictions to dynamically-fetched items

#### 4.7.3 Privacy & Data Minimization

- Players **SHOULD** only send necessary data to indexers
- Indexer endpoints **SHOULD** use HTTPS
- Players **MAY** implement allowlists for trusted indexer domains
- Players **SHOULD** provide transparency about data sharing

---

## 5 · Signatures

Playlists with extensions **MUST** be signed per DP-1 §7.1.

**Signature coverage:**
- Playlist signature covers the **entire playlist object** including all extension fields
- The `dynamicQuery` block is part of the signed payload
- Signature verification **MUST** occur before executing dynamic queries

**Canonical form:**
- JSON Canonicalization Scheme (JCS, RFC 8785)
- UTF-8 encoding (no BOM)
- LF line terminators
- Excludes `signature` and `signatures` fields

---

## 6 · Indexer Integration

### 6.1 For Indexer Providers

Indexers implementing DP-1 Playlist dynamic query support should:

**Protocol Support:**
- Implement one or more resolution profiles: `https-json-v1`, `graphql-v1`
- Follow standard protocol conventions (GraphQL spec, REST best practices)
- Return structured JSON responses matching declared schema

**Response Format:**
- For `graphql-v1`: Use standard `{"data": {...}, "errors": [...]}` envelope
- For `https-json-v1`: Return JSON object with items at declared `itemsPath`
- Ensure response items conform to specified DP-1 schema version (e.g., `dp1/1.0`)

**Documentation:**
- Document supported query parameters and template placeholders
- Provide example queries and responses
- Publish schema documentation (GraphQL schema, OpenAPI spec)
- Maintain changelog for API versioning

### 6.2 Example GraphQL Schema

```graphql
type Query {
  userWorks(
    address: String!
    chain: String!
    limit: Int
  ): [Artwork!]!
  
  seriesWorks(
    seriesId: Int!
  ): [Artwork!]!
}

type Artwork {
  id: ID!
  title: String!
  source: String!
  duration: Int
  provenance: ProvenanceBlock
}

type ProvenanceBlock {
  contract: ContractInfo!
}

type ContractInfo {
  chain: String!
  standard: String
  address: String
  seriesId: Int
  tokenId: String
  uri: String
}
```

---

## 7 · Compliance & Testing

### 7.1 Extension Badge: "DP-1 Playlist v0.1"

**Requirements:**
- Parse and display all extended playlist fields
- Verify playlist signatures per DP-1 §7.1
- Handle missing optional fields gracefully
- Pass reference test suite (10+ sample playlists)

### 7.2 Optional Badge: "DP-1 Playlist Dynamic"

**Requirements:**
- Full playlist extension badge requirements
- Implement at least one resolution profile (`https-json-v1` or `graphql-v1`)
- Support template placeholder hydration per §4.4
- Implement response mapping and schema validation per §4.5
- Handle errors gracefully per §4.6.2
- Obtain user consent before sharing wallet addresses
- Pass dynamic enrichment test scenarios

### 7.3 Test Suite

**Test scenarios:**
- Extended metadata (curators, summary, coverImage)
- Dynamic query with `graphql-v1` profile (success case)
- Dynamic query with `https-json-v1` profile (success case)
- Template placeholder hydration
- Response mapping and schema validation
- Indexer failure handling (network error, invalid response)
- User consent workflow for wallet address sharing
- Signature verification including `dynamicQuery` block

---

## 8 · Versioning & Future Extensions

### 8.1 Semantic Versioning

Playlist extension follows SemVer:
- **Major:** Breaking changes to schema or behavior
- **Minor:** Additive features, backward-compatible
- **Patch:** Bug fixes, clarifications, editorial changes

Current version: **0.2.0**

### 8.2 Proposed Future Features

**Potential v0.3.0 additions:**
- Additional template placeholders
- Support for additional resolution profiles (e.g., `grpc-v1`)
- Enhanced analytics/tracking fields

**Potential v1.0.0 changes:**
- Production-ready status after community feedback
- Finalized compliance badge requirements
- Reference implementation validation

---

## 9 · Governance

### 9.1 Extension Stewardship

- **Maintained by:** Feral File (2025-2026)
- **Community input:** GitHub discussions and pull requests
- **Versioning:** Aligned with DP-1 core release cycle

### 9.2 Proposing Changes

1. Open GitHub issue with proposal
2. Community discussion (minimum 2 weeks)
3. Reference implementation (for breaking changes)
4. Steering committee review (if applicable)
5. Version bump and publication

---

## 10 · References

- **DP-1 Core Specification:** `/docs/spec.md`
- **DP-1 Channel Extension:** `/docs/extension/channel.md`
- **DID Core Specification:** https://www.w3.org/TR/did-core/
- **RFC 8785 (JCS):** https://www.rfc-editor.org/rfc/rfc8785
- **JSON Schema Draft 2020-12:** https://json-schema.org/

---

## 11 · Changelog

### v0.2.0 (2026-07-21) — displayAt scheduling

- Bumped Playlist Extension from **0.1.0** to **0.2.0** (minor: additive `schedule` / `displayAt` per §8.1).
- Documented playlist-level **`schedule.byDisplayAt`** and item-level **`displayAt`** (ISO 8601 subset: date, local datetime with seconds, or RFC 3339 `date-time`).
- Normative split: device control layer filters and timers; player plays the pre-filtered active set only (no Daily-specific player logic).
- When `byDisplayAt` is `true`, implementations **MUST** resolve each `displayAt` to an instant (§3.5.2; bare/date-only = **playback-device** local), filter to the active set (most recent release ≤ now + evergreen; empty *past* → evergreen only), preserve order, and advance via timer with **immediate push** on threshold (does not wait for `duration`/`loop`).
- Composition with `dynamicQuery`: filter static items on fast-start; recompute over the merged list after enrichment (§3.5.6).
- Field location: `displayAt` is top-level on the item (same level as `source`), not inside `display`.
- JSON: `extensions/playlists/schema.json` (`schedule` and per-item `displayAt` via `items` overlay; `DisplayAt` as `oneOf` date / local datetime / `date-time`; composed with the bundle using `allOf`). Example: `extensions/playlists/examples/daily-by-display-at.json`. Canonical `core/v1.1.0/schemas/playlist.json` is unchanged.
- Published resource URLs now use `/extensions/playlists/v0.2.0/`.

### Amendment (2026-04-13) — Note (experimental)

- Documented optional **`note`** on the playlist and on each **`PlaylistItem`**: `text` (required, ≤500 characters), `duration` (optional, default 20 seconds when omitted).
- Normative intent: players show a **dedicated intermission page** before the playlist starts or before an item, for the effective duration; **experimental** and **may be deprecated** in a later version.
- JSON: `extensions/playlists/schema.json` (playlist-level `note` and per-item `note` via `items` overlay; composed with the bundle using `allOf`). Canonical `core/v1.1.0/schemas/playlist.json` is unchanged.

### v0.1.0 (2026-03-11)

**Initial draft release of Playlist Extension.**

**Extended Playlist Fields:**
- `curators` (array of entity objects with verifiable identities)
- `summary` (playlist description, 1-2000 characters)
- `coverImage` (URI for playlist cover image)
- `dynamicQuery` (optional machine-executable indexer integration)

**Dynamic Query Features:**
- Machine-executable interface for indexer integration
- Resolution profiles: `https-json-v1`, `graphql-v1`
- Template placeholder hydration system (`{{viewer_address}}`, `{{chain}}`, `{{limit}}`)
- Response mapping with schema validation (`dp1/1.0`, `dp1/1.1`)
- Fast start, rich upgrade rendering strategy (target <2s static, async enrichment)
- Security: Signed intent, rights-awareness, user consent workflow
- Graceful fallback on failures (screen never goes dark)

**Entity Format:**
- Unified curator format: `name` (required), `key` (required), `url` (optional)
- DID-based verifiable identities

**Player Requirements:**
- Immediate rendering of static content
- Asynchronous dynamic query execution
- User consent before sharing wallet addresses
- Graceful error handling with fallback to static content

**Indexer Integration:**
- Standard response formats (GraphQL envelope, REST JSON)
- Schema validation against DP-1 versions
- Rate limiting and caching recommendations

**Compliance:**
- Extension badge: "DP-1 Playlist v0.1"
- Optional badge: "DP-1 Playlist Dynamic"
- Test suite with 8+ scenarios

---

## Appendix A · JSON Schema

Canonical machine-readable schema: `extensions/playlists/schema.json`. The fragment below mirrors the shipped `$id` and the `schedule` / `displayAt` defs; prefer the file on disk when validating.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://dp1.feralfile.com/extensions/playlists/v0.2.0/schema.json",
  "title": "DP-1 Playlist Extension",
  "description": "Extended fields for DP-1 playlists",
  "type": "object",
  "properties": {
    "note": {
      "$ref": "#/$defs/Note"
    },
    "schedule": {
      "$ref": "#/$defs/Schedule"
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "note": {
            "$ref": "#/$defs/Note"
          },
          "displayAt": {
            "$ref": "#/$defs/DisplayAt"
          }
        }
      }
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
    "summary": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "coverImage": {
      "type": "string",
      "format": "uri"
    },
    "dynamicQuery": {
      "type": "object",
      "required": ["profile", "endpoint", "query", "responseMapping"],
      "properties": {
        "profile": {
          "type": "string",
          "enum": ["https-json-v1", "graphql-v1"]
        },
        "endpoint": {
          "type": "string",
          "format": "uri"
        },
        "method": {
          "type": "string",
          "enum": ["GET", "POST"]
        },
        "headers": {
          "type": "object"
        },
        "query": {
          "type": "string",
          "description": "Query string with optional {{...}} template placeholders"
        },
        "responseMapping": {
          "type": "object",
          "required": ["itemsPath", "itemSchema"],
          "properties": {
            "itemsPath": {
              "type": "string"
            },
            "itemSchema": {
              "type": "string",
              "pattern": "^dp1/\\d+\\.\\d+$"
            },
            "itemMap": {
              "type": "object"
            }
          }
        }
      }
    }
  },
  "$defs": {
    "Schedule": {
      "type": "object",
      "description": "Playlist-level scheduling controls. When byDisplayAt is true, the device control layer filters items to an active set based on each item's displayAt and pushes only that set to the player.",
      "properties": {
        "byDisplayAt": {
          "type": "boolean",
          "description": "When true, the device control layer MUST filter playlist items to the active set for the current time using displayAt and push only that set to the player. When false or absent, play all items (core behavior) and ignore displayAt for filtering."
        }
      }
    },
    "DisplayAt": {
      "description": "ISO 8601 subset when this item becomes eligible for the active set. Date only or local datetime without timezone: playback-device local (date only → T00:00:00). RFC 3339 date-time with Z or offset: absolute/global. Top-level item field (same level as source), not inside display.",
      "oneOf": [
        {
          "title": "Date only (playback-device local midnight)",
          "type": "string",
          "format": "date"
        },
        {
          "title": "Local datetime without timezone (playback-device local)",
          "type": "string",
          "pattern": "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])T([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?$"
        },
        {
          "title": "Absolute datetime with timezone",
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$"
        }
      ],
      "examples": [
        "2026-07-21",
        "2026-07-21T00:00:00",
        "2026-07-21T00:00:00Z",
        "2026-07-21T09:00:00+07:00"
      ]
    },
    "Note": {
      "type": "object",
      "description": "Experimental intermission card (may change or be deprecated)",
      "required": ["text"],
      "properties": {
        "text": {
          "type": "string",
          "minLength": 1,
          "maxLength": 500
        },
        "duration": {
          "type": "number",
          "default": 20,
          "exclusiveMinimum": 0
        }
      }
    }
  }
}
```

---

*This specification is maintained as part of the DP-1 protocol ecosystem. For questions, feedback, or contributions, please visit the project repository or contact the maintainers.*
