# Setup Required - Configuration Guide

This document describes what needs to be configured to move from MVP to a fully functional Dark Sun Campaign Assistant.

## Overview

The current MVP has placeholder/mock implementations for:
1. MCP Server connections (Obsidian, Foundry VTT, Filesystem)
2. Claude API integration for actual AI responses
3. Persistent database storage

## 1. MCP Server Configuration

### What are MCP Servers?

MCP (Model Context Protocol) servers provide Claude with access to external data sources. For the Dark Sun Assistant, you'll need:

- **Filesystem Server**: Access to local files
- **Obsidian Server**: Access to your Obsidian vault notes
- **Foundry VTT Server**: Integration with Foundry Virtual Tabletop

### Installing MCP Servers

#### Option A: Using npx (Recommended for testing)

MCP servers can be run directly via npx without installation:

```bash
# Filesystem server
npx -y @modelcontextprotocol/server-filesystem /path/to/your/directory

# For Obsidian, you'll need a custom MCP server or use filesystem pointing to your vault
npx -y @modelcontextprotocol/server-filesystem /path/to/your/obsidian/vault
```

#### Option B: Global Installation

```bash
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-obsidian  # if available
```

### Configuring MCP Servers in the App

Edit `src/mcp-client.ts` and update the `loadMCPConfig()` function:

```typescript
export function loadMCPConfig(): MCPServerConfig[] {
  return [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/yourname/Documents/Campaign']
    },
    {
      name: 'obsidian',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/yourname/Documents/ObsidianVault']
    },
    {
      name: 'foundry',
      command: '/path/to/foundry/mcp-server',  // Update when available
      args: []
    }
  ];
}
```

**Your Paths:**
- Obsidian Vault: `/path/to/configure` → Update with your actual vault path
- Campaign Files: `/path/to/configure` → Update with your campaign directory
- Foundry Data: `/path/to/configure` → Update with your Foundry data path

### Testing MCP Connections

After configuration, restart the server and check the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Look for `"status": "connected"` for each MCP server.

## 2. Claude API Integration

### Getting a Claude API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### Adding API Key to the Project

#### Option A: Environment Variable (Recommended)

```bash
export ANTHROPIC_API_KEY="sk-ant-your_key_here"
npm start
```

Or create a `.env` file:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-your_key_here' > .env
```

Then install dotenv:

```bash
npm install dotenv
```

And add to `src/server.ts`:

```typescript
import dotenv from 'dotenv';
dotenv.config();
```

#### Option B: Configuration File

Create `config.json` (add to .gitignore!):

```json
{
  "anthropicApiKey": "sk-ant-your_key_here"
}
```

### Integrating Claude SDK

Install the Anthropic SDK:

```bash
npm install @anthropic-ai/sdk
```

Update `src/routes/api.ts` to replace the mock response with actual Claude API calls:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// In the chat endpoint, replace mock response with:
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: message }
  ]
});

const assistantContent = response.content[0].text;
```

## 3. Persistent Database Storage

### Issue

The current implementation uses in-memory storage. The preferred option (better-sqlite3) has compilation issues with Node.js 24.x.

### Solutions

#### Option A: Use Node.js 20.x (Recommended)

```bash
# Install Node.js 20.x via nvm
nvm install 20
nvm use 20

# Reinstall dependencies
cd ~/Documents/GitHub/dark-sun-assistant
rm -rf node_modules package-lock.json
npm install
```

Then add better-sqlite3:

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

#### Option B: Use sql.js (Pure JavaScript SQLite)

```bash
npm install sql.js
npm install --save-dev @types/sql.js
```

Update `src/storage.ts` to use sql.js instead of the in-memory Map.

#### Option C: Use PostgreSQL or MongoDB

For production deployments, consider:
- PostgreSQL with `pg` package
- MongoDB with `mongodb` or `mongoose` package

### Implementing SQLite with better-sqlite3

Once Node.js 20.x is installed, update `src/storage.ts`:

```typescript
import Database from 'better-sqlite3';

class Storage {
  private db: Database.Database;

  constructor() {
    this.db = new Database('dark-sun.db');
    this.initDatabase();
  }

  private initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
    `);
  }

  // Update methods to use SQL queries...
}
```

## 4. Additional Configuration

### Port Configuration

Change the server port:

```bash
PORT=8080 npm start
```

### CORS Configuration

If accessing from a different origin, update `src/server.ts`:

```typescript
import cors from 'cors';

app.use(cors({
  origin: 'http://localhost:8080',  // Your frontend URL
  credentials: true
}));
```

## 5. First Run Checklist

Before running in production mode:

- [ ] MCP servers configured with actual paths
- [ ] Claude API key added to environment
- [ ] Database storage implemented (or accepted in-memory limitation)
- [ ] `.gitignore` updated to exclude:
  - `.env`
  - `config.json`
  - `*.db` (database files)
  - API keys
- [ ] Dependencies installed: `npm install`
- [ ] Project built: `npm run build`
- [ ] Server starts: `npm start`
- [ ] Health endpoint returns OK: `curl localhost:3000/api/health`
- [ ] Chat endpoint responds (test in browser or with curl)

## 6. Step-by-Step First Run

```bash
# 1. Update MCP configuration
nano ~/Documents/GitHub/dark-sun-assistant/src/mcp-client.ts
# Edit the paths in loadMCPConfig()

# 2. Add API key
echo 'ANTHROPIC_API_KEY=your_key_here' > ~/Documents/GitHub/dark-sun-assistant/.env

# 3. Install dotenv if using .env file
cd ~/Documents/GitHub/dark-sun-assistant
npm install dotenv

# 4. Rebuild
npm run rebuild

# 5. Start server
npm start

# 6. Test in browser
open http://localhost:3000
```

## 7. Known Issues & Workarounds

### better-sqlite3 won't compile
- **Cause**: Node.js 24.x C++20 requirement
- **Fix**: Use Node.js 20.x or use sql.js

### MCP servers won't connect
- **Cause**: Incorrect paths or missing binaries
- **Fix**: Test MCP servers independently first:
  ```bash
  npx -y @modelcontextprotocol/server-filesystem /path/to/test
  ```

### EADDRINUSE error on port 3000
- **Cause**: Port already in use
- **Fix**: Kill existing process or use different port:
  ```bash
  PORT=3001 npm start
  ```

## 8. Getting Help

If you encounter issues:
1. Check the server logs in the terminal
2. Check browser console for frontend errors
3. Test API endpoints with curl
4. Verify all paths are absolute, not relative

## Next Steps After Configuration

Once everything is configured:
1. Test chat with actual Claude responses
2. Verify MCP servers provide correct context
3. Test conversation persistence (if database enabled)
4. Consider adding authentication
5. Deploy to production (see deployment guides for Node.js apps)
