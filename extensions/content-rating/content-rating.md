# DP-1 Content Rating Extension (v0.1.0)

*A signed, per-item audience label that travels with the playlist.*

**Specification version:** 0.1.0  
**Status:** Draft Extension  
**DP-1 compatibility:** v1.0.0+  
**Published:** 2026-09-14

---

## 1 · Purpose & Scope

The **Content Rating Extension** lets the person who signs a playlist say, per item, which audience the work is for. It adds two optional fields to a `PlaylistItem`:

1. **`contentRating`**: an audience label. This version defines two values, `general` and `mature`.
2. **`contentReasons`**: optional free-text reasons, in the curator's own words, supporting the label.

Both fields are covered by the playlist signature (DP-1 §7.1). A consumer that filters on them is acting on the curator's judgment, not on an inspection of the media.

The extension defines the label and its meaning. It does not define viewer policy. Whether a device shows mature work, what it does with unrated work, and who may change that setting are consumer concerns (§4.1).

### 1.1 Relationship to Core DP-1

- **Extends:** `PlaylistItem` (DP-1 §3)
- **Transport:** Standard DP-1 transport (§8)
- **Signatures:** Covered by DP-1 playlist signatures (§7.1)
- **Composes with:** the Playlist Extension (`extensions/playlists`), see §3.4
- **Versioning:** Independent extension versioning (§7)

### 1.2 What this extension is not

- Not a claim that the media was inspected. The label is a curatorial judgment by the signer.
- Not a content-classification taxonomy. `contentReasons` is an open vocabulary and consumers **MUST NOT** treat its values as protocol-defined.
- Not a parental-control mechanism. Filtering happens on the consumer, and this extension carries no enforcement guarantee.
- Not an audience declaration. `contentRating` says what to exclude, not whom a work is for. Suitability for an audience (for example, a show curated for children, with an age floor) is a positive declaration by a curator on a playlist or channel and is reserved for a separate future `audience` field. It will not be expressed as additional `contentRating` values.

---

## 2 · Terminology

| Term | Definition |
|:-----|:-----------|
| **Rated item** | A `PlaylistItem` that carries a `contentRating`. |
| **Unrated item** | A `PlaylistItem` with no `contentRating` member. |
| **Extension-aware consumer** | A player, feed, or tool that validates and acts on this extension. |
| **Non-aware consumer** | A player, feed, or tool that implements DP-1 core (and possibly other extensions) but not this one. |
| **Playback projection** | The list of items a consumer actually plays after applying its own policy; derived from a signed document, never itself a signed document. |

---

## 3 · Item Fields

