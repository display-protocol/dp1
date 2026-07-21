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
| **displayAt** | Optional ISO 8601 date or datetime on a playlist item indicating when that item becomes eligible for the active set (date-only = local midnight). |
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

Playlist items **MAY** include an optional `note` field with the same object shape; when present, players **SHOULD** show that intermission **before loading that item** (after any prior item or intermission). Items **MAY** also include an optional top-level `displayAt` date or datetime (same level as `source`, **not** inside `display`). These fields are **not** part of canonical DP-1 core; they are defined only by this extension. In JSON Schema, item-level `note` and `displayAt` are validated by an **`allOf` overlay**: `extensions/playlists/schema.json` adds optional `properties.items.items.properties.note` and `properties.items.items.properties.displayAt` (see Appendix A), composed with `extensions/playlists/bundles/playlist-core-v1.1.0.json` via `playlist_with_extension.json`—the bundle’s `PlaylistItem` definition is not forked for these fields.

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
| **Publisher / app** | Ship the **full** playlist (`items` include archive and future; `schedule.byDisplayAt: true` when filtering is desired). Cast/send that full document to the device. |
| **Device control layer** (e.g. controld) | Parse `displayAt`, compute the active set, manage the timer, and **push only the active set** to the player. |
| **Player** | Play the received list with normal `duration` / `loop` rules. The player **MUST NOT** be required to interpret `displayAt` or `byDisplayAt`. |

Catalog UIs (hero, archive scroll) **MAY** keep the full playlist; only the list sent for playback **MUST** be the active set when `byDisplayAt` is `true`.

**Favorites / non-scheduled copies:** When an app copies an item from a `byDisplayAt` playlist into a playlist that should play without time filtering (for example Favorites), it **SHOULD** strip `displayAt` from the copied item and **MUST NOT** set `schedule.byDisplayAt` to `true` on that destination playlist unless filtering is intentional. Leaving `displayAt` on a Favorites item under `byDisplayAt: true` would wrongly exclude past favorited works from the active set.

**Signatures vs filtered push:** Signature verification **MUST** use the **full, unmodified** playlist document (including archive and future items) per §5 / DP-1 §7.1 **before** filtering. The active set pushed to the player is a **runtime playback subset** and **MUST NOT** be treated as a separately signed playlist. Players that receive only the active set from a control layer that has already verified the full document **MUST NOT** require a signature covering that subset alone.

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
| `displayAt` | string (ISO 8601 subset) | OPTIONAL | When this item becomes eligible for the active set. Accepted wire forms: date-only (`YYYY-MM-DD`), local datetime with seconds and no timezone (`YYYY-MM-DDThh:mm:ss[.frac]`), or absolute RFC 3339 `date-time` (with `Z` or numeric offset with colon, e.g. `+07:00`). Compact offset without colon (`+0700`) is **not** accepted. |

**Field location:** `displayAt` is a **top-level** field on the item (same level as `source`). It is **not** inside `display`. The `display` object is for render preferences (scaling, loop, margin); `displayAt` is scheduling metadata.

**Timezone rules (normative):** Implementations that filter by `displayAt` **MUST** resolve wire values as follows:

| Format | Example | Behavior |
|:-------|:--------|:---------|
| With timezone (`Z`) | `2026-07-21T00:00:00Z` | Absolute — global sync |
| With offset | `2026-07-21T09:00:00+07:00` | Absolute — global sync |
| Without timezone | `2026-07-21T00:00:00` | Playback-device local time |
| Date only | `2026-07-21` | Treat as `T00:00:00` playback-device local |

**Clock authority:** “Device local” **MUST** mean the local timezone of the **playback device** that runs the schedule filter (the device control layer on the wall display), **not** the casting client or phone. Absolute (`Z` / offset) values **MUST** compare as the same UTC instant on every device.

**DST gap and fold (bare local and date-only):** When resolving a timezone-less wall time in the playback-device zone:

- **Gap** (spring-forward; local time does not exist): resolve to the **first valid local instant after** the gap.
- **Fold** (fall-back; local time occurs twice): resolve to the **earlier** of the two ambiguous instants.

Absolute `Z` / offset values are unaffected (they already name a unique instant).

**Current time (`now`):** In §3.5.3–§3.5.4, **`now`** means the current instant on the playback-device clock used for §3.5.2 resolution (same authority as bare-local `displayAt`).

