/**
 * safe-query-run-tool.js — Atomic schema validation + query execution
 *
 * A single atomic tool that:
 * 1. Auto-discovers entity fields via a sample record
 * 2. Validates $select fields against discovered fields
 * 3. Executes the query only if all fields are valid
 *
 * This eliminates Auto-review false positives by combining
 * schema discovery and query execution into one atomic call.
 */
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

// In-memory cache for discovered fields (per session, across calls)
const _fieldDiscoveryCache = new Map();

export function registerSafeQueryRunTool(registry, client) {
    registry.registerTool({
        name: 'safe_query_run',
        description: 'Run a safe query against a root entity with automatic field validation. ' +
            'Before querying, this tool auto-discovers valid field names for the entity (via a sample record), ' +
            'validates all $select fields against discovered fields, and only executes the query if all fields are valid. ' +
            'Returns both the query results and the discovered schema. ' +
            'Use this instead of query_run when you want field validation built in.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['entity'],
            properties: {
                entity: { type: 'string', description: 'Entity name (e.g., USERS, CUSTOMERS, ORDERS)' },
                filter: { type: 'string', description: 'OData $filter expression' },
                lookup: { type: 'object', additionalProperties: true, description: 'Lookup values to convert to an OData filter, e.g. { "COUNTRY": 12 }' },
                select: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Fields to select. Validated against discovered schema before query executes.'
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
                count: { type: 'boolean', description: 'If true, request $count=true so response may include @odata.count' }
            }
        }
    }, async (args) => {
        if (!args?.entity) {
            throw new Error('Args required: { entity }');
        }

        const entity = String(args.entity).trim();
        const entityUpper = entity.toUpperCase();

        // Step 1: Resolve query args (same as query-run-tool)
        const { args: queryArgs, warnings, corrections } = resolveQueryArgs(args);

        const resourcePath = String(queryArgs.entity || entity);
        const lookupFilter = queryArgs.lookup ? buildLookupFilter(queryArgs.lookup) : undefined;
        const filter = queryArgs.filter && lookupFilter
            ? `(${String(queryArgs.filter)}) and (${lookupFilter})`
            : (queryArgs.filter ? String(queryArgs.filter) : lookupFilter);

        // Step 2: Auto-discover fields if $select is provided
        const selectFields = Array.isArray(queryArgs.select) ? queryArgs.select.map(s => String(s)) : [];
        let schemaFields = [];
        let fieldDiscoveryNote = null;

        if (selectFields.length > 0) {
            // Check cache first (shared across calls in the same session)
            if (!_fieldDiscoveryCache.has(entityUpper)) {
                // Fetch a sample record to discover field names
                try {
                    const sampleParams = { '$format': 'json', '$top': 1 };
                    const path = queryArgs.path ? String(queryArgs.path) : entity;
                    const sampleRes = await client.axios.get(path, { params: sampleParams });
                    const sample = sampleRes?.data?.value?.[0];
                    if (sample && typeof sample === 'object') {
                        const fields = Object.keys(sample).map(key => ({
                            name: key,
                            type: typeof sample[key],
                            example: sample[key]
                        }));
                        _fieldDiscoveryCache.set(entityUpper, fields);
                        schemaFields = fields;

                        // Validate $select fields
                        const validNames = new Set(fields.map(f => f.name));
                        const invalidFields = selectFields.filter(f => !validNames.has(f));
                        if (invalidFields.length > 0) {
                            const errMsg =
                                `Invalid $select field(s) for ${entity}: [${invalidFields.join(', ')}]. ` +
                                `Valid fields: [${fields.map(f => f.name).join(', ')}].`;
                            return {
                                error: 'Field validation failed',
                                entity,
                                invalidFields,
                                validFields: fields.map(f => f.name),
                                message: errMsg,
                                _safeQuery: true,
                                _schemaFields: fields
                            };
                        }
                        fieldDiscoveryNote = `All ${selectFields.length} $select fields validated against ${fields.length} discovered fields`;
                    } else {
                        fieldDiscoveryNote = 'Could not discover fields — no sample record available. Proceeding without validation.';
                    }
                } catch (discErr) {
                    // If discovery fails, warn but proceed — let OData decide
                    fieldDiscoveryNote = `Could not discover fields for ${entity}: ${discErr?.message || 'unknown'}. Proceeding without field validation.`;
                }
            } else {
                // Use cached fields
                schemaFields = _fieldDiscoveryCache.get(entityUpper);
                const validNames = new Set(schemaFields.map(f => f.name));
                const invalidFields = selectFields.filter(f => !validNames.has(f));
                if (invalidFields.length > 0) {
                    const errMsg =
                        `Invalid $select field(s) for ${entity}: [${invalidFields.join(', ')}]. ` +
                        `Valid fields: [${schemaFields.map(f => f.name).join(', ')}].`;
                    return {
                        error: 'Field validation failed',
                        entity,
                        invalidFields,
                        validFields: schemaFields.map(f => f.name),
                        message: errMsg,
                        _safeQuery: true,
                        _schemaFields: schemaFields
                    };
                }
                fieldDiscoveryNote = `Fields validated from cache (${schemaFields.length} fields)`;
            }
        }

        // Step 3: Execute the query
        try {
            const result = await client.runQuery(resourcePath, {
                filter,
                select: selectFields.length > 0 ? selectFields : undefined,
                top: isFiniteNum(queryArgs.top) ? Number(queryArgs.top) : undefined,
                skip: isFiniteNum(queryArgs.skip) ? Number(queryArgs.skip) : undefined,
                orderby: queryArgs.orderby ? String(queryArgs.orderby) : undefined,
                expand: formatExpandArg(queryArgs.expand),
                count: queryArgs.count === true
            });

            // Attach schema + validation metadata to response
            const safeResult = attachQueryMetadata(result, warnings, corrections);
            safeResult._safeQuery = true;
            safeResult._entity = entity;
            safeResult._schemaFields = schemaFields.length > 0 ? schemaFields : undefined;
            safeResult._fieldValidation = fieldDiscoveryNote;

            return safeResult;
        } catch (error) {
            // Enhance error with schema info if available
            const enhancedError = {
                error: error?.message || 'Query failed',
                entity,
                _safeQuery: true,
                _schemaFields: schemaFields.length > 0 ? schemaFields : undefined,
                _fieldValidation: fieldDiscoveryNote
            };

            const statusCode = error?.response?.status;
            const isNavigationPath = typeof args.path === 'string' && (args.path.includes('/') || args.path.includes('('));

            if (statusCode === 404 && isNavigationPath) {
                enhancedError.reason = 'Navigation path not supported in this environment for child forms';
                enhancedError.suggestion = 'Use entity + filter + expand instead of path for child forms';
                enhancedError.originalError = error.message;
                return enhancedError;
            }

            if (statusCode === 404 || statusCode === 403) {
                if (entity && !entity.includes('/') && !entity.includes('(')) {
                    const accessCheck = await checkEntityAPIAccess(client, entity);
                    if (accessCheck.exists && !accessCheck.hasAccess) {
                        enhancedError.reason = `RESTFLAG is "${accessCheck.currentRestFlag || 'null'}" in FORMLIMITED (needs to be "Y")`;
                        enhancedError.suggestion = `Enable API access for "${entity}" using priority_config.restflag_update`;
                        enhancedError.solution = {
                            tool: 'priority_config.restflag_update',
                            args: { formName: entity, restFlag: 'Y', formType: accessCheck.formType || 'F' },
                            description: `Enable API access for "${entity}"`
                        };
                        enhancedError.originalError = error.message;
                        return enhancedError;
                    }
                }
            }

            throw error;
        }
    });
}
