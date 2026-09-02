# Tool prompts

This folder is the single source of truth for every agent-facing prompt used by the native WebMCP tools.

- [`webmcp-tools.ts`](webmcp-tools.ts) contains tool names, titles, structured descriptions, field guidance, tool-use policy, output contracts and conforming examples.
- `src/services/webmcp.ts` owns schemas and execution only; it imports the prompt catalog from this folder.

Every runtime description is compiled in this order:

1. `<role>`
2. `<task>`
3. `<input>`
4. `<tools>`
5. `<output>`
6. `<example_output>`

When a tool contract changes, update the prompt catalog, Zod input schema, handler and tests together.
