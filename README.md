# DP-1 Protocol

### Validator
[![Build Status](https://img.shields.io/github/actions/workflow/status/feral-file/dp-1/test-validator.yaml?branch=main&label=build%20status&logo=github)](https://github.com/feral-file/dp-1/actions/workflows/test-validator.yaml)
[![Linter](https://img.shields.io/github/actions/workflow/status/feral-file/dp-1/lint-validator.yaml?branch=main&label=linter&logo=github)](https://github.com/feral-file/dp-1/actions/workflows/lint-validator.yaml)
[![Code Coverage](https://img.shields.io/codecov/c/github/feral-file/dp-1/main?label=code%20coverage&logo=codecov)](https://codecov.io/gh/feral-file/dp-1)

### Server
[![Build Status](https://img.shields.io/github/actions/workflow/status/feral-file/dp-1/test-server.yaml?branch=main&label=build%20status&logo=github)](https://github.com/feral-file/dp-1/actions/workflows/test-server.yaml)
[![Linter](https://img.shields.io/github/actions/workflow/status/feral-file/dp-1/lint-server.yaml?branch=main&label=linter&logo=github)](https://github.com/feral-file/dp-1/actions/workflows/lint-server.yaml)

DP‑1 is an open, vendor‑neutral protocol that bundles a digitally signed JSON "playlist" (plus an optional long‑term capsule) so any compliant player—from museum screens to home frames—can display blockchain‑native, code‑based art exactly as the artist intended. Like MIDI or RSS in their domains, it supplies a common rail gauge that ends today's patchwork of ad‑hoc embed codes, broken CDN links and browser‑specific hacks. Urgency comes from the wave of generative NFTs now aging out of their original runtimes: if we don't lock in a lightweight standard, artworks will keep degrading or disappearing. Feral File is seeding DP‑1—hosting the spec, shipping validator tools and using its own FF1 devices as the first reference implementation—while inviting independent nodes to prove interoperability. 

The near‑term goal is a stable v 1.0 with a public badge program; the longer‑range vision is a durable network where curators publish once and reach every screen. The protocol itself remains free and open‑source so the ecosystem can thrive without locking the rails. 

## Key Features

- **AI-First Design**: Natural language commands for playlist generation and device control
- **Blockchain Security**: Ed25519 signature verification ensures artwork authenticity
- **Platform Neutral**: Works across Node.js, Go, and Rust implementations
- **Flexible Licensing**: Support for open, token-gated, and subscription-based access
- **Capsule Format**: Self-contained `.dp1c` files with artwork and metadata

## Repository Structure

```
docs/
├── spec.md                     # DP-1 Protocol Specification
├── api/
    └── openapi.yaml            # OpenAPI 3.1.0 API specification

prototype/
└── server/                           # Cloudflare Workers API implementation
    ├── README.md                     # Server setup and deployment guide
    ├── src/                          # TypeScript source code
    ├── tests/                        # Unit and integration tests
    └── wrangler.toml                 # Cloudflare Workers configuration
```

## Getting Started

### 📖 **Protocol Documentation**
Start with `docs/spec.md` for the complete DP-1 protocol specification and design principles.

### 🚀 **Server Implementation**
See `prototype/server/README.md` for detailed setup instructions for the Cloudflare Workers API server, including:
- Local development setup
- KV namespace configuration
- Authentication and secrets management
- Deployment to Cloudflare Workers

### 🎨 **Client Implementation**
A Next.js client implementation is coming soon. It will serve as a demonstration feed editor/explorer that allows users to list all playlists, view playlist details, and create new playlists.

### 🔧 **API Documentation**
Explore `docs/api/openapi.yaml` for the complete OpenAPI 3.1.0 specification with example requests and responses.

## AI-First Philosophy

DP-1 embraces five core design principles:

- **P1**: Natural language as the primary interface
- **P2**: Context-aware playlist generation
- **P3**: Seamless device coordination
- **P4**: Intelligent content discovery
- **P5**: Adaptive user experience

## License Modes

- **Open**: Public domain artworks, no restrictions
- **Token**: Wallet-based proof of ownership required
- **Subscription**: JWT-based access control

---

*Part of the Feral File ecosystem for blockchain-native digital art.*
