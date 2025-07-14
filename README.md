# DP-1 Protocol
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
└── feed-api.yaml              # DP-1 Feed API specification
```

## Related Repositories

### DP-1 Feed Server
**Repository**: [display-protocol/dp1-feed](https://github.com/display-protocol/dp1-feed)  
Cloudflare Workers API implementation for the DP-1 Feed Operator API with:
- TypeScript/Hono-based REST API
- KV storage for playlists and metadata
- Zod schema validation
- Ed25519 signature verification
- Bearer token authentication

### DP-1 Validator
**Repository**: [display-protocol/dp1-validator](https://github.com/display-protocol/dp1-validator)  
Go CLI validator implementation providing:
- Ed25519 signature verification for DP-1 playlists
- SHA256 asset integrity checking for `.dp1c` capsules
- Support for URLs and base64 encoded playlist data
- Library usage for Go applications

## Getting Started

### 📖 **Protocol Documentation**
Start with `docs/spec.md` for the complete DP-1 protocol specification and design principles.

### 🚀 **Feed Server Implementation**
See the [DP-1 Feed Server repository](https://github.com/display-protocol/dp1-feed) for detailed setup instructions for the Cloudflare Workers API server, including:
- Local development setup
- KV namespace configuration
- Authentication and secrets management
- Deployment to Cloudflare Workers

### 🔧 **Validator CLI**
See the [DP-1 Validator repository](https://github.com/display-protocol/dp1-validator) for the Go command-line validator that provides:
- Ed25519 signature verification for DP-1 playlists
- SHA256 asset integrity checking for `.dp1c` capsules  
- Support for URLs and base64 encoded playlist data
- Library usage for Go applications

### 🔧 **API Documentation**
Explore `docs/feed-api.yaml` for the DP-1 Feed API specification with example requests and responses.

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
