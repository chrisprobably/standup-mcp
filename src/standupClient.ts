type FetchFn = typeof globalThis.fetch;

export interface StandupClientConfig {
  baseUrl: string;
  apiKey: string;
  fetchFn?: FetchFn;
}

export class StandupClient {
  private baseUrl: string;
  private apiKey: string;
  private fetchFn: FetchFn;

  constructor(config: StandupClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchFn(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Standup API error ${response.status}: ${body}`);
    }

    return response.json();
  }

  async listBoards(): Promise<unknown> {
    return this.request('/api/boards');
  }

  async getBoard(boardId: string): Promise<Board> {
    return this.request(`/api/boards/${boardId}`) as Promise<Board>;
  }

  async createCard(boardId: string, columnId: string, text: string): Promise<unknown> {
    return this.request(`/api/boards/${boardId}/columns/${columnId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async updateCard(boardId: string, columnId: string, cardId: string, text: string): Promise<unknown> {
    return this.request(`/api/boards/${boardId}/columns/${columnId}/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    });
  }

  async deleteCard(boardId: string, columnId: string, cardId: string): Promise<unknown> {
    return this.request(`/api/boards/${boardId}/columns/${columnId}/cards/${cardId}`, {
      method: 'DELETE',
    });
  }

  async moveCard(boardId: string, columnId: string, cardId: string, toColumnId: string, index?: number): Promise<unknown> {
    const body: Record<string, unknown> = { toColumnId };
    if (index !== undefined) body.index = index;
    return this.request(`/api/boards/${boardId}/columns/${columnId}/cards/${cardId}/move`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async setAssignees(boardId: string, columnId: string, cardId: string, assignees: string[]): Promise<unknown> {
    return this.request(`/api/boards/${boardId}/columns/${columnId}/cards/${cardId}/assignees`, {
      method: 'PUT',
      body: JSON.stringify({ assignees }),
    });
  }

  async getComments(boardId: string, cardId: string): Promise<unknown> {
    return this.request(`/api/boards/${boardId}/cards/${cardId}/comments`);
  }

  async addComment(boardId: string, cardId: string, text: string, mentions?: string[], options?: string[], agentId?: string): Promise<unknown> {
    const body: Record<string, unknown> = { text };
    if (mentions?.length) body.mentions = mentions;
    if (options?.length) body.options = options;
    if (agentId) body.agentId = agentId;
    return this.request(`/api/boards/${boardId}/cards/${cardId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateBoardContext(boardId: string, context?: string, repository?: string): Promise<unknown> {
    const body: Record<string, unknown> = {};
    if (context !== undefined) body.context = context;
    if (repository !== undefined) body.repository = repository;
    return this.request(`/api/boards/${boardId}/context`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async updateColumnAgents(boardId: string, columnId: string, agents: ColumnAgentInput[]): Promise<unknown> {
    return this.request(`/api/boards/${boardId}/columns/${columnId}/agents`, {
      method: 'PUT',
      body: JSON.stringify({ agents }),
    });
  }

  async searchCards(query: string): Promise<unknown> {
    return this.request(`/api/boards/search?q=${encodeURIComponent(query)}`);
  }

  findCardColumn(board: Board, cardId: string): Column | null {
    for (const column of board.columns) {
      if (column.cards?.some((c: Card) => c.identifier === cardId)) {
        return column;
      }
    }
    return null;
  }

  findCard(board: Board, cardId: string): Card | null {
    for (const column of board.columns) {
      const card = column.cards?.find((c: Card) => c.identifier === cardId);
      if (card) return card;
    }
    return null;
  }
}

export interface Card {
  identifier: string;
  text: string;
  assignees?: string[];
}

export interface Column {
  identifier: string;
  name: string;
  cards?: Card[];
}

export interface Board {
  identifier: string;
  columns: Column[];
}

export interface ColumnAgentInput {
  identifier?: string;
  name: string;
  instructions?: string;
  enabled?: boolean;
}