### 3.1 Playlist item JSON with the extension

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "title": "Anatomy Lesson",
  "source": "https://cdn.example.com/anatomy-lesson.html",
  "contentRating": "mature",
  "contentReasons": ["nudity", "medical imagery"]
}
```

### 3.2 Field reference

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `contentRating` | string | OPTIONAL | Curatorial audience label. Values defined by this version: `general`, `mature`. Absence, or a value a consumer does not recognize, means unrated. |
| `contentReasons` | array of strings | OPTIONAL | Reasons supporting `contentRating`, in the curator's own vocabulary. Each entry **MUST** be a non-empty string. An empty array is valid and means the curator gave no reasons. |

Both fields sit at the top level of the item, beside `source`, not inside `display`.

### 3.3 Semantics

- **Absence is unrated.** A missing `contentRating` says nothing about the work. Consumers **MUST NOT** infer `general` from absence.
- **An unrecognized value is unrated.** Nothing is assumed from a label a consumer does not know. A consumer **MUST** treat a `contentRating` outside the values it implements exactly as if the member were absent, and **MUST NOT** refuse the document, hide the item, or infer `mature` from it. The vocabulary is open on the wire so that publishers can label ahead of consumers; a consumer acts only on the values it knows.
- **`mature` is the only value that hides anything.** It is the label a curator applies so that a viewer does not come across the work by accident. `general` is a positive statement and has no filtering effect beyond confirming that no label was withheld.
- **`null` is a type error.** `contentRating` is a string; `null` or a non-string fails schema validation like any other malformed member. The wire form for "no label" is omitting the member.
- **Reasons do not change the label.** `contentReasons` is explanatory. A consumer **MAY** show it and **MUST NOT** filter on it as if it were a controlled taxonomy.
- **Reasons without a rating.** `contentReasons` **MAY** appear on an item with no `contentRating`. Validation accepts it; consumers **SHOULD** treat such an item as unrated.

### 3.4 Composition with the Playlist Extension

This extension is an `allOf` overlay on `PlaylistItem`. Four composed schemas are published so validators can pick the pair that matches the document:

| Composed schema | Validates |
|:----------------|:----------|
| `playlist_with_extension.json` | A core playlist plus this extension. |
| `playlist_item_with_extension.json` | A single core `PlaylistItem` plus this extension. |
| `playlist_with_playlists_extension.json` | A playlist using the Playlist Extension (v0.2.0) plus this extension, including `dynamicQuery` playlists whose static `items` array is empty. |
| `playlist_item_with_playlists_extension.json` | A single item using the Playlist Extension plus this extension; the schema for items accepted from `dynamicQuery` when both extensions are in use. |

All four resolve to the same `schema.json#/$defs/PlaylistItemExtension`, so the whole-playlist and single-item paths cannot drift apart. The canonical core `playlist.json` is unchanged.

### 3.5 Validation path

An extension-aware consumer **MUST** validate against the composed schema before decoding, in the order DP-1 core prescribes: schema, then signature, then typed decode. A document that fails the extension schema is malformed (`playlistInvalid`, §4.3), not unrated.

Items accepted from `dynamicQuery` (Playlist Extension §4.5.1) **MUST** be validated with the single-item composed schema for the extensions in use.

---

## 4 · Consumer Behavior

### 4.1 Filtering is a consumer concern

Consumers **MAY** exclude items from playback based on `contentRating`. The policy that decides what to exclude, who can change it, and how unrated items are handled is outside this extension. A reference consumer, for example, keeps a device-local viewing preference that hides `mature` items by default and treats unrated items as allowed until an operator says otherwise. Another consumer may make a different choice. The extension constrains only what the label means.

### 4.2 Filtered projections and signatures

Filtering produces a playback projection, not a new playlist. A consumer that removes items:

- **MUST NOT** present the projection as a signed document. The signatures of the source document cover the full item list; a subset does not verify against them.
- **MUST** verify the signature on the original bytes (DP-1 §7.1) before filtering, never on a re-encoded projection.
- **SHOULD** keep the original document so that a later policy change can restore items without a refetch.

### 4.3 Error codes

This extension reserves one code for the player-to-UI table in DP-1 §14:

| Code | Scenario | User message |
|:-----|:---------|:-------------|
| `contentBlocked` | Every item in an otherwise valid document is excluded by the consumer's content policy, so nothing can play. | "Content hidden by your viewing settings." |

Malformed labels or reasons are a schema failure and use the existing `playlistInvalid`. `contentBlocked` is for valid documents the consumer chose not to play.

### 4.4 Non-aware consumers

DP-1 core permits item properties it does not describe. A consumer that does not implement this extension **MUST** still accept a document that carries these fields, and **SHOULD** ignore them rather than fail the decode. Such a consumer plays every item; that is the expected behavior of a player that has not opted into ratings, and publishers **MUST NOT** rely on a rating being honored by a consumer that has not declared support (§6).

---

## 5 · Signatures

Playlists carrying this extension are signed per DP-1 §7.1. `contentRating` and `contentReasons` are ordinary members of the item and are part of the canonical payload, so changing a label invalidates the signature. There is no separate rating signature.

---

## 6 · Compliance

