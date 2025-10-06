#!/bin/bash
# Script to enable real MCP connections

echo "======================================"
echo "Enable MCP Connections for Dark Sun Assistant"
echo "======================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check 1: API Key
if grep -q "ANTHROPIC_API_KEY=your-api-key-here" .env 2>/dev/null; then
    echo "⚠️  WARNING: Anthropic API key not configured"
    echo "   Update .env file with your actual API key"
    echo ""
fi

# Check 2: SSH Access
echo "Testing SSH access to Foundry server..."
if timeout 5 ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o PasswordAuthentication=no \
    foundry@foundry.azthir-terra.com "echo success" 2>/dev/null | grep -q "success"; then
    echo "✓ SSH access works"
else
    echo "✗ SSH access not configured"
    echo "  Run: ssh-copy-id foundry@foundry.azthir-terra.com"
    echo ""
fi

# Check 3: Foundry MCP Bridge
echo "Checking Foundry MCP Bridge..."
if timeout 3 ssh foundry@foundry.azthir-terra.com "curl -s --connect-timeout 2 localhost:31415" 2>/dev/null | grep -q -E "WebSocket|upgrade|MCP"; then
    echo "✓ Foundry MCP Bridge is running"
else
    echo "✗ Foundry MCP Bridge not detected"
    echo "  Install the module in Foundry VTT (see QUICK_SETUP.md)"
    echo ""
fi

echo ""
echo "======================================"
echo "Updating MCP Client Configuration"
echo "======================================"
echo ""

# Create backup
cp src/mcp-client.ts src/mcp-client.ts.backup
echo "✓ Backed up src/mcp-client.ts to src/mcp-client.ts.backup"

# Update the initialize method
cat > /tmp/new-initialize.ts << 'EOF'
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
EOF

# Replace the initialize method
# This is a simplified version - in production, you'd use a proper parser
# For now, just show instructions
echo ""
echo "⚠️  Manual edit required:"
echo ""
echo "Edit src/mcp-client.ts and replace the initialize() method"
echo "See QUICK_SETUP.md Step 4 for the exact code to use"
echo ""

# Rebuild
echo "======================================"
echo "Rebuilding project..."
echo "======================================"
echo ""

npm run build
if [ $? -eq 0 ]; then
    echo "✓ Build successful"
else
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "======================================"
echo "Configuration Complete"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Edit src/mcp-client.ts to enable real MCP connections (see QUICK_SETUP.md)"
echo "2. Run: npm run rebuild"
echo "3. Run: npm start"
echo "4. Test: curl http://localhost:3000/api/health"
echo ""
echo "For detailed instructions, see QUICK_SETUP.md"
