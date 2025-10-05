// In-memory storage for MVP (replace with proper database later)
import { Conversation, Message } from './types';

class Storage {
  private conversations: Map<string, Conversation> = new Map();

  createConversation(title: string = 'New Conversation'): Conversation {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const conversation: Conversation = {
      id,
      title,
      created: new Date(),
      updated: new Date(),
      messages: []
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updated.getTime() - a.updated.getTime());
  }

  addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Message {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      role,
      content,
      timestamp: new Date()
    };

    conversation.messages.push(message);
    conversation.updated = new Date();

    return message;
  }

  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  clear(): void {
    this.conversations.clear();
  }
}

// Singleton instance
export const storage = new Storage();
