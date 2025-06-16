# DP-1 Protocol AI Agent Documentation

This AGENTS.md file provides comprehensive guidance for AI agents working with the DP-1 protocol and FF1 mobile controller codebase.

## Project Overview

The DP-1 protocol is a platform-neutral protocol for distributing, verifying, and preserving blockchain-native digital art (BNDA), combined with an AI-first mobile controller for the FF1 hardware device.

### Architecture Overview
- **Specification**: DP-1 protocol specification and documentation in `/docs`
- **Prototype Implementation**: Reference implementation using Cloudflare Workers in `/prototype`
- **Hardware Implementation**: Production code for FF1 hardware devices (separate repositories)
- **Storage Model**: JSON-only state storage using key-value databases (no SQL)
- **API Design**: RESTful JSON APIs for all interactions

**Core Philosophy**: "MIDI for art" - Everything must be hackable, scriptable, and AI-accessible while maintaining cryptographic integrity and provenance.

## Agent Capabilities

### Primary Functions
- **Playlist Management**: Create, validate, and manage DP-1 playlists following JSON Schema 2020-12
- **Art Curation**: Generate intelligent playlists based on natural language descriptions
- **Provenance Tracking**: Verify and maintain blockchain-native digital art provenance
- **Device Control**: Manage FF1 hardware devices through RESTful APIs
- **Security Validation**: Implement Ed25519 signature verification and authentication

### AI-First Design Principles
1. **Everything is addressable text** - All state in versioned JSON stored in key-value databases
2. **GUI = optional skin** - RESTful JSON APIs designed for both human and AI consumption
3. **Command-palette first** - Natural language to typed commands
4. **Idempotent, script-friendly endpoints** - Deterministic REST operations
5. **State diffs over dumps** - JSON-patches for AI reasoning

## Codebase Navigation for AI Agents

### Directory Structure
```
docs/                 # DP-1 protocol specification and documentation
├── DP-1 Specification (Draft).md  # Core protocol specification
├── FF1 Mobile Controller_ AI-First Design Brief.md  # Design principles
└── api/              # API documentation

prototype/            # Cloudflare Workers reference implementation
├── api/              # RESTful JSON endpoints for agent interaction
├── workers/          # Cloudflare Workers (prototype runtime environment)
├── schemas/          # JSON Schema definitions for validation
├── types/           # TypeScript type definitions
├── utils/           # Shared utilities for agents
├── storage/         # JSON state storage patterns
└── tests/           # Test files for agent validation
```

### Key Files for AI Agents

#### Specification Documents
- `docs/DP-1 Specification (Draft).md` - Core DP-1 protocol specification
- `docs/FF1 Mobile Controller_ AI-First Design Brief.md` - AI-first design principles
- `docs/api/` - API documentation and examples

#### Prototype Implementation (Cloudflare Workers)
- `prototype/schemas/playlist-schema.json` - DP-1 playlist validation schema
- `prototype/types/dp1-types.ts` - Core TypeScript definitions
- `prototype/api/playlists.ts` - RESTful playlist management endpoints
- `prototype/workers/playlist-validator.ts` - Playlist validation logic
- `prototype/storage/state-models.ts` - JSON state storage patterns
- `wrangler.jsonc` - Cloudflare Workers configuration

## JSON State Storage Model

### Core Principles
- **JSON-Only State**: All application state stored as JSON in key-value databases
- **No SQL Dependencies**: Use key-value stores exclusively (Workers KV, Redis, file-based)
- **Structured Keys**: Use consistent key patterns for organization (`{type}:{id}`)
- **Versioned State**: Include version and timestamp in all state objects

### Storage Patterns
- **Device State**: `device:{deviceId}` - Device configuration and status
- **Playlist State**: `playlist:{playlistId}` - DP-1 playlist data with signature
- **Session State**: `session:{sessionId}` - User session and command history
- **User Preferences**: `user:{userId}` - User settings and preferences
- **Global Configuration**: `config:{configName}` - System-wide settings

## Natural Language Command Processing

### Supported Commands for AI Agents
- `"Generate a 2-hour ambient art playlist"` → Create playlist with duration constraints
- `"Find artworks similar to Bauhaus style"` → Vector search using embeddings
- `"Verify provenance for series ID 1234"` → Blockchain verification
- `"Display on kitchen device at 6pm"` → Scheduled device control
- `"Explain this artwork's context"` → AI-powered art analysis

