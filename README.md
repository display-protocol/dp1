# DP-1 Protocol

DP‑1 is an open, vendor‑neutral protocol that bundles a digitally signed JSON “playlist” (plus an optional long‑term capsule) so any compliant player—from museum screens to home frames—can display blockchain‑native, code‑based art exactly as the artist intended. Like MIDI or RSS in their domains, it supplies a common rail gauge that ends today’s patchwork of ad‑hoc embed codes, broken CDN links and browser‑specific hacks. Urgency comes from the wave of generative NFTs now aging out of their original runtimes: if we don’t lock in a lightweight standard, artworks will keep degrading or disappearing. Feral File is seeding DP‑1—hosting the spec, shipping validator tools and using its own FF1 devices as the first reference implementation—while inviting independent nodes to prove interoperability. 

The near‑term goal is a stable v 1.0 with a public badge program; the longer‑range vision is a durable network where curators publish once and reach every screen. The protocol itself remains free and open‑source so the ecosystem can thrive without locking the rails. 

## Key Features

- **AI-First Design**: Natural language commands for playlist generation and device control
- **Blockchain Security**: Ed25519 signature verification ensures artwork authenticity
- **Platform Neutral**: Works across Node.js, Go, and Rust implementations
- **Flexible Licensing**: Support for open, token-gated, and subscription-based access
- **Capsule Format**: Self-contained `.dp1c` files with artwork and metadata

## Repository Structure

```
docs/       - Protocol specification and documentation
prototype/  - Cloudflare Workers reference implementation
```

## Quick Start

1. **Read the Specification**: Start with `docs/` for the complete DP-1 protocol definition
2. **Try the Prototype**: Explore `prototype/` for a Cloudflare Worker API and a separate Next.js client
   ```bash
   # build the client for Cloudflare Pages
   npm run build
   # start the Worker locally
   npm run worker
   ```
   Deploy the client to Pages and the API worker separately.
   See the [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/llms-full.txt) for details.
 The client features a responsive three-panel UI (player, chat, and document). The chat panel shows a message-style log with the command box at the bottom.
3. **Build Hardware**: Use the spec to implement DP-1 on your preferred platform

### Headless Testing
Run `npm run headless` to build the client and verify the UI with Puppeteer. This test should pass before submitting client changes.

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

See `docs/api/README.md` for example API requests and responses.
