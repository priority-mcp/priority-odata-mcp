import { checkEntityAPIAccess } from './utils.js';

/**
 * Register the query_sum tool for aggregating (SUM) a numeric field over an entity.
 * Fast path: $apply=aggregate(field with sum as Total).
 * Fallback: paging through results and summing client-side.
 * Never returns 0 on failure; throws SUM_FAILED with diagnostics.
 */
export function registerQuerySumTool(registry, client) {
    registry.registerTool({
        name: 'query_sum',
        description: 'Sum a numeric field over an entity. Use for total amount questions (e.g. "מה סכום הזמנות רכש?"). ' +
            '⚠️ $apply aggregate is NOT supported on this instance — always falls back to full table scan. ' +
            'For large entities (CUSTOMERS, PART, etc.), apply a filter to reduce rows scanned. ' +
            'Args: { entity, field?, filter? }',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['entity'],
            properties: {
                entity: { type: 'string', description: 'Entity name (e.g. PORDERS, ORDERS)' },
                field: { type: 'string', description: 'Numeric field to sum (default: TOTPRICE for orders/invoices)' },
                filter: { type: 'string', description: 'OData $filter expression' }
            }
        }
    }, async (args) => {
        if (!args?.entity) throw new Error('Args required: { entity }');
        const entityName = String(args.entity);
        try {
            const result = await client.runSum(entityName, {
                field: args.field ? String(args.field) : undefined,
                filter: args.filter ? String(args.filter) : undefined
            });
            if (result.method === 'paging_sum' && result.rows_scanned > 500) {
                result._warning = `Scanned ${result.rows_scanned} rows via paging fallback. Consider narrowing with a filter to reduce scan cost.`;
            }
            return result;
        } catch (error) {
            const statusCode = error?.response?.status;
            if (statusCode === 404 || statusCode === 403) {
                const accessCheck = await checkEntityAPIAccess(client, entityName);
                if (accessCheck.exists && !accessCheck.hasAccess) {
                    return {
                        error: `Entity "${entityName}" is not accessible via Priority REST API`,
                        reason: `RESTFLAG is "${accessCheck.currentRestFlag || 'null'}" in FORMLIMITED (needs to be "Y")`,
                        suggestion: `Enable API access for "${entityName}" using priority_config.restflag_update`
                    };
                }
            }
            throw error;
        }
    });
}
