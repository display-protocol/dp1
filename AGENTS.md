# DP-1 Protocol AI Agent Documentation

AI agent guidance for the DP-1 protocol - a platform-neutral protocol for blockchain-native digital art distribution with AI-first mobile controller design.

## Core Architecture
- **Specification**: Protocol docs in `/docs`
- **Prototype**: Cloudflare Workers implementation in `/prototype`
- **Storage**: JSON-only state in key-value databases (no SQL)
- **APIs**: RESTful JSON for all interactions
- **Philosophy**: "MIDI for art" - hackable, scriptable, AI-accessible

## Key Capabilities
- Playlist management with DP-1 schema validation
- AI-powered art curation from natural language
- Ed25519 signature verification for provenance
- Device control through RESTful APIs
- JSON state storage with `{type}:{id}` key patterns

## AI Integration
- Workers AI as default inference provider
- Structured JSON outputs with `response_format`
- Vectorize for art embeddings and similarity search
- KV caching for AI responses
- Budget limits and cost management

## Development Setup

### Essential Tools
```bash
# Install Node.js v18+, pnpm, and Wrangler
npm install -g pnpm wrangler

# Create Next.js client (deployed to Cloudflare Pages)
pnpm create next-app@latest prototype-ui --typescript --tailwind --eslint --app

# Create Cloudflare Worker server
wrangler init prototype-worker --type typescript

# Start development servers
npx wrangler dev --port 8787 --live-reload  # Worker server
pnpm dev                                     # Next.js client
```

### Testing Requirements
**Always reference [Cloudflare Workers API documentation](https://developers.cloudflare.com/workers/llms-full.txt)**

#### Quick Test Commands
```bash
# Unit tests with Vitest
npx vitest run

# API testing
curl -X GET http://localhost:8787/api/v1/playlists
```

#### Verification Checklist
1. Unit tests pass: `npm test`
2. Worker runs: `npx wrangler dev`
3. API responds: curl tests return JSON
4. Schema validation works
5. TypeScript compiles

## Prototype Architecture

### Client-Server Setup
**Server**: Cloudflare Worker (TypeScript) - API backend deployed to Workers
**Client**: Next.js (TypeScript) - UI frontend deployed to Cloudflare Pages

### Two-Panel UI Layout (Next.js Client)
**Left Panel**: DP-1 playlist player with artwork rendering and controls
**Right Panel**: Chat interface for natural language commands

### Communication Flow
```
Next.js Client → Cloudflare Worker API → Response
Chat Panel → PUT /api/playlist → Player Panel Update
```

### Configuration
**Worker**: TypeScript with ES modules, `compatibility_date = "2025-03-07"`
**Next.js**: Static export for Cloudflare Pages deployment

## Dev Environment Tips

### Workspace Management
- Use `pnpm dlx turbo run dev --filter <project_name>` to jump to a specific package
- Run `pnpm install --filter <project_name>` to add packages to workspace
- Use `pnpm create next-app@latest <project_name> --typescript --tailwind --eslint --app` for Next.js client
- Check the `name` field in each package's `package.json` for correct package names

### Quick Commands
```bash
# Development (run both simultaneously)
npx wrangler dev --port 8787 --live-reload  # Worker server
pnpm dev --filter prototype-ui               # Next.js client

# Testing
npx vitest run                               # Worker tests
pnpm test --filter prototype-ui              # Next.js tests

# Deployment
wrangler deploy --env staging                # Deploy Worker
pnpm build && pnpm pages:deploy              # Deploy Next.js to Pages
```

### Next.js + Cloudflare Pages Setup
```bash
# Configure Next.js for static export (required for Pages)
# Add to next.config.js:
# output: 'export'
# trailingSlash: true
# images: { unoptimized: true }

# Deploy to Cloudflare Pages
pnpm add @cloudflare/next-on-pages
pnpm build
npx @cloudflare/next-on-pages
```

