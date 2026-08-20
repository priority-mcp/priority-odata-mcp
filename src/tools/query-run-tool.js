import { isFiniteNum, checkEntityAPIAccess, createAPIAccessSuggestion } from './utils.js';
import { resolveQueryArgs, attachQueryMetadata } from '../utils/resolve-query-args.js';

function formatODataValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(value)) {
        return String(value);
    }
    return `'${String(value).replace(/'/g, "''")}'`;
}

function buildLookupFilter(lookup) {
    if (!lookup || typeof lookup !== 'object' || Array.isArray(lookup)) {
        throw new Error('lookup must be an object with field names and values');
    }
    const entries = Object.entries(lookup).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (entries.length === 0) {
        throw new Error('lookup must contain at least one field');
    }
    return entries
        .map(([field, value]) => `${field} eq ${formatODataValue(value)}`)
        .join(' and ');
}

function formatExpandArg(expand) {
    if (!expand) return undefined;
    if (Array.isArray(expand)) return expand.map((s) => String(s)).join(',');
    return String(expand);
}

export function registerQueryRunTool(registry, client) {
    registry.registerTool({
        name: 'query_run',
        description: 'Run a query against a root entity or navigation path. For child forms/subforms, prefer parent entity + filter + expand, for example: { "entity": "SERG_COUNTRY", "filter": "COUNTRYCODE eq \'AFG\'", "expand": "SERG_CITY_SUBFORM", "top": 1 }. WebSDK subform screen names (e.g. SUPPART, ORDERITEMS) are auto-corrected to OData navigation properties (SUPPART_SUBFORM, ORDERITEMS_SUBFORM). Use lookup to build a filter automatically, e.g. { "entity": "SERG_COUNTRY", "lookup": { "COUNTRY": 12 } }. Direct navigation paths may not work reliably in this environment even when OData allows them; use expand as the primary child-form approach. Args: { entity | path, filter?, lookup?, select?, top?, skip?, orderby?, expand?, deltaToken?, count? }',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            oneOf: [
                { required: ['entity'] },
                { required: ['path'] }
            ],
            properties: {
                entity: { type: 'string', description: 'Entity name for root entities (e.g. USERS, CUSTOMERS)' },
                path: { type: 'string', description: 'Full OData resource path for navigation (e.g. "SERG_COUNTRY(\'1\')/SERG_CITY_SUBFORM")' },
                filter: { type: 'string', description: 'OData $filter expression' },
                lookup: { type: 'object', additionalProperties: true, description: 'Lookup values to convert to an OData filter, for example { "COUNTRY": 12 }' },
                select: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Fields to select'
                },
                top: { type: 'number', description: 'Maximum records to return', minimum: 0, maximum: 10000 },
                skip: { type: 'number', description: 'Records to skip', minimum: 0 },
                orderby: { type: 'string', description: 'OData $orderby clause' },
                expand: {
                    oneOf: [
                        { type: 'string' },
                        {
                            type: 'array',
                            items: { type: 'string' }
                        }
                    ],
                    description: 'Subform names to expand. WebSDK names (SUPPART) or OData names (SUPPART_SUBFORM) both accepted.'
                },
                deltaToken: { type: 'string', description: 'Delta token for retrieving only records with changes since the last query. Use the @odata.deltaLink from a previous query response.' },
                count: { type: 'boolean', description: 'If true, request $count=true so response may include @odata.count (server support varies)' }
            }
        }
    }, async (args) => {
        if (!args?.entity && !args?.path)
            throw new Error('Args required: either { entity } for root entities or { path } for navigation paths');

        const { args: queryArgs, warnings, corrections } = resolveQueryArgs(args);

        const resourcePath = queryArgs.path ? String(queryArgs.path) : String(queryArgs.entity);
        const lookupFilter = queryArgs.lookup ? buildLookupFilter(queryArgs.lookup) : undefined;
        const filter = queryArgs.filter && lookupFilter
            ? `(${String(queryArgs.filter)}) and (${lookupFilter})`
            : (queryArgs.filter ? String(queryArgs.filter) : lookupFilter);

        try {
            const result = await client.runQuery(resourcePath, {
                filter,
                select: Array.isArray(queryArgs.select) ? queryArgs.select.map((s) => String(s)) : undefined,
                top: isFiniteNum(queryArgs.top) ? Number(queryArgs.top) : undefined,
                skip: isFiniteNum(queryArgs.skip) ? Number(queryArgs.skip) : undefined,
                orderby: queryArgs.orderby ? String(queryArgs.orderby) : undefined,
                expand: formatExpandArg(queryArgs.expand),
                deltaToken: queryArgs.deltaToken ? String(queryArgs.deltaToken) : undefined,
                count: queryArgs.count === true
            });
            return attachQueryMetadata(result, warnings, corrections);
        } catch (error) {
            const statusCode = error?.response?.status;
            const isNavigationPath = typeof args.path === 'string' && (args.path.includes('/') || args.path.includes('('));
            if (statusCode === 404 && isNavigationPath) {
                return {
                    error: 'Navigation path not supported in this environment for child forms',
                    reason: 'Direct OData navigation paths returned HTTP 404 in this Priority REST environment',
                    suggestion: 'Use entity + filter + expand instead of path for child forms',
                    example: {
                        entity: 'SERG_COUNTRY',
                        filter: "COUNTRYCODE eq 'AFG'",
                        expand: 'SERG_CITY_SUBFORM',
                        top: 1
                    },
                    originalError: error.message
                };
            }

            if (statusCode === 404 || statusCode === 403) {
                const entityName = args.entity || args.path;
                if (entityName && !entityName.includes('/') && !entityName.includes('(')) {
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
            }
            throw error;
        }
    });
}