## AI Integration Standards

### Workers AI Integration
- Use Workers AI as default inference provider for prototype
- Implement structured JSON outputs with `response_format`
- Support streaming responses for real-time updates
- Cache frequently used AI responses in Workers KV

### Embedding and Search
- Store art embeddings in Vectorize for prototype
- Implement semantic similarity search capabilities
- Support multi-modal embeddings (text + visual)
- Index provenance and metadata for comprehensive search

### Cost Management
- Implement per-device daily AI budget limits
- Use smaller models for simple tasks
- Cache AI responses to reduce operational costs
- Set up alerts for budget overages

## Security Standards

### Authentication Requirements
- **Ed25519 Signature Verification**: For playlist integrity
- **License Mode Support**: open, token (wallet proof), subscription (JWT)
- **Rate Limiting**: Per-device and per-user request limits
- **Input Validation**: All inputs validated against JSON schemas

### Data Protection
- Never expose private keys in responses
- Validate all content-addressed URIs
- Implement proper CORS headers
- Use structured error responses
- Encrypt sensitive data in storage

## Testing and Verification Requirements

### Local Development and Testing
Based on [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/llms-full.txt):

#### Running Workers Locally
```bash
# Start local development server
npx wrangler dev

# Run with specific port and environment
npx wrangler dev --port 8787 --env development

# Test with live reload for rapid development
npx wrangler dev --live-reload
```

#### Unit Testing Framework
```bash
# Install testing dependencies
npm install --save-dev vitest @cloudflare/workers-types

# Run unit tests
npm test
# or with Vitest directly
npx vitest run

# Run tests in watch mode during development
npx vitest watch

# Run specific test pattern
npx vitest run -t "playlist validation"
```

#### API Testing Requirements
Each coding task must be verified through:

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test API endpoints and Workers functionality
3. **Local Worker Testing**: Verify behavior using `wrangler dev`
4. **API Endpoint Testing**: Use curl or HTTP clients to test endpoints

### Testing Structure and Patterns

#### Unit Test Organization
```typescript
// Example test structure for DP-1 protocol
describe('Playlist Validation', () => {
  test('should validate DP-1 schema compliance', async () => {
    // Test playlist schema validation
  });
  
  test('should verify Ed25519 signatures', async () => {
    // Test signature verification
  });
});

describe('API Endpoints', () => {
  test('GET /api/v1/playlists should return JSON array', async () => {
    // Test REST endpoint
  });
  
  test('PUT /api/v1/devices/{id}/playlist should be idempotent', async () => {
    // Test device playlist assignment
  });
});
```

#### Workers Testing with Miniflare
```typescript
// Use Miniflare for local Workers testing
import { Miniflare } from 'miniflare';

describe('Worker Integration Tests', () => {
  let mf: Miniflare;
  
  beforeAll(async () => {
    mf = new Miniflare({
      scriptPath: './src/index.ts',
      modules: true,
      bindings: {
        // Mock KV, D1, AI bindings for testing
      }
    });
  });
  
  test('should handle playlist generation request', async () => {
    const response = await mf.dispatchFetch('http://localhost/api/v1/ai/generate-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ambient art playlist' })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('playlist');
  });
});
```

### API Testing with curl
```bash
# Test playlist endpoints locally
curl -X GET http://localhost:8787/api/v1/playlists

# Test playlist creation
curl -X POST http://localhost:8787/api/v1/playlists \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Playlist", "items": []}'

# Test device playlist assignment
curl -X PUT http://localhost:8787/api/v1/devices/device-123/playlist \
  -H "Content-Type: application/json" \
  -d '{"playlistId": "playlist-456"}'

# Test AI playlist generation
curl -X POST http://localhost:8787/api/v1/ai/generate-playlist \
  -H "Content-Type: application/json" \
  -d '{"prompt": "2-hour ambient art mix", "duration": 7200}'
```

### Required Test Coverage
- **Playlist Validation**: >95% accuracy for DP-1 schema compliance
- **Signature Verification**: Ed25519 and wallet proof validation
- **API Endpoints**: All REST endpoints with proper error handling
- **State Management**: JSON storage operations and atomic updates
- **AI Integration**: Natural language command parsing and execution
- **Workers Bindings**: KV storage, AI inference, and Vectorize operations

### Performance Benchmarks
- Playlist generation: <2 seconds
- Signature verification: <100ms
- Semantic search: <500ms
- Device command execution: <1 second
- Worker cold start: <100ms
- API response time: <500ms average

