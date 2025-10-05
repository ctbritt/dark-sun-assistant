# Quick Setup Guide - 3 Steps to Full Functionality

This guide will get your Dark Sun Assistant fully operational in about 30 minutes.

## Current Status: ✅ Server Working, ⚠️ Needs Configuration

The server is running and all core functionality works. You just need to configure 3 things for full features.

---

## Step 1: Add Your Anthropic API Key (5 minutes)

### Get Your API Key:
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

### Add to Your Project:
```bash
# Edit the .env file
nano .env

# Replace this line:
ANTHROPIC_API_KEY=your-api-key-here

# With your actual key:
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
```

### Test It:
```bash
# Restart the server (if running locally)
npm start

# Test the chat endpoint:
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me about Dark Sun"}'
```

✅ **Success:** You should see Claude's response about Dark Sun

---

## Step 2: Install Foundry MCP Bridge Module (10 minutes)

This module allows the assistant to read and modify data in your Foundry VTT world.

### In Foundry VTT:

1. **Go to your Foundry instance:**
   - Navigate to https://foundry.azthir-terra.com:30000
   - Log in as GM

2. **Install the Module:**
   - Click **Return to Setup** (if in a world)
   - Go to **Add-on Modules**
   - Click **Install Module**
   - Paste this URL in the **Manifest URL** field:
     ```
     https://raw.githubusercontent.com/adambdooley/foundry-vtt-mcp/master/packages/foundry-module/module.json
     ```
   - Click **Install**
   - Wait for installation to complete

3. **Enable the Module:**
   - Launch your **Dark Sun** world
   - Go to **Settings** (gear icon) → **Manage Modules**
   - Find "Foundry MCP Bridge" in the list
   - ✓ Check the box to enable it
   - Click **Save Module Settings**
   - Foundry may need to reload

4. **Verify It's Running:**
   - Press **F12** to open browser console
   - Look for a message like:
     ```
     Foundry MCP Bridge: Server started on port 31415
     ```

### Test It:
```bash
# From the Foundry server (via SSH):
ssh foundry@foundry.azthir-terra.com "curl -s localhost:31415" 

# You should see a response (WebSocket upgrade or MCP handshake)
```

✅ **Success:** MCP Bridge is listening on port 31415

---

## Step 3: Set Up SSH Access (15 minutes)

The assistant needs to SSH into your Foundry server to access the MCP server.

### Option A: Using Your Existing SSH Key (Recommended if you already have access)

If you can already SSH to `foundry@foundry.azthir-terra.com` without a password:

```bash
# Test your current access:
ssh foundry@foundry.azthir-terra.com "echo success"

# If that works, you're done! Your SSH key is already set up.
```

### Option B: Set Up New SSH Keys

If SSH access isn't working:

```bash
# 1. Generate a new SSH key (on your Mac):
ssh-keygen -t ed25519 -f ~/.ssh/darksun_foundry -C "darksun-assistant"

# 2. Copy the public key to Foundry:
ssh-copy-id -i ~/.ssh/darksun_foundry foundry@foundry.azthir-terra.com

# 3. Test the connection:
ssh -i ~/.ssh/darksun_foundry foundry@foundry.azthir-terra.com "echo success"
```

### Option C: SSH Agent Forwarding (For Remote Development)

If you're running the server in a remote environment but SSHing from your Mac:

```bash
# Add your key to ssh-agent:
ssh-add ~/.ssh/id_ed25519  # or your key file

# Connect to remote environment with forwarding:
ssh -A user@remote-server

# Now SSH to Foundry should work from the remote environment
ssh foundry@foundry.azthir-terra.com "echo success"
```

### Update SSH Config (Optional but Recommended)

Add to `~/.ssh/config`:
```
Host foundry
    HostName foundry.azthir-terra.com
    User foundry
    IdentityFile ~/.ssh/darksun_foundry
    ServerAliveInterval 60
```

Now you can just use: `ssh foundry`

### Test It:
```bash
# This should work without prompting for password:
ssh foundry@foundry.azthir-terra.com "echo success"
```

✅ **Success:** Prints "success" without password prompt

---

## Step 4: Enable Real MCP Connections (5 minutes)

Once steps 1-3 are complete, enable actual MCP server connections:

### Edit the MCP Client:

```bash
nano src/mcp-client.ts
```

Find the `initialize()` method (around line 14) and replace:

```typescript
async initialize(): Promise<void> {
  // For MVP, we'll skip actual MCP server connections
  // This will be configured later with real server paths
  console.log('MCP Client Manager initialized (mock mode)');
  console.log('Configured servers:', this.configs.map(c => c.name));
}
```

With:

