// Dark Sun Campaign Assistant Frontend

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  created: string;
  updated: string;
  messages: Message[];
}

class DarkSunApp {
  private currentConversationId: string | null = null;
  private conversations: Conversation[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    this.setupEventListeners();
    await this.checkHealth();
    await this.loadConversations();
  }

  private setupEventListeners() {
    const form = document.getElementById('chat-form') as HTMLFormElement;
    const input = document.getElementById('message-input') as HTMLTextAreaElement;
    const newConvBtn = document.getElementById('new-conversation-btn') as HTMLButtonElement;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    newConvBtn.addEventListener('click', () => {
      this.createNewConversation();
    });
  }

  private async checkHealth() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();

      const statusEl = document.getElementById('status');
      const statusText = document.getElementById('status-text');

      if (data.status === 'ok') {
        statusEl?.classList.add('connected');
        if (statusText) statusText.textContent = 'Connected';
      } else {
        if (statusText) statusText.textContent = 'Error';
      }
    } catch (error) {
      console.error('Health check failed:', error);
      const statusText = document.getElementById('status-text');
      if (statusText) statusText.textContent = 'Disconnected';
    }
  }

  private async loadConversations() {
    try {
      const response = await fetch('/api/conversations');
      this.conversations = await response.json();
      this.renderConversations();
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  private renderConversations() {
    const listEl = document.getElementById('conversations-list');
    if (!listEl) return;

    if (this.conversations.length === 0) {
      listEl.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No conversations yet</div>';
      return;
    }

    listEl.innerHTML = this.conversations
      .map(conv => `
        <div class="conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}"
             data-id="${conv.id}"
             onclick="app.selectConversation('${conv.id}')">
          <div class="title">${this.escapeHtml(conv.title)}</div>
          <div class="date">${this.formatDate(conv.updated)}</div>
        </div>
      `)
      .join('');
  }

  public async selectConversation(id: string) {
    this.currentConversationId = id;
    this.renderConversations();

    const conv = this.conversations.find(c => c.id === id);
    if (conv) {
      this.renderMessages(conv.messages);
    }
  }

  private async createNewConversation() {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' })
      });

      const conversation = await response.json();
      this.conversations.unshift(conversation);
      this.currentConversationId = conversation.id;
      this.renderConversations();
      this.clearMessages();

      // Focus the input
      const input = document.getElementById('message-input') as HTMLTextAreaElement;
      input?.focus();
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }

  private async sendMessage() {
    const input = document.getElementById('message-input') as HTMLTextAreaElement;
    const message = input.value.trim();

    if (!message) return;

    // Disable input while sending
    input.disabled = true;
    const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    sendBtn.disabled = true;

    try {
      // If no conversation, create one
      if (!this.currentConversationId) {
        await this.createNewConversation();
      }

      // Add user message to UI immediately
      this.addMessageToUI({ role: 'user', content: message, timestamp: new Date().toISOString() } as any);

      // Send to server
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId: this.currentConversationId
        })
      });

      const data = await response.json();
      this.currentConversationId = data.conversationId;

      // Add assistant message
      this.addMessageToUI(data.message);

      // Update conversation list
      await this.loadConversations();

      // Clear input
      input.value = '';
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  private clearMessages() {
    const messagesEl = document.getElementById('messages');
    if (messagesEl) {
      messagesEl.innerHTML = '';
    }
  }

  private renderMessages(messages: Message[]) {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    messagesEl.innerHTML = messages
      .map(msg => this.createMessageHTML(msg))
      .join('');

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  private addMessageToUI(message: Message) {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    // Remove welcome message if present
    const welcome = messagesEl.querySelector('.welcome-message');
    if (welcome) {
      welcome.remove();
    }

    messagesEl.insertAdjacentHTML('beforeend', this.createMessageHTML(message));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  private createMessageHTML(message: Message): string {
    return `
      <div class="message ${message.role}">
        <div class="role">${message.role === 'user' ? 'You' : 'Assistant'}</div>
        <div class="content">${this.escapeHtml(message.content)}</div>
        <div class="timestamp">${this.formatDate(message.timestamp)}</div>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }
}

// Initialize app
const app = new DarkSunApp();

// Make app globally accessible for inline onclick handlers
(window as any).app = app;
