export function registerEntitiesListResource(registry, client) {
    registry.registerResource('priority://entities/list', {
        name: 'Available Entities List',
        description: 'Complete list of all Priority entities with RESTFLAG=Y that are accessible via the API',
        mimeType: 'application/json',
        handler: async () => {
            try {
                // Get entities with RESTFLAG=Y from FORMLIMITED
                const result = await client.runQuery('FORMLIMITED', {
                    filter: "RESTFLAG eq 'Y'",
                    orderby: 'ENAME asc'
                });

                if (!result || !result.value) {
                    throw new Error('Failed to fetch entities list from FORMLIMITED');
                }

                const entities = result.value.map(entity => ({
                    name: entity.ENAME,
                    title: entity.TITLE || entity.ENAME,
                    description: entity.TITLE || '',
                    restFlag: entity.RESTFLAG || 'Y',
                    type: entity.TYPE || 'F',
                    accessible: true
                }));

                return {
                    contents: [
                        {
                            uri: 'priority://entities/list',
                            mimeType: 'application/json',
                            text: JSON.stringify({
                                total: entities.length,
                                entities: entities,
                                lastUpdated: new Date().toISOString(),
                                note: 'These entities have RESTFLAG=Y in FORMLIMITED and are accessible via the Priority REST API'
                            }, null, 2)
                        }
                    ]
                };
            } catch (error) {
                throw new Error(`Failed to fetch entities list: ${error.message}`);
            }
        }
    });
}

