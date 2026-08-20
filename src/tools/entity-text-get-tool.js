import { checkEntityAPIAccess } from './utils.js';

export function registerEntityTextGetTool(registry, client) {
    registry.registerTool({
        name: 'entity_text_get',
        description: 'Get text for an entity. Retrieves text content associated with an entity record. Args: { entity: string, key: string }',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['entity', 'key'],
            properties: {
                entity: { type: 'string', description: 'Entity name (e.g. ORDERS, PART)' },
                key: { type: 'string', description: 'Entity key value' }
            }
        }
    }, async (args) => {
        if (!args?.entity || !args?.key) {
            throw new Error('Args required: { entity, key }');
        }
        
        const entityName = String(args.entity);
        
        try {
            return await client.getEntityText(
                entityName, 
                String(args.key)
            );
        } catch (error) {
            // Check if this might be an API access issue
            const statusCode = error?.response?.status;
            if (statusCode === 404 || statusCode === 403) {
                const accessCheck = await checkEntityAPIAccess(client, entityName);
                if (accessCheck.exists && !accessCheck.hasAccess) {
                    return {
                        error: `Entity "${entityName}" is not accessible via Priority REST API`,
                        reason: `RESTFLAG is "${accessCheck.currentRestFlag || 'null'}" in FORMLIMITED (needs to be "Y")`,
                        suggestion: `Enable API access for "${entityName}" using priority_config.restflag_update`,
                        solution: {
                            tool: 'priority_config.restflag_update',
                            args: {
                                formName: entityName,
                                restFlag: 'Y',
                                formType: accessCheck.formType || 'F'
                            },
                            description: `Use this tool to enable API access for "${entityName}"`
                        },
                        originalError: error.message
                    };
                }
            }
            throw error;
        }
    });
}

