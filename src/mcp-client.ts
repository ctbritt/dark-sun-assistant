// MCP Client for connecting to MCP servers
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServerConfig } from './types';

export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private configs: MCPServerConfig[] = [];

  constructor(configs: MCPServerConfig[] = []) {
    this.configs = configs;
  }

  async initialize(): Promise<void> {
    console.log('MCP Client Manager initializing...');
    console.log('Configured servers:', this.configs.map(c => c.name));

    // Connect to Foundry VTT MCP server (SSH-based, always available)
    const foundryConfig = this.configs.find(c => c.name === 'foundry-vtt');
    if (foundryConfig) {
      try {
        await this.connectToServer(foundryConfig);
        console.log('✓ Connected to Foundry VTT MCP server');
      } catch (error) {
        console.error('✗ Failed to connect to Foundry VTT:', error);
      }
    }

    // Connect to local MCP servers (Obsidian, filesystem) if enabled
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

  async connectToServer(config: MCPServerConfig): Promise<void> {
    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env
      });

      const client = new Client({
        name: 'dark-sun-assistant',
        version: '0.1.0'
      }, {
        capabilities: {}
      });

      // Add timeout to prevent hanging
      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        )
      ]);

      this.clients.set(config.name, client);
      console.log(`Connected to MCP server: ${config.name}`);
    } catch (error) {
      console.error(`Failed to connect to ${config.name}:`, error);
      throw error;
    }
  }

  async queryServer(serverName: string, query: string): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      // List available tools
      const toolsResponse = await client.listTools();

      return {
        server: serverName,
        query,
        availableTools: toolsResponse.tools,
        status: 'connected'
      };
    } catch (error: any) {
      return {
        server: serverName,
        query,
        error: error.message,
        status: 'error'
      };
    }
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args
      });

      return result;
    } catch (error: any) {
      console.error(`Tool call failed for ${serverName}/${toolName}:`, error);
      throw error;
    }
  }

  getServerStatus(): { name: string; status: 'connected' | 'disconnected' | 'error' }[] {
    return this.configs.map(config => ({
      name: config.name,
      status: this.clients.has(config.name) ? 'connected' : 'disconnected'
    }));
  }

  async close(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
        console.log(`Closed connection to ${name}`);
      } catch (error) {
        console.error(`Error closing ${name}:`, error);
      }
    }
    this.clients.clear();
  }
}

// Load MCP server configuration
// In production, this would load from a config file
export function loadMCPConfig(): MCPServerConfig[] {
  const foundryMCPPath = process.env.FOUNDRY_MCP_PATH || '/Users/christopherallbritton/Documents/GitHub/foundry-vtt-mcp/packages/mcp-server/dist/index.js';
  const obsidianPath = process.env.OBSIDIAN_VAULT_PATH || '/Users/christopherallbritton/Library/Mobile Documents/iCloud~md~obsidian/Documents/Dark Sun Campaign';
  const darkSunMaterialsPath = process.env.DARK_SUN_MATERIALS_PATH || '/Users/christopherallbritton/Documents/DnD.5e/06-Campaign-Resources/3. Dark Sun';

  const configs: MCPServerConfig[] = [
    {
      name: 'obsidian-vault',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        obsidianPath
      ]
    },
    {
      name: 'dark-sun-materials',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        darkSunMaterialsPath
      ]
    },
    {
      name: 'foundry-vtt',
      command: 'node',
      args: [
        foundryMCPPath
      ],
      env: {
        FOUNDRY_HOST: 'localhost',
        FOUNDRY_PORT: '31415',
        FOUNDRY_NAMESPACE: '/foundry-mcp',
        FOUNDRY_CONNECTION_TIMEOUT: '10000',
        LOG_LEVEL: 'info'
      }
    }
  ];

  // Only add Notion if API key and profile are configured
  if (process.env.NOTION_API_KEY && process.env.NOTION_PROFILE) {
    configs.push({
      name: 'notion',
      command: 'npx',
      args: [
        '-y',
        '@smithery/cli@latest',
        'run',
        '@smithery/notion',
        '--key',
        process.env.NOTION_API_KEY,
        '--profile',
        process.env.NOTION_PROFILE
      ]
    });
  } else {
    console.log('ℹ️  Notion MCP server not configured (NOTION_API_KEY or NOTION_PROFILE missing)');
  }

  return configs;
}
