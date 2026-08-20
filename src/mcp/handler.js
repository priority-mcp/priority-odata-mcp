import { formatToolCallFailureMessage, runToolCallForMcp } from './tool-call-runner.js';

export class MCPProtocolHandler {
    tools;
    prompts;
    resources;
    strictDataIntegrity;
    constructor(tools, options = {}) {
        this.tools = tools;
        this.prompts = options.prompts || null;
        this.resources = options.resources || null;
        this.strictDataIntegrity = options.strictDataIntegrity !== false; // Default to true
    }
    async handle(req) {
        const id = req.id ?? null;
        try {
            if (req.jsonrpc !== '2.0') {
                return this.error(id, -32600, 'Invalid Request: jsonrpc must be "2.0"');
            }
            switch (req.method) {
                case 'initialize': {
                    const capabilities = {
                        tools: {
                            listChanged: true
                        }
                    };
                    if (this.prompts) {
                        capabilities.prompts = {};
                    }
                    if (this.resources) {
                        capabilities.resources = {};
                    }
                    return this.ok(id, {
                        protocolVersion: '2024-11-05',
                        capabilities,
                        serverInfo: {
                            name: 'Priority MCP Server',
                            version: '0.1.0'
                        }
                    });
                }
                case 'tools/list': {
                    const tools = this.tools.listTools();
                    return this.ok(id, { tools });
                }
                case 'tools/call': {
                    const { name, arguments: args = {} } = req.params || {};
                    if (!name || typeof name !== 'string') {
                        return this.error(id, -32602, 'Invalid params: missing tool name');
                    }
                    try {
                        const result = await runToolCallForMcp(this.tools, name, args, this.strictDataIntegrity);
                        return this.ok(id, result);
                    } catch (error) {
                        const errorMessage = formatToolCallFailureMessage(error, name);
                        return this.error(id, -32603, errorMessage, {
                            tool: name,
                            stack: error?.stack,
                            policy: 'NO_MOCK_DATA_ALLOWED'
                        });
                    }
                }
                case 'prompts/list': {
                    if (!this.prompts) {
                        return this.error(id, -32601, 'Prompts not supported');
                    }
                    const prompts = this.prompts.listPrompts();
                    return this.ok(id, { prompts });
                }
                case 'prompts/get': {
                    if (!this.prompts) {
                        return this.error(id, -32601, 'Prompts not supported');
                    }
                    const { name, arguments: args = {} } = req.params || {};
                    if (!name || typeof name !== 'string') {
                        return this.error(id, -32602, 'Invalid params: missing prompt name');
                    }
                    try {
                        const prompt = await this.prompts.getPrompt(name, args);
                        return this.ok(id, prompt);
                    } catch (error) {
                        return this.error(id, -32603, error?.message || 'Failed to get prompt', {
                            prompt: name,
                            stack: error?.stack
                        });
                    }
                }
                case 'resources/list': {
                    if (!this.resources) {
                        return this.error(id, -32601, 'Resources not supported');
                    }
                    const resources = this.resources.listResources();
                    return this.ok(id, { resources });
                }
                case 'resources/read': {
                    if (!this.resources) {
                        return this.error(id, -32601, 'Resources not supported');
                    }
                    const { uri } = req.params || {};
                    if (!uri || typeof uri !== 'string') {
                        return this.error(id, -32602, 'Invalid params: missing resource URI');
                    }
                    try {
                        const resource = await this.resources.readResource(uri);
                        return this.ok(id, resource);
                    } catch (error) {
                        return this.error(id, -32603, error?.message || 'Failed to read resource', {
                            uri,
                            stack: error?.stack
                        });
                    }
                }
                default:
                    return this.error(id, -32601, `Method not found: ${req.method}`);
            }
        }
        catch (err) {
            return this.error(id, -32000, err?.message || 'Internal error', { stack: err?.stack });
        }
    }
    ok(id, result) {
        return { jsonrpc: '2.0', id, result };
    }
    error(id, code, message, data) {
        return { jsonrpc: '2.0', id, error: { code, message, data } };
    }
}

