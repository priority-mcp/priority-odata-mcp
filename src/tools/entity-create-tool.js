import { checkEntityAPIAccess } from './utils.js';

export function registerEntityCreateTool(registry, client) {
    registry.registerTool({
        name: 'entity_create',
        description: 'Create an entity record. Supports creating entities with related subforms (e.g., ORDER with ORDERITEMS_SUBFORM). For composite keys, use comma-separated values in the key. ' +
            'Args: { entity: string, data: object, parentEntity?: string, parentKey?: string, parentLookup?: object, subform?: string }. ' +
            'Returns created record (201) on success. Returns validation errors from Priority backend on 400/422.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['entity', 'data'],
            properties: {
                entity: { 
                    type: 'string', 
                    description: 'Entity name (e.g. PART, ORDERITEMS_SUBFORM). If creating a related entity, specify the subform name here.' 
                },
                data: { 
                    type: 'object', 
                    description: 'Record payload. Can include related subforms as arrays (e.g., ORDERITEMS_SUBFORM: [...]). See https://prioritysoftware.github.io/restapi/modify/' 
                },
                parentEntity: {
                    type: 'string',
                    description: 'Parent entity name when operating on a related entity (subform), e.g., "ORDERS" when creating ORDERITEMS_SUBFORM'
                },
                parentKey: {
                    type: 'string',
                    description: 'Parent entity key as a raw string. Prefer parentLookup instead for auto-resolution. ' +
                        '(e.g., "SO18000002" or comma-separated for composite keys like "IVNUM=\'T9696\',IVTYPE=\'A\',DEBIT=\'D\'")'
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
        if (!args?.entity || typeof args?.data !== 'object') {
            throw new Error('Args required: { entity, data }');
        }
        
        const entityName = String(args.entity);
        
        try {
            // If creating a related entity (subform), use subformOperation
            if (args.parentEntity || args.subform) {
                const missing = [];
                if (!args.parentEntity) missing.push('parentEntity');
                if (!args.parentKey && !args.parentLookup) missing.push('parentKey or parentLookup');
                if (!args.subform) missing.push('subform');
                if (missing.length > 0) {
                    throw new Error(`Subform create requires all of: parentEntity, parentKey/parentLookup, subform. Missing: ${missing.join(', ')}`);
                }
            }
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
                    null, // No subform key for create
                    'create',
                    args.data
                );
            }
            
            // Regular entity creation (supports subforms in data object like ORDERITEMS_SUBFORM: [...])
            return await client.createEntity(entityName, args.data);
        } catch (error) {
            // Check if this might be an API access issue
            const statusCode = error?.response?.status || error?.statusCode;
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
            
            // Handle detailed subform operation errors
            if (error?.details && (statusCode === 400 || statusCode === 422)) {
                const details = error.details;
                return {
                    error: `Subform creation failed with validation error`,
                    operation: details.operation,
                    parentEntity: details.parentEntity,
                    resolvedParentKey: details.parentKey,
                    subform: details.subform,
                    subformPath: details.subformPath,
                    httpStatus: details.httpStatus,
                    rawBackendResponse: details.rawResponse,
                    interfaceErrors: details.interfaceErrors,
                    validationErrors: details.validationErrors,
                    dataPayload: args.data,
                    suggestion: `Check the validation errors and ensure all required fields are provided with correct values`,
                    originalError: error.message
                };
            }
            
            throw error;
        }
    });
}

