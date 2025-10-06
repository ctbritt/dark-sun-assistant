// Dark Sun Campaign Assistant Frontend

interface FileAttachment {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
  content?: string;
  processed?: boolean;
}

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
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
  private selectedFile: File | null = null;
  private loadingIndicator: HTMLElement | null = null;
  private loadingMessageInterval: number | null = null;
  private currentLoadingMessageIndex: number = 0;

  // Dark Sun themed loading messages
  private readonly loadingMessages = [
    'Consulting the Oracle of Athas...',
    'Deciphering ancient scrolls...',
    'Communing with the spirits of the Tablelands...',
    'Searching the archives of Tyr...',
    'Channeling the Way...',
    'Consulting the sorcerer-kings\' wisdom...',
    'Reading the obsidian oracles...',
    'Invoking psionic visions...',
    'Scanning the ruins of Kalidnay...',
    'Consulting the Veiled Alliance...'
  ];

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
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const fileUploadBtn = document.getElementById('file-upload-btn') as HTMLButtonElement;
    const fileRemoveBtn = document.querySelector('.file-remove-btn') as HTMLButtonElement;

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    newConvBtn?.addEventListener('click', () => {
      this.createNewConversation();
    });

    // File upload event listeners (optional elements)
    if (fileUploadBtn && fileInput) {
      fileUploadBtn.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          this.handleFileSelect(target.files[0]);
        }
      });
    }

    fileRemoveBtn?.addEventListener('click', () => {
      this.removeSelectedFile();
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

  private handleFileSelect(file: File) {
    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/markdown'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only images, PDFs, and text files are allowed.');
      return;
    }

    if (file.size > maxSize) {
      alert('File size too large. Maximum size is 50MB.');
      return;
    }

    this.selectedFile = file;
    this.showFilePreview(file);
  }

  private showFilePreview(file: File) {
    const preview = document.getElementById('file-preview') as HTMLDivElement;
    const fileName = preview.querySelector('.file-name') as HTMLSpanElement;

    fileName.textContent = file.name;
    preview.style.display = 'block';
  }

  private removeSelectedFile() {
    this.selectedFile = null;
    const preview = document.getElementById('file-preview') as HTMLDivElement;
    preview.style.display = 'none';
    
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    fileInput.value = '';
  }

  private async uploadFile(file: File): Promise<FileAttachment | null> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      return result.file;
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file. Please try again.');
      return null;
    }
  }

  private async sendMessage() {
    const input = document.getElementById('message-input') as HTMLTextAreaElement;
    const message = input.value.trim();

    if (!message && !this.selectedFile) return;

    // Disable input while sending
    input.disabled = true;
    const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    sendBtn.disabled = true;

    try {
      // If no conversation, create one
      if (!this.currentConversationId) {
        await this.createNewConversation();
      }

      let attachments: FileAttachment[] = [];
      if (this.selectedFile) {
        const uploadedFile = await this.uploadFile(this.selectedFile);
        if (uploadedFile) {
          attachments.push(uploadedFile);
        }
        this.removeSelectedFile();
      }

      const finalMessage = message || (attachments.length > 0 ? `Please analyze this file: ${attachments[0].originalName}` : '');

      // Add user message to UI immediately
      this.addMessageToUI({
        role: 'user',
        content: finalMessage,
        timestamp: new Date().toISOString(),
        attachments: attachments.length > 0 ? attachments : undefined
      } as any);

      // Show loading indicator
      this.showLoadingIndicator();

      // Send to server using fetch with SSE streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          conversationId: this.currentConversationId,
          attachments: attachments.length > 0 ? attachments : undefined
        })
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                break;
              }

              try {
                const event = JSON.parse(data);

                if (event.type === 'progress') {
                  // Update loading indicator with specific action
                  this.updateLoadingAction(event.action);
                } else if (event.type === 'response') {
                  // Final response received
                  this.currentConversationId = event.data.conversationId;

                  // Hide loading indicator
                  this.hideLoadingIndicator();

                  // Add assistant message
                  this.addMessageToUI(event.data.message);
                } else if (event.type === 'error') {
                  throw new Error(event.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Update conversation list
      await this.loadConversations();

      // Clear input
      input.value = '';
    } catch (error) {
      console.error('Failed to send message:', error);
      this.hideLoadingIndicator();
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
    const attachmentsHTML = message.attachments && message.attachments.length > 0 
      ? `<div class="attachments">
           ${message.attachments.map(att => `
             <div class="attachment">
               <span class="attachment-name">📎 ${att.originalName}</span>
               <span class="attachment-size">(${this.formatFileSize(att.size)})</span>
             </div>
           `).join('')}
         </div>`
      : '';

    return `
      <div class="message ${message.role}">
        <div class="role">${message.role === 'user' ? 'You' : 'Assistant'}</div>
        <div class="content">${this.escapeHtml(message.content)}</div>
        ${attachmentsHTML}
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

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Show the Dark Sun themed loading indicator with cycling messages
   */
  private showLoadingIndicator(): void {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    // Remove welcome message if present
    const welcome = messagesEl.querySelector('.welcome-message');
    if (welcome) {
      welcome.remove();
    }

    // Create loading indicator element
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'message assistant loading-message';
    this.loadingIndicator.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-content">
        <div class="loading-text">${this.loadingMessages[0]}</div>
        <div class="loading-action"></div>
      </div>
    `;

    messagesEl.appendChild(this.loadingIndicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Start cycling through messages
    this.currentLoadingMessageIndex = 0;
    this.loadingMessageInterval = window.setInterval(() => {
      this.cycleLoadingMessage();
    }, 2500);
  }

  /**
   * Hide and remove the loading indicator
   */
  private hideLoadingIndicator(): void {
    if (this.loadingMessageInterval) {
      clearInterval(this.loadingMessageInterval);
      this.loadingMessageInterval = null;
    }

    if (this.loadingIndicator) {
      // Fade out animation
      this.loadingIndicator.style.opacity = '0';
      this.loadingIndicator.style.transform = 'translateY(-10px)';
      this.loadingIndicator.style.transition = 'all 0.3s ease-out';

      setTimeout(() => {
        if (this.loadingIndicator) {
          this.loadingIndicator.remove();
          this.loadingIndicator = null;
        }
      }, 300);
    }

    this.currentLoadingMessageIndex = 0;
  }

  /**
   * Cycle to the next loading message
   */
  private cycleLoadingMessage(): void {
    if (!this.loadingIndicator) return;

    const loadingTextEl = this.loadingIndicator.querySelector('.loading-text') as HTMLElement;
    if (!loadingTextEl) return;

    // Move to next message
    this.currentLoadingMessageIndex = (this.currentLoadingMessageIndex + 1) % this.loadingMessages.length;

    // Fade out current text
    loadingTextEl.style.opacity = '0';
    loadingTextEl.style.transform = 'translateX(-10px)';

    setTimeout(() => {
      // Update text
      loadingTextEl.textContent = this.loadingMessages[this.currentLoadingMessageIndex];

      // Reset animation by removing and re-adding the animation class
      loadingTextEl.style.animation = 'none';
      setTimeout(() => {
        loadingTextEl.style.animation = '';
        loadingTextEl.style.opacity = '';
        loadingTextEl.style.transform = '';
      }, 10);
    }, 200);
  }

  /**
   * Update the loading indicator with a specific action message
   * For future use when MCP server queries are integrated
   * @param action - The specific action being performed (e.g., "Accessing Obsidian vault: campaign-notes.md")
   */
  public updateLoadingAction(action: string): void {
    if (!this.loadingIndicator) return;

    const actionEl = this.loadingIndicator.querySelector('.loading-action');
    if (!actionEl) return;

    actionEl.textContent = action;
  }

  /**
   * Clear the specific action message from the loading indicator
   */
  public clearLoadingAction(): void {
    if (!this.loadingIndicator) return;

    const actionEl = this.loadingIndicator.querySelector('.loading-action');
    if (!actionEl) return;

    actionEl.textContent = '';
  }
}

// Initialize app
const app = new DarkSunApp();

// Make app globally accessible for inline onclick handlers
(window as any).app = app;