**Publisher controls behavior:**

- Global release (same instant worldwide): include timezone (`Z` or offset)
- Local release (each playback device’s local time): omit timezone (datetime or date-only)

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
7. **MUST** arm or clear the transition timer per §3.5.4.

**One-sentence summary:** Active set = items from the most recent release that has already happened + items with no time restriction.

**Concrete example** (now = 2026-07-22 14:00 playback-device local):

```text
Playlist items (in order):
  [0] Intro      — no displayAt
  [1] Work A     — displayAt: 2026-07-21T00:00:00
  [2] Work B     — displayAt: 2026-07-22T00:00:00
  [3] Work C     — displayAt: 2026-07-22T00:00:00  (same instant as B)
  [4] Outro      — no displayAt
  [5] Work D     — displayAt: 2026-07-23T00:00:00
```

- Items with resolved instant ≤ now: A, B, C → `max_instant` = 2026-07-22T00:00:00 (playback-device local)
- Timed cohort (same `max_instant`): B, C
- Evergreen: Intro, Outro
- Active set (original order): **Intro, Work B, Work C, Outro**
- Excluded: Work A (older archive), Work D (future)

#### 3.5.4 Timer-based transitions

After computing the active set, the device control layer **MUST**:

1. Find `next_instant` = the minimum resolved `displayAt` instant where that instant > now (if any).
2. If `next_instant` exists, set a timer for (`next_instant` − now).
3. When the timer fires, when the device wakes / boots while a scheduled playlist is loaded, when the playback device’s clock or timezone changes materially (manual clock set, timezone switch, DST transition, or |Δ| ≥ 1 s versus the clock used for the prior `now`), **or** when the playlist document changes (live refresh, app push, etc.): recompute the active set; then **push** per the apply policy below (unless the unchanged-set skip applies), and set a new timer (or clear the timer if step 4 applies). Routine NTP drift below 1 s **MAY** be ignored until the next wake/boot or timer fire.
4. If there is no future `displayAt` instant, **MUST NOT** arm a transition timer. The current active set remains in effect until a step-3 trigger fires — step 4 does **not** freeze the set against those recomputes.

There is no polling and no midnight-specific logic. Scheduling is driven by the actual `displayAt` values (midnight, 09:00, global launch, etc.).

**Apply policy when the active set changes (normative):** When membership or order of the active set changes, or when any selected item’s `source` changes, pushing the new list **MUST** replace the player’s current playback list **immediately**. It **MUST NOT** wait for the current item’s `duration` or `loop` cycle to finish. Crossing a `displayAt` threshold is **not** duration expiry: even if the current item would otherwise loop indefinitely or has `duration` longer than the remaining time until the next release, the new active set **MUST** take effect when the timer fires (artwork changes).

**Unchanged-set skip (normative):** Two active-set snapshots are the **same** only when they have the same length, the same ordered sequence of item identities (`id` when present; otherwise `source`; otherwise index in the full effective list), **and** the same `source` string for each corresponding item. Deep equality of other fields (`note`, `duration`, `display`, …) is **not** required for sameness. When a step-3 recompute yields the same active set under this definition, the control layer **MAY** skip a redundant player push and **SHOULD** preserve in-progress playback and cursor position. A live refresh that changes `source` on the same `id` is **not** the same set and **MUST** push.

**Playback cursor after an active-set push (normative):** If the new active set is **empty**, cursor rules 1–3 do **not** apply — push empty/idle per §3.5.5 with **no** start item. Otherwise let `previous_item` be the item currently playing (if any). Item identity for “same item” **MUST** use `id` when present; otherwise `source`; otherwise the item’s index in the full effective list. Let the timed cohort be as defined in §3.5.3.

1. If the timed cohort’s `max_instant` **changed** to a **non-empty** new value (including from empty to non-empty, or to a different instant), the control layer **MUST** begin playback at the **first timed-cohort item** in the new active set (the first selected item whose resolved `displayAt` equals the new `max_instant`). Evergreen items remain in the list for later advances within the set — they **MUST NOT** block surfacing the new release (for example, Daily midnight **MUST** start the new day’s work, not restart a leading evergreen intro). If that item has a `note` (§3.4), the player **SHOULD** show the intermission **before** loading its `source` (timer threshold does not skip `note`).
2. Else if `previous_item` is still present in the new active set, playback **MUST** continue that item when this push is not skipped (or resume its in-progress media if the player supports it). This covers `max_instant` unchanged, timed cohort becoming empty (clock rollback), or any other recompute where the previous item remains eligible. When the unchanged-set skip applies, the control layer **SHOULD** preserve in-progress playback without a new push.
3. Else begin at the **first** item of the new active set.

