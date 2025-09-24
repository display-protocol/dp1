# DP-1 Protocol Specification
DP‑1 is an open, vendor‑neutral protocol that bundles a digitally signed JSON "playlist" (plus an optional long‑term capsule) so any compliant player—from museum screens to home frames—can display blockchain‑native, code‑based art exactly as the artist intended. Like MIDI or RSS in their domains, it supplies a common rail gauge that ends today's patchwork of ad‑hoc embed codes, broken CDN links and browser‑specific hacks. Urgency comes from the wave of generative NFTs now aging out of their original runtimes: if we don't lock in a lightweight standard, artworks will keep degrading or disappearing. Feral File is seeding DP‑1—hosting the spec, shipping validator tools and using its own FF1 devices as the first reference implementation—while inviting independent nodes to prove interoperability. 

The longer‑range vision is a durable network where curators publish once and reach every screen. The protocol itself remains free and open‑source so the ecosystem can thrive without locking the rails. 

## Related Repositories

### DP-1 Feed Server
**Repository**: [display-protocol/dp1-feed](https://github.com/display-protocol/dp1-feed)  
A modern API server implementing the DP-1 Feed Operator specification for blockchain-native digital art playlists. Supports both **Cloudflare Workers** (serverless) and **Node.js** (self-hosted) deployments.

**Key Features:**
- **DP-1 Compliant**: Full OpenAPI 3.1.0 implementation of DP-1 v1.0.0
- **Dual Deployment**: Cloudflare Workers (serverless) + Node.js (self-hosted)
- **Type Safety**: End-to-end TypeScript with Zod validation
- **Modern Stack**: Hono framework, Ed25519 signatures, async processing
- **Production Ready**: KV storage, queues, authentication, CORS, monitoring

### DP-1 Validator
**Repository**: [display-protocol/dp1-validator](https://github.com/display-protocol/dp1-validator)  
Go CLI validator implementation providing:
- Ed25519 signature verification for DP-1 playlists
- SHA256 asset integrity checking for `.dp1c` capsules
- Support for URLs and base64 encoded playlist data
- Library usage for Go applications

## 📄 License

Creative Commons Attribution 4.0 International Public License

Copyright (c) 2025 Feral File

For detailed terms and conditions, please refer to the [LICENSE](LICENSE) file.

---

*Part of the Feral File ecosystem for blockchain-native digital art.*
