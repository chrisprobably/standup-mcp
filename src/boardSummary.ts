import type { Board, Card, CardWork, ColumnAgent } from './standupClient.js';
import { firstLineOfCardText } from './cardText.js';

export interface LastCommentSummary {
  author: string;
  agentId: string | null;
  createdAt: string | null;
}

export interface CardSummary {
  identifier: string;
  columnId: string;
  position: number;
  firstLine: string;
  assignees: string[];
  stickers: string[];
  work: Omit<CardWork, 'repositoryPath'> | null;
  commentCount: number;
  lastComment: LastCommentSummary | null;
}

export interface ColumnSummary {
  identifier: string;
  name: string;
  agents: ColumnAgent[];
}

export interface BoardSummary {
  identifier: string;
  name: string | null;
  context: string | null;
  repository: string | null;
  columns: ColumnSummary[];
  cards: CardSummary[];
}

function summarizeWork(work: CardWork | undefined): CardSummary['work'] {
  if (!work) return null;
  const { branch, commits, pushed, pullRequestUrl } = work;
  return pullRequestUrl ? { branch, commits, pushed, pullRequestUrl } : { branch, commits, pushed };
}

function summarizeLastComment(card: Card): LastCommentSummary | null {
  const last = card.comments?.at(-1);
  if (!last) return null;
  return { author: last.author, agentId: last.agentId ?? null, createdAt: last.createdAt ?? null };
}

function summarizeCard(card: Card, columnId: string, position: number): CardSummary {
  return {
    identifier: card.identifier,
    columnId,
    position,
    firstLine: firstLineOfCardText(card.text ?? ''),
    assignees: card.assignees ?? [],
    stickers: card.stickers ?? [],
    work: summarizeWork(card.work),
    commentCount: card.comments?.length ?? 0,
    lastComment: summarizeLastComment(card),
  };
}

export function summarizeBoard(board: Board): BoardSummary {
  return {
    identifier: board.identifier,
    name: board.name ?? null,
    context: board.context ?? null,
    repository: board.repository ?? null,
    columns: board.columns.map(({ identifier, name, agents }) => ({ identifier, name, agents: agents ?? [] })),
    cards: board.columns.flatMap((column) =>
      (column.cards ?? []).map((card, position) => summarizeCard(card, column.identifier, position)),
    ),
  };
}
