import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './server.js';

const EXPECTED_TOOLS = [
  'list_boards',
  'get_board',
  'create_card',
  'update_card',
  'delete_card',
  'move_card',
  'assign_card',
  'unassign_card',
  'search_cards',
  'get_comments',
  'add_comment',
  'update_board_context',
  'update_column_agents',
];

let client: Client;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  fetchSpy = vi.fn();
  const server = createServer({ baseUrl: 'https://standup.test', apiKey: 'sk-test', fetchFn: fetchSpy });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
});

describe('server registration', () => {
  it('registers all expected tools', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('provides server instructions', async () => {
    expect(client.getInstructions()).toBeTruthy();
  });

  it('tells agents to read the board context and repository', async () => {
    expect(client.getInstructions()).toMatch(/`context`.*`repository`/);
  });

  it('tells agents to pull inbox cards into the first active column', async () => {
    expect(client.getInstructions()).toMatch(/first active column/i);
  });

  it('tells agents to leave the inbox and terminal columns alone', async () => {
    expect(client.getInstructions()).toMatch(/never process cards in the first column/i);
    expect(client.getInstructions()).toMatch(/terminal/i);
  });

  it('tells each column agent to assign itself as agent:<identifier>', async () => {
    expect(client.getInstructions()).toMatch(/`agent:<identifier>`/);
  });

  it('lets agents in the same column work on a card in parallel', async () => {
    expect(client.getInstructions()).toMatch(/parallel/i);
  });

  it('tells agents never to work on cards assigned to a person', async () => {
    expect(client.getInstructions()).toMatch(/never work on a card assigned to a person/i);
  });

  it('tells agents to judge whether they have finished a card from the comments and their times', async () => {
    const instructions = client.getInstructions();
    expect(instructions).toMatch(/judge from the card's comments/i);
    expect(instructions).not.toMatch(/stageEnteredAt/);
  });

  it('tells agents to prompt the user about cards that have stalled', async () => {
    expect(client.getInstructions()).toMatch(/stalled/i);
  });

  it('tells agents to block in place instead of using an awaiting input column', async () => {
    const instructions = client.getInstructions();
    expect(instructions).toMatch(/leave the card in its column/i);
    expect(instructions).not.toMatch(/Awaiting Input/);
  });

  it('gives agents a default git workflow so boards do not need a git policy', async () => {
    const instructions = client.getInstructions();
    expect(instructions).toMatch(/### Where the work lives/);
    expect(instructions).toMatch(/do not push/i);
  });

  it('tells agents to say where the work is when they change code', async () => {
    const instructions = client.getInstructions();
    expect(instructions).toMatch(/\*\*Where:\*\*/);
    expect(instructions).toMatch(/commit/i);
    expect(instructions).toMatch(/branch/i);
  });

  it('tells reviewers to assign themselves even when they only approve', async () => {
    expect(client.getInstructions()).toMatch(/even if you only approve/i);
  });

  it('explains that standup hands a card back when the person answers', async () => {
    expect(client.getInstructions()).toMatch(/hands the card back/i);
  });

  it('describes how triage handles each kind of inbox card', async () => {
    const instructions = client.getInstructions();
    expect(instructions).toMatch(/### Triage/);
    expect(instructions).toMatch(/ambiguous/i);
    expect(instructions).toMatch(/empty/i);
  });
});

describe('list_boards', () => {
  it('calls GET /api/boards and returns the result', async () => {
    const boards = [{ identifier: 'b1', name: 'My Board', columns: [] }];
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(boards), { status: 200 }));

    const result = await client.callTool({ name: 'list_boards', arguments: {} });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer sk-test' }),
      }),
    );
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual(boards);
  });
});

describe('get_board', () => {
  it('calls GET /api/boards/:id and returns the result', async () => {
    const board = { identifier: 'b1', name: 'Board', columns: [{ identifier: 'c1', name: 'To Do', cards: [] }] };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(board), { status: 200 }));

    const result = await client.callTool({ name: 'get_board', arguments: { boardId: 'b1' } });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer sk-test' }),
      }),
    );
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual(board);
  });
});

