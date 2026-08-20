export function registerEntitySchemaResource(registry, client) {
    registry.registerResource('priority://entity-schema/{entity}', {
        name: 'Entity Schema',
        description: 'Schema information for a specific Priority entity including fields, types, and relationships',
        mimeType: 'application/json',
        handler: async (args) => {
            const { entity } = args;
            
            if (!entity) {
                throw new Error('Entity name is required');
            }

            try {
                // Fetch a sample record to infer schema
                const sampleData = await client.runQuery(entity, {
                    top: 1,
                    select: [] // Get all fields
                });

                if (!sampleData || !sampleData.value || !Array.isArray(sampleData.value) || sampleData.value.length === 0) {
                    return {
                        contents: [
                            {
                                uri: `priority://entity-schema/${entity}`,
                                mimeType: 'application/json',
                                text: JSON.stringify({
                                    entity: entity,
                                    note: 'No sample records found. Entity may be empty or require specific filters.',
                                    fields: [],
                                    subforms: [],
                                    relationships: []
                                }, null, 2)
                            }
                        ]
                    };
                }

                const sample = sampleData.value[0];
                const fields = {};
                const subforms = [];
                const relationships = [];

                // Infer schema from sample
                Object.keys(sample).forEach(fieldName => {
                    const value = sample[fieldName];
                    let type = 'unknown';
                    if (value === null || value === undefined) {
                        type = 'null';
                    } else if (typeof value === 'string') {
                        if (/^\d{4}-\d{2}-\d{2}/.test(value) || (value.includes('T') && value.includes('Z'))) {
                            type = 'datetime';
                        } else {
                            type = 'string';
                        }
                    } else if (typeof value === 'number') {
                        type = Number.isInteger(value) ? 'integer' : 'number';
                    } else if (typeof value === 'boolean') {
                        type = 'boolean';
                    } else if (Array.isArray(value)) {
                        type = 'array';
                    } else if (typeof value === 'object') {
                        type = 'object';
                    }

                    fields[fieldName] = {
                        type: type,
                        example: value
                    };

                    // Identify subforms
                    if (fieldName.endsWith('_SUBFORM')) {
                        subforms.push({
                            name: fieldName,
                            type: type,
                            structure: Array.isArray(value) ? 'array' : 'object'
                        });
                    }
                });

                // Identify relationships (common patterns)
                const relationshipPatterns = {
                    'CUSTNAME': 'CUSTOMERS',
                    'ORDNAME': 'ORDERS',
                    'PARTNAME': 'PART',
                    'INVNAME': 'INVOICES',
                    'DOCNO': 'DOCUMENTS_D'
                };

                Object.keys(fields).forEach(fieldName => {
                    const upperField = fieldName.toUpperCase();
                    if (relationshipPatterns[upperField]) {
                        relationships.push({
                            field: fieldName,
                            relatedEntity: relationshipPatterns[upperField],
                            type: 'reference'
                        });
                    }
                });

                const schemaInfo = {
                    entity: entity,
                    fields: fields,
                    subforms: subforms,
                    relationships: relationships,
                    sampleRecord: sample,
                    totalFields: Object.keys(fields).length
                };

                return {
                    contents: [
                        {
                            uri: `priority://entity-schema/${entity}`,
                            mimeType: 'application/json',
                            text: JSON.stringify(schemaInfo, null, 2)
                        }
                    ]
                };
            } catch (error) {
                throw new Error(`Failed to fetch entity schema for ${entity}: ${error.message}`);
            }
        }
    });
}

