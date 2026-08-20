export function registerDataModificationPrompt(registry, client) {
    registry.registerPrompt({
        name: 'modify_priority_data',
        description: 'Guides users through creating, updating, or deleting Priority records with proper field handling and subform management',
        arguments: [
            {
                name: 'operation',
                description: 'The operation to perform: create, update, or delete',
                required: true
            },
            {
                name: 'entity_name',
                description: 'The Priority entity name (e.g., ORDERS, CUSTOMERS, PART)',
                required: true
            },
            {
                name: 'record_key',
                description: 'The record key (for update/delete operations). For create, this can be empty or the desired key',
                required: false
            },
            {
                name: 'field_list',
                description: 'Comma-separated list of fields to set (e.g., "CUSTNAME=Customer123,ORDDATE=2025-01-15")',
                required: false
            },
            {
                name: 'subform_list',
                description: 'Subforms to update (e.g., "ORDERITEMS_SUBFORM")',
                required: false
            }
        ]
    }, async (args) => {
        const {
            operation = '',
            entity_name = '',
            record_key = '',
            field_list = '',
            subform_list = ''
        } = args;

        if (!operation || !entity_name) {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: 'Please provide both operation (create/update/delete) and entity_name.'
                        }
                    }
                ]
            };
        }

        const op = operation.toLowerCase();
        if (!['create', 'update', 'delete'].includes(op)) {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Invalid operation: ${operation}. Must be one of: create, update, delete.`
                        }
                    }
                ]
            };
        }

        let guide = `# Data Modification Guide: ${op.toUpperCase()} ${entity_name}\n\n`;

        // Parse fields if provided
        const fields = {};
        if (field_list) {
            field_list.split(',').forEach(field => {
                const parts = field.trim().split('=');
                if (parts.length === 2) {
                    fields[parts[0].trim()] = parts[1].trim();
                }
            });
        }

        // Operation-specific guidance
        if (op === 'create') {
            guide += `## Creating a New ${entity_name} Record\n\n`;
            guide += `### Step 1: Get Entity Schema\n\n`;
            guide += `First, understand the required fields using the \`priority_entity_schema\` tool:\n\n`;
            guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "sample": true\n}\n\`\`\`\n\n`;

            guide += `### Step 2: Prepare Data\n\n`;
            if (Object.keys(fields).length > 0) {
                guide += `Fields to set:\n`;
                Object.entries(fields).forEach(([key, value]) => {
                    guide += `- **${key}**: ${value}\n`;
                });
                guide += `\n`;
            } else {
                guide += `**Note**: You'll need to provide all required fields. Check the entity schema for required fields.\n\n`;
            }

            guide += `### Step 3: Create Record\n\n`;
            guide += `Use the \`priority_entity_create\` tool:\n\n`;
            guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "data": {\n`;
            if (Object.keys(fields).length > 0) {
                Object.entries(fields).forEach(([key, value]) => {
                    guide += `    "${key}": "${value}",\n`;
                });
            } else {
                guide += `    // Add required fields here\n`;
            }
            guide += `  }\n}\n\`\`\`\n\n`;

            if (subform_list) {
                const subforms = subform_list.split(',').map(s => s.trim());
                guide += `### Step 4: Include Subforms (if needed)\n\n`;
                guide += `To create records with subforms, include them as arrays in the data:\n\n`;
                guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "data": {\n`;
                guide += `    // ... parent fields ...\n`;
                subforms.forEach(subform => {
                    guide += `    "${subform}": [\n`;
                    guide += `      {\n`;
                    guide += `        // Subform record fields\n`;
                    guide += `      }\n`;
                    guide += `    ],\n`;
                });
                guide += `  }\n}\n\`\`\`\n\n`;
                guide += `**Important**: Subforms are arrays. Each element represents one subform record.\n\n`;
            }

        } else if (op === 'update') {
            guide += `## Updating ${entity_name} Record\n\n`;
            
            if (!record_key) {
                guide += `**Warning**: No record key provided. You'll need the key to update a record.\n\n`;
            } else {
                guide += `### Record Key: ${record_key}\n\n`;
            }

            guide += `### Step 1: Get Current Record (Recommended)\n\n`;
            guide += `Before updating, fetch the current record to see existing values:\n\n`;
            guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "key": "${record_key || '<key>'}"\n}\n\`\`\`\n\n`;

            guide += `### Step 2: Prepare Update Data\n\n`;
            if (Object.keys(fields).length > 0) {
                guide += `Fields to update:\n`;
                Object.entries(fields).forEach(([key, value]) => {
                    guide += `- **${key}**: ${value}\n`;
                });
                guide += `\n`;
            } else {
                guide += `**Note**: Only include fields you want to change. Other fields will remain unchanged.\n\n`;
            }

            guide += `### Step 3: Update Record\n\n`;
            guide += `Use the \`priority_entity_update\` tool:\n\n`;
            guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "key": "${record_key || '<key>'}",\n  "data": {\n`;
            if (Object.keys(fields).length > 0) {
                Object.entries(fields).forEach(([key, value]) => {
                    guide += `    "${key}": "${value}",\n`;
                });
            } else {
                guide += `    // Add fields to update here\n`;
            }
            guide += `  }\n}\n\`\`\`\n\n`;

            if (subform_list) {
                const subforms = subform_list.split(',').map(s => s.trim());
                guide += `### Step 4: Update Subforms\n\n`;
                guide += `**Important**: When updating subforms, you must include ALL existing subform records plus new ones.\n\n`;
                guide += `1. First, get the current record with subforms expanded:\n\n`;
                guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "key": "${record_key}",\n  "expand": "${subforms.join(',')}"\n}\n\`\`\`\n\n`;
                guide += `2. Then update with the complete subform array:\n\n`;
                guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "key": "${record_key}",\n  "data": {\n`;
                guide += `    "${subforms[0]}": [\n`;
                guide += `      // ... existing subform records ...\n`;
                guide += `      // ... new subform records ...\n`;
                guide += `    ]\n`;
                guide += `  }\n}\n\`\`\`\n\n`;
                guide += `**Warning**: If you don't include existing subform records, they will be deleted!\n\n`;
            }

        } else if (op === 'delete') {
            guide += `## Deleting ${entity_name} Record\n\n`;
            
            if (!record_key) {
                guide += `**Error**: Record key is required for delete operations.\n\n`;
            } else {
                guide += `### Record Key: ${record_key}\n\n`;
                guide += `### Step 1: Verify Record Exists\n\n`;
                guide += `Before deleting, verify the record exists:\n\n`;
                guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "key": "${record_key}"\n}\n\`\`\`\n\n`;

                guide += `### Step 2: Delete Record\n\n`;
                guide += `Use the \`priority_entity_delete\` tool:\n\n`;
                guide += `\`\`\`json\n{\n  "entity": "${entity_name}",\n  "key": "${record_key}"\n}\n\`\`\`\n\n`;

                guide += `### ⚠️ Important Warnings\n\n`;
                guide += `- **This action cannot be undone**\n`;
                guide += `- Deleting a parent record may cascade to related records\n`;
                guide += `- Check entity relationships before deleting\n`;
                guide += `- Some entities may have restrictions on deletion\n\n`;
            }
        }

        guide += `## Common Patterns\n\n`;

        guide += `### Working with Dates\n`;
        guide += `- Use ISO 8601 format: \`'2025-01-15'\` or \`'2025-01-15T10:30:00'\`\n`;
        guide += `- Date fields in Priority are typically strings\n\n`;

        guide += `### Working with Keys\n`;
        guide += `- Simple keys: \`"SO15000005"\`\n`;
        guide += `- Composite keys: \`"IVNUM='T9696',IVTYPE='A',DEBIT='D'"\`\n`;
        guide += `- Use quotes for string keys\n\n`;

        guide += `### Working with Subforms\n`;
        guide += `- Subforms are arrays of objects\n`;
        guide += `- Always include existing subform records when updating\n`;
        guide += `- Subforms don't need RESTFLAG=Y (only parent entity needs it)\n`;
        guide += `- Use \`$expand\` to fetch subforms when reading\n\n`;

        guide += `## Error Handling\n\n`;
        guide += `Common errors and solutions:\n\n`;
        guide += `- **400 Bad Request**: Check field names and data types\n`;
        guide += `- **401 Unauthorized**: Verify authentication credentials\n`;
        guide += `- **404 Not Found**: Entity or record doesn't exist\n`;
        guide += `- **409 Conflict**: Record already exists or constraint violation\n`;
        guide += `- **Validation Error**: Required fields missing or invalid data\n\n`;

        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: guide
                    }
                }
            ]
        };
    });
}


