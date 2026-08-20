export function registerEntityRelationshipPrompt(registry, client) {
    registry.registerPrompt({
        name: 'explore_entity_relationships',
        description: 'Helps understand relationships between Priority entities, subforms, and entity hierarchies',
        arguments: [
            {
                name: 'entity',
                description: 'The Priority entity name to explore (e.g., ORDERS, CUSTOMERS, PART)',
                required: true
            }
        ]
    }, async (args) => {
        const { entity = '' } = args;

        if (!entity) {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: 'Please provide an entity name to explore relationships.'
                        }
                    }
                ]
            };
        }

        let explanation = `# Entity Relationship Explorer: ${entity}\n\n`;

        explanation += `## Getting Entity Schema\n\n`;
        explanation += `To understand the relationships for **${entity}**, use the \`priority_entity_schema\` tool:\n\n`;
        explanation += `\`\`\`json\n{\n  "entity": "${entity}",\n  "sample": true\n}\n\`\`\`\n\n`;

        explanation += `## Common Relationships\n\n`;

        // Provide common entity relationships based on known Priority structure
        const commonRelationships = {
            'ORDERS': {
                parent: 'CUSTOMERS (via CUSTNAME)',
                subforms: [
                    'ORDERITEMS_SUBFORM - Line items in the order',
                    'SHIPTO2_SUBFORM - Shipping address',
                    'ORDERSTEXT_SUBFORM - Order text/notes',
                    'ORDISTATUSLOG_SUBFORM - Status history (nested in ORDERITEMS_SUBFORM)'
                ],
                related: [
                    'CUSTOMERS - Customer information',
                    'PART - Products/parts in order items',
                    'DOCUMENTS_D - Shipping documents'
                ]
            },
            'CUSTOMERS': {
                parent: null,
                subforms: [
                    'SHIPTO2_SUBFORM - Shipping addresses',
                    'CUSTOMERSTEXT_SUBFORM - Customer notes'
                ],
                related: [
                    'ORDERS - Customer orders',
                    'INVOICES - Customer invoices',
                    'PART - Products purchased by customer'
                ]
            },
            'PART': {
                parent: null,
                subforms: [
                    'PARTARC_SUBFORM - Child products (מוצרי בן)',
                    'PARTTEXT_SUBFORM - Part description/notes'
                ],
                related: [
                    'ORDERS (via ORDERITEMS_SUBFORM) - Orders containing this part',
                    'WARHSBAL - Warehouse inventory',
                    'PART - Parent/child part relationships'
                ]
            },
            'INVOICES': {
                parent: 'CUSTOMERS (via CUSTNAME)',
                subforms: [
                    'INVOICEITEMS_SUBFORM - Invoice line items',
                    'INVOICESTEXT_SUBFORM - Invoice notes'
                ],
                related: [
                    'ORDERS - Related orders',
                    'CUSTOMERS - Customer information',
                    'PART - Products in invoice'
                ]
            }
        };

        const entityInfo = commonRelationships[entity.toUpperCase()];
        if (entityInfo) {
            if (entityInfo.parent) {
                explanation += `### Parent Entity\n${entityInfo.parent}\n\n`;
            }

            if (entityInfo.subforms && entityInfo.subforms.length > 0) {
                explanation += `### Subforms (Child Records)\n\n`;
                entityInfo.subforms.forEach(subform => {
                    explanation += `- **${subform.split(' - ')[0]}**: ${subform.split(' - ')[1] || 'Related data'}\n`;
                });
                explanation += `\n`;
            }

            if (entityInfo.related && entityInfo.related.length > 0) {
                explanation += `### Related Entities\n\n`;
                entityInfo.related.forEach(related => {
                    explanation += `- ${related}\n`;
                });
                explanation += `\n`;
            }
        } else {
            explanation += `### Discovering Relationships\n\n`;
            explanation += `To discover relationships for **${entity}**:\n\n`;
            explanation += `1. Get entity schema to see all fields\n`;
            explanation += `2. Look for fields ending in \`_SUBFORM\` - these are subforms\n`;
            explanation += `3. Look for fields that reference other entities (e.g., \`CUSTNAME\` references \`CUSTOMERS\`)\n`;
            explanation += `4. Check the entity metadata for relationship definitions\n\n`;
        }

        explanation += `## Querying with Relationships\n\n`;

        explanation += `### Get Entity with Subforms\n\n`;
        explanation += `Use \`$expand\` to include subform data:\n\n`;
        explanation += `\`\`\`json\n{\n`;
        explanation += `  "entity": "${entity}",\n`;
        if (entityInfo && entityInfo.subforms && entityInfo.subforms.length > 0) {
            explanation += `  "expand": "${entityInfo.subforms[0].split(' - ')[0]}"\n`;
        } else {
            explanation += `  "expand": "<SUBFORM_NAME>"\n`;
        }
        explanation += `}\n\`\`\`\n\n`;

        explanation += `### Multiple Subforms\n\n`;
        explanation += `To expand multiple subforms:\n\n`;
        explanation += `\`\`\`json\n{\n`;
        explanation += `  "entity": "${entity}",\n`;
        explanation += `  "expand": "SUBFORM1_SUBFORM,SUBFORM2_SUBFORM"\n`;
        explanation += `}\n\`\`\`\n\n`;

        explanation += `### Nested Subforms\n\n`;
        explanation += `For nested subforms (subform of a subform):\n\n`;
        explanation += `\`\`\`json\n{\n`;
        explanation += `  "entity": "${entity}",\n`;
        explanation += `  "expand": "ORDERITEMS_SUBFORM($expand=ORDISTATUSLOG_SUBFORM)"\n`;
        explanation += `}\n\`\`\`\n\n`;

        explanation += `## Important Notes\n\n`;
        explanation += `- **Subforms do NOT need RESTFLAG=Y** - only the parent entity needs it\n`;
        explanation += `- Subforms are accessed via the parent entity, not as standalone entities\n`;
        explanation += `- To add records to subforms, update the parent entity with the subform as an array\n`;
        explanation += `- Use the \`priority_entity_schema\` tool to see the exact structure\n`;

        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: explanation
                    }
                }
            ]
        };
    });
}


