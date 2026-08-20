export function registerBatchOperationsTool(registry, client) {
    registry.registerTool({
        name: 'batch_operations',
        description: 'Perform batch operations. Allows executing multiple create/update/delete operations in a single request with dependencies. Useful for creating entities with related subforms and getting clear error messages. ' +
            'Returns { responses: Array<{ id, status, headers, body? }> }. ' +
            'IMPORTANT: NOT atomic — a failure does not abort other requests. URL encoding is manual (spaces -> %20 — no auto-encoding). ' +
            'See MCP_GUIDE.md §10. ' +
            'See https://prioritysoftware.github.io/restapi/modify/#Performing_Batch_Operations',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['requests'],
            properties: {
                requests: {
                    type: 'array',
                    description: 'Array of batch request objects',
                    items: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                description: 'Unique identifier for this request (e.g., "1", "2")'
                            },
                            method: {
                                type: 'string',
                                enum: ['POST', 'PATCH', 'DELETE'],
                                description: 'HTTP method'
                            },
                            url: {
                                type: 'string',
                                description: 'Relative URL (e.g., "ORDERS" or "$1/ORDERITEMS_SUBFORM" to reference previous request)'
                            },
                            headers: {
                                type: 'object',
                                description: 'Optional headers for this request'
                            },
                            body: {
                                type: 'object',
                                description: 'Request body (for POST/PATCH)'
                            },
                            dependsOn: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of request IDs this request depends on (e.g., ["1"])'
                            }
                        },
                        required: ['id', 'method', 'url']
                    }
                }
            }
        }
    }, async (args) => {
        if (!args?.requests || !Array.isArray(args.requests)) {
            throw new Error('Args required: { requests: array }');
        }
        
        // Build batch requests with proper format
        const batchRequests = args.requests.map(req => ({
            id: String(req.id),
            method: String(req.method).toUpperCase(),
            url: String(req.url),
            headers: req.headers || {
                'content-type': 'application/json; odata.metadata=minimal; odata.streaming=true',
                'odata-version': '4.0'
            },
            body: req.body || undefined,
            dependsOn: req.dependsOn || undefined
        }));
        
        return client.batchOperations(batchRequests);
    });
}

