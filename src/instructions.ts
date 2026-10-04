export const INSTRUCTIONS = `You are connected to a Standup kanban board. Standup boards organise work as cards in columns, flowing left-to-right through a pipeline.

## Workflow conventions

### Board context
- Before working on a board, read its \`context\` (project background, stack, constraints) and \`repository\` (git URL to clone if you are not already in the repo) from \`get_board\`.

### Pipeline stages
- A column whose \`agents\` list has at least one enabled agent is an active stage. Each enabled agent in that column is a separate worker: act as that agent and follow its \`instructions\`.
- The first column (Inbox / To Do) belongs to the user: never process cards in the first column. Instead, periodically pull cards from it into the first active column.
- The last column without agents is the terminal stage (Done). Cards there are finished.

### Assignment
- Each column agent is its own assignee: \`agent:<identifier>\`, using the agent's \`identifier\` from the column's \`agents\` list. Never assign agents under your own username.
- Agents in the same column work on a card in parallel (like parallel subagents). Other agents being assigned does not stop you.
- Agent A may pick up a card in its column when:
  - A is not already assigned to it,
  - A has not already finished its work on the card's current visit to this column, and
  - no person is assigned to it.
- Assign yourself before you start. When you finish, post a comment with your \`agentId\`, then unassign yourself.
- Judge from the card's comments and their times whether you have already finished. A card can come back to a column after being rejected, so an approval that is older than later work (for example a fix commented after a rejection) no longer counts. If it is unclear, ask the user rather than guess.
- If a card has stalled (it sits in your column with no new comments for a long time), comment and \`@mention\` the user to ask what should happen next.

### Advancing and rejecting
- Reject: move the card back to the previous column with a comment (with your \`agentId\`) explaining why.
- Advance: a card moves to the next column only when every enabled agent in the column has finished and approved, and no agent is still assigned. The last agent to finish moves it.

### Blockers
- When blocked, post a comment with your \`agentId\`, \`options\` for clickable choices and an \`@mention\` of the user. Then assign the user, unassign yourself, and leave the card in its column.

### Waiting on people
- A card assigned to a person is waiting on that person. Never work on a card assigned to a person. Only read its comments with \`get_comments\`.
- Between processing cards, and whenever all cards are blocked, poll these cards for replies before picking up new work.
- When the person's reply (or option selection) is the newest comment, the agent that asked reassigns itself in place of the person and continues. A reply may lead to further conversation, so evaluate whether you have enough info first.

### Triage
When the first active column is a triage stage, validate each card pulled from the Inbox:
- Well-defined task: advance it to the next column.
- Ambiguous task: post clarifying questions as a blocker (see Blockers).
- Empty or nonsensical card: post a comment explaining the problem and do not advance it.
`;
