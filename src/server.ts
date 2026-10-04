import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StandupClient } from './standupClient.js';
import { INSTRUCTIONS } from './instructions.js';

export interface ServerConfig {
  baseUrl: string;
  apiKey: string;
  fetchFn?: typeof globalThis.fetch;
}

export function createServer(config: ServerConfig): McpServer {
  const client = new StandupClient(config);

  const server = new McpServer(
    { name: 'standup', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );

  async function resolveCard(boardId: string, cardId: string) {
    const board = await client.getBoard(boardId);
    const column = client.findCardColumn(board, cardId);
    if (!column) return null;
    const card = client.findCard(board, cardId)!;
    return { board, column, card };
  }

  server.registerTool('list_boards', {
    description: 'List all boards with name and column summary',
    inputSchema: z.object({}),
  }, async () => {
    return jsonResult(await client.listBoards());
  });

  server.registerTool('get_board', {
    description: 'Get a full board with columns, cards, context, and agents',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
    }),
  }, async ({ boardId }) => {
    return jsonResult(await client.getBoard(boardId));
  });

  server.registerTool('create_card', {
    description: 'Create a new card in a column',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      columnId: z.string().describe('The column to create the card in'),
      text: z.string().describe('The card text'),
    }),
  }, async ({ boardId, columnId, text }) => {
    return jsonResult(await client.createCard(boardId, columnId, text));
  });

  server.registerTool('update_card', {
    description: 'Update card text. Automatically finds the column containing the card.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      text: z.string().describe('The new card text'),
    }),
  }, async ({ boardId, cardId, text }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    return jsonResult(await client.updateCard(boardId, resolved.column.identifier, cardId, text));
  });

  server.registerTool('delete_card', {
    description: 'Delete a card. Automatically finds the column containing the card.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
    }),
  }, async ({ boardId, cardId }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    return jsonResult(await client.deleteCard(boardId, resolved.column.identifier, cardId));
  });

  server.registerTool('move_card', {
    description: 'Move a card to a different column. Automatically finds the source column.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      toColumnId: z.string().describe('The target column identifier'),
      index: z.number().optional().describe('Position in the target column (0-based). Defaults to the end.'),
    }),
  }, async ({ boardId, cardId, toColumnId, index }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    return jsonResult(await client.moveCard(boardId, resolved.column.identifier, cardId, toColumnId, index));
  });

  server.registerTool('assign_card', {
    description: 'Assign a user or agent to a card. Adds to existing assignees without duplicates.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      assignee: z.string().describe('Username to assign'),
    }),
  }, async ({ boardId, cardId, assignee }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    const current = resolved.card.assignees ?? [];
    const updated = current.includes(assignee) ? current : [...current, assignee];
    return jsonResult(await client.setAssignees(boardId, resolved.column.identifier, cardId, updated));
  });

  server.registerTool('unassign_card', {
    description: 'Remove a user or agent from a card.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      assignee: z.string().describe('Username to remove'),
    }),
  }, async ({ boardId, cardId, assignee }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    const current = resolved.card.assignees ?? [];
    const updated = current.filter(a => a !== assignee);
    return jsonResult(await client.setAssignees(boardId, resolved.column.identifier, cardId, updated));
  });

  server.registerTool('get_comments', {
    description: 'Get all comments on a card',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
    }),
  }, async ({ boardId, cardId }) => {
    return jsonResult(await client.getComments(boardId, cardId));
  });

  server.registerTool('add_comment', {
    description: 'Add a comment to a card, with optional @mentions and clickable option buttons',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      text: z.string().describe('Comment text (supports markdown)'),
      mentions: z.array(z.string()).optional().describe('Usernames to @mention'),
      options: z.array(z.string()).optional().describe('Clickable option buttons for structured questions'),
    }),
  }, async ({ boardId, cardId, text, mentions, options }) => {
    return jsonResult(await client.addComment(boardId, cardId, text, mentions, options));
  });

  return server;
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function cardNotFound(boardId: string, cardId: string) {
  return { content: [{ type: 'text' as const, text: `Card ${cardId} not found on board ${boardId}` }], isError: true };
}
