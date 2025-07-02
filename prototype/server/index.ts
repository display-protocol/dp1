import { Hono } from 'hono';
import { MIN_DP_VERSION, type Env } from './types';
import {
  authMiddleware,
  corsMiddleware,
  errorMiddleware,
  loggingMiddleware,
  validateJsonMiddleware,
} from './middleware/auth';
import { playlists } from './routes/playlists';
import { playlistGroups } from './routes/playlistGroups';

/**
 * DP-1 Feed Operator API Server
 *
 * Modern Hono-based implementation with:
 * - Express-like routing and middleware
 * - Zod schema validation
 * - Modular route organization
 * - Comprehensive middleware stack
 * - OpenAPI 3.1.0 compliance
 * - DP-1 v0.9-alpha specification implementation
 */

// Create main Hono app
const app = new Hono<{ Bindings: Env }>();

// Global middleware stack
app.use('*', errorMiddleware); // Error handling (first)
app.use('*', loggingMiddleware); // Request logging
app.use('*', corsMiddleware); // CORS headers
app.use('*', authMiddleware); // Authentication (before validation)
app.use('*', validateJsonMiddleware); // Content-Type validation (last)

// Health check endpoint
app.get('/health', c => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: MIN_DP_VERSION,
    environment: c.env.ENVIRONMENT || 'development',
  });
});

// API version info
app.get('/', c => {
  return c.json({
    name: 'DP-1 Feed Operator API',
    version: MIN_DP_VERSION,
    description:
      'REST interface for creating, updating, and retrieving DP-1 playlists and playlist-groups',
    specification: 'DP-1 v0.9-alpha',
    openapi: '3.1.0',
    endpoints: {
      playlists: '/playlists',
      playlistGroups: '/playlist-groups',
      health: '/health',
    },
    documentation: 'https://github.com/feralfile/dp-1/tree/main/docs',
  });
});

// Mount route modules
app.route('/playlists', playlists);
app.route('/playlist-groups', playlistGroups);

// Legacy API routes (for backward compatibility)
app.route('/api/v1/playlists', playlists);
app.route('/api/v1/playlist-groups', playlistGroups);

// 404 handler for unmatched routes
app.notFound(c => {
  return c.json(
    {
      error: 'not_found',
      message: 'The requested resource was not found',
      available_endpoints: [
        'GET /',
        'GET /health',
        'GET /playlists',
        'POST /playlists',
        'GET /playlists/:id',
        'PUT /playlists/:id',
        'GET /playlist-groups',
        'POST /playlist-groups',
        'GET /playlist-groups/:id',
        'PUT /playlist-groups/:id',
      ],
    },
    404
  );
});

// Global error handler (fallback)
app.onError((error, c) => {
  console.error('Global error handler:', error);

  return c.json(
    {
      error: 'internal_error',
      message: 'An unexpected error occurred',
    },
    500
  );
});

// Export for Cloudflare Workers
export default app;
