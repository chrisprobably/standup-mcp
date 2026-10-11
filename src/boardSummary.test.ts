import { describe, it, expect } from 'vitest';
import { summarizeBoard } from './boardSummary.js';
import type { Board, Card } from './standupClient.js';

const editorJs = (...texts: string[]) =>
  JSON.stringify({ time: 1, blocks: texts.map((text) => ({ type: 'paragraph', data: { text } })) });

const boardWith = (cards: Card[], extra: Partial<Board> = {}): Board => ({
  identifier: 'b1',
  name: 'Board',
  columns: [{ identifier: 'c1', name: 'To Do', cards }],
  ...extra,
});

const onlyCard = (card: Card) => summarizeBoard(boardWith([card])).cards[0];

describe('summarizeBoard', () => {
  it('keeps the board name, identifier, context and repository', () => {
    const board = boardWith([], { context: 'Use TypeScript', repository: 'https://github.com/o/r' });

    const summary = summarizeBoard(board);

    expect(summary).toMatchObject({
      identifier: 'b1',
      name: 'Board',
      context: 'Use TypeScript',
      repository: 'https://github.com/o/r',
    });
  });

  it('keeps each column with its agents but without its cards', () => {
    const agents = [{ identifier: 'a1', name: 'Coder', instructions: 'Write code', enabled: true }];
    const board: Board = {
      identifier: 'b1',
      columns: [
        { identifier: 'c1', name: 'Inbox', cards: [{ identifier: 'x', text: 'X' }] },
        { identifier: 'c2', name: 'Doing', agents, cards: [] },
      ],
    };

    const summary = summarizeBoard(board);

    expect(summary.columns).toEqual([
      { identifier: 'c1', name: 'Inbox', agents: [] },
      { identifier: 'c2', name: 'Doing', agents },
    ]);
  });

  it('lists every card in every column with its column and position', () => {
    const board: Board = {
      identifier: 'b1',
      columns: [
        { identifier: 'c1', name: 'To Do', cards: [{ identifier: 'k1', text: 'A' }, { identifier: 'k2', text: 'B' }] },
        { identifier: 'c2', name: 'Done', cards: [{ identifier: 'k3', text: 'C' }] },
      ],
    };

    const summary = summarizeBoard(board);

    expect(summary.cards.map(({ identifier, columnId, position }) => ({ identifier, columnId, position }))).toEqual([
      { identifier: 'k1', columnId: 'c1', position: 0 },
      { identifier: 'k2', columnId: 'c1', position: 1 },
      { identifier: 'k3', columnId: 'c2', position: 0 },
    ]);
  });

  it('summarizes a card with no comments, work or stickers', () => {
    const card = onlyCard({ identifier: 'k1', text: 'Fix the login bug' });

    expect(card).toEqual({
      identifier: 'k1',
      columnId: 'c1',
      position: 0,
      firstLine: 'Fix the login bug',
      assignees: [],
      stickers: [],
      work: null,
      commentCount: 0,
      lastComment: null,
    });
  });

  it('keeps assignees and stickers', () => {
    const card = onlyCard({ identifier: 'k1', text: 'T', assignees: ['chris', 'agent:a1'], stickers: ['🚀'] });

    expect(card.assignees).toEqual(['chris', 'agent:a1']);
    expect(card.stickers).toEqual(['🚀']);
  });

  it('keeps the branch, commits, pushed flag and pull request link of the work', () => {
    const card = onlyCard({
      identifier: 'k1',
      text: 'T',
      work: {
        branch: 'feat/x',
        commits: ['abc'],
        pushed: true,
        repositoryPath: '/repo',
        pullRequestUrl: 'https://github.com/o/r/pull/1',
      },
    });

    expect(card.work).toEqual({
      branch: 'feat/x',
      commits: ['abc'],
      pushed: true,
      pullRequestUrl: 'https://github.com/o/r/pull/1',
    });
  });

  it('counts comments and describes the last one without its body', () => {
    const card = onlyCard({
      identifier: 'k1',
      text: 'T',
      comments: [
        { identifier: 'm1', author: 'chris', text: 'Please start', createdAt: '2026-10-11T08:00:00Z' },
        { identifier: 'm2', author: 'chris', text: 'Done it', agentId: 'a1', createdAt: '2026-10-11T09:00:00Z' },
      ],
    });

    expect(card.commentCount).toBe(2);
    expect(card.lastComment).toEqual({ author: 'chris', agentId: 'a1', createdAt: '2026-10-11T09:00:00Z' });
    expect(JSON.stringify(card)).not.toMatch(/Please start|Done it/);
  });

  it('marks a last comment written by a person with no agentId', () => {
    const card = onlyCard({
      identifier: 'k1',
      text: 'T',
      comments: [{ identifier: 'm1', author: 'chris', text: 'Rework please', createdAt: '2026-10-11T08:00:00Z' }],
    });

    expect(card.lastComment).toEqual({ author: 'chris', agentId: null, createdAt: '2026-10-11T08:00:00Z' });
  });

  it('takes the first line of a plain text card', () => {
    const card = onlyCard({ identifier: 'k1', text: '\nAdd dark mode\nUsers want it at night' });

    expect(card.firstLine).toBe('Add dark mode');
  });

  it('takes the first block of an Editor.js card and strips its HTML', () => {
    const card = onlyCard({ identifier: 'k1', text: editorJs('Add <b>dark</b> mode &amp; themes', 'Second block') });

    expect(card.firstLine).toBe('Add dark mode & themes');
  });

  it('stops an Editor.js card at a line break inside the first block', () => {
    const card = onlyCard({ identifier: 'k1', text: editorJs('', 'Title<br>More detail') });

    expect(card.firstLine).toBe('Title');
  });

  it('gives an empty first line for an empty card', () => {
    expect(onlyCard({ identifier: 'k1', text: '' }).firstLine).toBe('');
  });
});
