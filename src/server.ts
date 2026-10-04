import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StandupClient } from './standupClient.js';
import { INSTRUCTIONS } from './instructions.js';
import { HandedBackTracker } from './handedBackTracker.js';
import { mergeCardWork } from './mergeCardWork.js';

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

  const handedBack = new HandedBackTracker(client);

  async function respond(boardId: string, data: unknown) {
    const result = jsonResult(data);
    const notice = await handedBack.noticeFor(boardId);
    return notice ? { content: [...result.content, { type: 'text' as const, text: notice }] } : result;
  }

  async function respondAfterChange(boardId: string, data: unknown) {
    handedBack.forget(boardId);
    return respond(boardId, data);
  }

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
    const board = await client.getBoard(boardId);
    handedBack.remember(board);
    return respond(boardId, board);
  });

  server.registerTool('create_card', {
    description: 'Create a new card in a column',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      columnId: z.string().describe('The column to create the card in'),
      text: z.string().describe('The card text'),
    }),
  }, async ({ boardId, columnId, text }) => {
    return respondAfterChange(boardId, await client.createCard(boardId, columnId, text));
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
    return respondAfterChange(boardId, await client.updateCard(boardId, resolved.column.identifier, cardId, text));
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
    return respondAfterChange(boardId, await client.deleteCard(boardId, resolved.column.identifier, cardId));
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
    return respondAfterChange(boardId, await client.moveCard(boardId, resolved.column.identifier, cardId, toColumnId, index));
  });

  server.registerTool('assign_card', {
    description: 'Assign a user or agent to a card. Adds to existing assignees without duplicates. Column agents are assigned as agent:<identifier>.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      assignee: z.string().describe('Username, or agent:<identifier> for a column agent'),
    }),
  }, async ({ boardId, cardId, assignee }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    const current = resolved.card.assignees ?? [];
    const updated = current.includes(assignee) ? current : [...current, assignee];
    return respondAfterChange(boardId, await client.setAssignees(boardId, resolved.column.identifier, cardId, updated));
  });

  server.registerTool('unassign_card', {
    description: 'Remove a user or agent from a card.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      assignee: z.string().describe('Username, or agent:<identifier> for a column agent, to remove'),
    }),
  }, async ({ boardId, cardId, assignee }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    const current = resolved.card.assignees ?? [];
    const updated = current.filter(a => a !== assignee);
    return respondAfterChange(boardId, await client.setAssignees(boardId, resolved.column.identifier, cardId, updated));
  });

  server.registerTool('search_cards', {
    description: 'Search for cards across all boards by text content',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
  }, async ({ query }) => {
    return jsonResult(await client.searchCards(query));
  });

  server.registerTool('get_comments', {
    description: 'Get all comments on a card',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
    }),
  }, async ({ boardId, cardId }) => {
    return respond(boardId, await client.getComments(boardId, cardId));
  });

  server.registerTool('add_comment', {
    description: 'Add a comment to a card, with optional @mentions and clickable option buttons',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      text: z.string().describe('Comment text (supports markdown)'),
      mentions: z.array(z.string()).optional().describe('Usernames to @mention'),
      options: z.array(z.string()).optional().describe('Clickable option buttons for structured questions'),
      agentId: z.string().optional().describe('Identifier of the column agent posting the comment, so it is attributed to that agent'),
    }),
  }, async ({ boardId, cardId, text, mentions, options, agentId }) => {
    return respondAfterChange(boardId, await client.addComment(boardId, cardId, text, mentions, options, agentId));
  });

  server.registerTool('update_board_context', {
    description: "Set a board's project context (markdown) and/or repository URL. Omitted fields are left unchanged.",
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      context: z.string().optional().describe('Project context in markdown: stack, constraints, conventions'),
      repository: z.string().optional().describe('Git URL of the project repository'),
    }),
  }, async ({ boardId, context, repository }) => {
    return respondAfterChange(boardId, await client.updateBoardContext(boardId, context, repository));
  });

  server.registerTool('update_column_agents', {
    description: "Set the agents for a column. The list replaces the column's existing agents, so to change one agent send the full list from get_board with that agent edited. Keep each existing agent's identifier so its assignments and comments stay linked.",
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      columnId: z.string().describe('The column identifier'),
      agents: z.array(z.object({
        identifier: z.string().optional().describe('Existing agent identifier; omit for a new agent'),
        name: z.string().describe('Agent name'),
        instructions: z.string().optional().describe('Markdown instructions for the agent'),
        enabled: z.boolean().optional().describe('Whether the agent is active (default true)'),
      })).describe('The complete list of agents for the column (max 10)'),
    }),
  }, async ({ boardId, columnId, agents }) => {
    return respondAfterChange(boardId, await client.updateColumnAgents(boardId, columnId, agents));
  });

  server.registerTool('set_card_work', {
    description: 'Record where the work for a card lives: repository path, branch, commits, whether it was pushed and the pull request link. Merges with what is already recorded: new commits are added and fields you leave out are kept.',
    inputSchema: z.object({
      boardId: z.string().describe('The board identifier'),
      cardId: z.string().describe('The card identifier'),
      branch: z.string().optional().describe('Branch the work is on (required the first time)'),
      commits: z.array(z.string()).optional().describe('Commit SHAs to add'),
      repositoryPath: z.string().optional().describe('Absolute path of the local clone'),
      pushed: z.boolean().optional().describe('Whether the branch has been pushed'),
      pullRequestUrl: z.string().optional().describe('Link to the pull request, if one was opened'),
    }),
  }, async ({ boardId, cardId, ...update }) => {
    const resolved = await resolveCard(boardId, cardId);
    if (!resolved) return cardNotFound(boardId, cardId);
    const work = mergeCardWork(resolved.card.work, update);
    if (!work) {
      return { content: [{ type: 'text' as const, text: 'branch is required the first time work is recorded on a card' }], isError: true };
    }
    return respondAfterChange(boardId, await client.setCardWork(boardId, cardId, work));
  });

  return server;
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function cardNotFound(boardId: string, cardId: string) {
  return { content: [{ type: 'text' as const, text: `Card ${cardId} not found on board ${boardId}` }], isError: true };
}
