# DP-1 Client Guidelines

This file contains guidance specific to the Next.js client located in this directory.

## Prototype Architecture

### Client-Server Setup
**Server**: Cloudflare Worker (TypeScript) - API backend deployed to Workers
**Client**: Next.js (TypeScript) - UI frontend deployed to Cloudflare Pages

### Three-Panel UI Layout
**Player Panel**: Artwork player on the left
**Chat Panel**: Command interface in the center
**Document Panel**: DP-1 specification on the right

### Communication Flow
```
Next.js Client → Cloudflare Worker API → Response
Chat Panel → PUT /api/playlist → Player Panel Update
```

### Configuration
**Next.js**: Static export for Cloudflare Pages deployment

## Dev Environment Tips

### Workspace Management
- Use `pnpm dlx turbo run dev --filter <project_name>` to jump to a specific package
- Run `pnpm install --filter <project_name>` to add packages to workspace
- Use `pnpm create next-app@latest <project_name> --typescript --tailwind --eslint --app` for Next.js client
- Check the `name` field in each package's `package.json` for correct package names

### Quick Commands
```bash
# Development
pnpm dev                                     # Next.js client
# Testing
npm run headless                             # Headless UI test
pnpm test --filter prototype-ui              # Next.js tests
# Deployment
pnpm build && pnpm pages:deploy              # Deploy to Cloudflare Pages
```

### Headless Testing
Any modification to the client code must run the headless test:
```bash
npm run headless
```
The script builds the client and verifies the UI with Puppeteer. Ensure Node.js v18+ is installed.
