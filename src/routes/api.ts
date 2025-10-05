// API Routes for Dark Sun Assistant
import express, { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage';
import { MCPClientManager } from '../mcp-client';
import { ChatRequest, ChatResponse, HealthStatus } from '../types';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export function createApiRouter(mcpManager: MCPClientManager): express.Router {
  const router = express.Router();

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    const status: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      mcpServers: mcpManager.getServerStatus()
    };
    res.json(status);
  });

  // Get all conversations
  router.get('/conversations', (req: Request, res: Response) => {
    const conversations = storage.getAllConversations();
    res.json(conversations);
  });

  // Get a specific conversation
  router.get('/conversations/:id', (req: Request, res: Response) => {
    const conversation = storage.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  });

  // Create a new conversation
  router.post('/conversations', (req: Request, res: Response) => {
    const { title } = req.body;
    const conversation = storage.createConversation(title);
    res.status(201).json(conversation);
  });

  // Delete a conversation
  router.delete('/conversations/:id', (req: Request, res: Response) => {
    const success = storage.deleteConversation(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.status(204).send();
  });

  // Chat endpoint
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body as ChatRequest;

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
      const userMessage = storage.addMessage(conversation.id, 'user', message);

      // Call Claude API with Claude Sonnet 4.5 (latest model as of Sept 2025)
      const claudeResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8096,
        system: `You are a knowledgeable assistant for a Dark Sun D&D campaign. Dark Sun is a unique campaign setting featuring:
- A harsh desert world called Athas
- Survival in a brutal post-apocalyptic environment
- Powerful sorcerer-kings ruling city-states
- Defiling magic that destroys the land
- Psionic abilities are common
- Metal is extremely rare
- Slavery and gladiatorial combat are prevalent

Help the Dungeon Master manage their campaign, answer questions about the setting, and provide creative ideas while staying true to the Dark Sun lore.`,
        messages: [
          { role: 'user', content: message }
        ]
      });

      const assistantContent = claudeResponse.content[0].type === 'text'
        ? claudeResponse.content[0].text
        : 'Unable to generate response';

      const assistantMessage = storage.addMessage(
        conversation.id,
        'assistant',
        assistantContent
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

  return router;
}
