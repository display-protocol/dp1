# Item-level fixtures

These exercise `../../playlist_item_with_extension.json` — the composed schema §4.5.1 mandates for `dynamicQuery` items. The playlist-level examples one directory up exercise `playlist_with_extension.json` instead; the two paths are validated separately because they can drift apart (see [#45](https://github.com/display-protocol/dp1/issues/45)).

| Location | Contract |
|:---------|:---------|
| `*.json` here | A standalone `PlaylistItem` that **MUST** validate. |
| `rejected/*.json` | A `PlaylistItem` that **MUST** be refused. |

Both directories are walked by the "Validate item examples against the single-item composed schema" step in `.github/workflows/lint.yaml`.

## Why `rejected/` carries the signal

A passing fixture proves a field is *allowed*. It cannot prove a field is *checked*: an undeclared property is unconstrained, not invalid, so `item-with-inline-manifest.json` validated just as happily against the schema before [#46](https://github.com/display-protocol/dp1/pull/46) fixed it, when `inlineManifest` was absent from the overlay entirely.

The `rejected/` fixtures close that hole. Each is a single-field mutation of an item that would otherwise pass, so if the constraint it violates ever drops out of the schema, the fixture starts validating and CI fails.

## Adding a fixture

Change **one** thing relative to a passing item, and name the file after that change. A fixture that violates two constraints still fails when one of them is removed, so it stops testing what its name claims.

Nothing here is normative. These are test inputs, not published examples — the specification's illustrative snippets live in [playlist.md](../../playlist.md).
