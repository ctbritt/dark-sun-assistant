# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dark Sun Campaign Assistant is an AI-powered campaign management tool for Dark Sun D&D campaigns. It integrates with external data sources via Model Context Protocol (MCP) servers to access Obsidian notes, campaign materials, and Foundry VTT.

**Current Status**: MVP with basic chat functionality and MCP framework in place, but MCP servers not yet fully integrated.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build both backend and frontend TypeScript
npm run build

# Start production server (requires build first)
npm start

# Development mode (uses ts-node, no build required)
npm run dev

# Clean compiled files
npm run clean

# Clean and rebuild
npm run rebuild
```

**Development workflow**: Use `npm run dev` for quick iteration. For production deployment, use `npm run build && npm start`.

## Project Architecture

### Frontend/Backend Split

- **Backend** (`src/`): Node.js/Express server compiled with `tsconfig.json` (CommonJS)
- **Frontend** (`frontend/`): Browser TypeScript compiled with `tsconfig.frontend.json` (ES modules) to `public/js/`
- Both compile to JavaScript on build; the frontend compilation outputs to `public/js/app.js`

### Core Components

**Server Entry Point** (`src/server.ts`):
- Express server initialization
- MCP client manager setup via `loadMCPConfig()`
- Graceful shutdown handlers for SIGTERM/SIGINT
- Serves static files from `public/` and API routes under `/api`

**MCP Integration** (`src/mcp-client.ts`):
- `MCPClientManager`: Manages connections to multiple MCP servers
- `loadMCPConfig()`: Returns array of MCP server configurations
- Currently in "mock mode" - servers configured but not actively connected
- Configured servers:
  - `obsidian-vault`: Campaign notes in iCloud Obsidian vault
  - `dark-sun-materials`: Local filesystem with campaign resources
  - `foundry-vtt`: SSH connection to remote Foundry VTT MCP server

**API Routes** (`src/routes/api.ts`):
- `/api/health`: Server and MCP status
- `/api/chat`: Main chat endpoint using Claude Sonnet 4.5
- `/api/conversations/*`: CRUD operations for conversations
- `/api/mcp/query`: Test endpoint for MCP server queries

**Storage** (`src/storage.ts`):
- In-memory conversation storage (data lost on restart)
- Simple CRUD interface for conversations and messages
- Intended to be replaced with persistent storage (SQLite planned)

**Types** (`src/types.ts`):
- Shared TypeScript interfaces for the entire application
- `Conversation`, `Message`, `MCPServerConfig`, etc.

### MCP Server Integration

The project is designed to query three MCP servers for campaign data:

1. **Obsidian Vault** (`@modelcontextprotocol/server-filesystem`): Campaign notes and worldbuilding
2. **Dark Sun Materials** (`@modelcontextprotocol/server-filesystem`): PDFs, reference materials, maps
3. **Foundry VTT** (custom MCP server in `mcp-servers/foundry-vtt-mcp`): Live game data via SSH

MCP connections are initialized in `MCPClientManager.initialize()` but currently run in mock mode. To enable:
- Set `ANTHROPIC_API_KEY` in `.env`
- Configure SSH keys for Foundry VTT access
- Verify Obsidian vault path in `loadMCPConfig()`

### Claude AI Integration

Chat endpoint (`POST /api/chat`) uses:
- Model: `claude-sonnet-4-5-20250929` (Claude Sonnet 4.5)
- System prompt: Dark Sun setting expert with lore knowledge
- Max tokens: 8096
- Requires `ANTHROPIC_API_KEY` environment variable

## Key Implementation Details

**Dual TypeScript Configs**: Two separate `tsconfig` files compile backend (Node.js) and frontend (browser) code with different module systems. Always use the correct config when making changes.

**MCP Architecture**: The MCPClientManager is designed for multi-server queries but needs actual MCP tool/prompt integration to be functional. Currently it's a framework awaiting full implementation.

**Storage Layer**: Currently in-memory only. The `storage.ts` interface is designed to be swapped for a database-backed implementation without changing API routes.

**Foundry VTT MCP**: A custom MCP server exists in `mcp-servers/foundry-vtt-mcp` that connects to Foundry VTT via SSH. This is a separate package with its own build process.

## Environment Variables

Required for full functionality:
- `ANTHROPIC_API_KEY`: Claude API key for chat
- `PORT`: Server port (default: 3000)
- `FOUNDRY_HOST`: Foundry VTT hostname (default: foundry.azthir-terra.com)
- `FOUNDRY_PORT`: Foundry VTT port (default: 30000)

## Important Paths

All MCP server paths in `loadMCPConfig()` are absolute and user-specific:
- Obsidian vault: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Dark Sun Campaign`
- Campaign materials: `~/Documents/DnD.5e/06-Campaign-Resources/3. Dark Sun`
- Foundry MCP: SSH to `foundry@foundry.azthir-terra.com` running node server

Update these paths when working in different environments.
