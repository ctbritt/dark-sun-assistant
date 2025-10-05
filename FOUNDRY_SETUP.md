# Foundry VTT Integration Setup

This document describes how to set up the Foundry VTT MCP integration for the Dark Sun Campaign Assistant.

## Overview

The Foundry VTT MCP server allows Claude to interact directly with your Foundry VTT game world, including:
- Reading and modifying character data
- Searching compendiums
- Creating content (items, actors, journal entries)
- Managing scenes and combat
- Accessing campaign data

## Prerequisites

1. **Foundry VTT v13** or later
2. **Access to your Foundry installation** at https://foundry.azthir-terra.com
3. **GM/Admin access** to install modules

## Installation Steps

### Step 1: Install the Foundry MCP Bridge Module

You need to install the "Foundry MCP Bridge" module in your Foundry VTT instance:

1. Log in to Foundry at https://foundry.azthir-terra.com
2. Go to **Setup** → **Add-on Modules**
3. Click **Install Module**
4. Use this manifest URL:
   ```
   https://github.com/adambdooley/foundry-vtt-mcp/blob/master/packages/foundry-module/module.json
   ```
5. Click **Install**

### Step 2: Enable the Module in Your World

1. Launch your Dark Sun world
2. Go to **Settings** → **Manage Modules**
3. Find "Foundry MCP Bridge" and check the box to enable it
4. Click **Save Module Settings**
5. The module will start a WebSocket server on port **31415** (default)

### Step 3: Verify MCP Bridge is Running

After enabling the module, check the Foundry console (F12 in browser) for:
```
Foundry MCP Bridge: Server started on port 31415
```

## Configuration

The MCP server is already configured in your Dark Sun Assistant using SSH to run the server directly on the Foundry host:

**File**: `src/mcp-client.ts`
```typescript
{
  name: 'foundry-vtt',
  command: 'ssh',
  args: [
    '-t',
    'foundry@foundry.azthir-terra.com',
    'node',
    '/home/foundry/foundry-vtt-mcp/packages/mcp-server/dist/index.js'
  ],
  env: {
    FOUNDRY_HOST: 'foundry.azthir-terra.com',
    FOUNDRY_PORT: '30000'
  }
}
```

**Environment Variables** (`.env`):
```bash
FOUNDRY_HOST=foundry.azthir-terra.com
FOUNDRY_PORT=30000
```

This configuration matches your working Claude Desktop setup and uses SSH to run the MCP server on the same machine as Foundry, eliminating the need for port forwarding or tunneling.

## Remote Access Considerations

The current configuration uses **SSH to run the MCP server directly on the Foundry host**, which is the recommended approach for remote installations. This means:

✅ **No port forwarding needed** - The MCP server runs on the same machine as Foundry
✅ **More secure** - Communication happens over SSH
✅ **More reliable** - No network issues between your machine and the MCP Bridge port (30000)

### SSH Authentication

For this to work seamlessly, you should have SSH key authentication set up:

```bash
# If you don't already have SSH key access:
ssh-copy-id foundry@foundry.azthir-terra.com

# Test the connection:
ssh foundry@foundry.azthir-terra.com echo "Connection successful"
```

This matches the configuration you're using in Claude Desktop, which works without password prompts.

## Testing the Connection

1. Ensure Foundry is running with the MCP Bridge module enabled (listening on port 30000)
2. Ensure you can SSH to foundry@foundry.azthir-terra.com without a password prompt
3. Restart the Dark Sun Assistant:
   ```bash
   cd ~/Documents/GitHub/dark-sun-assistant
   npm start
   ```
4. Check the health endpoint:
   ```bash
   curl http://localhost:3000/api/health
   ```
5. Look for `foundry-vtt` status - it should show "connected" if working

## Available MCP Tools

Once connected, Claude can use these Foundry tools:

### Character Management
- `get_actor` - Retrieve actor data
- `update_actor` - Modify actor properties
- `list_actors` - List all actors in the world

### Compendium Access
- `search_compendium` - Search for items, spells, etc.
- `get_compendium_entry` - Get specific compendium entry

### Content Creation
- `create_item` - Create new items
- `create_journal` - Create journal entries
- `create_scene` - Create new scenes

### Campaign Management
- `get_scene_info` - Get current scene details
- `list_journals` - List journal entries
- `get_journal` - Read journal content

### Combat & Effects
- `list_active_effects` - View active effects on actors
- `manage_combat` - Combat tracker operations

## Usage Examples

Once the MCP server is connected, you can ask Claude:

```
"Show me all the player characters in my Dark Sun campaign"
"Create a bone longsword item for my defiler character"
"What spells does Valara have prepared?"
"Add 50 XP to all party members"
"Create a journal entry about our last session in the desert"
"Search the compendium for Dark Sun specific monsters"
```

## Troubleshooting

### MCP Server Shows "Disconnected"

**Possible Causes**:
1. Foundry MCP Bridge module not enabled
2. Port 31415 not accessible
3. Foundry not running
4. Firewall blocking connection

**Solutions**:
```bash
# Test if port is accessible
nc -zv foundry.azthir-terra.com 31415

# If fails, set up SSH tunnel
ssh -L 31415:localhost:31415 user@foundry.azthir-terra.com

# Update .env to use localhost
# Then restart the assistant
```

### "Connection Refused" Errors

Check that:
1. Foundry world is running (not on setup screen)
2. MCP Bridge module is enabled in the active world
3. Foundry console shows "MCP Bridge: Server started"

### "Authentication Failed" Errors

The MCP Bridge requires GM access. Ensure:
1. You're logged in as GM in Foundry
2. The MCP Bridge module has proper permissions

## Security Notes

⚠️ **Important Security Considerations**:

1. **Port Exposure**: Port 31415 provides direct access to your Foundry world
   - Only expose this port on trusted networks
   - Consider using SSH tunneling for production use
   - Enable firewall rules to restrict access

2. **GM Access**: The MCP Bridge has full GM permissions
   - Treat access to this port like GM account credentials
   - Don't share your MCP connection details

3. **HTTPS**: If exposing port 31415 over the internet:
   - Use a reverse proxy with TLS/SSL
   - Consider authentication middleware

## Updating the MCP Server

To update to a newer version of foundry-vtt-mcp:

```bash
cd ~/Documents/GitHub/dark-sun-assistant/mcp-servers/foundry-vtt-mcp
git pull
npm install
npm run build
cd ~/Documents/GitHub/dark-sun-assistant
npm start
```

## Support & Resources

- **Foundry MCP GitHub**: https://github.com/adambdooley/foundry-vtt-mcp
- **MCP Bridge Issues**: https://github.com/adambdooley/foundry-vtt-mcp/issues
- **MCP Protocol Docs**: https://modelcontextprotocol.io

## Current Status

✅ MCP server installed: `/mcp-servers/foundry-vtt-mcp/`
✅ Server built and ready
✅ Configuration added to Dark Sun Assistant
⚠️ **Action Required**: Install MCP Bridge module in Foundry
⚠️ **Action Required**: Ensure port 31415 is accessible

Once the Foundry MCP Bridge module is installed and port 31415 is accessible, the integration will be fully functional!
