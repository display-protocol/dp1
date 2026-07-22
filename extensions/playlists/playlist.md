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
4. **displayAt Scheduling**: Optional time-based filtering so conforming implementations play only items that are eligible at a given time (for example, Daily-style one artwork per day)

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
| **displayAt** | Optional ISO 8601 datetime on a playlist item indicating when that item becomes eligible for playback. |
| **Schedule** | Playlist-level object that opts into scheduling behavior (currently `byDisplayAt`). |
| **Display locale** | The local timezone and clock of the display that presents the playlist; authority for timezone-less `displayAt` values (not the casting client). |

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
| `schedule` | object | OPTIONAL | Scheduling controls. See §3.5. When `byDisplayAt` is `true`, playback uses only eligible items derived from `displayAt`. |
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

Time-based scheduling lets a playlist carry its full catalog (including archive and future items) while only playing items that are eligible at the current time. This supports Daily-style playlists (one artwork per day).

**Favorites / non-scheduled copies:** When copying an item from a `byDisplayAt` playlist into a playlist that should play without time filtering (for example Favorites), the implementation **SHOULD** strip `displayAt` from the copied item and **MUST NOT** set `schedule.byDisplayAt` to `true` on that destination playlist unless filtering is intentional.

**Signatures:** Signature verification **MUST** use the **full, unmodified** playlist document (including archive and future items) per §5 / DP-1 §7.1.

#### 3.5.1 Playlist-level `schedule.byDisplayAt`

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `schedule` | object | OPTIONAL | Playlist-level scheduling controls. |
| `schedule.byDisplayAt` | boolean | OPTIONAL | When `true`, playback **MUST** include only eligible items per §3.5.3. When `false` or absent, play all items normally. |

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
| `displayAt` | string (ISO 8601 subset) | OPTIONAL | When this item becomes eligible for playback. Accepted wire forms: local datetime with seconds and no timezone (`YYYY-MM-DDThh:mm:ss[.frac]`), or absolute RFC 3339 `date-time` (with `Z` or numeric offset with colon, e.g. `+07:00`). Date-only (`YYYY-MM-DD`) and compact offset without colon (`+0700`) are **not** accepted. |

**Field location:** `displayAt` is a **top-level** field on the item (same level as `source`). It is **not** inside `display`. The `display` object is for render preferences (scaling, loop, margin); `displayAt` is scheduling metadata.

**Timezone rules (normative):** Implementations that filter by `displayAt` **MUST** resolve wire values as follows:

| Format | Example | Behavior |
|:-------|:--------|:---------|
| With timezone (`Z`) | `2026-07-21T00:00:00Z` | Absolute — global sync |
| With offset | `2026-07-21T09:00:00+07:00` | Absolute — global sync |
| Without timezone | `2026-07-21T00:00:00` | Display-locale local time |

**Clock authority:** Timezone-less values **MUST** resolve in the **display locale** (§2) — the local timezone and clock of the display that presents the playlist — **not** the casting client or phone. Absolute (`Z` / offset) values **MUST** compare as the same UTC instant everywhere.

**DST gap and fold (bare local):** When resolving a timezone-less wall time in the display locale:

- **Gap** (spring-forward; local time does not exist): resolve to the **first valid local instant after** the gap.
- **Fold** (fall-back; local time occurs twice): resolve to the **earlier** of the two ambiguous instants.

Absolute `Z` / offset values are unaffected (they already name a unique instant).

**Current time (`now`):** In §3.5.3–§3.5.4, **`now`** means the current instant on the display-locale clock used for §3.5.2 resolution (same authority as bare-local `displayAt`).

**Publisher controls behavior:**

- Global release (same instant worldwide): include timezone (`Z` or offset)
- Local release (each display’s local time): omit timezone (local datetime with seconds)

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

#### 3.5.3 Playback eligibility

When `schedule.byDisplayAt` is `true`, playback **MUST** include only eligible items. Eligibility is determined as follows:

1. **MUST** resolve each item’s `displayAt` to an **instant** using §3.5.2. Comparisons against `now` **MUST** use those instants — **not** lexical string comparison of the wire values.
2. Let *past* be items that have a resolvable `displayAt` whose instant ≤ now. If *past* is empty, skip to step 4.
3. Otherwise let `max_instant` be the maximum resolved instant in *past*. Items whose resolved instant equals `max_instant` form the **current release** (same release even when wire strings differ, e.g. `2026-07-21T00:00:00Z` and `2026-07-21T07:00:00+07:00`).
4. **Eligible items** = current release items **plus** every item with **no** `displayAt` (always eligible).
5. **MUST** preserve original playlist order among eligible items.
6. Older archive and future items **MUST NOT** be played. They **MAY** remain visible in catalog UIs.

