import { PriorityMCPServer } from './server.js';

/**
 * Boots the Priority MCP HTTP server. MCP over HTTP uses the official
 * @modelcontextprotocol/sdk with stateless StreamableHTTPServerTransport on POST /mcp.
 * Optional SSE routes still use the JSON-RPC handler for compatibility.
 */
async function main() {
    const server = new PriorityMCPServer();
    server.listen();
}
// eslint-disable-next-line no-console
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