describe('create_card', () => {
  it('calls POST to create a card in the specified column', async () => {
    const card = { identifier: 'card1', text: 'New task' };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(card), { status: 201 }));

    const result = await client.callTool({
      name: 'create_card',
      arguments: { boardId: 'b1', columnId: 'c1', text: 'New task' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'New task' }),
      }),
    );
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual(card);
  });
});

describe('update_card', () => {
  it('finds the card column and calls PUT to update text', async () => {
    const board = {
      identifier: 'b1',
      columns: [{ identifier: 'c1', name: 'To Do', cards: [{ identifier: 'card1', text: 'Old' }] }],
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(board), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ identifier: 'card1', text: 'Updated' }), { status: 200 }));

    await client.callTool({
      name: 'update_card',
      arguments: { boardId: 'b1', cardId: 'card1', text: 'Updated' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ text: 'Updated' }),
      }),
    );
  });
});

describe('delete_card', () => {
  it('finds the card column and calls DELETE', async () => {
    const board = {
      identifier: 'b1',
      columns: [{ identifier: 'c1', name: 'To Do', cards: [{ identifier: 'card1', text: 'Delete me' }] }],
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(board), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await client.callTool({
      name: 'delete_card',
      arguments: { boardId: 'b1', cardId: 'card1' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('move_card', () => {
  it('finds the source column and calls move endpoint', async () => {
    const board = {
      identifier: 'b1',
      columns: [
        { identifier: 'c1', name: 'To Do', cards: [{ identifier: 'card1', text: 'Task' }] },
        { identifier: 'c2', name: 'Done', cards: [] },
      ],
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(board), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await client.callTool({
      name: 'move_card',
      arguments: { boardId: 'b1', cardId: 'card1', toColumnId: 'c2' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1/move',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ toColumnId: 'c2' }),
      }),
    );
  });

  it('includes index when provided', async () => {
    const board = {
      identifier: 'b1',
      columns: [
        { identifier: 'c1', name: 'To Do', cards: [{ identifier: 'card1', text: 'Task' }] },
        { identifier: 'c2', name: 'Done', cards: [] },
      ],
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(board), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await client.callTool({
      name: 'move_card',
      arguments: { boardId: 'b1', cardId: 'card1', toColumnId: 'c2', index: 0 },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1/move',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ toColumnId: 'c2', index: 0 }),
      }),
    );
  });
});

describe('assign_card', () => {
  it('fetches current assignees and adds the new one', async () => {
    const board = {
      identifier: 'b1',
      columns: [{ identifier: 'c1', name: 'To Do', cards: [{ identifier: 'card1', text: 'Task', assignees: ['alice'] }] }],
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(board), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ identifier: 'card1', assignees: ['alice', 'bob'] }), { status: 200 }));

    await client.callTool({
      name: 'assign_card',
      arguments: { boardId: 'b1', cardId: 'card1', assignee: 'bob' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1/assignees',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ assignees: ['alice', 'bob'] }),
      }),
    );
  });

  it('does not duplicate an existing assignee', async () => {
    const board = {
      identifier: 'b1',
      columns: [{ identifier: 'c1', name: 'To Do', cards: [{ identifier: 'card1', text: 'Task', assignees: ['alice'] }] }],
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(board), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ identifier: 'card1', assignees: ['alice'] }), { status: 200 }));

    await client.callTool({
      name: 'assign_card',
      arguments: { boardId: 'b1', cardId: 'card1', assignee: 'alice' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1/assignees',
      expect.objectContaining({
        body: JSON.stringify({ assignees: ['alice'] }),
      }),
    );
  });
});

describe('unassign_card', () => {
  it('fetches current assignees and removes the specified one', async () => {
    const board = {
      identifier: 'b1',
      columns: [{ identifier: 'c1', name: 'To Do', cards: [{ identifier: 'card1', text: 'Task', assignees: ['alice', 'bob'] }] }],
    };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(board), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ identifier: 'card1', assignees: ['alice'] }), { status: 200 }));

    await client.callTool({
      name: 'unassign_card',
      arguments: { boardId: 'b1', cardId: 'card1', assignee: 'bob' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1/assignees',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ assignees: ['alice'] }),
      }),
    );
  });
});

describe('search_cards', () => {
  it('calls GET /api/boards/search with query parameter', async () => {
    const results = [{ boardId: 'b1', boardName: 'Board', cardId: 'card1', text: 'MCP integration' }];
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(results), { status: 200 }));

    const result = await client.callTool({
      name: 'search_cards',
      arguments: { query: 'MCP' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/search?q=MCP',
      expect.anything(),
    );
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual(results);
  });
});

describe('get_comments', () => {
  it('calls GET /api/boards/:boardId/cards/:cardId/comments', async () => {
    const comments = [{ identifier: 'c1', text: 'Hello', author: 'alice' }];
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(comments), { status: 200 }));

    const result = await client.callTool({
      name: 'get_comments',
      arguments: { boardId: 'b1', cardId: 'card1' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/cards/card1/comments',
      expect.anything(),
    );
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual(comments);
  });
});

describe('add_comment', () => {
  it('calls POST with text, mentions, and options', async () => {
    const comment = { identifier: 'c1', text: 'Hello', author: 'alice' };
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(comment), { status: 201 }));

    await client.callTool({
      name: 'add_comment',
      arguments: {
        boardId: 'b1',
        cardId: 'card1',
        text: 'Need input',
        mentions: ['bob'],
        options: ['Yes', 'No'],
      },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/cards/card1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Need input', mentions: ['bob'], options: ['Yes', 'No'] }),
      }),
    );
  });

  it('attributes the comment to an agent when agentId is provided', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));

    await client.callTool({
      name: 'add_comment',
      arguments: { boardId: 'b1', cardId: 'card1', text: 'Approved', agentId: 'swift-1' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/cards/card1/comments',
      expect.objectContaining({
        body: JSON.stringify({ text: 'Approved', agentId: 'swift-1' }),
      }),
    );
  });

  it('omits mentions and options when not provided', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));

    await client.callTool({
      name: 'add_comment',
      arguments: { boardId: 'b1', cardId: 'card1', text: 'Simple comment' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/cards/card1/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Simple comment' }),
      }),
    );
  });
});

