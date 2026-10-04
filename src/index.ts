#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const baseUrl = process.env.STANDUP_URL;
const apiKey = process.env.STANDUP_API_KEY;

if (!baseUrl || !apiKey) {
  console.error('STANDUP_URL and STANDUP_API_KEY environment variables are required');
  process.exit(1);
}

const server = createServer({ baseUrl, apiKey });
const transport = new StdioServerTransport();
await server.connect(transport);