**Summary:** Play items from the most recent release that has happened + items with no time restriction.

**Example** (now = 2026-07-22 14:00 display-locale local):

```text
Playlist items (in order):
  [0] Intro      — no displayAt
  [1] Work A     — displayAt: 2026-07-21T00:00:00
  [2] Work B     — displayAt: 2026-07-22T00:00:00
  [3] Work C     — displayAt: 2026-07-22T00:00:00  (same instant as B)
  [4] Outro      — no displayAt
  [5] Work D     — displayAt: 2026-07-23T00:00:00
```

- Items with resolved instant ≤ now: A, B, C → `max_instant` = 2026-07-22T00:00:00
- Current release: B, C
- Always eligible: Intro, Outro
- **Playback includes (in order):** Intro, Work B, Work C, Outro
- **Excluded:** Work A (older), Work D (future)

#### 3.5.4 Playback transitions

When `byDisplayAt` is `true`, playback **MUST** update when eligibility changes:

1. Find `next_instant` = the minimum resolved `displayAt` instant where that instant > now (if any).
2. If `next_instant` exists, playback **MUST** transition at that time.
3. Playback **MUST** also re-evaluate eligibility when: resuming after sleep/restart, the display-locale clock or timezone changes materially (manual clock set, timezone switch, DST transition), or the playlist document changes (live refresh, cast, etc.).
4. If there is no future `displayAt` instant, no timer is needed. Eligibility remains stable until a step-3 trigger.

There is no polling and no midnight-specific logic. Scheduling is driven by the actual `displayAt` values.

