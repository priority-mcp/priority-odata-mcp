export function registerMetadataRefreshTool(registry, client) {
    registry.registerTool({
        name: 'metadata_refresh',
        description: 'Clear and refresh metadata for an entity (or all entities). Use this when private customizations add fields to a form - new fields will not appear in REST API until metadata is refreshed. See https://prioritysoftware.github.io/restapi/modify/#Refreshing_Metadata',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                entity: {
                    type: 'string',
                    description: 'Entity name to refresh metadata for. ⚠️ On this instance, entity-level refresh returns HTTP 400. Always call without params for full cache flush. (KI-007)'
                }
            }
        }
    }, async (args) => {
        const entityName = args?.entity ? String(args.entity) : undefined;
        if (entityName) {
            return {
                _warning: 'Entity-level metadata refresh is NOT supported on this instance — returns HTTP 400 (KI-007). ' +
                    'Calling full cache flush (no entity) instead.',
                result: await client.clearEntityMetadata(undefined)
            };
        }
        return client.clearEntityMetadata(entityName);
    });
}