**Playhead handoff (normative):** Because the player **MUST NOT** be required to interpret `displayAt` / `byDisplayAt`, every control-layer active-set push that is **not** skipped under the unchanged-set rule above and that pushes a **non-empty** active set **MUST** include an explicit start descriptor for the player. The transport channel is implementation-defined; the descriptor **MUST** identify exactly one item in the **pushed active set** using **one** of:

| Field | Type | Meaning |
|:------|:-----|:--------|
| `start.id` | string | Item `id` (preferred when present on the item) |
| `start.source` | string | Item `source` URI |
| `start.index` | integer ≥ 0 | Zero-based index within the **pushed active set** (not the full catalog) |

Exactly one of `start.id`, `start.source`, or `start.index` **MUST** be present. Selection follows the cursor rules: rule 1 → first timed-cohort item; rule 2 → continue `previous_item`; rule 3 → first item of the new active set. Empty-list / idle pushes (§3.5.5) **MUST NOT** require a start descriptor. A list-only push where the player always starts at index 0 is **not** sufficient for non-empty sets — including when membership changes but `max_instant` does not (for example `dynamicQuery` appends evergreen while Day N is playing), and when evergreen items precede the timed cohort (Daily midnight).

#### 3.5.5 Duration, loop, and edge cases

- `duration` and `loop` **MUST** apply **only within** the current active set (advancing among concurrently active items).
- If every resolvable `displayAt` is still in the future, the active set **MUST** be only items without `displayAt`.
- If the active set is empty, the control layer **MUST** still push an empty playback list (or an explicit idle command). The player **MAY** show an idle or blank state, or **MAY** hold the last frame of the previous item, until a non-empty active set is pushed.
- Multiple items with the same resolved `displayAt` instant **MUST** all be included.
- An item whose `displayAt` cannot be resolved to an instant (invalid calendar/clock value after accepting the wire pattern) **MUST** be treated as **not eligible** for the timed cohort and **MUST NOT** contribute a timer candidate (it is excluded until corrected; it is **not** evergreen). Schema patterns are syntactic only — they do not prove calendar validity.
- Implementations that do not understand `byDisplayAt` **SHOULD** ignore it and play the full list (degraded but functional).

#### 3.5.6 Composition with `dynamicQuery`

When both `schedule.byDisplayAt` is `true` and `dynamicQuery` is present, the **device control layer owns the playback list**. Enrichment from §4 still produces accepted dynamic items, but those items enter the **effective item list** used by §3.5.3 — they are **not** merged into an unfiltered player-owned playlist.

1. Fast-start static items (§4.6.1) **MUST** be filtered to an active set **before** they are sent for playback — do not flash archive or future static items, then filter later. When `byDisplayAt` is `true`, the player **MUST NOT** paint a playback surface from the unfiltered catalog while waiting; it **MUST** wait for the first control-layer active-set push (empty/idle counts). The `<2s` fast-start target in §4.6.1 applies to that **first filtered push**, not to flashing the full static list.
2. **Effective list order (normative):** Static `items` from the signed playlist document **MUST** appear first, in document order; accepted dynamic items **MUST** be appended after the static block, in the order returned by the indexer (after mapping). §3.5.3 step 5 preserves order within this combined list.
3. **`displayAt` on dynamic items (trust):** Only `displayAt` values on **static** items in the signed playlist document **MUST** affect active-set filtering and timers. If an indexer response includes `displayAt`, implementations **MUST** ignore it for scheduling (the field **MAY** still be stored on the item for catalog UIs). For §3.5.3 membership, such dynamic items **MUST** be treated as having **no** scheduling `displayAt` (evergreen / always eligible), not as invalid or excluded. Dynamic items **MUST NOT** shift `max_instant` or arm timers.
4. **Who executes `dynamicQuery` when `byDisplayAt` is `true`:** Exactly one executor **MUST** run the query — either the device control layer **or** the player — not both for the same enrichment cycle. The control layer **MAY** execute it. If the control layer does not, the player **MUST** execute it asynchronously (per §4) and **MUST** hand accepted items to the control layer (implementation-defined channel) **before** any player-side display update from enrichment. If the control layer executes the query, the player **MUST NOT** be required to execute it again for that cycle. Accepted dynamic items **MUST** be available to the control layer before any player-side display update from enrichment.
5. After enrichment, the device control layer **MUST** recompute the active set over that effective list, **MUST** retarget the transition timer, and **MUST** push per §3.5.4 (including cursor rules).
6. **Exception to §4.6.1:** when `byDisplayAt` is `true`, players **MUST NOT** render the unfiltered static catalog or an unfiltered static+dynamic merge. They **MUST** play only active-set lists received from the control layer. The §4.6.1 phrase “update display without disrupting current playback” **MUST NOT** delay or refuse an active-set replace required by §3.5.4 / this section. When `dynamicQuery` fails, fallback **MUST** be the last active set pushed by the control layer (or idle if empty), not the unfiltered static catalog (§4.4, §4.6.2).

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

