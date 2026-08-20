import { checkEntityAPIAccess } from './utils.js';

function inferLookupField(entityName) {
    const parts = String(entityName).split(/_+/).filter(Boolean);
    return parts.length > 1 ? parts.slice(1).join('_') : entityName;
}

function parseNumericKey(keyValue) {
    const raw = String(keyValue).trim();
    const numericMatch = raw.match(/^'?(?<num>[+-]?\d+)'?$/);
    return numericMatch ? Number(numericMatch.groups.num) : null;
}

export function registerEntityGetTool(registry, client) {
    registry.registerTool({
        name: 'entity_get',
        description: 'Fetch a single entity by key or lookup. Supports expanding subforms. Use lookup for numeric key resolution, for example: { "entity": "SERG_COUNTRY", "lookup": { "COUNTRY": 12 } }',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            oneOf: [
                { required: ['entity', 'key'] },
                { required: ['entity', 'lookup'] }
            ],
            properties: {
                entity: { type: 'string', description: 'Entity name (e.g. USERS, ORDERS)' },
                key: { type: 'string', description: 'Entity key value' },
                lookup: { type: 'object', additionalProperties: true, description: 'Lookup object to resolve the real entity key, e.g. { "COUNTRY": 12 }' },
                select: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Fields to select'
                },
                expand: {
                    type: 'string',
                    description: 'OData $expand expression for subforms (e.g., ORDERITEMS_SUBFORM, SHIPTO2_SUBFORM, or multiple: ORDERITEMS_SUBFORM,SHIPTO2_SUBFORM)'
                }
            }
        }
    }, async (args) => {
        if (!args?.entity || (!args?.key && !args?.lookup)) {
            throw new Error('Args required: { entity, key } or { entity, lookup }');
        }
        
        const entityName = String(args.entity);
        const select = Array.isArray(args.select) ? args.select : undefined;
        const expand = args.expand ? String(args.expand) : undefined;

        // If key is provided and entity has a cached keyField, use it directly
        if (args.key && !args.lookup && client.keyFieldCache.has(entityName)) {
            const cachedKeyField = client.keyFieldCache.get(entityName);
            const keyValue = String(args.key).replace(/^'|'$/g, '');
            
            try {
                const keyExpr = client.formatODataValue(keyValue);
                if (typeof client.log === 'function') {
                    client.log(`[entity_get] Using cached keyField: ${cachedKeyField} for ${entityName}`);
                }
                const result = await client.getEntityByKey(entityName, keyExpr, select, expand);
                
                if (result && typeof result === 'object') {
                    result._mcp_metadata = result._mcp_metadata || {};
                    result._mcp_metadata.resolvedKeyField = cachedKeyField;
                    result._mcp_metadata.keyUsedDirectly = true;
                    result._mcp_metadata.keyValue = keyValue;
                }
                return result;
            } catch (error) {
                const statusCode = error?.response?.status || error?.statusCode;
                if (statusCode === 404 || statusCode === 400) {
                    // Check if this might be an API access issue (like the other tools do)
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
                    return {
                        error: `Entity direct key access failed for ${entityName}`,
                        reason: `Direct key access using cached field ${cachedKeyField} failed. The key value may be incorrect or the record doesn't exist.`,
                        suggestion: `Try using the lookup method with the actual filter values instead, or verify the key value is correct.`,
                        cachedKeyField,
                        keyValue: keyValue,
                        originalError: error.message
                    };
                }
                throw error;
            }
        }

        // Always use KeyResolver - convert key to lookup if needed
        let lookup = args.lookup;
        if (!lookup && args.key) {
            // For numeric keys, try to infer a lookup field
            const numericKey = parseNumericKey(args.key);
            if (numericKey !== null) {
                const inferredField = inferLookupField(entityName);
                lookup = { [inferredField]: numericKey };
            } else {
                // For string keys, treat as identifying value directly, don't try lookup inference
                const keyValue = String(args.key).replace(/^'|'$/g, '');
                try {
                    const keyExpr = client.formatODataValue(keyValue);
                    if (typeof client.log === 'function') {
                        client.log(`[entity_get] Using string key directly for ${entityName}: ${keyExpr}`);
                    }
                    const result = await client.getEntityByKey(entityName, keyExpr, select, expand);
                    
                    if (result && typeof result === 'object') {
                        result._mcp_metadata = result._mcp_metadata || {};
                        result._mcp_metadata.directKeyUsed = true;
                        result._mcp_metadata.keyValue = keyValue;
                    }
                    return result;
                } catch (error) {
                    const statusCode = error?.response?.status || error?.statusCode;
                    if (statusCode === 404 || statusCode === 400) {
                        // Check if this might be an API access issue (like the other tools do)
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
                        return {
                            error: `Entity direct key access failed for ${entityName}`,
                            reason: `String key value "${keyValue}" did not match any record. The value may be incorrect or the record doesn't exist.`,
                            suggestion: `Verify the key value is correct, or use lookup method with actual filter values.`,
                            keyValue: keyValue,
                            originalError: error.message
                        };
                    }
                    throw error;
                }
            }
        }

        try {
            return await client.getEntityByLookup(entityName, lookup, select, expand);
        } catch (error) {
            // If KeyResolver fails, provide helpful guidance
            const statusCode = error?.response?.status || error?.statusCode;
            if (statusCode === 404 || statusCode === 400) {
                // Check if this might be an API access issue (like the other tools do)
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
                return {
                    error: `Entity lookup failed for ${entityName}`,
                    reason: `Key resolution via filter query failed. This may indicate the lookup field is incorrect or the record doesn't exist.`,
                    suggestion: `Try using query_run with filter to find the correct identifying field, or verify the lookup values.`,
                    example: {
                        tool: 'query_run',
                        args: {
                            entity: entityName,
                            top: 1
                        },
                        description: 'Run a query to see available fields and identify the correct key field'
                    },
                    originalError: error.message
                };
            }
            throw error;
        }
    });
}

