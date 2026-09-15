# Item-level fixtures

These exercise `../../playlist_item_with_extension.json`, the composed schema a consumer applies to a single `PlaylistItem` carrying this extension. The playlist-level example one directory up exercises `playlist_with_extension.json` instead; the two paths are validated separately so they cannot drift apart.

| Location | Contract |
|:---------|:---------|
| `*.json` here | A standalone `PlaylistItem` that **MUST** validate. |
| `rejected/*.json` | A `PlaylistItem` that **MUST** be refused. |

Both directories are walked by the "Validate item examples against the single-item composed schema" step in `.github/workflows/lint.yaml`.

Each `rejected/` fixture changes one thing relative to a passing item and is named after that change. A passing fixture proves a field is allowed; the rejected one proves it is checked.

Nothing here is normative. The specification's illustrative snippets live in [content-rating.md](../../content-rating.md).
