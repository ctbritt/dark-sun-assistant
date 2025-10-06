// Dark Sun Campaign Assistant Server
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { MCPClientManager, loadMCPConfig } from './mcp-client';
import { createApiRouter } from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Create upload directories if they don't exist
const uploadDirs = ['uploads/images', 'uploads/documents', 'uploads/temp'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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

// Error handling middleware (must be before catch-all route)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Serve frontend (must be last)
// Express 5: Use regex for catch-all route
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize and start server
let httpServer: any;

async function start() {
  try {
    // Initialize MCP connections
    await mcpManager.initialize();

    // Start HTTP server
    httpServer = app.listen(PORT, () => {
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

    // Set server timeout
    httpServer.timeout = 120000; // 2 minutes
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Close HTTP server
  if (httpServer) {
    httpServer.close(() => {
      console.log('HTTP server closed');
    });
  }

  // Close MCP connections
  await mcpManager.close();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
start();
