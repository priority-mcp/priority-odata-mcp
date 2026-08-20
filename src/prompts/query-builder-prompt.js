export function registerQueryBuilderPrompt(registry, client) {
    registry.registerPrompt({
        name: 'query_priority_entity',
        description: 'Helps construct OData queries for Priority entities with proper syntax, filters, and subform expansions',
        arguments: [
            {
                name: 'entity',
                description: 'The Priority entity name to query (e.g., ORDERS, CUSTOMERS, PART)',
                required: true
            },
            {
                name: 'filter_description',
                description: 'Description of what to filter (e.g., "orders from last month", "customers in New York")',
                required: false
            },
            {
                name: 'field_list',
                description: 'Comma-separated list of fields to retrieve (e.g., "CUSTNAME,ORDNAME,ORDDATE")',
                required: false
            },
            {
                name: 'subforms',
                description: 'Subforms to include via $expand (e.g., "ORDERITEMS_SUBFORM,SHIPTO2_SUBFORM")',
                required: false
            },
            {
                name: 'sort_field',
                description: 'Field to sort by (e.g., "ORDDATE desc" or "CUSTNAME asc")',
                required: false
            },
            {
                name: 'top_count',
                description: 'Maximum number of records to return',
                required: false
            }
        ]
    }, async (args) => {
        const {
            entity = '',
            filter_description = '',
            field_list = '',
            subforms = '',
            sort_field = '',
            top_count = ''
        } = args;

        // Build the query explanation
        let explanation = `# OData Query Builder for ${entity || 'Priority Entity'}\n\n`;

        if (entity) {
            explanation += `## Entity: ${entity}\n\n`;
        }

        // Base URL construction
        const baseUrl = client.config?.baseUrl || 'https://<priority-host>/odata/Priority/tabula.ini/demo/';
        let queryUrl = `${baseUrl}${entity}`;
        const queryParams = [];

        // Build query parameters
        if (filter_description) {
            explanation += `### Filter Criteria\n${filter_description}\n\n`;
            explanation += `**Note**: You'll need to construct the proper OData $filter expression based on this description.\n\n`;
            explanation += `Common filter examples:\n`;
            explanation += `- Date range: \`ORDDATE ge '2025-01-01' and ORDDATE le '2025-12-31'\`\n`;
            explanation += `- Exact match: \`CUSTNAME eq 'CUSTOMER123'\`\n`;
            explanation += `- Contains: \`PARTDES contains 'widget'\`\n`;
            explanation += `- Comparison: \`PRICE gt 100\`\n\n`;
        }

        if (field_list) {
            const fields = field_list.split(',').map(f => f.trim()).filter(f => f);
            queryParams.push(`$select=${fields.join(',')}`);
            explanation += `### Selected Fields\n${fields.join(', ')}\n\n`;
        }

        if (subforms) {
            const subformList = subforms.split(',').map(s => s.trim()).filter(s => s);
            queryParams.push(`$expand=${subformList.join(',')}`);
            explanation += `### Subforms to Expand\n${subformList.join(', ')}\n\n`;
            explanation += `**Important**: Subforms are accessed via the parent entity. Only the parent entity needs RESTFLAG=Y in FORMLIMITED.\n\n`;
        }

        if (sort_field) {
            queryParams.push(`$orderby=${sort_field}`);
            explanation += `### Sorting\nOrder by: ${sort_field}\n\n`;
        }

        if (top_count) {
            queryParams.push(`$top=${top_count}`);
            explanation += `### Result Limit\nMaximum records: ${top_count}\n\n`;
        }

        // Construct final URL
        if (queryParams.length > 0) {
            queryUrl += '?' + queryParams.join('&');
        }

        explanation += `## Complete Query URL\n\`\`\`\n${queryUrl}\n\`\`\`\n\n`;

        explanation += `## Using the MCP Tool\n\n`;
        explanation += `You can execute this query using the \`priority_query_run\` tool:\n\n`;
        explanation += `\`\`\`json\n{\n`;
        explanation += `  "entity": "${entity}"`;
        if (filter_description) {
            explanation += `,\n  "filter": "<construct OData filter based on: ${filter_description}>"`;
        }
        if (field_list) {
            explanation += `,\n  "select": [${field_list.split(',').map(f => `"${f.trim()}"`).join(', ')}]`;
        }
        if (subforms) {
            explanation += `,\n  "expand": "${subforms}"`;
        }
        if (sort_field) {
            explanation += `,\n  "orderby": "${sort_field}"`;
        }
        if (top_count) {
            explanation += `,\n  "top": ${top_count}`;
        }
        explanation += `\n}\n\`\`\`\n\n`;

        explanation += `## 📅 Critical Date Handling Rules\n\n`;
        explanation += `### Primary Date Field\n`;
        explanation += `- **For 99% of Priority entities, including ORDERS: Use CURDATE**\n`;
        explanation += `- Use ORDDATE only if explicitly documented in entity schema\n`;
        explanation += `- Always verify the correct date field via Entity Schema resource before querying\n\n`;
        explanation += `### Year-Based Queries (MANDATORY Translation)\n`;
        explanation += `Year-based queries MUST be translated to a full-day time range:\n\n`;
        explanation += `**Example: year = 2025**\n`;
        explanation += `\`\`\`\n`;
        explanation += `(CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)\n`;
        explanation += `\`\`\`\n\n`;
        explanation += `**Pattern:**\n`;
        explanation += `- Start: YYYY-01-01T00:00:01+TZ\n`;
        explanation += `- End: YYYY+1-01-01T00:00:00+TZ\n\n`;
        explanation += `### ⚠️ Forbidden Date Formats\n`;
        explanation += `**DO NOT use:**\n`;
        explanation += `- ❌ \`cast(...)\` - Not supported\n`;
        explanation += `- ❌ \`'datetime'...\` - Invalid format\n`;
        explanation += `- ❌ Date-only strings (e.g., \`'2025-01-01'\`) - Missing timezone\n`;
        explanation += `- ❌ String comparisons against Edm.DateTimeOffset\n\n`;
        explanation += `### ✅ Required Format\n`;
        explanation += `- Always use offset-aware datetimes: \`2025-01-01T00:00:01+02:00\`\n`;
        explanation += `- Normalize all comparisons to the same timezone\n`;
        explanation += `- Never compare offset-aware with offset-naive datetimes\n\n`;
        explanation += `## Tips\n\n`;
        explanation += `- String comparisons are case-sensitive\n`;
        explanation += `- Use \`and\`, \`or\`, \`not\` for logical operations\n`;
        explanation += `- For nested subforms, use: \`$expand=ORDERITEMS_SUBFORM($expand=ORDISTATUSLOG_SUBFORM)\`\n`;
        explanation += `- Combine multiple query options with \`&\`\n`;
        explanation += `- **Post-query validation**: Always validate that returned records fall within requested date range\n`;

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


