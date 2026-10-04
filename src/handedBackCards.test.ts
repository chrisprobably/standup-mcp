import { describe, it, expect } from 'vitest';
import { findHandedBackCards, handedBackNotice } from './handedBackCards.js';

const agents = [{ identifier: 'triage-1', name: 'Triage Agent' }];

const boardWith = (card: object) => ({
  identifier: 'b1',
  columns: [{ identifier: 'c1', name: 'Triage', agents, cards: [card] }],
});

const question = { identifier: 'q1', author: 'user@email.com', text: 'Which?', agentId: 'triage-1' };
const reply = { identifier: 'r1', author: 'user@email.com', text: 'Minor' };

describe('findHandedBackCards', () => {
  it('finds a card assigned to an agent whose newest comment is from a person', () => {
    const board = boardWith({
      identifier: 'card1',
      text: 'Bump the version',
      assignees: ['agent:triage-1'],
      comments: [question, reply],
    });

    expect(findHandedBackCards(board)).toEqual([
      { cardId: 'card1', cardText: 'Bump the version', agentId: 'triage-1', agentName: 'Triage Agent' },
    ]);
  });

  it('ignores a card whose newest comment is from an agent', () => {
    const board = boardWith({
      identifier: 'card1',
      text: 'Bump the version',
      assignees: ['agent:triage-1'],
      comments: [reply, question],
    });

    expect(findHandedBackCards(board)).toEqual([]);
  });

  it('ignores a card that is still waiting on a person', () => {
    const board = boardWith({
      identifier: 'card1',
      text: 'Bump the version',
      assignees: ['user@email.com'],
      comments: [question, reply],
    });

    expect(findHandedBackCards(board)).toEqual([]);
  });

  it('ignores a card without comments', () => {
    const board = boardWith({ identifier: 'card1', text: 'x', assignees: ['agent:triage-1'] });

    expect(findHandedBackCards(board)).toEqual([]);
  });

  it('uses the plain text of editor.js card content', () => {
    const board = boardWith({
      identifier: 'card1',
      text: JSON.stringify({ blocks: [{ type: 'paragraph', data: { text: 'Bump <b>the</b> version' } }] }),
      assignees: ['agent:triage-1'],
      comments: [question, reply],
    });

    expect(findHandedBackCards(board)[0].cardText).toBe('Bump the version');
  });

  it('falls back to the agent identifier when the agent is no longer on the board', () => {
    const board = boardWith({
      identifier: 'card1',
      text: 'x',
      assignees: ['agent:removed-1'],
      comments: [reply],
    });

    expect(findHandedBackCards(board)[0].agentName).toBe('removed-1');
  });
});

describe('handedBackNotice', () => {
  it('returns null when nothing has been handed back', () => {
    expect(handedBackNotice([])).toBeNull();
  });

  it('tells the agent to resume each handed-back card first', () => {
    const notice = handedBackNotice([
      { cardId: 'card1', cardText: 'Bump the version', agentId: 'triage-1', agentName: 'Triage Agent' },
    ]);

    expect(notice).toMatch(/Handed back to you/);
    expect(notice).toMatch(/"Bump the version" \(card card1\) for Triage Agent/);
    expect(notice).toMatch(/resume/i);
  });
});
