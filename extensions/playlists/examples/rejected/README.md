# Playlist-level rejected fixtures

| Location | Contract |
|:---------|:---------|
| `../*.json` | A full playlist using this extension that **MUST** validate. |
| `*.json` here | A full playlist that **MUST** be refused. |

Same reasoning as [`../items/rejected`](../items/rejected), one level up. A
passing example proves a field is *allowed*; it cannot prove the field is
*checked*, because an undeclared property is unconstrained rather than invalid.
Each fixture here is a **single-field mutation** of a passing playlist, named
after that change, so if the constraint it violates ever drops out of
`../../schema.json` the fixture starts validating and CI fails.

Both directories are walked by the "Validate examples against their composed
schema" step in `.github/workflows/lint.yaml`.

Nothing here is normative. These are test inputs; the specification's
illustrative snippets live in [playlist.md](../../playlist.md).
