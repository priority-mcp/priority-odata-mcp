/**
 * Builds an @modelcontextprotocol/sdk McpServer wired to existing Tool/Prompt/Resource registries.
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { jsonSchemaObjectToZod } from './json-schema-to-zod.js';
import { runToolCallForMcp } from './tool-call-runner.js';

/**
 * @param {import('./registry.js').ToolRegistry} tools
 * @param {import('./prompt-registry.js').PromptRegistry | null} prompts
 * @param {import('./resource-registry.js').ResourceRegistry | null} resources
 * @param {{ strictDataIntegrity?: boolean }} options
 */
export function createPriorityMcpServer(tools, prompts, resources, options = {}) {
  const strictDataIntegrity = options.strictDataIntegrity !== false;
  const capabilities = { tools: {} };
  if (prompts) {
    capabilities.prompts = {};
  }
  if (resources) {
    capabilities.resources = {};
  }

  const server = new McpServer(
    { name: 'Priority MCP Server', version: '0.1.0' },
    { capabilities }
  );

  const looseSchema = z.object({}).catchall(z.unknown());

  for (const { desc } of tools.listToolEntries()) {
    let inputSchema = looseSchema;
    if (desc.inputSchema) {
      try {
        inputSchema = jsonSchemaObjectToZod(desc.inputSchema);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[priority-mcp] Tool "${desc.name}": JSON Schema → Zod failed (${err?.message || err}); using loose schema`
        );
      }
    }
    const toolName = desc.name;
    server.registerTool(
      toolName,
      { description: desc.description || '', inputSchema },
      async (args) => runToolCallForMcp(tools, toolName, args ?? {}, strictDataIntegrity)
    );
  }

  if (prompts) {
    for (const { desc, handler } of prompts.listPromptEntries()) {
      /** @type {Record<string, import('zod/v4').ZodTypeAny>} */
      const argsSchema = {};
      for (const arg of desc.arguments || []) {
        let field = z.string();
        if (arg.description) {
          field = field.describe(arg.description);
        }
        argsSchema[arg.name] = arg.required ? field : field.optional();
      }
      server.registerPrompt(
        desc.name,
        { description: desc.description || '', argsSchema },
        async (args) => handler(args)
      );
    }
  }

  if (resources) {
    for (const entry of resources.listResourceEntries()) {
      const meta = {
        title: entry.name,
        description: entry.description,
        mimeType: entry.mimeType
      };
      const logicalName = resourceLogicalName(entry.uri);
      const isTemplate = entry.uri.includes('{') && entry.uri.includes('}');
      if (isTemplate) {
        server.registerResource(
          logicalName,
          new ResourceTemplate(entry.uri, {}),
          meta,
          async (_uri, variables) => entry.handler(variables || {})
        );
      } else {
        server.registerResource(logicalName, entry.uri, meta, async () => entry.handler());
      }
    }
  }

  return server;
}

/**
 * Stable logical name for McpServer.registerResource (must be unique).
 * @param {string} uri
 */
function resourceLogicalName(uri) {
  const key = uri
    .replace(/^priority:\/\//, '')
    .replace(/\{([^}]+)\}/g, 'by_$1')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || 'resource';
}
