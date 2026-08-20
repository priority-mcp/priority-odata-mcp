import { checkEntityAPIAccess } from './utils.js';

export function registerEntityDeleteTool(registry, client) {
    registry.registerTool({
        name: 'entity_delete',
        description: 'Delete an entity. Supports deleting related entities (subforms). For composite keys, use comma-separated values. ' +
            'Args: { entity: string, key: string, parentEntity?: string, parentKey?: string, parentLookup?: object, subform?: string }. ' +
            'Returns empty (204 No Content) on success. 400 on delete = referential integrity block — check for child records. ' +
            'See KI-012 for EFORM delete workflow (clear FCLMN columns first).',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['entity', 'key'],
            properties: {
                entity: { 
                    type: 'string', 
                    description: 'Entity name (e.g. PART, ORDERITEMS_SUBFORM). If deleting a related entity, specify the subform name here.' 
                },
                key: { 
                    type: 'string', 
                    description: 'Key identifying the record. For composite keys, use comma-separated format (e.g., "IVNUM=\'T9696\',IVTYPE=\'A\',DEBIT=\'D\'" or just "1" for subform line number)' 
                },
                parentEntity: {
                    type: 'string',
                    description: 'Parent entity name when operating on a related entity (subform), e.g., "ORDERS" when deleting ORDERITEMS_SUBFORM'
                },
                parentKey: {
                    type: 'string',
                    description: 'Parent entity key as a raw string. Prefer parentLookup instead for auto-resolution. ' +
                        '(e.g., "SO18000002" or comma-separated for composite keys)'
                },
                parentLookup: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Lookup object to resolve parent entity key automatically (preferred over parentKey), ' +
                        'e.g., { "ORDNAME": "SO18000002" }'
                },
                subform: {
                    type: 'string',
                    description: 'Subform name when operating on a related entity, e.g., "ORDERITEMS_SUBFORM". ' +
                        'All three (parentEntity + parentLookup + subform) are required for subform operations.'
                }
            }
        }
    }, async (args) => {
        if (!args?.entity || !args?.key) {
            throw new Error('Args required: { entity, key }');
        }
        
        const entityName = String(args.entity);
        
        try {
            // If deleting a related entity (subform), use subformOperation
            if (args.parentEntity && (args.parentKey || args.parentLookup) && args.subform) {
                let resolvedParentKey = args.parentKey;
                if (args.parentLookup) {
                    const resolved = await client.resolveEntityKey(String(args.parentEntity), args.parentLookup);
                    resolvedParentKey = resolved.formattedKey;
                }
                return await client.subformOperation(
                    String(args.parentEntity),
                    resolvedParentKey,
                    String(args.subform),
                    String(args.key),
                    'delete',
                    null
                );
            }
            
            // Auto-format plain string keys — composite (contains '=') and already-quoted
            // keys pass through unchanged; plain strings get wrapped in single quotes.
            const rawKey = String(args.key);
            const keyExpr = (rawKey.includes('=') || rawKey.startsWith("'") || /^[+-]?\d+(?:\.\d+)?$/.test(rawKey))
                ? rawKey
                : client.formatODataValue(rawKey);
            return await client.deleteEntity(entityName, keyExpr);
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

