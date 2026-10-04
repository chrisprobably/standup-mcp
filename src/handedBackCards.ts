import type { Board, Card } from './standupClient.js';

const AGENT_ASSIGNEE_PREFIX = 'agent:';

export interface HandedBackCard {
  cardId: string;
  cardText: string;
  agentId: string;
  agentName: string;
}

function plainCardText(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.blocks) {
      return parsed.blocks
        .map((block: { data?: { text?: string } }) => block.data?.text ?? '')
        .join(' ')
        .replace(/<[^>]+>/g, '');
    }
  } catch {
    // plain text or markdown card
  }
  return text;
}

function handedBackAgentId(card: Card): string | null {
  const assignees = card.assignees ?? [];
  const agentIds = assignees
    .filter((a) => a.startsWith(AGENT_ASSIGNEE_PREFIX))
    .map((a) => a.slice(AGENT_ASSIGNEE_PREFIX.length));
  const isWaitingOnPerson = agentIds.length < assignees.length;
  const newestComment = card.comments?.at(-1);

  if (agentIds.length === 0 || isWaitingOnPerson || !newestComment || newestComment.agentId) {
    return null;
  }
  return agentIds[0];
}

export function findHandedBackCards(board: Board): HandedBackCard[] {
  const agentNames = new Map(
    board.columns.flatMap((column) => column.agents ?? []).map((agent) => [agent.identifier, agent.name]),
  );

  return board.columns
    .flatMap((column) => column.cards ?? [])
    .flatMap((card) => {
      const agentId = handedBackAgentId(card);
      if (!agentId) return [];
      return [{
        cardId: card.identifier,
        cardText: plainCardText(card.text),
        agentId,
        agentName: agentNames.get(agentId) ?? agentId,
      }];
    });
}

export function handedBackNotice(cards: HandedBackCard[]): string | null {
  if (cards.length === 0) return null;
  const lines = cards.map((card) => `- "${card.cardText}" (card ${card.cardId}) for ${card.agentName}`);
  return [
    'Handed back to you: a person has replied on these cards, which are assigned to your agents again.',
    ...lines,
    'Read the reply with get_comments and resume these cards before picking up other work.',
  ].join('\n');
}