### Testing Verification Checklist
Before merging any code changes:

1. ✅ **Unit tests pass**: `npm test` returns green
2. ✅ **Local Worker runs**: `npx wrangler dev` starts without errors
3. ✅ **API endpoints respond**: curl tests return expected JSON responses
4. ✅ **Schema validation works**: Invalid payloads are rejected with proper error codes
5. ✅ **AI integration functions**: Natural language commands parse and execute correctly
6. ✅ **State persistence works**: JSON storage operations complete successfully
7. ✅ **Performance meets benchmarks**: Response times within acceptable limits
8. ✅ **Linting passes**: `pnpm lint` returns no errors
9. ✅ **Type checking passes**: TypeScript compilation succeeds

## Prototype Development Guidelines

### API Reference Requirements
**Always reference [Cloudflare Workers API documentation](https://developers.cloudflare.com/workers/llms-full.txt) when coding the prototype.**

This documentation provides:
- Complete Workers AI integration patterns
- Agents framework usage
- Durable Objects with WebSocket Hibernation API
- Vectorize for embeddings and semantic search
- KV storage for JSON state management
- Structured JSON outputs with `response_format`

### Prototype UI Architecture

#### Two-Panel Layout Design
The prototype UI must implement a **two-panel layout**:

**Left Panel - Player Interface**:
- DP-1 playlist player for displaying digital art
- Artwork rendering with display preferences (scaling, margin, background)
- Playlist navigation and controls
- Device status and connection indicators
- Visual feedback for AI-generated playlists

**Right Panel - Chat Interface**:
- Natural language command input box
- AI conversation history and responses
- API call results and status messages
- Real-time playlist generation feedback
- Command palette for typed commands

#### Panel Communication Flow
```
Chat Panel (Right) → API Calls → Player Panel (Left)
     ↓                              ↑
Natural Language    →    JSON Commands    →    Playlist Updates
"Play ambient art"  →    PUT /playlist    →    Visual Display
```

#### Implementation Pattern
```typescript
// Chat panel sends commands to player panel
interface ChatToPlayerMessage {
  type: 'playlist_update' | 'device_command' | 'display_settings';
  payload: {
    playlistId?: string;
    deviceId?: string;
    settings?: DisplayPrefs;
  };
}

// Player panel responds with status
interface PlayerToChatMessage {
  type: 'status_update' | 'playback_event' | 'error';
  payload: {
    status: 'playing' | 'paused' | 'error';
    currentItem?: PlaylistItem;
    error?: string;
  };
}
```

### Cloudflare Workers Configuration
Based on [Cloudflare Workers guidelines](https://developers.cloudflare.com/workers/prompt.txt):

- Use TypeScript by default with ES modules format exclusively
- Import all methods, classes and types used in the code
- Keep all code in a single file unless otherwise specified
- Use official SDKs when available and minimize external dependencies
- Set `compatibility_date = "2025-03-07"` and `compatibility_flags = ["nodejs_compat"]`
- Enable observability with `enabled = true` and `head_sampling_rate = 1`

### Environment Variables
```bash
# Required for AI agents
OPENAI_API_KEY=sk-...           # For external AI calls
ANTHROPIC_API_KEY=sk-ant-...    # For Claude integration
SENTRY_DSN=https://...          # Error tracking
IPFS_GATEWAY=https://...        # Content addressing
```

## Monitoring and Observability

### Key Metrics for AI Agents
- **Accuracy Rate**: >95% for playlist validation
- **Response Time**: <500ms average API response
- **Error Rate**: <5% failure rate across all operations
- **Resource Usage**: <80% CPU, <90% memory utilization
- **Cost Tracking**: Per-request AI usage and budget compliance

### Logging Requirements
- Implement structured logging for all operations
- Log authentication attempts and security events
- Track AI usage and costs per device/user
- Monitor state storage operations and performance
- Alert on error thresholds and budget overages

## Contributing Guidelines

### Pull Request Requirements
1. All AI endpoints must include input/output examples in documentation
2. Include performance benchmarks in PR description
3. Update schema definitions if data structures change
4. Add integration tests for new AI capabilities
5. Document any new natural language commands

### Code Quality Standards
- Use TypeScript strict mode for all prototype code
- Implement proper error boundaries and graceful degradation
- Follow async/await patterns consistently
- Include comprehensive input validation
- Validate all outputs against schemas before storage