### 6.1 Extension Badge: "DP-1 Content Rating v0.1"

**Requirements:**

- Validate documents with the composed schema for the extensions in use (§3.4) before decoding.
- Reject non-string `contentRating` and malformed `contentReasons` as `playlistInvalid`.
- Treat absence and any unrecognized `contentRating` value as unrated; never infer `general` or `mature` from either.
- Hide only `mature`, and only when the consumer's own policy says so.
- When filtering, verify signatures on the original bytes and never re-sign a projection (§4.2).
- Report `contentBlocked` when policy excludes every item of a valid document (§4.3).
- Pass the fixtures in `examples/`: the playlist and item examples **MUST** validate; every file under `examples/items/rejected/` **MUST** be refused.

---

## 7 · Versioning

This extension follows SemVer independently of DP-1 core:

- **Major:** a change to the meaning of an existing label, or removal of a field.
- **Minor:** a new label value or a new optional field. Because consumers treat unknown labels as unrated (§3.3), a new label degrades safely: older consumers play the item as if it were unlabeled. A new value that is meant to hide content therefore protects viewers only on consumers that have adopted it, and publishers **SHOULD** keep using `mature` for anything that must be hidden today.
- **Patch:** editorial changes and clarifications.

Current version: **0.1.0**

The `contentRating` vocabulary is open on the wire and expected to stay small in practice. Audience suitability and age ranges are out of scope for this field at every version (§1.2); a consumer that wants an allow-list for a child's profile should expect a separate `audience` extension rather than new values here.

---

## 8 · Governance

- **Maintained by:** Feral File (2025-2026)
- **Community input:** GitHub discussions and pull requests
- **Proposing changes:** the process in `extensions/registry.json` (`governance.process`)

---

## 9 · References

- **DP-1 Core Specification:** `core/v1.1.0/spec.md`
- **DP-1 Playlist Extension:** `extensions/playlists/playlist.md`
- **Reference implementation:** [display-protocol/dp1-go](https://github.com/display-protocol/dp1-go), `extension/contentrating`
- **RFC 8785 (JCS):** https://www.rfc-editor.org/rfc/rfc8785
- **JSON Schema Draft 2020-12:** https://json-schema.org/

---

## 10 · Changelog

### v0.1.0 (2026-09-14)

**Initial draft release of the Content Rating Extension.**

- Per-item `contentRating` (defined values `general` and `mature`; absence or an unrecognized value is unrated; nothing is assumed from a label a consumer does not know) and `contentReasons` (open-vocabulary non-empty strings).
- Four composed schemas covering core and Playlist Extension documents and single items.
- Consumer rules: filtering is a consumer concern; projections are never signed; `contentBlocked` reserved for valid documents fully excluded by policy; non-aware consumers accept and ignore.
- Fixtures under `examples/`.
- Scope boundary: audience suitability (for whom, age ranges) is reserved for a separate future `audience` field on playlists and channels, never as new `contentRating` values.

---

## Appendix A · JSON Schema

The normative schema is `extensions/content-rating/schema.json`, reproduced here for reference.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://dp1.feralfile.com/extensions/content-rating/v0.1.0/schema.json",
  "title": "DP-1 Content Rating Extension",
  "description": "Optional signed, per-item audience labels and open-vocabulary curatorial reasons.",
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/PlaylistItemExtension"
      }
    }
  },
  "$defs": {
    "PlaylistItemExtension": {
      "type": "object",
      "properties": {
        "contentRating": {
          "type": "string",
          "description": "Curatorial audience label. Values defined by v0.1.0: general, mature. Absence, or a value the consumer does not recognize, means unrated; nothing is assumed from an unknown label. Non-string values are invalid."
        },
        "contentReasons": {
          "type": "array",
          "description": "Optional open-vocabulary curatorial reasons supporting contentRating. Consumers must not treat values as a closed protocol taxonomy.",
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    }
  }
}
```
