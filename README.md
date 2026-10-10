# Standup MCP Server

An [MCP](https://modelcontextprotocol.io/) server that connects AI coding agents (Claude Code, etc.) to [Standup](https://thestandup.app/) — a kanban board app. Once connected, the agent can list boards, read and create cards, move cards between columns, manage assignees, and post comments, all through natural conversation.

## Prerequisites

- A [Standup](https://thestandup.app/) account with a **Pro** or **Enterprise** membership (required for API keys)
- [Node.js](https://nodejs.org/) 18+
- An MCP-compatible client (e.g. [Claude Code](https://docs.anthropic.com/en/docs/claude-code))

## Setup

### 1. Create an API key in Standup

1. Go to [thestandup.app](https://thestandup.app/) and log in
2. Click the user menu (top-right) → **API Keys**
3. Give your key a name (e.g. "Claude Code") and click **Create**
4. Copy the key — it starts with `sk-` and is only shown once

### 2. Configure your MCP client

#### Claude Code

Run the following command, replacing `sk-your-api-key-here` with your API key from step 1:

```bash
claude mcp add standup \
  -e STANDUP_URL=https://www.thestandup.app \
  -e STANDUP_API_KEY=sk-your-api-key-here \
  -- npx -y thestandup-mcp
```

Then restart Claude Code for the server to connect.

#### Other MCP clients

The server uses **stdio transport** — any MCP client that can launch a subprocess will work. Set the `STANDUP_URL` and `STANDUP_API_KEY` environment variables and run:

```bash
npx -y thestandup-mcp
```

### 3. Verify the connection

Start a new Claude Code session and ask it to list your boards:

> "List my standup boards"

You should see your boards returned. If you get an authentication error, double-check your API key.

## Available tools

| Tool | Description |
|------|-------------|
| `list_boards` | List all boards with name and column summary |
| `get_board` | Get a full board with columns, cards, context, and agents |
| `create_card` | Create a new card in a column |
| `update_card` | Update card text |
| `delete_card` | Delete a card |
| `move_card` | Move a card to a different column |
| `assign_card` | Assign a user, or a column agent as `agent:<identifier>`, to a card |
| `unassign_card` | Remove a user or column agent from a card |
| `search_cards` | Search for cards across all boards by text content |
| `get_comments` | Get all comments on a card |
| `add_comment` | Post a comment on a card (supports markdown, @mentions, clickable option buttons, and attribution to a column agent via `agentId`) |
| `update_board_context` | Set a board's project context and/or repository URL |
| `update_column_agents` | Replace a column's agents (send the full list) |
| `set_card_work` | Record where a card's work lives (repo path, branch, commits, pushed, PR link); merges with what's already recorded |

## Example usage

Once connected, you can interact with your boards in natural language:

- "What's on my standup board?"
- "Create a card in the To Do column: Refactor the auth middleware"
- "Move the auth refactor card to In Progress"
- "Add a comment to that card: Started work, estimating 2 hours"
- "Assign me to the top card in In Progress"

## Workflow conventions

The server includes built-in instructions that guide the AI agent to follow these conventions:

- **Assignment**: each column agent assigns itself as `agent:<identifier>`; agents in the same column work in parallel
- **Priorities**: resume cards handed back after a person replied, then take unfinished cards nobody is assigned to
- **Progress updates**: add a comment (attributed with `agentId`) summarising what you did before unassigning, and record where code changes live with `set_card_work` (shown on the card)
- **Blockers**: post a comment with clickable options, @mention the user and assign the card to them in place. Standup hands it back to the agent when they answer
- **Handed-back note**: tool responses include a "Handed back to you" note while a card is waiting to be resumed
- **Pipeline flow**: advance cards left-to-right through columns; reject by moving back with a comment
- **Running the pipeline**: when asked to process a board, carry each card on through every agent column rather than stopping after one stage; board context is optional
- **Instruction length**: Claude Code truncates server instructions at 4,096 characters, so a test keeps them under that limit

## Keeping agents running

Agents only act while a session is running; Standup cannot start one. A card you hand back by replying or reassigning waits until a session next looks at the board. To have it picked up without asking, keep a session polling:

- **Claude Code**: `/loop 15m process the <board name> board`
- **Other agents**: a scheduler or cron job that starts the agent with the same prompt

## Development

```bash
npm install
npm run build       # compile TypeScript
npm test            # run tests
npm run test:watch  # run tests in watch mode
npm run all         # type-check + test
```

## License

MIT
