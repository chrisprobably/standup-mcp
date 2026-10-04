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
- Each time you look for work, take cards in this order:
  1. Cards assigned to one of your agents where a person has replied since that agent's last comment (a handed-back card). Resume these first.
  2. Unfinished cards in your agents' columns that no person is assigned to and that agent has not already finished on this visit to the column. Other agents being assigned does not stop you.
- A card assigned to one of your agents means it is yours to continue, not that someone else is busy with it.
- A card assigned to a person is never yours to work on (see Waiting on people).
- Assign yourself before you start, even if you only approve. When you finish, post a comment with your \`agentId\`, then unassign yourself.
- Judge from the card's comments and their times whether you have already finished. A card can come back to a column after being rejected, so an approval that is older than later work (for example a fix commented after a rejection) no longer counts. If it is unclear, ask the user rather than guess.
- If a card has stalled (it sits in your column with no new comments for a long time), comment and \`@mention\` the user to ask what should happen next.

### Advancing and rejecting
- Reject: move the card back to the previous column with a comment (with your \`agentId\`) explaining why.
- Advance: a card moves to the next column only when every enabled agent in the column has finished and approved, and no agent is still assigned. The last agent to finish moves it.

### Where the work lives
- Unless the board context says otherwise: work in a local clone of \`repository\`, on one branch per card (e.g. \`standup/<short-card-name>\`), commit your changes, and do not push or open pull requests.
- Whenever you commit, call \`set_card_work\` with the absolute repository path, branch and new commit SHA(s), and again if you push or open a pull request. Standup shows this on the card, so someone looking at a card in Done can find the work without reading comments.
- Your comment can then keep the location short, e.g. "Committed \`811fca4\` on \`standup/fix-files-list\`".

### Blockers
- When blocked, post a comment with your \`agentId\`, \`options\` for clickable choices and an \`@mention\` of the user's Standup username (not their git username; the API lists valid usernames if you get one wrong). Then assign the user, unassign yourself, and leave the card in its column.

### Waiting on people
- A card assigned to a person is waiting on that person. Never work on a card assigned to a person. Only read its comments with \`get_comments\`.
- When the person answers (picks an option or replies), Standup hands the card back automatically: it unassigns them and reassigns the agent that asked. A reply may lead to further conversation, so evaluate whether you have enough info before continuing.
- Tool responses include a "Handed back to you" note whenever a card is waiting for you to resume it. When you see that note, finish your current step, then resume those cards before starting anything new.
- Between processing cards, and whenever all cards are blocked, check the board again for handed-back cards before picking up new work.

### Triage
When the first active column is a triage stage, validate each card pulled from the Inbox:
- Well-defined task: advance it to the next column.
- Ambiguous task: post clarifying questions as a blocker (see Blockers).
- Empty or nonsensical card: post a comment explaining the problem and do not advance it.
`;
