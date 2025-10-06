// API Routes for Dark Sun Assistant
import express, { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { pdf as pdfParse } from 'pdf-parse';
import { storage } from '../storage';
import { MCPClientManager } from '../mcp-client';
import { ChatRequest, ChatResponse, HealthStatus } from '../types';

// Validate required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  WARNING: ANTHROPIC_API_KEY not set. Chat functionality will not work.');
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'missing-api-key'
});

export function createApiRouter(mcpManager: MCPClientManager, upload: multer.Multer): express.Router {
  const router = express.Router();

  // Health check endpoint
  router.get('/health', (req: Request, res: Response): void => {
    const status: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      mcpServers: mcpManager.getServerStatus()
    };
    res.json(status);
  });

  // Get all conversations
  router.get('/conversations', (req: Request, res: Response) => {
    try {
      const conversations = storage.getAllConversations();
      res.json(conversations);
    } catch (error: any) {
      console.error('Error getting conversations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific conversation
  router.get('/conversations/:id', (req: Request, res: Response) => {
    try {
      const conversation = storage.getConversation(req.params.id);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.json(conversation);
    } catch (error: any) {
      console.error('Error getting conversation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new conversation
  router.post('/conversations', (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = storage.createConversation(title);
      res.status(201).json(conversation);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a conversation
  router.delete('/conversations/:id', (req: Request, res: Response) => {
    try {
      const success = storage.deleteConversation(req.params.id);
      if (!success) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chat endpoint
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationId, attachments } = req.body as ChatRequest;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Get or create conversation
      let conversation = conversationId ? storage.getConversation(conversationId) : null;
      if (!conversation) {
        conversation = storage.createConversation();
      }

      // Add user message
      const userMessage = storage.addMessage(conversation.id, 'user', message, attachments);

      // Get MCP tools from connected servers
      const mcpTools: any[] = [];
      const serverStatus = mcpManager.getServerStatus();

      for (const server of serverStatus) {
        if (server.status === 'connected') {
          try {
            const toolsResult = await mcpManager.queryServer(server.name, 'list-tools');
            if (toolsResult.availableTools) {
              // Convert MCP tools to Anthropic tool format
              for (const tool of toolsResult.availableTools) {
                mcpTools.push({
                  name: `${server.name}__${tool.name}`,
                  description: tool.description,
                  input_schema: tool.inputSchema
                });
              }
            }
          } catch (error) {
            console.error(`Failed to get tools from ${server.name}:`, error);
          }
        }
      }

      console.log(`Loaded ${mcpTools.length} MCP tools for Claude`);

      // Build conversation history for Claude
      let currentMessages: any[] = conversation.messages
        .slice(0, -1) // Exclude the just-added user message
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Add the current user message
      currentMessages.push({ role: 'user', content: message });

      let finalResponse = '';
      const maxIterations = 10;

      for (let i = 0; i < maxIterations; i++) {
         const claudeResponse = await anthropic.messages.create({
           model: 'claude-sonnet-4-5-20250929',
           max_tokens: 8096,
           system: `You are the Oracle of Athas, an AI assistant for a Dark Sun D&D campaign. You have access to four powerful MCP servers that you must use strategically and efficiently.

## 📎 **FILE ATTACHMENT HANDLING**
When users upload files (images, PDFs, text files), you can:
- **Images**: Describe what you see, identify Dark Sun elements, suggest how to use in campaign
- **PDFs**: Extract and analyze text content, reference specific sections
- **Text Files**: Read and analyze content, integrate with campaign knowledge
- **Always mention** when you're referencing uploaded content vs. your knowledge base

## 🎯 **MCP SERVER USAGE STRATEGY**

### **1. OBSIDIAN VAULT (obsidian-vault) - CAMPAIGN BRAIN**
**USE FOR:** Current campaign state, NPCs, locations, session history, plot threads
**WHEN TO USE:**
- Questions about current campaign status, NPCs, or locations
- Session preparation and recap requests
- Character relationships and plot development
- Campaign timeline and continuity questions
**TOOLS:** read_text_file, list_directory, search_files, read_multiple_files

### **2. DARK SUN MATERIALS (dark-sun-materials) - LORE LIBRARY**
**USE FOR:** Reference materials, generators, maps, official content, tools
**WHEN TO USE:**
- Need specific Dark Sun lore, rules, or mechanics
- Looking for generators, tools, or reference materials
- Map requests or battle map needs
- Equipment, spells, or creature information
- Adventure modules or published content
**TOOLS:** read_text_file, list_directory, search_files, read_multiple_files

### **3. FOUNDRY VTT (foundry-vtt) - LIVE GAME DATA**
**USE FOR:** Active game state, character sheets, compendiums, scene management
**WHEN TO USE:**
- Character stats, abilities, or inventory questions
- Monster/creature lookups from compendiums
- Scene management or token placement
- Quest journal creation or updates
- Player roll requests or game mechanics
- Map generation or scene switching
**TOOLS:** get-character, list-characters, search-compendium, get-current-scene, create-quest-journal, request-player-rolls

### **4. NOTION (notion) - COLLABORATIVE WORKSPACE**
**USE FOR:** Shared campaign notes, databases, collaborative content, project management
**WHEN TO USE:**
- Creating or updating shared campaign documents
- Managing campaign databases (NPCs, locations, plot threads)
- Collaborative note-taking and session planning
- Project management for campaign preparation
- Sharing information with players or co-DMs
- Organizing campaign resources and timelines
**TOOLS:** search, fetch, create-pages, update-page, create-database, move-pages

## 🚀 **EFFICIENCY RULES**

### **PRIORITY ORDER:**
1. **Campaign Questions** → Check Obsidian vault FIRST
2. **Lore/Reference** → Check Dark Sun materials FIRST  
3. **Live Game Data** → Use Foundry VTT for current state
4. **Collaborative Work** → Use Notion for shared content
5. **Web Search** → Only if local sources don't have the information

### **PARALLEL EXECUTION:**
- When possible, query multiple MCP servers simultaneously
- Use read_multiple_files for batch operations
- Combine related searches to minimize round trips

### **SMART CACHING:**
- Remember information from previous queries in the conversation
- Don't re-query the same data unless it might have changed
- Use list_directory first to understand structure before deep searches

## 🎲 **DARK SUN EXPERTISE**

You are an expert on Dark Sun (Athas) featuring:
- Harsh desert world with brutal survival mechanics
- Sorcerer-kings ruling city-states with absolute power
- Defiling magic that destroys the land vs. preserving magic
- Psionics (the Way) as common abilities
- Metal scarcity and bone/stone/wood equipment
- Slavery, gladiatorial combat, and harsh social structures

## 📋 **RESPONSE STRATEGY**

1. **Identify the query type** (campaign, lore, game mechanics, live data, collaborative)
2. **Choose the appropriate MCP server(s)** based on the priority order
3. **Execute queries efficiently** using parallel calls when possible
4. **Provide comprehensive answers** combining information from multiple sources
5. **Always cite your sources** (which MCP server provided the information)

Remember: You are the Oracle of Athas - wise, efficient, and deeply connected to the campaign's knowledge base. Use your MCP servers strategically to provide the most helpful and accurate assistance possible.`,
          messages: currentMessages,
          tools: mcpTools.length > 0 ? mcpTools : undefined
        });

        // Check if Claude wants to use tools
        const hasToolUse = claudeResponse.content.some((block: any) => block.type === 'tool_use');

        console.log(`Iteration ${i}: hasToolUse=${hasToolUse}`);

        if (!hasToolUse) {
          // No more tools to call, extract final text response
          finalResponse = claudeResponse.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
          break;
        }

        // Execute tools and collect results
        const toolResults: any[] = [];

        for (const block of claudeResponse.content) {
          if (block.type === 'tool_use') {
            // Parse server name and tool name from the prefixed tool name
            const [serverName, ...toolNameParts] = block.name.split('__');
            const toolName = toolNameParts.join('__');

            console.log(`Calling tool: ${serverName}/${toolName}`, block.input);

            try {
              // Call the MCP tool
              const result = await mcpManager.callTool(serverName, toolName, block.input);
              console.log(`Tool result:`, result);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
              });
            } catch (error: any) {
              console.error(`Tool error:`, error);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: error.message }),
                is_error: true
              });
            }
          }
        }

        // Add assistant response and tool results to message history
        currentMessages.push({
          role: 'assistant',
          content: claudeResponse.content
        });

        currentMessages.push({
          role: 'user',
          content: toolResults
        });
      }

      const assistantMessage = storage.addMessage(
        conversation.id,
        'assistant',
        finalResponse || 'Unable to generate response'
      );

      const response: ChatResponse = {
        conversationId: conversation.id,
        message: assistantMessage,
        mcpResponses: []
      };

      res.json(response);
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // MCP query endpoint (for testing)
  router.post('/mcp/query', async (req: Request, res: Response) => {
    try {
      const { server, query } = req.body;

      if (!server || !query) {
        res.status(400).json({ error: 'Server and query are required' });
        return;
      }

      const result = await mcpManager.queryServer(server, query);
      res.json(result);
    } catch (error: any) {
      console.error('MCP query error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // File upload endpoint
  router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.file;
      const fileInfo = {
        id: Date.now().toString(),
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString()
      };

      // Process different file types
      let content = '';
      let processed = false;

      if (file.mimetype === 'application/pdf') {
        try {
          if (fs.existsSync(file.path)) {
            const dataBuffer = fs.readFileSync(file.path);
            const pdfData = await pdfParse(dataBuffer);
            content = pdfData.text;
            processed = true;
          }
        } catch (error) {
          console.error('PDF processing error:', error);
        }
      } else if (file.mimetype.startsWith('text/')) {
        try {
          if (fs.existsSync(file.path)) {
            content = fs.readFileSync(file.path, 'utf-8');
            processed = true;
          }
        } catch (error) {
          console.error('Text file processing error:', error);
        }
      }

      // Store file info in conversation storage (temporary solution)
      const fileRecord = {
        ...fileInfo,
        content: content,
        processed: processed
      };

      res.json({
        success: true,
        file: fileRecord,
        message: processed ? 'File uploaded and processed successfully' : 'File uploaded successfully'
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get uploaded files endpoint
  router.get('/files', (req: Request, res: Response) => {
    try {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const files: any[] = [];

      // Read all upload directories
      const dirs = ['images', 'documents', 'temp'];
      
      dirs.forEach(dir => {
        const dirPath = path.join(uploadsDir, dir);
        if (fs.existsSync(dirPath)) {
          const dirFiles = fs.readdirSync(dirPath);
          dirFiles.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            files.push({
              name: file,
              path: `/uploads/${dir}/${file}`,
              size: stats.size,
              modified: stats.mtime,
              type: dir
            });
          });
        }
      });

      res.json({ files: files.sort((a, b) => b.modified.getTime() - a.modified.getTime()) });
    } catch (error: any) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete file endpoint
  router.delete('/files/:filename', (req: Request, res: Response) => {
    try {
      const { filename } = req.params;

      // Sanitize filename to prevent path traversal
      const sanitizedFilename = path.basename(filename);
      if (sanitizedFilename !== filename || filename.includes('..')) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }

      const uploadsDir = path.join(__dirname, '../../uploads');

      // Search for file in all directories
      const dirs = ['images', 'documents', 'temp'];
      let deleted = false;

      for (const dir of dirs) {
        const filePath = path.join(uploadsDir, dir, sanitizedFilename);

        // Ensure the resolved path is still within uploads directory (defense in depth)
        const resolvedPath = path.resolve(filePath);
        const resolvedUploadsDir = path.resolve(uploadsDir);
        if (!resolvedPath.startsWith(resolvedUploadsDir)) {
          res.status(400).json({ error: 'Invalid file path' });
          return;
        }

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deleted = true;
          break;
        }
      }

      if (deleted) {
        res.json({ success: true, message: 'File deleted successfully' });
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
