import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandupClient } from './standupClient.js';

let client: StandupClient;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  client = new StandupClient({ baseUrl: 'https://standup.test', apiKey: 'sk-test', fetchFn: fetchSpy });
});

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });

describe('request headers', () => {
  it('sends authorization and content-type headers', async () => {
    fetchSpy.mockResolvedValue(ok([]));
    await client.listBoards();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-test',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});

describe('error handling', () => {
  it('throws on non-ok response', async () => {
    fetchSpy.mockResolvedValue(new Response('Not found', { status: 404 }));
    await expect(client.listBoards()).rejects.toThrow('Standup API error 404');
  });
});

describe('trailing slash handling', () => {
  it('strips trailing slash from base URL', async () => {
    const c = new StandupClient({ baseUrl: 'https://standup.test/', apiKey: 'sk-test', fetchFn: fetchSpy });
    fetchSpy.mockResolvedValue(ok([]));
    await c.listBoards();
    expect(fetchSpy).toHaveBeenCalledWith('https://standup.test/api/boards', expect.anything());
  });
});

describe('listBoards', () => {
  it('calls GET /api/boards', async () => {
    fetchSpy.mockResolvedValue(ok([{ identifier: 'b1' }]));
    const result = await client.listBoards();
    expect(fetchSpy).toHaveBeenCalledWith('https://standup.test/api/boards', expect.anything());
    expect(result).toEqual([{ identifier: 'b1' }]);
  });
});

describe('getBoard', () => {
  it('calls GET /api/boards/:id', async () => {
    fetchSpy.mockResolvedValue(ok({ identifier: 'b1' }));
    const result = await client.getBoard('b1');
    expect(fetchSpy).toHaveBeenCalledWith('https://standup.test/api/boards/b1', expect.anything());
    expect(result).toEqual({ identifier: 'b1' });
  });
});

describe('createCard', () => {
  it('calls POST with text body', async () => {
    fetchSpy.mockResolvedValue(ok({ identifier: 'card1' }));
    await client.createCard('b1', 'c1', 'New task');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'New task' }),
      }),
    );
  });
});

describe('moveCard', () => {
  it('omits index when undefined', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true }));
    await client.moveCard('b1', 'c1', 'card1', 'c2');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ toColumnId: 'c2' }),
      }),
    );
  });

  it('includes index when provided', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true }));
    await client.moveCard('b1', 'c1', 'card1', 'c2', 0);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ toColumnId: 'c2', index: 0 }),
      }),
    );
  });
});

describe('findCardColumn', () => {
  it('returns the column containing the card', () => {
    const board = {
      identifier: 'b1',
      columns: [
        { identifier: 'c1', name: 'A', cards: [{ identifier: 'x', text: '' }] },
        { identifier: 'c2', name: 'B', cards: [{ identifier: 'y', text: '' }] },
      ],
    };
    expect(client.findCardColumn(board, 'y')?.identifier).toBe('c2');
  });

  it('returns null when card is not found', () => {
    const board = { identifier: 'b1', columns: [{ identifier: 'c1', name: 'A', cards: [] }] };
    expect(client.findCardColumn(board, 'missing')).toBeNull();
  });
});

describe('findCard', () => {
  it('returns the card across columns', () => {
    const board = {
      identifier: 'b1',
      columns: [
        { identifier: 'c1', name: 'A', cards: [] },
        { identifier: 'c2', name: 'B', cards: [{ identifier: 'y', text: 'found' }] },
      ],
    };
    expect(client.findCard(board, 'y')?.text).toBe('found');
  });

  it('returns null when card is not found', () => {
    const board = { identifier: 'b1', columns: [] };
    expect(client.findCard(board, 'missing')).toBeNull();
  });
});
