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
    // For MVP, we'll skip actual MCP server connections
    // This will be configured later with real server paths
    console.log('MCP Client Manager initialized (mock mode)');
    console.log('Configured servers:', this.configs.map(c => c.name));
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

      await client.connect(transport);
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

    // This would call actual MCP methods
    // For now, return mock response
    return {
      server: serverName,
      query,
      response: 'Mock response (MCP server not configured)'
    };
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
  return [
    {
      name: 'obsidian-vault',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/Users/christopherallbritton/Library/Mobile Documents/iCloud~md~obsidian/Documents/Dark Sun Campaign'
      ]
    },
    {
      name: 'dark-sun-materials',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/Users/christopherallbritton/Documents/DnD.5e/06-Campaign-Resources/3. Dark Sun'
      ]
    },
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
        FOUNDRY_HOST: process.env.FOUNDRY_HOST || 'foundry.azthir-terra.com',
        FOUNDRY_PORT: process.env.FOUNDRY_PORT || '30000'
      }
    }
  ];
}