| Playback-device local time | Active set (original order) | Cursor on push |
|:--------------------------|:----------------------------|:---------------|
| 2026-07-20, 10:00 (pre-Day 1) | Evergreen Intro only | First item → Evergreen Intro |
| 2026-07-21, 00:00 (first entry into Day 1 cohort) | Evergreen Intro, Day 1 Work | Cohort changed → Day 1 Work (playhead handoff; not Intro) |
| 2026-07-21, 10:00 (same-day refresh; Day 1 already playing) | Evergreen Intro, Day 1 Work | `max_instant` unchanged → continue Day 1 if still present |
| 2026-07-22, 00:00 (timer fires → immediate push) | Evergreen Intro, Day 2 Work | Cohort changed → Day 2 Work (not Intro restart) |
| 2026-07-23, 00:00 (timer fires → immediate push) | Evergreen Intro, Day 3 Work | Cohort changed → Day 3 Work |
| 2026-07-24, 10:00 (post-Day 3; no future `displayAt`) | Evergreen Intro, Day 3 Work | `max_instant` unchanged → continue current item if still present |

---

## 4 · Dynamic Query

The `dynamicQuery` extension enables playlists to fetch items dynamically from external indexers. It provides a **deterministic, machine-executable interface** for real-time content discovery.

### 4.1 Core Principles

**Machine-Executable Interface**  
Defines a rigid contract for request construction and response parsing, moving beyond opaque metadata.

**Fast Start, Rich Upgrade**  
Players **MUST** render static playlist items immediately and execute the `dynamicQuery` asynchronously to enrich the view — **except** when `schedule.byDisplayAt` is `true`: the fast-start playback list is the **filtered active set** from the first control-layer push (§3.5.6), and `dynamicQuery` execution follows the single-executor rule in §3.5.6.4 (control layer **or** player, not both).

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

The component that executes `dynamicQuery` (the player, or the device control layer when it is the sole executor per §3.5.6.4) **MUST** hydrate template placeholders directly in the `query` string before execution.

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
- If a template cannot be resolved, the executor **MUST** fail gracefully (skip query; player shows static content / last pushed active set). When `schedule.byDisplayAt` is `true`, “static content” means the **last active set** pushed by the device control layer (or idle if empty), not the unfiltered static catalog (§3.5.6).
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
- `displayAt` (string; ISO 8601 scheduling date or datetime per §3.5) — **ignored for scheduling when the item came from `dynamicQuery`** (§3.5.6)
- All other PlaylistItem fields per DP-1 §3.2

**Validation path:** Core `itemSchema` versions validate base PlaylistItem fields. Extension overlay fields (`note`, `displayAt`) on **static** signed items are validated by `extensions/playlists/schema.json` via `allOf`. Dynamic items **SHOULD** be validated against core PlaylistItem fields (and `note` when present) before acceptance. If a dynamic item includes `displayAt` that fails the `DisplayAt` pattern, implementations **MUST** strip or ignore that field and **MUST NOT** reject the whole item for that reason alone — the item remains evergreen for §3.5.6 membership. Only static `displayAt` values affect active-set filtering.

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

