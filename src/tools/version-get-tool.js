export function registerVersionGetTool(registry, client) {
    registry.registerTool({
        name: 'version_get',
        description: 'Fetch Priority service version and relevant headers',
        inputSchema: {
            type: 'object',
            additionalProperties: false
        }
    }, async () => {
        return client.getVersionInfo();
    });
}

