import type { Board, StandupClient } from './standupClient.js';
import { findHandedBackCards, handedBackNotice } from './handedBackCards.js';

const DEFAULT_TTL_MS = 5000;

export class HandedBackTracker {
  private boards = new Map<string, { board: Board; fetchedAt: number }>();

  constructor(
    private client: StandupClient,
    private ttlMs: number = DEFAULT_TTL_MS,
    private now: () => number = Date.now,
  ) {}

  remember(board: Board): void {
    this.boards.set(board.identifier, { board, fetchedAt: this.now() });
  }

  forget(boardId: string): void {
    this.boards.delete(boardId);
  }

  async noticeFor(boardId: string): Promise<string | null> {
    try {
      return handedBackNotice(findHandedBackCards(await this.boardFor(boardId)));
    } catch {
      // The notice is a hint; never let it break the tool call it is attached to
      return null;
    }
  }

  private async boardFor(boardId: string): Promise<Board> {
    const cached = this.boards.get(boardId);
    if (cached && this.now() - cached.fetchedAt < this.ttlMs) {
      return cached.board;
    }
    const board = await this.client.getBoard(boardId);
    this.remember(board);
    return board;
  }
}
