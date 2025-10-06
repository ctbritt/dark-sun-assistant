// Dark Sun Campaign Assistant Server
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { MCPClientManager, loadMCPConfig } from './mcp-client';
import { createApiRouter } from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize MCP Client Manager
const mcpConfig = loadMCPConfig();
const mcpManager = new MCPClientManager(mcpConfig);

// API Routes
app.use('/api', createApiRouter(mcpManager));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize and start server
async function start() {
  try {
    // Initialize MCP connections (in mock mode for MVP)
    await mcpManager.initialize();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`\n╔════════════════════════════════════════════════════════╗`);
      console.log(`║  Dark Sun Campaign Assistant Server                   ║`);
      console.log(`╚════════════════════════════════════════════════════════╝`);
      console.log(`\n🌐 Server running at: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`\n🔧 MCP Status: Mock mode (configure servers in src/mcp-client.ts)`);
      console.log(`\nPress Ctrl+C to stop the server.\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await mcpManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  await mcpManager.close();
  process.exit(0);
});

// Start the server
start();
