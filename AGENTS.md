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

## Pull Request Guidelines

### Conventional Commits
All commits and PR titles must follow [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/#specification):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Required Types
- `feat:` - New features (correlates with MINOR version)
- `fix:` - Bug fixes (correlates with PATCH version)
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring without feature changes
- `chore:` - Maintenance tasks, dependency updates

#### Breaking Changes
- Add `!` after type: `feat!: redesign playlist API`
- Or use footer: `BREAKING CHANGE: playlist format changed`

#### Examples
```bash
feat(worker): add AI playlist generation endpoint
fix(ui): resolve chat panel scroll issue
docs: update API documentation for v1.2.0
test(playlist): add validation test cases
```

## Prototype Architecture

See `prototype/client/AGENTS.md` for Next.js client instructions.

### Server Setup
**Server**: Cloudflare Worker (TypeScript) - API backend deployed to Workers

### Configuration
**Worker**: TypeScript with ES modules, `compatibility_date = "2025-03-07"`

## Dev Environment Tips

### Quick Commands
```bash
# Development
npx wrangler dev --port 8787 --live-reload  # Worker server

# Testing
npx vitest run                               # Worker tests

# Deployment
wrangler deploy --env staging
```

