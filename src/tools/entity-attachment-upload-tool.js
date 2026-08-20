import { checkEntityAPIAccess } from './utils.js';

export function registerEntityAttachmentUploadTool(registry, client) {
    registry.registerTool({
        name: 'entity_attachments_upload',
        description: 'Upload an attachment to an entity. Attaches a file to an entity record. Args: { entity: string, key: string, fileData: string, fileName: string, contentType?: string }',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['entity', 'key', 'fileData', 'fileName'],
            properties: {
                entity: { type: 'string', description: 'Entity name (e.g. ORDERS, PART)' },
                key: { type: 'string', description: 'Entity key value' },
                fileData: { 
                    type: 'string', 
                    description: 'File data as base64-encoded string' 
                },
                fileName: { 
                    type: 'string', 
                    description: 'File name (e.g., "document.pdf", "image.jpg")' 
                },
                contentType: { 
                    type: 'string', 
                    description: 'Content type (e.g., "application/pdf", "image/jpeg"). Defaults to "application/octet-stream"' 
                }
            }
        }
    }, async (args) => {
        if (!args?.entity || !args?.key || !args?.fileData || !args?.fileName) {
            throw new Error('Args required: { entity, key, fileData, fileName }');
        }
        
        const entityName = String(args.entity);
        
        try {
            return await client.uploadEntityAttachment(
                entityName, 
                String(args.key),
                String(args.fileData), // base64 string
                String(args.fileName),
                args.contentType ? String(args.contentType) : undefined
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

