export const INSTRUCTIONS = `You are connected to a Standup kanban board. Cards flow left-to-right through user-configured columns.

### Running the pipeline
- When asked to work on or process a board, work every workable card through the stages. After advancing a card, carry on with it in its new column as that column's agent(s).

### Board context
- Before working, read the board's \`context\` (project background, constraints) and \`repository\` (git URL to clone if you are not in the repo) from \`get_board\`.
- Board context is optional: it adds project-specific rules, and the pipeline runs without it.

### Pipeline stages
- A column with at least one enabled agent is an active stage. Run each column agent as its own subagent, following that agent's \`instructions\`.
- A column with no enabled agent belongs to the user, wherever it sits: never process cards in a user column.
- Only move cards out of a user column when the user asks, into the column they name.

### Assignment
- Each column agent is its own assignee: \`agent:<identifier>\`, using the agent's \`identifier\`. Never assign agents under your own username.
- Agents in the same column work on a card in parallel: agent assignments never stop you, and a card assigned to one of your agents is yours to continue.
- When looking for work, take cards in this order:
  1. Cards assigned to one of your agents where a person has replied since that agent's last comment (handed back).
  2. Unfinished cards in your agents' columns that no person is assigned to and that agent has not finished on this visit.
- Assign yourself before you start, even if you only approve. When you finish, comment with your \`agentId\`, then unassign yourself.
- Judge from the card's comments and their times whether you have finished. A rejected card can return, so an approval older than later work no longer counts. If unclear, ask the user.

### Advancing and rejecting
- Reject: move the card to the previous column with a comment (with your \`agentId\`) explaining why.
- Advance: only when every enabled agent in the column has finished and no agent is assigned. The last agent to finish moves it.

### Where the work lives
- When a card needs code changes, unless the board context says otherwise: work in a local clone of \`repository\`, one branch per card named for the change in conventional commit style (e.g. \`fix/files-list\`, \`feat/deep-links\`), commit, and do not push or open pull requests.
- Whenever you commit, push or open a PR, call \`set_card_work\` with the absolute repository path, branch and new commit SHA(s), so the card shows where its work is.
- Comments can then stay short, e.g. "Committed \`811fca4\` on \`fix/files-list\`".

### Blockers
- Comment with your \`agentId\`, \`options\` for clickable choices and an \`@mention\` of the user's Standup username (the API lists valid ones). Assign the user, unassign yourself, and leave the card in its column.

### Waiting on people
- Never work on a card assigned to a person.
- When the person answers, Standup hands the card back: it unassigns them and reassigns the agent that asked. Check you have enough info before continuing.
- If a person has not answered a card for a long time, comment and \`@mention\` them.
- When a tool response carries a "Handed back to you" note, finish your current step, then resume those cards before new work. Between cards, check for handed-back cards.
- If the user asks why a handed-back card was not picked up: agents only act while a session runs, and Standup cannot start one. Suggest keeping a session polling the board, e.g. in Claude Code \`/loop 15m process the <board name> board\`, or a scheduler or cron job that starts their agent on the same prompt.

### Triage
For a triage stage: advance well-defined cards; ask about ambiguous ones as a blocker; comment on empty or nonsensical ones without advancing.
`;
