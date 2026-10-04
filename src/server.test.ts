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
  'set_card_work',
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

  it('tells agents to record the repository path, branch and commits on the card', async () => {
    const instructions = client.getInstructions();
    expect(instructions).toMatch(/absolute repository path, branch and new commit SHA/);
    expect(instructions).not.toMatch(/\*\*Where:\*\*/);
  });

  it('tells reviewers to assign themselves even when they only approve', async () => {
    expect(client.getInstructions()).toMatch(/even if you only approve/i);
  });

  it('explains that standup hands a card back when the person answers', async () => {
    expect(client.getInstructions()).toMatch(/hands the card back/i);
  });

  it('tells agents to resume cards handed back to them before other work', async () => {
    const instructions = client.getInstructions();
    expect(instructions).toMatch(/1\. Cards assigned to one of your agents where a person has replied/);
    expect(instructions).toMatch(/2\. Unfinished cards in your agents' columns/);
  });

  it('does not treat a card assigned to your own agent as off limits', async () => {
    const instructions = client.getInstructions();
    expect(instructions).not.toMatch(/is not already assigned to it/);
    expect(instructions).toMatch(/assigned to one of your agents means it is yours to continue/i);
  });

  it('tells agents to act on the handed-back note in tool responses', async () => {
    expect(client.getInstructions()).toMatch(/"Handed back to you" note/);
  });

  it('tells agents to record where the work lives with set_card_work', async () => {
    expect(client.getInstructions()).toMatch(/call `set_card_work`/);
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

describe('set_card_work', () => {
  const boardWithWork = (work?: object) => ({
    identifier: 'b1',
    columns: [{ identifier: 'c1', name: 'Code Review', cards: [{ identifier: 'card1', text: 'Fix', ...(work ? { work } : {}) }] }],
  });

  const workSent = () => {
    const call = fetchSpy.mock.calls.find(([url, options]) =>
      url === 'https://standup.test/api/boards/b1/cards/card1/work' && options?.method === 'PUT');
    return JSON.parse(call[1].body);
  };

  it('records where the work lives on a card with no work yet', async () => {
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify(boardWithWork()), { status: 200 }));

    await client.callTool({
      name: 'set_card_work',
      arguments: { boardId: 'b1', cardId: 'card1', branch: 'standup/fix', commits: ['811fca4'], repositoryPath: '/src/app' },
    });

    expect(workSent()).toEqual({ branch: 'standup/fix', commits: ['811fca4'], pushed: false, repositoryPath: '/src/app' });
  });

  it('adds new commits to the commits already recorded without duplicates', async () => {
    const existing = { branch: 'standup/fix', commits: ['811fca4'], pushed: false, repositoryPath: '/src/app' };
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify(boardWithWork(existing)), { status: 200 }));

    await client.callTool({
      name: 'set_card_work',
      arguments: { boardId: 'b1', cardId: 'card1', branch: 'standup/fix', commits: ['811fca4', '737d190'] },
    });

    expect(workSent()).toEqual({ ...existing, commits: ['811fca4', '737d190'] });
  });

  it('keeps recorded fields that are not given', async () => {
    const existing = { branch: 'standup/fix', commits: ['811fca4'], pushed: false, repositoryPath: '/src/app' };
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify(boardWithWork(existing)), { status: 200 }));

    await client.callTool({
      name: 'set_card_work',
      arguments: { boardId: 'b1', cardId: 'card1', pushed: true, pullRequestUrl: 'https://github.com/o/r/pull/1' },
    });

    expect(workSent()).toEqual({ ...existing, pushed: true, pullRequestUrl: 'https://github.com/o/r/pull/1' });
  });

  it('asks for a branch when the card has no work recorded yet', async () => {
    fetchSpy.mockImplementation(async () => new Response(JSON.stringify(boardWithWork()), { status: 200 }));

    const result = await client.callTool({ name: 'set_card_work', arguments: { boardId: 'b1', cardId: 'card1', pushed: true } });

    expect(result.isError).toBe(true);
  });
});

describe('handed-back notice', () => {
  const handedBackBoard = {
    identifier: 'b1',
    columns: [{
      identifier: 'c1',
      name: 'Triage',
      agents: [{ identifier: 'triage-1', name: 'Triage Agent' }],
      cards: [{
        identifier: 'card1',
        text: 'Bump the version',
        assignees: ['agent:triage-1'],
        comments: [
          { identifier: 'q1', author: 'u', text: 'Which?', agentId: 'triage-1' },
          { identifier: 'r1', author: 'u', text: 'Minor' },
        ],
      }],
    }],
  };
  const quietBoard = { identifier: 'b1', columns: [{ identifier: 'c1', name: 'Triage', cards: [] }] };

  const respondTo = (routes: Record<string, unknown>) => {
    fetchSpy.mockImplementation(async (url: string) => {
      const path = url.replace('https://standup.test', '');
      return new Response(JSON.stringify(routes[path] ?? {}), { status: 200 });
    });
  };

  const boardFetches = () =>
    fetchSpy.mock.calls.filter(([url]) => url === 'https://standup.test/api/boards/b1').length;

  const texts = (result: Awaited<ReturnType<typeof client.callTool>>) =>
    (result.content as Array<{ type: string; text: string }>).map((c) => c.text);

  it('appends a note to the tool response when a card has been handed back', async () => {
    respondTo({ '/api/boards/b1': handedBackBoard });

    const result = await client.callTool({
      name: 'add_comment',
      arguments: { boardId: 'b1', cardId: 'other', text: 'Done', agentId: 'coding-1' },
    });

    expect(texts(result)[1]).toMatch(/Handed back to you[\s\S]*"Bump the version" \(card card1\) for Triage Agent/);
  });

  it('adds no note when nothing has been handed back', async () => {
    respondTo({ '/api/boards/b1': quietBoard });

    const result = await client.callTool({ name: 'get_comments', arguments: { boardId: 'b1', cardId: 'card1' } });

    expect(texts(result)).toHaveLength(1);
  });

  it('uses the board returned by get_board instead of fetching it again', async () => {
    respondTo({ '/api/boards/b1': handedBackBoard });

    const result = await client.callTool({ name: 'get_board', arguments: { boardId: 'b1' } });

    expect(boardFetches()).toBe(1);
    expect(texts(result)[1]).toMatch(/Handed back to you/);
  });

  it('reuses a recently fetched board for read-only tools', async () => {
    respondTo({ '/api/boards/b1': handedBackBoard });

    await client.callTool({ name: 'get_board', arguments: { boardId: 'b1' } });
    await client.callTool({ name: 'get_comments', arguments: { boardId: 'b1', cardId: 'card1' } });

    expect(boardFetches()).toBe(1);
  });

  it('fetches the board again after a tool changes it', async () => {
    respondTo({ '/api/boards/b1': handedBackBoard });

    await client.callTool({ name: 'get_board', arguments: { boardId: 'b1' } });
    await client.callTool({
      name: 'add_comment',
      arguments: { boardId: 'b1', cardId: 'card1', text: 'Resuming', agentId: 'triage-1' },
    });

    expect(boardFetches()).toBe(2);
  });

  it('still returns the tool result when the board cannot be fetched for the note', async () => {
    fetchSpy.mockImplementation(async (url: string) =>
      url.endsWith('/comments')
        ? new Response(JSON.stringify([{ identifier: 'r1' }]), { status: 200 })
        : new Response('boom', { status: 500 }),
    );

    const result = await client.callTool({ name: 'get_comments', arguments: { boardId: 'b1', cardId: 'card1' } });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(texts(result)[0])).toEqual([{ identifier: 'r1' }]);
  });
});
