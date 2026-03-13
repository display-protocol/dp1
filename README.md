# DP-1 Protocol

DP-1 is an open, vendor-neutral protocol for signed digital art playlists and optional preservation capsules (`.dp1c`).

## Canonical version

- The canonical core specification in this repository is **DP-1 v1.1.0**.
- Version pointer: [`core/latest`](core/latest)
- Source of truth: [`core/v1.1.0/spec.md`](core/v1.1.0/spec.md)

## Validate first

Before building feed or player integrations, validate one playlist payload.

- Validator repo: [display-protocol/dp1-validator](https://github.com/display-protocol/dp1-validator)
- Validator command (base64 payload):

```bash
./dp1-validator playlist --playlist "<base64-encoded-playlist-json>"
```

If signatures are present, add `--pubkey` as required by your validation flow.

## Compatibility at a glance

| Area | Version | Status | Notes |
| :--- | :--- | :--- | :--- |
| DP-1 core spec (this repo) | `1.1.0` | Current | Multi-signature model (`signatures`) is defined in core v1.1.0. |
| DP-1 legacy playlists | `1.0.x` | Legacy compatible | Single `signature` format remains supported by v1.1.0 players. |
| dp1-validator examples | Mostly `1.0.0` payloads | Transitional ecosystem state | Useful for first validation; align to your toolchain output. |
| dp1-feed OpenAPI (`dp1-feed` repo) | API `1.0.0` | Current for that API surface | Feed API version is separate from playlist spec SemVer. |
| Core/extensions implementation parity across repos | N/A | Must verify per integration | Validate in feed/player/tool repos before claiming full parity. |

## Canonical entry points

- Core specification: [`core/v1.1.0/spec.md`](core/v1.1.0/spec.md)
- Ref manifest specification: [`core/v1.1.0/ref-manifest.md`](core/v1.1.0/ref-manifest.md)
- Extension registry: [`extensions/registry.json`](extensions/registry.json)
- Feed implementation and OpenAPI: [display-protocol/dp1-feed](https://github.com/display-protocol/dp1-feed)
- Validator implementation: [display-protocol/dp1-validator](https://github.com/display-protocol/dp1-validator)

## Reference hardware path

FF1 is a reference hardware/player path for DP-1, not the definition of DP-1 itself.

## Guided integration flow

For a guided first-run integration route, see: <https://docs.feralfile.com/dp1-protocol/overview/>

## License

Creative Commons Attribution 4.0 International Public License

Copyright (c) 2025 Feral File

For detailed terms and conditions, please refer to the [LICENSE](LICENSE) file.

---

*Part of the Feral File ecosystem for blockchain-native digital art.*
