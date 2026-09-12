export function registerPaginationGuidePrompt(registry) {
    registry.registerPrompt({
        name: 'pagination_guide',
        description: 'Guide to pagination in Priority OData API. Provides best practices for $top/$skip, count queries, and handling large result sets.',
        arguments: [],
    }, async () => {
            return {
                description: 'Priority OData Pagination Guide',
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `# Priority OData Pagination Guide

## Pagination Parameters

The OData REST API supports standard \`$top\` and \`$skip\` parameters for pagination:

| Parameter | Purpose | Example |
|-----------|---------|---------|
| \`top\` | Max records to return | \`top: 100\` (first 100) |
| \`skip\` | Records to skip | \`skip: 100\` (skip first 100) |

## Example Queries

**Get first 50 records:**
\`\`\`json
{ "entity": "ORDERS", "top": 50, "skip": 0 }
\`\`\`

**Get next page (records 51-100):**
\`\`\`json
{ "entity": "ORDERS", "top": 50, "skip": 50 }
\`\`\`

**Count-only query** (avoids broken /$count endpoint):
\`\`\`json
{ "entity": "ORDERS", "top": 0, "count": true }
\`\`\`

## Known Limitations

- **Top max**: Tested up to 500. For larger queries, paginate.
- **$count endpoint**: The \`/$count\` standalone endpoint returns HTTP 500. Use \`top: 0, count: true\` instead.
- **OData $apply=aggregate**: Not supported on this instance. Use \`query_sum\` tool for summing numeric fields.

## Best Practices

1. Always paginate for entities with >500 records
2. Use \`top: 0, count: true\` for efficient count-only queries
3. For large exports, iterate with \`skip\` advancing by \`top\` each time
4. The \`@odata.count\` field in results shows total record count when \`count: true\`
5. Combine with \`$filter\` for targeted subsets`
                        }
                    }
                ]
            };
    });
}
