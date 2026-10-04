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
  'get_comments',
  'add_comment',
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
