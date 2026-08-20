/**
 * Date Handling Prompt for Priority ERP Queries
 * Provides critical guidance for date filtering in OData queries
 */

export function registerDateHandlingPrompt(registry, client) {
    registry.registerPrompt({
        name: 'date_handling_guide',
        description: 'Critical date handling rules and patterns for Priority ERP OData queries. Use this before constructing any date-based filters.',
        arguments: [
            {
                name: 'entity',
                description: 'The Priority entity name (e.g., ORDERS, DOCUMENTS_D)',
                required: false
            },
            {
                name: 'date_field',
                description: 'Specific date field to query (e.g., CURDATE, ORDDATE, SHIPDATE). If not provided, will use primary date field for entity.',
                required: false
            },
            {
                name: 'year',
                description: 'Year for year-based queries (e.g., 2025). Will be translated to proper date range.',
                required: false
            },
            {
                name: 'date_range_start',
                description: 'Start date for date range queries (ISO 8601 format)',
                required: false
            },
            {
                name: 'date_range_end',
                description: 'End date for date range queries (ISO 8601 format)',
                required: false
            }
        ]
    }, async (args) => {
        const {
            entity = '',
            date_field = '',
            year = '',
            date_range_start = '',
            date_range_end = ''
        } = args;

        let guide = `# 📅 Date Handling Guide for Priority ERP Queries\n\n`;
        
        guide += `## 🔍 Mandatory Discovery Step\n\n`;
        guide += `**BEFORE constructing any date query, you MUST:**\n\n`;
        guide += `1. Call \`prompts/list\` and \`resources/list\` to review existing guidance\n`;
        guide += `2. Identify existing date-handling guidance\n`;
        guide += `3. Check entity-specific date fields via Entity Schema resource\n`;
        guide += `4. Review known OData limitations (casts, types, formats)\n\n`;
        guide += `**Only after this step may you construct a query.**\n\n`;

        guide += `## 📋 Primary Date Field Rules\n\n`;
        guide += `### For 99% of Priority Entities (Including ORDERS)\n\n`;
        guide += `- **Primary date field: CURDATE**\n`;
        guide += `- Use ORDDATE only if:\n`;
        guide += `  - Explicitly documented in entity schema\n`;
        guide += `  - Or validated via Entity Schema resource\n\n`;

        if (entity) {
            guide += `### For Entity: ${entity}\n\n`;
            if (date_field) {
                guide += `**Specified date field: ${date_field}**\n\n`;
                if (date_field === 'ORDDATE' && entity === 'ORDERS') {
                    guide += `⚠️ **WARNING**: ORDDATE is specified for ORDERS, but CURDATE is the primary date field.\n`;
                    guide += `Verify via Entity Schema resource that ORDDATE is correct for this use case.\n\n`;
                }
            } else {
                guide += `**Using primary date field: CURDATE** (default for most entities)\n\n`;
            }
        }

        guide += `## 📅 Year-Based Queries (CRITICAL)\n\n`;
        guide += `Year-based queries MUST be translated to a full-day time range:\n\n`;
        guide += `### Pattern:\n`;
        guide += `- **Start**: YYYY-01-01T00:00:01+TZ\n`;
        guide += `- **End**: YYYY+1-01-01T00:00:00+TZ\n\n`;

        if (year) {
            const yearNum = parseInt(year, 10);
            const startYear = yearNum;
            const endYear = yearNum + 1;
            const dateField = date_field || 'CURDATE';
            
            guide += `### Example for Year ${year}:\n\n`;
            guide += `\`\`\`\n`;
            guide += `(${dateField} ge ${startYear}-01-01T00:00:01+00:00) and (${dateField} lt ${endYear}-01-01T00:00:00+00:00)\n`;
            guide += `\`\`\`\n\n`;
            
            guide += `**Tool Call:**\n`;
            guide += `\`\`\`json\n`;
            guide += `{\n`;
            guide += `  "entity": "${entity || 'ORDERS'}",\n`;
            guide += `  "filter": "(${dateField} ge ${startYear}-01-01T00:00:01+00:00) and (${dateField} lt ${endYear}-01-01T00:00:00+00:00)"\n`;
            guide += `}\n`;
            guide += `\`\`\`\n\n`;
        } else {
            guide += `### Example for Year 2025:\n\n`;
            guide += `\`\`\`\n`;
            guide += `(CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)\n`;
            guide += `\`\`\`\n\n`;
        }

        if (date_range_start || date_range_end) {
            guide += `## 📆 Date Range Queries\n\n`;
            if (date_range_start && date_range_end) {
                const dateField = date_field || 'CURDATE';
                guide += `### Date Range: ${date_range_start} to ${date_range_end}\n\n`;
                guide += `**Filter Expression:**\n`;
                guide += `\`\`\`\n`;
                guide += `(${dateField} ge ${date_range_start}) and (${dateField} le ${date_range_end})\n`;
                guide += `\`\`\`\n\n`;
                guide += `**Important:** Ensure both dates include timezone offset (e.g., +00:00 or +02:00)\n\n`;
            }
        }

        guide += `## ⚠️ Forbidden Date Formats (DO NOT USE)\n\n`;
        guide += `- ❌ \`cast(...)\` - Not supported in Priority OData\n`;
        guide += `- ❌ \`'datetime'...\` - Invalid format\n`;
        guide += `- ❌ Date-only strings (e.g., \`'2025-01-01'\`) - Missing timezone\n`;
        guide += `- ❌ String comparisons against Edm.DateTimeOffset\n\n`;

        guide += `## ✅ Required Format\n\n`;
        guide += `- **Always use offset-aware datetimes**: \`2025-01-01T00:00:01+02:00\`\n`;
        guide += `- **Normalize all comparisons** to the same timezone\n`;
        guide += `- **Never compare** offset-aware with offset-naive datetimes\n\n`;

        guide += `## 🕒 Timezone Discipline\n\n`;
        guide += `- Always produce offset-aware datetimes\n`;
        guide += `- Normalize all internal comparisons to the same timezone\n`;
        guide += `- Common timezones: \`+00:00\` (UTC), \`+02:00\` (Israel Standard Time)\n\n`;

        guide += `## 🧪 Post-Query Validation (MANDATORY)\n\n`;
        guide += `After receiving results, you MUST validate:\n\n`;
        guide += `1. All records fall within requested date range\n`;
        guide += `2. No record violates year constraint\n\n`;
        guide += `**If mismatch detected:**\n`;
        guide += `- Report via planner_metadata\n`;
        guide += `- Do NOT silently trim results\n`;
        guide += `- Raise FilterNotAppliedError if filter was not applied server-side\n\n`;

        guide += `## 🧠 Fallback Policy\n\n`;
        guide += `If OData rejects the filter:\n\n`;
        guide += `1. Retry only with documented formats\n`;
        guide += `2. If still rejected, return a clear MCP error\n`;
        guide += `3. Do NOT fallback to unfiltered $top queries unless explicitly allowed\n\n`;

        guide += `## 📝 Logging & Transparency\n\n`;
        guide += `Always include in logs/metadata:\n\n`;
        guide += `- Chosen date field\n`;
        guide += `- Final $filter string\n`;
        guide += `- Timezone used\n`;
        guide += `- Validation summary\n\n`;

        guide += `## 🔗 Related Resources\n\n`;
        guide += `- Entity Schema: \`priority://entity-schema/${entity || '{entity}'}\`\n`;
        guide += `- Common Queries: \`priority://queries/common\`\n`;
        guide += `- Query Builder Prompt: \`query_priority_entity\`\n\n`;

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

