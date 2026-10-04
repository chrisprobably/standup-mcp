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
| `assign_card` | Assign a user to a card |
| `unassign_card` | Remove a user from a card |
| `get_comments` | Get all comments on a card |
| `add_comment` | Post a comment on a card (supports markdown, @mentions, and clickable option buttons) |

## Example usage

Once connected, you can interact with your boards in natural language:

- "What's on my standup board?"
- "Create a card in the To Do column: Refactor the auth middleware"
- "Move the auth refactor card to In Progress"
- "Add a comment to that card: Started work, estimating 2 hours"
- "Assign me to the top card in In Progress"

## Workflow conventions

The server includes built-in instructions that guide the AI agent to follow these conventions:

- **Assignment** — assign yourself to a card when you start, unassign when done
- **Progress updates** — add a comment summarising what you did before unassigning
- **Blockers** — post a comment with clickable options, @mention the user, and move the card to an Awaiting Input column
- **Pipeline flow** — advance cards left-to-right through columns; reject by moving back with a comment

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