```typescript
async initialize(): Promise<void> {
  console.log('MCP Client Manager initializing...');
  console.log('Configured servers:', this.configs.map(c => c.name));
  
  // Connect to Foundry VTT MCP server
  const foundryConfig = this.configs.find(c => c.name === 'foundry-vtt');
  if (foundryConfig) {
    try {
      await this.connectToServer(foundryConfig);
      console.log(`✓ Connected to Foundry VTT MCP server`);
    } catch (error) {
      console.error(`✗ Failed to connect to Foundry VTT:`, error);
    }
  }
  
  // Note: Obsidian and filesystem servers are only available when running locally
  if (process.env.RUN_LOCAL_MCP === 'true') {
    for (const config of this.configs) {
      if (config.name === 'foundry-vtt') continue; // Already connected
      try {
        await this.connectToServer(config);
        console.log(`✓ Connected to ${config.name}`);
      } catch (error) {
        console.error(`✗ Failed to connect to ${config.name}:`, error);
      }
    }
  }
}
```

### Rebuild and Restart:
```bash
npm run rebuild
npm start
```

### Verify:
```bash
curl http://localhost:3000/api/health
```

Look for:
```json
{
  "status": "ok",
  "mcpServers": [
    {"name": "foundry-vtt", "status": "connected"},
    ...
  ]
}
```

✅ **Success:** Foundry VTT status shows "connected"

---

## Step 5: Test Everything (5 minutes)

### Test Chat with Context:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What actors are in my Foundry world?"
  }'
```

Claude should now be able to query your Foundry world!

### Test in Browser:
1. Open http://localhost:3000
2. Click **+ New Conversation**
3. Type: "List all the player characters in my campaign"
4. Claude should connect to Foundry and list your PCs!

### Test MCP Query:
```bash
curl -X POST http://localhost:3000/api/mcp/query \
  -H "Content-Type: application/json" \
  -d '{
    "server": "foundry-vtt",
    "query": "list actors"
  }'
```

---

## Troubleshooting

### Chat returns "Internal server error"
- **Problem:** API key not configured or invalid
- **Solution:** Check `.env` file, make sure key starts with `sk-ant-`

### MCP servers show "disconnected"
- **Problem:** SSH keys not configured or MCP Bridge not running
- **Solution:** 
  1. Test SSH: `ssh foundry@foundry.azthir-terra.com "echo test"`
  2. Check MCP Bridge: Look for port 31415 in Foundry console

### "Connection refused" to Foundry
- **Problem:** Foundry not running or MCP Bridge not enabled
- **Solution:** 
  1. Check Foundry is running: `curl http://foundry.azthir-terra.com:30000`
  2. Enable MCP Bridge module in Foundry

### SSH times out or hangs
- **Problem:** Network issues or firewall
- **Solution:** 
  1. Test basic connectivity: `ping foundry.azthir-terra.com`
  2. Test SSH port: `nc -zv foundry.azthir-terra.com 22`

### Local MCP servers (Obsidian) not working
- **Problem:** Paths are local to your Mac
- **Solution:** Run the server locally on your Mac instead of remotely

---

## Quick Reference

### Start the Server:
```bash
# Production mode (requires build first):
npm run build && npm start

# Development mode (auto-reload):
npm run dev
```

### Check Health:
```bash
curl http://localhost:3000/api/health
```

### View Logs:
- Server logs appear in terminal where you ran `npm start`
- Frontend logs in browser console (F12)

### Stop the Server:
- Press `Ctrl+C` in the terminal

---

## What You Can Do Now

Once setup is complete, you can:

### Ask About Dark Sun:
- "Tell me about the Sorcerer-Kings"
- "What makes Dark Sun unique?"
- "Generate a random encounter in the desert"

### Query Foundry Data:
- "List all player characters"
- "Show me Valara's character sheet"
- "What items does the party have?"
- "Create a bone longsword"

### Access Campaign Notes (when running locally):
- "What notes do I have about Session 15?"
- "Search my Obsidian vault for information about Tyr"
- "What NPCs have I created?"

### Manage Your Campaign:
- "Add 500 XP to each player"
- "Create a journal entry for today's session"
- "What scenes are in my world?"

---

## Running Locally vs. Remotely

### Local (Your Mac) - Recommended:
**Pros:**
- ✅ Access to Obsidian vault
- ✅ Access to campaign files
- ✅ Easier SSH setup
- ✅ Better performance

**Cons:**
- ❌ Must keep computer on
- ❌ Only accessible from your network (without port forwarding)

### Remote (Server) - For Production:
**Pros:**
- ✅ Always available
- ✅ Can access from anywhere

**Cons:**
- ❌ Can't access local files (Obsidian, campaign materials)
- ❌ More complex SSH setup
- ❌ Requires SSH agent forwarding or key management

**Recommendation:** Start local for testing, deploy remote once everything works.

---

## Need Help?

If you get stuck:

1. Check the [TEST_REPORT.md](TEST_REPORT.md) for detailed test results
2. Check [FOUNDRY_SETUP.md](FOUNDRY_SETUP.md) for Foundry-specific help
3. Run the test script: `./test-system.sh`
4. Check server logs for error messages

---

## You're Ready! 🚀

Once you complete these steps, your Dark Sun Assistant will be fully functional with:
- ✅ AI-powered chat about Dark Sun
- ✅ Direct access to Foundry VTT data
- ✅ Campaign note integration (when running locally)
- ✅ Beautiful web interface

Have fun managing your Dark Sun campaign! 🌅