describe('error handling', () => {
  it('returns an error when the API responds with a non-ok status', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }));

    const result = await client.callTool({ name: 'list_boards', arguments: {} });

    expect(result.isError).toBe(true);
  });
});

describe('update_board_context', () => {
  it('calls PUT /api/boards/:id/context with context and repository', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await client.callTool({
      name: 'update_board_context',
      arguments: { boardId: 'b1', context: 'Swift 6 app', repository: 'git@github.com:me/app.git' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/context',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ context: 'Swift 6 app', repository: 'git@github.com:me/app.git' }),
      }),
    );
  });

  it('only sends the fields that were provided', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await client.callTool({
      name: 'update_board_context',
      arguments: { boardId: 'b1', repository: 'repo-url' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/context',
      expect.objectContaining({ body: JSON.stringify({ repository: 'repo-url' }) }),
    );
  });
});

describe('update_column_agents', () => {
  it('calls PUT /api/boards/:id/columns/:colId/agents with the full agents list', async () => {
    const agents = [
      { identifier: 'a1', name: 'Reviewer', instructions: 'Review it', enabled: false },
      { name: 'Tester', instructions: 'Test it' },
    ];
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(agents), { status: 200 }));

    await client.callTool({
      name: 'update_column_agents',
      arguments: { boardId: 'b1', columnId: 'c1', agents },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/agents',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ agents }),
      }),
    );
  });

  it('explains that the list replaces the existing agents', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'update_column_agents');

    expect(tool.description).toMatch(/replaces/i);
  });
});
