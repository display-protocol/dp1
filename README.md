# DP-1 Protocol

DP-1 is an open, vendor-neutral protocol for signed digital art playlists and optional preservation capsules (`.dp1c`).

## Canonical version

- The canonical core specification in this repository is **DP-1 v1.1.0**.
- Version pointer: [`core/latest`](core/latest)
- Source of truth: [`core/v1.1.0/spec.md`](core/v1.1.0/spec.md)

## Validate first

Before building feed or player integrations, validate a playlist payload locally.

- **CLI:** [display-protocol/dp1-cli](https://github.com/display-protocol/dp1-cli) — validate, sign, verify, and publish DP-1 documents (successor to the unmaintained [dp1-validator](https://github.com/display-protocol/dp1-validator))
- **Library:** [display-protocol/dp1-go](https://github.com/display-protocol/dp1-go) — schema validation and multi-signatures (used by dp1-cli and dp1-feed-v2)

Install and validate a playlist file:

```bash
go install github.com/display-protocol/dp1-cli@latest
dp1 init
dp1 playlist validate ./playlist.json
```

Machine-readable output for CI:

```bash
dp1 playlist validate ./playlist.json --json
```

## Ecosystem implementations

| Project | Role |
| :--- | :--- |
| [dp1-cli](https://github.com/display-protocol/dp1-cli) | Command-line client: validate, sign, verify, draft, and publish to a compatible feed |
| [dp1-feed-v2](https://github.com/display-protocol/dp1-feed-v2) | Spec-compliant HTTP API: create, sign, store, and serve playlists, playlist-groups, and channels |
| [dp1-go](https://github.com/display-protocol/dp1-go) | Go library for DP-1 validation, canonical signing, and verification |

**Feed quick start:** run a local server with Docker (`make up`) or `go run ./cmd/server` — see the [dp1-feed-v2 README](https://github.com/display-protocol/dp1-feed-v2#quick-start). Publish from the CLI when a feed URL and API key are configured (`DP1_FEED_URL`, `DP1_FEED_API_KEY`, or `~/.dp1/config.yaml`).

## Compatibility at a glance

| Area | Version | Status | Notes |
| :--- | :--- | :--- | :--- |
| DP-1 core spec (this repo) | `1.1.0` | Current | Multi-signature model (`signatures`) is defined in core v1.1.0. |
| DP-1 legacy playlists | `1.0.x` | Legacy compatible | Single `signature` format remains supported by v1.1.0 players. |
| dp1-cli / dp1-go | DP-1 `1.1.0` | Current | Primary toolchain for validation and signing; replaces unmaintained dp1-validator. |
| dp1-feed-v2 OpenAPI | API `v1` under `/api/v1` | Current | Feed API version is separate from playlist spec SemVer. |
| Core/extensions implementation parity across repos | N/A | Must verify per integration | Validate in feed/player/tool repos before claiming full parity. |

## Canonical entry points

- Core specification: [`core/v1.1.0/spec.md`](core/v1.1.0/spec.md)
- Ref manifest specification: [`core/v1.1.0/ref-manifest.md`](core/v1.1.0/ref-manifest.md)
- Extension registry: [`extensions/registry.json`](extensions/registry.json)
- Feed server and OpenAPI: [display-protocol/dp1-feed-v2](https://github.com/display-protocol/dp1-feed-v2) — [`api/openapi.yaml`](https://github.com/display-protocol/dp1-feed-v2/blob/main/api/openapi.yaml)
- CLI: [display-protocol/dp1-cli](https://github.com/display-protocol/dp1-cli) — [`docs/cli_design.md`](https://github.com/display-protocol/dp1-cli/blob/main/docs/cli_design.md)
- Go library: [display-protocol/dp1-go](https://github.com/display-protocol/dp1-go)

## Reference hardware path

The Art Computer (model FF1) is a reference hardware/player path for DP-1, not the definition of DP-1 itself.

## Guided integration flow

For a guided first-run integration route, see: <https://docs.feralfile.com/dp1-protocol/overview/>

## License

Creative Commons Attribution 4.0 International Public License

Copyright (c) 2025 Feral File

For detailed terms and conditions, please refer to the [LICENSE](LICENSE) file.

---

*Part of the Feral File ecosystem for blockchain-native digital art.*