**Immediate transition (normative):** When eligible items change (membership, order, or any item's `source`), playback **MUST** switch immediately. It **MUST NOT** wait for the current item's `duration` or `loop` cycle to finish. Crossing a `displayAt` threshold **MUST** surface the new item.

**Item identity (normative):** For “same item” / continue decisions, identity **MUST** use the item’s `id` when present; otherwise `source`; otherwise the item’s index in the full effective list (static document order, then appended dynamic items per §3.5.6).

**Unchanged eligibility skip (normative):** If eligibility has not changed (same ordered identities and the same `source` for each), the implementation **MAY** skip transition and **SHOULD** preserve in-progress playback. A live refresh that changes `source` on the same identity **MUST** reload that item.

**Which item to play after eligibility changes (normative):** If no items are eligible, show idle per §3.5.5. Otherwise:

1. If a **new release** becomes current (a different `max_instant` than before), playback **MUST** begin at the **first item** of that release — not at an always-eligible item that precedes it in the list. Example: Daily midnight **MUST** start the new day's work, not restart a leading intro. If that item has a `note` (§3.4), show the intermission first.
2. Else if the **current item is still eligible**, continue playing it. If its `source` changed (same identity, new URI), reload the new `source`.
3. Else if a **current release exists**, begin at its first item.
4. Else begin at the **first eligible item**.

**Start item:** When starting playback, select the item per the rules above. Starting always at index 0 is **not** sufficient when always-eligible items precede the current release (Daily midnight must start the new day's work, not a leading intro).

#### 3.5.5 Duration, loop, and edge cases

- `duration` and `loop` **MUST** apply **only among** currently eligible items.
- If every resolvable `displayAt` is still in the future, only items without `displayAt` are eligible.
- If no items are eligible, the implementation **MAY** show an idle or blank state, or **MAY** hold the last frame of the previous item.
- Multiple items with the same resolved `displayAt` instant **MUST** all be eligible together.
- An item whose `displayAt` cannot be resolved to an instant (invalid calendar/clock value) **MUST** be treated as **not eligible** and **MUST NOT** contribute a timer candidate.
- Implementations that do not understand `byDisplayAt` **SHOULD** ignore it and play the full list (degraded but functional).

#### 3.5.6 Composition with `dynamicQuery`

When both `schedule.byDisplayAt` is `true` and `dynamicQuery` is present, accepted dynamic items from §4 enter the item list used by §3.5.3. They **MUST NOT** bypass eligibility filtering.

1. **Fast-start (§4.6.1)** **MUST** present eligible items first (empty/idle counts) — do not flash archive or future static items, then filter later.
2. **Effective list order:** Static `items` from the signed playlist document **MUST** appear first, in document order; accepted dynamic items **MUST** be appended after, in indexer order.
3. **`displayAt` on dynamic items:** Only `displayAt` values on **static** items affect eligibility and timers. Before computing *past* / `max_instant` (§3.5.3), implementations **MUST** ignore (or strip) any `displayAt` on dynamic items and treat those items as always eligible. Dynamic items **MUST NOT** shift `max_instant` or arm timers.
4. After enrichment, the implementation **MUST** re-evaluate eligibility per §3.5.3–§3.5.4 and retarget any transition timer.
5. When `dynamicQuery` fails, fallback **MUST** be the last eligible set (or idle if empty), not the unfiltered static catalog.

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

**Behavior** (display-locale local time; no timezone on `displayAt`):

| Display-locale local time | Eligible items (original order) | Cursor on apply |
|:--------------------------|:----------------------------|:----------------|
| 2026-07-20, 10:00 (pre-Day 1) | Evergreen Intro only | First item → Evergreen Intro |
| 2026-07-21, 00:00 (first entry into Day 1 cohort) | Evergreen Intro, Day 1 Work | Cohort changed → Day 1 Work (start item; not Intro) |
| 2026-07-21, 10:00 (same-day refresh; Day 1 already playing) | Evergreen Intro, Day 1 Work | `max_instant` unchanged → continue Day 1 if still present |
| 2026-07-22, 00:00 (timer fires → immediate apply) | Evergreen Intro, Day 2 Work | Cohort changed → Day 2 Work (not Intro restart) |
| 2026-07-23, 00:00 (timer fires → immediate apply) | Evergreen Intro, Day 3 Work | Cohort changed → Day 3 Work |
| 2026-07-24, 10:00 (post-Day 3; no future `displayAt`) | Evergreen Intro, Day 3 Work | `max_instant` unchanged → continue current item if still present |

---

## 4 · Dynamic Query

The `dynamicQuery` extension enables playlists to fetch items dynamically from external indexers. It provides a **deterministic, machine-executable interface** for real-time content discovery.

### 4.1 Core Principles

**Machine-Executable Interface**  
Defines a rigid contract for request construction and response parsing, moving beyond opaque metadata.

**Fast Start, Rich Upgrade**  
Players **MUST** render static playlist items immediately and execute the `dynamicQuery` asynchronously to enrich the view — **except** when `schedule.byDisplayAt` is `true`: the fast-start playback list is the **first set of eligible items**, and enrichment feeds the effective list per §3.5.6 (not an unfiltered post-filter merge).

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
- Query string (GET): The `dynamicQuery` executor hydrates `{{...}}` templates in `query` field, then appends to endpoint URL
- Body (POST): The `dynamicQuery` executor hydrates `{{...}}` templates in `query` field, then parses as JSON body

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
- The `dynamicQuery` executor hydrates `{{...}}` templates in `query` field
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

The component that executes `dynamicQuery` **MUST** hydrate template placeholders directly in the `query` string before execution. When `schedule.byDisplayAt` is `true`, that work is part of building the effective list (§3.5.6); otherwise it is typically the player (§4.6.1).

**Standard Template Variables:**

| Variable | Type | Description | Example |
|:---------|:-----|:------------|:--------|
| `{{viewer_address}}` | string | Active wallet address of the user. | `"tz1..."` or `"0x..."` |
| `{{chain}}` | string | Target blockchain. | `"ethereum"`, `"tezos"`, `"bitmark"` |
| `{{limit}}` | integer | Maximum number of items to return. | `20`, `50` |
| `{{series_id}}` | integer | Series or collection identifier. | `42`, `777` |

**Hydration rules:**
- Template variables use double curly braces: `{{variable_name}}`
- The `dynamicQuery` executor **MUST** replace all `{{...}}` templates in the `query` field before sending the request
- If a template cannot be resolved, the executor **MUST** fail gracefully (skip query; show static content). When `schedule.byDisplayAt` is `true`, “static content” means the **last eligible set** (or idle if empty), not the unfiltered static catalog (§3.5.6.5).
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
- `displayAt` (string; ISO 8601 scheduling datetime per §3.5) — **ignored for scheduling when the item came from `dynamicQuery`** (§3.5.6)
- All other PlaylistItem fields per DP-1 §3.2

**Validation path:** Core `itemSchema` versions validate base PlaylistItem fields. Extension overlay fields (`note`, `displayAt`) on **static** signed items are validated by `extensions/playlists/schema.json` via `allOf`. Dynamic items **SHOULD** be validated against core PlaylistItem fields (and `note` when present) before acceptance. If a dynamic item includes `displayAt` that fails the `DisplayAt` pattern, implementations **MUST** strip or ignore that field and **MUST NOT** reject the whole item for that reason alone — the item remains evergreen for §3.5.6 membership. Only static `displayAt` values affect eligibility filtering.

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

The `dynamicQuery` executor **MUST** transform response items using the mapping before validating against the specified DP-1 schema version.

### 4.6 Player Implementation Requirements

#### 4.6.1 Rendering Strategy

When `schedule.byDisplayAt` is `true`, playback **MUST** use only eligible items per §3.5 — not the unfiltered static catalog or an unfiltered static+dynamic merge. Enrichment feeds the effective list (§3.5.6); the fast-start and enrichment bullets below include that carve-out.

**Fast start:**
1. Players **MUST** render static playlist items immediately (target <2s). When `byDisplayAt` is `true`, that target applies to the **first eligible set** (empty/idle counts); implementations **MUST NOT** flash the unfiltered static catalog while waiting (§3.5.6.1).
2. When `byDisplayAt` is absent or `false`, players **MUST** execute `dynamicQuery` asynchronously (non-blocking). When `byDisplayAt` is `true`, enrichment **MUST** follow §3.5.6 (effective list → eligibility), not a separate unfiltered merge into playback.
3. Players **MUST** continue showing the current playback surface until dynamic items are ready — when `byDisplayAt` is `true`, that surface is the **last eligible set** (or idle), not the full static catalog

**Dynamic enrichment** (when `byDisplayAt` is absent or `false`):
1. Validate response structure and item schema against specified DP-1 version
2. Transform items using `itemMap` (if present)
3. Merge or append dynamic items to playlist (implementation-defined)
4. Update display without disrupting current playback

**When `schedule.byDisplayAt` is `true`:** Implementations **MUST** perform enrichment into the effective list (validate, `itemMap`, append per §3.5.6.2–3), then re-evaluate eligibility per §3.5.6.4. Playback **MUST** remain only eligible items. Fallback on query failure **MUST** be the last eligible set (or idle), not the unfiltered catalog (§4.4, §4.6.2).

#### 4.6.2 Error Handling

Players **MUST** handle failures gracefully:

| Error Condition | Required Behavior |
|:----------------|:------------------|
| Network failure | Continue playing static content, retry with exponential backoff (optional). When `byDisplayAt` is `true`, continue the **last eligible set** (or idle if empty), not the unfiltered catalog. |
| Invalid response | Log error, continue with static content, do not crash. When `byDisplayAt` is `true`, continue the **last eligible set** (or idle if empty). |
| Missing template placeholder | Skip query execution, show static content. When `byDisplayAt` is `true`, show the **last eligible set** (or idle if empty). |
| Signature verification failed | Reject entire playlist per DP-1 §7.1. |
| Schema validation failed | Log error, discard invalid items, show valid items only. When `byDisplayAt` is `true`, discard invalid dynamic items and re-evaluate eligibility (or continue the last eligible set / idle); **MUST NOT** paint an unfiltered partial catalog. Invalid dynamic `displayAt` alone **MUST NOT** discard an otherwise-valid item (§4.5). |

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
- The `schedule` object and every **static** item’s `displayAt` (when present in the signed document) are part of the signed payload
- Signature verification **MUST** occur before executing dynamic queries
- When `schedule.byDisplayAt` is `true`, verification **MUST** use the full catalog document **before** eligibility filtering; the filtered playback list is **not** a separately signed object (§3.5)
- **`displayAt` on items returned by `dynamicQuery` is not part of the signed payload** and **MUST NOT** affect eligibility filtering (§3.5.6)

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

### 7.1 Extension Badge: "DP-1 Playlist v0.2"

**Requirements:**
- Parse all extended playlist fields (catalog UIs **MAY** display them)
- Verify playlist signatures per DP-1 §7.1 on the full catalog document before eligibility filtering when `byDisplayAt` is `true`
- Handle missing optional fields gracefully
- Any implementation that accepts playlists with `schedule.byDisplayAt: true` for scheduled playback **MUST** implement eligibility, transitions, and start-item selection per §3.5. Catalog-only clients that never perform playback **MAY** omit filtering and **MUST NOT** claim scheduled-playback compliance.
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
- Signature verification of full catalog (`schedule`, static `displayAt`, archive/future items) **before** eligibility filter when `byDisplayAt` is `true`
- `schedule.byDisplayAt`: eligible = current release (latest past `max_instant`) + items with no `displayAt` (order preserved)
- `schedule.byDisplayAt` absent or `false`: play full list; ignore `displayAt` for filtering
- `displayAt` timezone forms: bare local vs `Z` / offset absolute equality; date-only and compact offset rejected; DST gap/fold rules for bare local
- Invalid `displayAt` not eligible and not a timer candidate (not treated as always eligible)
- Threshold: immediate transition; does not wait for `duration`/`loop`
- Unchanged eligibility skip: same identity sequence **and** same `source` per item; `source` change on same identity forces reload
- Cursor rule 1: new `max_instant` → start at first current-release item (not leading always-eligible)
- Cursor rule 2: current item still eligible → continue; reload if `source` changed
- Cursor rule 3: current item left eligibility but a current release exists → start at first current-release item
- Cursor rule 4: otherwise → first eligible item
- Display-locale clock/timezone change triggers re-evaluation (§3.5.4 step 3)
- Multiple items same `displayAt` instant in the current release (§3.5.3 example B+C)
- No eligible items: idle/blank or hold last frame (§3.5.5)
- Future-only `displayAt`: only items without `displayAt` are eligible
- Fast-start: first eligible set; no flash of archive/future static items (§3.5.6.1)
- Composition: `byDisplayAt` + `dynamicQuery`; ignore/strip unsigned `displayAt` on dynamic items before §3.5.3; enrichment then re-evaluate (§3.5.6.4); failure → last eligible set (§3.5.6.5)
- Schema validation under `byDisplayAt`: last eligible set (or idle); invalid dynamic `displayAt` alone does not discard the item
- Favorites / non-scheduled copy: strip `displayAt` (or keep `byDisplayAt` false) so past items remain playable

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
- Documented playlist-level **`schedule.byDisplayAt`** and item-level **`displayAt`** (ISO 8601 subset: local datetime with seconds, or RFC 3339 `date-time` with bounded offset; date-only not accepted).
- Normative behavior: when `byDisplayAt` is `true`, playback includes only eligible items (most recent release ≤ now + items with no `displayAt`).
- When `byDisplayAt` is `true`, implementations **MUST** resolve each `displayAt` to an instant (§3.5.2; bare local = **display locale**, with DST gap/fold rules), preserve order, and transition immediately on threshold (does not wait for `duration`/`loop`).
- Which item to play: new release → first release item; else continue current if still eligible (reload if `source` changed); else first current-release item; else first eligible. No eligible items → idle/blank or hold last frame.
- Favorites / non-scheduled copies: **SHOULD** strip `displayAt`; destination **MUST NOT** enable `byDisplayAt` unless filtering is intentional.
- Unchanged eligibility skip: same identity sequence (`id` / else `source` / else index) **and** same `source` per item.
- Re-evaluate also on material display-locale clock or timezone changes.
- Signatures verify the full catalog before filtering; the eligible playback subset is not separately signed.
- Composition with `dynamicQuery`: ignore/strip unsigned `displayAt` on dynamic items before eligibility; enrichment then re-evaluate (§3.5.6); failure → last eligible set.
- Offset wire form: colon required; hours `00–23`, minutes `00–59`; compact `+0700` rejected.
- §7.1 badge: scheduled playback with `byDisplayAt: true` **MUST** implement §3.5; catalog-only clients may omit without claiming scheduled-playback compliance.
- `DisplayAt` schema `oneOf`: local datetime / absolute `date-time` (mutually exclusive patterns; date-only rejected).
- JSON: `extensions/playlists/schema.json`; example: `extensions/playlists/examples/daily-by-display-at.json`. Canonical core playlist schema unchanged.
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
      "description": "Per-item extension fields. Composed with the core playlist schema via allOf: each element must still satisfy PlaylistItem from the bundle, and may include optional note and displayAt.",
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
      "required": ["profile", "endpoint", "responseMapping"],
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
      "description": "Playlist-level scheduling controls. When byDisplayAt is true, playback includes only eligible items based on each item's displayAt.",
      "properties": {
        "byDisplayAt": {
          "type": "boolean",
          "description": "When true, playback MUST include only eligible items for the current time based on displayAt. When false or absent, play all items (core behavior)."
        }
      }
    },
    "DisplayAt": {
      "description": "ISO 8601 subset when this item becomes eligible for playback. Local datetime without timezone: display-locale local. RFC 3339 date-time with Z or offset (hours 00-23, minutes 00-59): absolute/global. Date-only (YYYY-MM-DD) is not accepted. Top-level item field (same level as source), not inside display. Patterns are syntactic only; invalid calendar values are rejected at resolve time.",
      "oneOf": [
        {
          "title": "Local datetime without timezone (display-locale local)",
          "type": "string",
          "pattern": "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])T([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?$"
        },
        {
          "title": "Absolute datetime with timezone",
          "type": "string",
          "pattern": "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])T([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?(Z|[+-]([01]\\d|2[0-3]):[0-5]\\d)$"
        }
      ],
      "examples": [
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