When `schedule.byDisplayAt` is `true`, players **MUST NOT** send the unfiltered static catalog or an unfiltered static+dynamic merge to the screen; they **MUST** play only active-set lists the control layer pushes. Enrichment still feeds the control layer’s effective list (§3.5.6); the fast-start and enrichment bullets below include that carve-out.

**Fast start:**
1. Players **MUST** render static playlist items immediately (target <2s). When `byDisplayAt` is `true`, that target applies to the **first filtered active-set push** from the control layer (empty/idle counts); players **MUST NOT** flash the unfiltered static catalog while waiting (§3.5.6.1).
2. Players **MUST** execute `dynamicQuery` asynchronously (non-blocking), **unless** `byDisplayAt` is `true` and the control layer is the executor for that cycle (§3.5.6.4).
3. Players **MUST** continue showing the current playback surface until dynamic items are ready — when `byDisplayAt` is `true`, that surface is the **last pushed active set** (or idle), not the full static catalog

**Dynamic enrichment:**
1. Validate response structure and item schema against specified DP-1 version
2. Transform items using `itemMap` (if present)
3. Merge or append dynamic items to playlist (implementation-defined), **except** when `byDisplayAt` is `true`: static items first in document order, then append accepted dynamic items (§3.5.6)
4. Update display without disrupting current playback

**When `schedule.byDisplayAt` is `true`:** Accepted dynamic items **MUST** reach the control layer before player display update (via control-layer fetch or player handoff per §3.5.6.4). Active-set replace from the control layer **MUST NOT** be delayed by bullet 4. Fallback on query failure **MUST** be the last pushed active set (or idle), not the unfiltered catalog (§4.4, §4.6.2).

#### 4.6.2 Error Handling

Players **MUST** handle failures gracefully:

