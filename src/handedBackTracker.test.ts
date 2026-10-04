import { describe, it, expect, vi } from 'vitest';
import { HandedBackTracker } from './handedBackTracker.js';
import type { Board, StandupClient } from './standupClient.js';

const board: Board = { identifier: 'b1', columns: [] };

const createTracker = () => {
  let now = 0;
  const getBoard = vi.fn().mockResolvedValue(board);
  const tracker = new HandedBackTracker({ getBoard } as unknown as StandupClient, 5000, () => now);
  return { tracker, getBoard, advance: (ms: number) => { now += ms; } };
};

describe('HandedBackTracker', () => {
  it('reuses a board fetched within the last five seconds', async () => {
    const { tracker, getBoard, advance } = createTracker();

    await tracker.noticeFor('b1');
    advance(4999);
    await tracker.noticeFor('b1');

    expect(getBoard).toHaveBeenCalledTimes(1);
  });

  it('fetches the board again once the cached copy is older than five seconds', async () => {
    const { tracker, getBoard, advance } = createTracker();

    await tracker.noticeFor('b1');
    advance(5000);
    await tracker.noticeFor('b1');

    expect(getBoard).toHaveBeenCalledTimes(2);
  });

  it('fetches the board again after it has been forgotten', async () => {
    const { tracker, getBoard } = createTracker();

    await tracker.noticeFor('b1');
    tracker.forget('b1');
    await tracker.noticeFor('b1');

    expect(getBoard).toHaveBeenCalledTimes(2);
  });

  it('uses a remembered board without fetching it', async () => {
    const { tracker, getBoard } = createTracker();

    tracker.remember(board);
    await tracker.noticeFor('b1');

    expect(getBoard).not.toHaveBeenCalled();
  });

  it('returns no notice when the board cannot be fetched', async () => {
    const getBoard = vi.fn().mockRejectedValue(new Error('boom'));
    const tracker = new HandedBackTracker({ getBoard } as unknown as StandupClient);

    expect(await tracker.noticeFor('b1')).toBeNull();
  });
});
