// Dark Sun Campaign Assistant Server
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { FileAttachment } from './types';
import { MCPClientManager, loadMCPConfig } from './mcp-client';
import { createApiRouter } from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, 'uploads/images/');
    } else if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, 'uploads/documents/');
    } else {
      cb(null, 'uploads/temp/');
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Allow images, PDFs, and text files
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and text files are allowed.'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Initialize MCP Client Manager
const mcpConfig = loadMCPConfig();
const mcpManager = new MCPClientManager(mcpConfig);

// API Routes
app.use('/api', createApiRouter(mcpManager, upload));

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
      const serverStatus = mcpManager.getServerStatus();
      const connectedCount = serverStatus.filter(s => s.status === 'connected').length;
      console.log(`\n🔧 MCP Servers: ${connectedCount}/${serverStatus.length} connected`);
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