| Error Condition | Required Behavior |
|:----------------|:------------------|
| Network failure | Continue playing static content, retry with exponential backoff (optional). When `byDisplayAt` is `true`, continue the **last pushed active set** (or idle if empty), not the unfiltered catalog. |
| Invalid response | Log error, continue with static content, do not crash. When `byDisplayAt` is `true`, continue the **last pushed active set** (or idle if empty). |
| Missing template placeholder | Skip query execution, show static content. When `byDisplayAt` is `true`, show the **last pushed active set** (or idle if empty). |
| Signature verification failed | Reject entire playlist per DP-1 §7.1. |
| Schema validation failed | Log error, discard invalid items, show valid items only. When `byDisplayAt` is `true`, continue the **last pushed active set** (or idle if empty) and hand only accepted items to the control layer — do not paint an unfiltered partial catalog. Invalid dynamic `displayAt` alone **MUST NOT** discard an otherwise-valid item (§4.5). |

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
- When `schedule.byDisplayAt` is `true`, verification **MUST** use the full catalog document **before** active-set filtering; the filtered playback list pushed to the player is **not** a separately signed object (§3.5)
- **`displayAt` on items returned by `dynamicQuery` is not part of the signed payload** and **MUST NOT** affect active-set filtering (§3.5.6)

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
- Parse all extended playlist fields (catalog UIs **MAY** display them; wall players that only receive pre-filtered active sets are not required to surface `displayAt` / `schedule` in the UI)
- Verify playlist signatures per DP-1 §7.1 on the full catalog document before active-set filtering when `byDisplayAt` is `true`
- Handle missing optional fields gracefully
- Any playback stack that accepts playlists with `schedule.byDisplayAt: true` for wall playback **MUST** implement active-set filtering, timer push, and playhead handoff per §3.5 in the device control layer. Catalog-only clients that never push playback **MAY** omit filtering and **MUST NOT** claim scheduled wall-playback compliance.
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
- Signature verification of full catalog (`schedule`, static `displayAt`, archive/future items) **before** active-set filter when `byDisplayAt` is `true`
- `schedule.byDisplayAt`: active set = latest past cohort + evergreen (order preserved)
- `schedule.byDisplayAt` absent or `false`: play full list; ignore `displayAt` for filtering
- `displayAt` timezone forms: date-only (= local midnight), bare local vs `Z` / offset absolute equality; compact offset rejected; DST gap/fold rules for bare local
- Invalid `displayAt` excluded from timed cohort and timers (not evergreen)
- Timer threshold: immediate active-set push; does not wait for `duration`/`loop`
- Unchanged-set skip: same identity sequence **and** same `source` per item; `source` change on same `id` forces push
- Cursor rule 1: when `max_instant` changes to non-empty, start at first timed-cohort item (playhead handoff; not leading evergreen)
- Cursor rule 2: when a non-empty list is pushed and `max_instant` is unchanged, handoff **MUST** name the continued item via `start.id` / `start.source` / `start.index`; empty/idle pushes need no start descriptor
- Clock/timezone change on playback device triggers recompute (§3.5.4 step 3)
- Multiple items same `displayAt` instant in timed cohort (§3.5.3 example B+C)
- Empty active set: push empty/idle (no start descriptor); player **MAY** idle/blank or hold last frame
- Future-only `displayAt`: active set is evergreen items only
- Fast-start: wait for first filtered push; no flash of archive/future static items (§3.5.6.1)
- Composition: `byDisplayAt` + `dynamicQuery`; single executor; ignore unsigned `displayAt` on dynamic items (treat as evergreen for membership); membership change with unchanged `max_instant` → push with continue handoff
- Schema validation under `byDisplayAt`: last pushed active set (or idle); invalid dynamic `displayAt` alone does not discard the item
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
- Documented playlist-level **`schedule.byDisplayAt`** and item-level **`displayAt`** (ISO 8601 subset: date-only as local midnight, local datetime with seconds, or RFC 3339 `date-time` with bounded offset).
- Normative split: device control layer filters and timers; player plays the pre-filtered active set only (no Daily-specific player logic). Aligns with [feral-file#3440 design](https://github.com/feral-file/feral-file/issues/3440#issuecomment-5031173091).
- When `byDisplayAt` is `true`, implementations **MUST** resolve each `displayAt` to an instant (§3.5.2; bare local / date-only = **playback-device** local, with DST gap/fold rules), filter to the active set (most recent release ≤ now + evergreen; empty *past* → evergreen only), preserve order, and advance via timer with **immediate push** on threshold (does not wait for `duration`/`loop`).
- Playback cursor on cohort change: start at the first timed-cohort item (Daily midnight surfaces the new day work, not a leading evergreen restart). Empty active set short-circuits cursor rules.
- Empty active set: push empty/idle; player **MAY** idle/blank or hold last frame.
- Favorites / non-scheduled copies: **SHOULD** strip `displayAt`; destination **MUST NOT** enable `byDisplayAt` unless filtering is intentional.
- Unchanged-set skip requires same identity sequence **and** same `source` per item; playhead handoff uses `start.id` / `start.source` / `start.index`.
- Recompute also on material playback-device clock or timezone changes.
- Signatures verify the full catalog before filtering; the pushed active set is not separately signed.
- Composition with `dynamicQuery`: control layer owns playback lists; single executor; wait for first filtered push (no catalog flash); static-first effective list order; ignore unsigned `displayAt` on dynamic items (evergreen for membership).
- Offset wire form: colon required; hours `00–23`, minutes `00–59`; compact `+0700` rejected.
- §7.1 badge: wall playback with `byDisplayAt: true` **MUST** implement §3.5; catalog-only clients may omit without claiming scheduled playback.
- `DisplayAt` schema `oneOf`: date-only / local datetime / absolute `date-time` (mutually exclusive patterns).
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
      "description": "Playlist-level scheduling controls. When byDisplayAt is true, the device control layer filters items to an active set based on each item's displayAt and pushes only that set to the player.",
      "properties": {
        "byDisplayAt": {
          "type": "boolean",
          "description": "When true, the device control layer MUST filter playlist items to the active set for the current time using displayAt and push only that set to the player. When false or absent, play all items (core behavior) and ignore displayAt for filtering."
        }
      }
    },
    "DisplayAt": {
      "description": "ISO 8601 subset when this item becomes eligible for the active set. Date-only (YYYY-MM-DD): playback-device local midnight. Local datetime without timezone: playback-device local. RFC 3339 date-time with Z or offset (hours 00-23, minutes 00-59): absolute/global. Top-level item field (same level as source), not inside display. Branches use mutually exclusive patterns so oneOf works without Format-Assertion vocabulary. Patterns are syntactic only; invalid calendar values are rejected at resolve time.",
      "oneOf": [
        {
          "title": "Date-only (playback-device local midnight)",
          "type": "string",
          "pattern": "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$"
        },
        {
          "title": "Local datetime without timezone (playback-device local)",
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
