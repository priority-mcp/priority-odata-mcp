import { checkEntityAPIAccess } from './utils.js';

export function registerEntityTextCreateTool(registry, client) {
    registry.registerTool({
        name: 'entity_text_create',
        description: 'Add text to an entity. Creates new text content for an entity record. Args: { entity: string, key: string, textData: object }',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['entity', 'key', 'textData'],
            properties: {
                entity: { type: 'string', description: 'Entity name (e.g. ORDERS, PART)' },
                key: { type: 'string', description: 'Entity key value' },
                textData: { 
                    type: 'object', 
                    description: 'Text data to add. Typically contains fields like TEXT, TEXT2, etc. depending on the entity type.' 
                }
            }
        }
    }, async (args) => {
        if (!args?.entity || !args?.key || typeof args?.textData !== 'object') {
            throw new Error('Args required: { entity, key, textData }');
        }
        
        const entityName = String(args.entity);
        
        try {
            return await client.addEntityText(
                entityName, 
                String(args.key),
                args.textData
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

