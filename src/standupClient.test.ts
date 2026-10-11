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

describe('searchCards', () => {
  it('calls GET /api/boards/search with encoded query', async () => {
    fetchSpy.mockResolvedValue(ok([{ cardId: 'card1', text: 'result' }]));
    await client.searchCards('hello world');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/search?q=hello%20world',
      expect.anything(),
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

describe('addColumn', () => {
  it('calls POST with the name and index', async () => {
    fetchSpy.mockResolvedValue(ok({ identifier: 'c9' }, 201));
    await client.addColumn('b1', 'Review', 1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Review', index: 1 }) }),
    );
  });

  it('omits index when undefined', async () => {
    fetchSpy.mockResolvedValue(ok({ identifier: 'c9' }, 201));
    await client.addColumn('b1', 'Review');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ name: 'Review' }) }),
    );
  });
});

describe('renameColumn', () => {
  it('calls PUT with the new name', async () => {
    fetchSpy.mockResolvedValue(ok({ identifier: 'c1' }));
    await client.renameColumn('b1', 'c1', 'Backlog');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'Backlog' }) }),
    );
  });
});

describe('reorderColumn', () => {
  it('calls the move endpoint with the index', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true }));
    await client.reorderColumn('b1', 'c1', 0);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/move',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ index: 0 }) }),
    );
  });
});

describe('deleteColumn', () => {
  it('calls DELETE without deleting cards by default', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true }));
    await client.deleteColumn('b1', 'c1');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('asks the server to delete the cards when requested', async () => {
    fetchSpy.mockResolvedValue(ok({ success: true }));
    await client.deleteColumn('b1', 'c1', true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1?deleteCards=true',
      expect.anything(),
    );
  });
});

describe('addSticker', () => {
  it('calls POST with the sticker', async () => {
    fetchSpy.mockResolvedValue(ok({ identifier: 'card1' }));
    await client.addSticker('b1', 'c1', 'card1', '🫠');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1/stickers',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ sticker: '🫠' }) }),
    );
  });
});

describe('removeSticker', () => {
  it('calls DELETE with the sticker index', async () => {
    fetchSpy.mockResolvedValue(ok({ identifier: 'card1' }));
    await client.removeSticker('b1', 'c1', 'card1', 2);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://standup.test/api/boards/b1/columns/c1/cards/card1/stickers/2',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('getAttachment', () => {
  it('returns the file as base64 with its content type', async () => {
    fetchSpy.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    }));

    const attachment = await client.getAttachment('b1', 'card1', 'f1');

    expect(fetchSpy).toHaveBeenCalledWith('https://standup.test/api/boards/b1/cards/card1/attachments/f1', expect.anything());
    expect(attachment).toEqual({ data: 'AQID', mimeType: 'image/png' });
  });

  it('drops content type parameters such as the charset', async () => {
    fetchSpy.mockResolvedValue(new Response('notes', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }));

    const attachment = await client.getAttachment('b1', 'card1', 'f1');

    expect(attachment.mimeType).toBe('text/plain');
  });

  it('throws on non-ok response', async () => {
    fetchSpy.mockResolvedValue(new Response('{"error":"Attachment not found"}', { status: 404 }));
    await expect(client.getAttachment('b1', 'card1', 'f1')).rejects.toThrow('Standup API error 404');
  });
});
