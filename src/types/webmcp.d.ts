interface WebMcpContentBlock {
  type: 'text'
  text: string
}

interface WebMcpToolResult {
  content: WebMcpContentBlock[]
}

interface WebMcpToolAnnotations {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
}

interface WebMcpExecuteOptions {
  signal: AbortSignal
}

interface WebMcpTool {
  name: string
  title?: string
  description: string
  inputSchema?: Record<string, unknown>
  annotations?: WebMcpToolAnnotations
  execute: (input: unknown, options?: WebMcpExecuteOptions) => WebMcpToolResult | Promise<WebMcpToolResult>
}

interface ModelContext {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal; exposedTo?: string[] }) => Promise<void>
  getTools?: (options?: { fromOrigins?: string[] }) => Promise<Array<{ name: string; title?: string; description: string; inputSchema?: Record<string, unknown> }>>
}

interface Document {
  modelContext?: ModelContext
}
