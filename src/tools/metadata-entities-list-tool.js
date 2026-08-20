import { checkEntityAPIAccess } from './utils.js';

/**
 * Unified tool for listing entities
 * Replaces both entities_list and api_entities_list
 */
export function registerMetadataEntitiesListTool(registry, client) {
    registry.registerTool({
        name: 'metadata_entities_list',
        description: 'List OData entity sets exposed by Priority service. Can return all entities or filter to API-accessible entities (RESTFLAG=Y in FORMLIMITED). Optionally include metadata from FORMLIMITED.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                apiOnly: {
                    type: 'boolean',
                    description: 'If true, return only entities available via API (RESTFLAG=Y in FORMLIMITED). If false, return all entities from service document. Default: false',
                    default: false
                },
                includeMetadata: {
                    type: 'boolean',
                    description: 'If true and apiOnly is true, include additional metadata from FORMLIMITED like TITLE, EXEC, UDATE. Default: false',
                    default: false
                }
            }
        }
    }, async (args) => {
        const apiOnly = args?.apiOnly || false;
        const includeMetadata = args?.includeMetadata || false;
        
        // If apiOnly is false, return all entities from service document
        if (!apiOnly) {
            const allEntities = await client.listEntities();
            return {
                total: Array.isArray(allEntities) ? allEntities.length : (allEntities?.entities?.length || 0),
                entities: allEntities,
                source: 'Service document (all entities)',
                note: 'To get only API-accessible entities, set apiOnly=true'
            };
        }
        
        // Get API-accessible entities from FORMLIMITED
        // NO MOCK DATA ALLOWED: Must fetch real data from Priority ERP or throw error
        const result = await client.runQuery('FORMLIMITED', {
            filter: "RESTFLAG eq 'Y'",
            orderby: 'ENAME asc'
        });

        // If API call succeeded but returned unexpected structure, throw error
        if (!result || !result.value) {
            throw new Error(
                'NO MOCK DATA ALLOWED: Failed to retrieve FORMLIMITED data from Priority ERP. ' +
                'Response structure is invalid. All data must come from Priority ERP system.'
            );
        }

        const entities = result.value.map(entity => {
            if (includeMetadata) {
                return {
                    name: entity.ENAME,
                    title: entity.TITLE,
                    exec: entity.EXEC,
                    type: entity.TYPE,
                    lastUpdated: entity.UDATE,
                    userLogin: entity.USERLOGIN,
                    restFlag: entity.RESTFLAG
                };
            }
            return {
                name: entity.ENAME,
                url: entity.ENAME
            };
        });

        return {
            total: entities.length,
            entities: entities,
            source: 'FORMLIMITED (RESTFLAG=Y)',
            note: 'These entities have RESTFLAG=Y in FORMLIMITED, indicating they are available via the Priority REST API'
        };
    });
}

