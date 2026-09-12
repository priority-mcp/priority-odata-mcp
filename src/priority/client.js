import axios from 'axios';
import https from 'https';
import FormData from 'form-data';
import { createPriorityApiError, FilterNotAppliedError } from '../utils/errors.js';
import { logApiCall, ensureNoMockData, validateApiResponse } from '../utils/data-integrity.js';

export class PriorityClient {
    axios;
    config;
    log;
    strictDataIntegrity;
    keyFieldCache;
    constructor(config, options) {
        this.config = config;
        this.log = options?.logger || (() => { });
        this.strictDataIntegrity = options?.strictDataIntegrity !== false; // Default to true
        this.keyFieldCache = new Map(); // Cache resolved key fields per entity
        this.fieldCache = new Map(); // Cache discovered field names per entity ($select validation)
        this.debugEnabled = process.env.MCP_DEBUG === 'true';
        const httpsAgent = new https.Agent({
            rejectUnauthorized: config.rejectUnauthorized
        });
        this.axios = axios.create({
            baseURL: ensureTrailingSlash(config.baseUrl),
            timeout: config.timeoutMs,
            httpsAgent
        });
        this.axios.interceptors.request.use((req) => {
            applyAuth(req, config);
            applyLicenseHeaders(req, config);
            req.headers = req.headers || {};
            req.headers['Accept'] = req.headers['Accept'] || 'application/json';
            if (config.language) {
                req.headers['Accept-Language'] = config.language;
            }
            if (config.enableTrace) {
                req.headers['X-App-Trace'] = '1';
            }
            return req;
        });
    }
    _debugLog(method, entity, meta = {}) {
        if (!this.debugEnabled) return;
        const { duration, data, error, status, url } = meta;
        const lines = [`[MCP_DEBUG] ${method} entity=${entity}`];
        if (status != null) lines.push(`status=${status}`);
        if (duration != null) lines.push(`duration=${duration}ms`);
        if (url) lines.push(`url=${url.slice(0, 250)}`);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            lines.push(`fields=[${Object.keys(data).join(', ')}]`);
        }
        if (error) {
            const errStatus = error?.response?.status;
            if (errStatus) lines.push(`http_status=${errStatus}`);
            if (error.code) lines.push(`error_code=${error.code}`);
            if (error?.response?.data) {
                const bodyStr = typeof error.response.data === 'string'
                    ? error.response.data : JSON.stringify(error.response.data);
                lines.push(`error_body=${bodyStr.slice(0, 300)}`);
            }
        }
        console.log(lines.join(' '));
    }
    _createTimeoutError(method, entity, timeoutMs, data, url) {
        const fieldNames = data && typeof data === 'object' && !Array.isArray(data)
            ? Object.keys(data) : [];
        const msg =
            `OData ${method} timeout after ${timeoutMs}ms on ${entity}. ` +
            `Possible causes: missing required field (e.g., TYPE), ` +
            `document in wrong status, or business rule violation.` +
            (fieldNames.length > 0 ? ` Payload fields: [${fieldNames.join(', ')}].` : '') +
            ` Check KI-013 before retrying.` +
            (url ? ` URL: ${url.slice(0, 300)}` : '');
        return new Error(msg);
    }
    async getServiceDocument() {
        try {
            logApiCall('getServiceDocument', null, {});
            const res = await this.axios.get('', { params: { '$format': 'json' } });
            if (this.strictDataIntegrity) {
                ensureNoMockData(res.data, 'getServiceDocument', true);
            }
            return res.data;
        } catch (error) {
            throw createPriorityApiError('getServiceDocument', error, {});
        }
    }
    async getVersionInfo() {
        const res = await this.axios.get('', { validateStatus: () => true });
        const headers = {};
        for (const [k, v] of Object.entries(res.headers)) {
            headers[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : String(v);
        }
        return { headers, ok: res.status >= 200 && res.status < 300 };
    }
    async listEntities() {
        try {
            logApiCall('listEntities', null, {});
            const doc = await this.getServiceDocument();
            
            // OData v4 service document usually has 'value' array with { name, url }
            if (doc && Array.isArray(doc.value)) {
                const entities = doc.value
                    .filter((e) => typeof e?.name === 'string' && typeof e?.url === 'string')
                    .map((e) => ({ name: e.name, url: e.url }));
                
                if (this.strictDataIntegrity) {
                    ensureNoMockData({ value: entities }, 'listEntities', true);
                }
                return entities;
            }
            
            // Fallback: try older shapes (only if doc exists - this is still real API data)
            if (doc && doc.EntitySets && Array.isArray(doc.EntitySets)) {
                const entitySets = [];
                for (const name of doc.EntitySets) {
                    entitySets.push({ name, url: name });
                }
                if (this.strictDataIntegrity) {
                    ensureNoMockData({ value: entitySets }, 'listEntities', true);
                }
                return entitySets;
            }
            
            // If doc exists but doesn't match expected structure, return empty array
            // This is OK because it came from the API - it's just an empty result
            if (doc) {
                return [];
            }
            
            // If doc is null/undefined, this is an error - no fallback
            throw createPriorityApiError('listEntities', new Error('Service document is null or undefined'), {});
        } catch (error) {
            if (error.name === 'PriorityApiError') {
                throw error;
            }
            throw createPriorityApiError('listEntities', error, {});
        }
    }
    async getEntityByKey(entity, keyExpr, select, expand) {
        const startTime = Date.now();
        try {
            logApiCall('getEntityByKey', entity, { keyExpr, select, expand });
            if (typeof this.log === 'function') {
                this.log(`[API Call] getEntityByKey called directly for ${entity} with key ${keyExpr}`);
            }
            const path = `${stripSlashes(entity)}(${keyExpr})`;
            const params = { '$format': 'json' };
            if (select && select.length > 0) {
                params['$select'] = select.join(',');
            }
            if (expand) {
                params['$expand'] = expand;
            }
            const res = await this.axios.get(path, { params });
            this._debugLog('getEntityByKey', entity, { status: res.status, duration: Date.now() - startTime, url: path });
            
            if (this.strictDataIntegrity) {
                ensureNoMockData(res.data, `getEntityByKey(${entity})`, true);
            }
            return res.data;
        } catch (error) {
            this._debugLog('getEntityByKey', entity, { error, duration: Date.now() - startTime });
            throw createPriorityApiError(`getEntityByKey(${entity})`, error, { keyExpr, select, expand });
        }
    }

    formatODataValue(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }
        if (typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(value)) {
            return String(value);
        }
        return `'${String(value).replace(/'/g, "''")}'`;
    }

    /**
     * Like formatODataValue, but a JS string is always emitted as an OData string literal.
     * Values such as CUSTNAME '1001' look numeric yet belong to a string field — emitting
     * them bare makes Priority reject the request with 400.
     */
    formatODataValueStrict(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }
        return `'${String(value).replace(/'/g, "''")}'`;
    }

    async resolveEntityKey(entity, lookup) {
        const lookupEntries = Object.entries(lookup || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
        if (lookupEntries.length === 0) {
            throw createPriorityApiError('resolveEntityKey', new Error('lookup must contain at least one field'), { entity, lookup });
        }

        // String values stay quoted on the first attempt; only if that finds nothing do we retry
        // with bare numeric literals, for fields that really are numeric.
        const buildFilter = (fmt) => lookupEntries
            .map(([field, value]) => `${field} eq ${fmt(value)}`)
            .join(' and ');
        const filterQuoted = buildFilter((v) => this.formatODataValueStrict(v));
        const filterNumeric = buildFilter((v) => this.formatODataValue(v));

        if (typeof this.log === 'function') {
            this.log(`[KeyResolver] Resolving key for ${entity} with lookup: ${JSON.stringify(lookup)}`);
            this.log(`[KeyResolver] Generated filter: ${filterQuoted}`);
        }

        let filter = filterQuoted;
        let result = null;
        let firstError = null;
        try {
            result = await this.runQuery(entity, { filter, top: 1 });
        } catch (error) {
            firstError = error;
        }
        if (!result?.value?.[0] && filterNumeric !== filterQuoted) {
            if (typeof this.log === 'function') {
                this.log(`[KeyResolver] No match with quoted literals, retrying: ${filterNumeric}`);
            }
            try {
                const retry = await this.runQuery(entity, { filter: filterNumeric, top: 1 });
                if (retry?.value?.[0]) {
                    result = retry;
                    filter = filterNumeric;
                }
            } catch (retryError) {
                if (!firstError) firstError = retryError;
            }
        }
        const row = result?.value?.[0];
        if (!row) {
            throw createPriorityApiError('resolveEntityKey', firstError || new Error(`No matching record found for filter: ${filter}`), { entity, filter });
        }

        if (typeof this.log === 'function') {
            this.log(`[KeyResolver] Query returned row: ${JSON.stringify(row)}`);
        }

        // Fast path: composite lookup — all fields present in row → build composite key string
        if (lookupEntries.length > 1 && lookupEntries.every(([field]) => field in row)) {
            const compositeKey = lookupEntries
                .map(([field]) => `${field}=${this.formatODataValueStrict(row[field])}`)
                .join(',');
            if (typeof this.log === 'function') {
                this.log(`[KeyResolver] Composite key resolved: ${compositeKey}`);
            }
            return {
                keyField: lookupEntries.map(([f]) => f).join(','),
                keyValue: compositeKey,
                formattedKey: compositeKey,
                row, filter,
                candidates: [compositeKey],
                resolutionSource: 'composite_lookup',
                providedLookupField: lookupEntries[0][0],
                cacheHit: false
            };
        }

        const lookupFields = lookupEntries.map(([field]) => field);
        const allCandidates = Object.keys(row)
            .filter((key) => row[key] != null && typeof row[key] !== 'object');

        let keyField = null;
        let resolutionSource = null;
        let providedLookupField = lookupFields.length > 0 ? lookupFields[0] : null;

        // Priority 1: Use cached resolved key field if available
        if (this.keyFieldCache.has(entity)) {
            const cachedField = this.keyFieldCache.get(entity);
            if (allCandidates.includes(cachedField)) {
                keyField = cachedField;
                resolutionSource = 'cache';
                if (typeof this.log === 'function') {
                    this.log(`[KeyResolver] Using cached key field: ${keyField}`);
                }
            }
        }

        // Priority 2: Use lookup field directly if no cache hit
        if (!keyField && lookupFields.length > 0) {
            // Use the first lookup field that exists in the row
            for (const lookupField of lookupFields) {
                if (allCandidates.includes(lookupField)) {
                    keyField = lookupField;
                    resolutionSource = 'lookup';
                    if (typeof this.log === 'function') {
                        this.log(`[KeyResolver] Using lookup field directly: ${keyField}`);
                    }
                    break;
                }
            }
        }

        // Priority 3: Fallback to heuristics only if no direct match
        if (!keyField) {
            const lookupCandidates = lookupFields.filter((key) => allCandidates.includes(key));
            const otherCandidates = allCandidates.filter((key) => !lookupFields.includes(key));
            const lookupNameCodeCandidates = lookupCandidates.filter((key) => typeof row[key] === 'string' && /(NAME|CODE)$/i.test(key));
            const otherNameCodeCandidates = otherCandidates.filter((key) => typeof row[key] === 'string' && /(NAME|CODE)$/i.test(key));
            const lookupStringCandidates = lookupCandidates.filter((key) => typeof row[key] === 'string' && !/(NAME|CODE)$/i.test(key));
            const otherStringCandidates = otherCandidates.filter((key) => typeof row[key] === 'string' && !/(NAME|CODE)$/i.test(key));
            const numericCandidates = otherCandidates.filter((key) => typeof row[key] === 'number');
            const lookupOtherCandidates = lookupCandidates.filter((key) => typeof row[key] !== 'string');

            const preferred = [
                ...lookupNameCodeCandidates,
                ...otherNameCodeCandidates,
                ...lookupStringCandidates,
                ...otherStringCandidates,
                ...numericCandidates,
                ...lookupOtherCandidates
            ];

            if (preferred.length === 0) {
                preferred.push(...lookupCandidates);
            }

            keyField = preferred[0];
            resolutionSource = 'heuristic';

            if (typeof this.log === 'function') {
                this.log(`[KeyResolver] Using heuristic fallback: ${keyField}`);
                this.log(`[KeyResolver] All candidates: ${JSON.stringify(allCandidates)}`);
                this.log(`[KeyResolver] Lookup candidates: ${JSON.stringify(lookupCandidates)}`);
                this.log(`[KeyResolver] Other candidates: ${JSON.stringify(otherCandidates)}`);
                this.log(`[KeyResolver] Preferred order: ${JSON.stringify(preferred)}`);
            }
        }

        const keyValue = row[keyField];

        if (typeof this.log === 'function') {
            this.log(`[KeyResolver] Final resolution: keyField=${keyField}, keyValue=${JSON.stringify(keyValue)}, source=${resolutionSource}`);
        }

        // Cache the resolved key field for this entity
        this.keyFieldCache.set(entity, keyField);

        return {
            keyField,
            keyValue,
            formattedKey: this.formatODataValue(keyValue),
            row,
            filter,
            candidates: [keyField],
            resolutionSource,
            providedLookupField,
            cacheHit: resolutionSource === 'cache'
        };
    }

    async getEntityByLookup(entity, lookup, select, expand) {
        const resolved = await this.resolveEntityKey(entity, lookup);
        const cacheUsed = this.keyFieldCache.has(entity);
        const candidates = resolved.candidates || [resolved.keyField];
        const errors = [];

        if (typeof this.log === 'function') {
            this.log(`[API Call] getEntityByLookup resolved ${entity} via filter ${resolved.filter} (cache: ${cacheUsed ? 'hit' : 'miss'})`);
            this.log(`[API Call] Candidate key fields: ${JSON.stringify(candidates)}`);
        }

        let result;
        let chosenField = null;
        let chosenValue = null;
        let chosenKeyExpr = null;

        for (const candidateField of candidates) {
            const candidateValue = resolved.row[candidateField];
            if (candidateValue === undefined || candidateValue === null) {
                continue;
            }
            // Quoted form first: a resolved value like '1001' is a string key even though it
            // looks numeric. Only fall back to the bare number for genuinely numeric keys.
            const keyExprs = [this.formatODataValueStrict(candidateValue)];
            const looseKeyExpr = this.formatODataValue(candidateValue);
            if (looseKeyExpr !== keyExprs[0]) {
                keyExprs.push(looseKeyExpr);
            }

            for (const candidateKeyExpr of keyExprs) {
                if (typeof this.log === 'function') {
                    this.log(`[API Call] Trying getEntityByKey(${entity}, ${candidateKeyExpr}) using candidate field ${candidateField}`);
                }

                try {
                    result = await this.getEntityByKey(entity, candidateKeyExpr, select, expand);
                    chosenField = candidateField;
                    chosenValue = candidateValue;
                    chosenKeyExpr = candidateKeyExpr;
                    break;
                } catch (error) {
                    const statusCode = error?.response?.status || error?.statusCode;
                    errors.push({ candidateField, candidateValue, candidateKeyExpr, statusCode, message: error.message });
                    if (statusCode === 404 || statusCode === 400) {
                        if (typeof this.log === 'function') {
                            this.log(`[API Call] candidate ${candidateField}=${candidateKeyExpr} failed with ${statusCode}, trying next key form`);
                        }
                        continue;
                    }
                    throw error;
                }
            }

            if (result) {
                break;
            }
        }

        if (!result) {
            throw createPriorityApiError(
                `getEntityByLookup(${entity})`,
                new Error(`Failed to resolve entity key for ${entity} from lookup`),
                { entity, lookup, candidates, errors }
            );
        }

        if (typeof this.log === 'function') {
            this.log(`[API Call] getEntityByLookup succeeded with field ${chosenField} and keyExpr ${chosenKeyExpr}`);
        }

        if (result && typeof result === 'object') {
            result._mcp_metadata = result._mcp_metadata || {};
            result._mcp_metadata.resolvedKeyField = chosenField;
            result._mcp_metadata.originalLookup = lookup;
            result._mcp_metadata.resolvedValue = chosenValue;
            result._mcp_metadata.resolvedKeyExpr = chosenKeyExpr;
            result._mcp_metadata.candidateFields = candidates;
            result._mcp_metadata.cacheUsed = cacheUsed;
            result._mcp_metadata.filter = resolved.filter;
            result._mcp_metadata.row = resolved.row;
            result._mcp_metadata.resolutionSource = resolved.resolutionSource;
            result._mcp_metadata.providedLookupField = resolved.providedLookupField;
            result._mcp_metadata.cacheHit = resolved.cacheHit;
        }

        return result;
    }
    /**
     * Get text for an entity
     * GET /Entity(Key)/Text
     * @param {string} entity - Entity name
     * @param {string} keyExpr - Entity key expression
     * @returns {Promise<object>} Text data
     */
    async getEntityText(entity, keyExpr) {
        try {
            logApiCall('getEntityText', entity, { keyExpr });
            const path = `${stripSlashes(entity)}(${keyExpr})/Text`;
            const params = { '$format': 'json' };
            const res = await this.axios.get(path, { params });
            
            if (this.strictDataIntegrity) {
                ensureNoMockData(res.data, `getEntityText(${entity})`, true);
            }
            return res.data;
        } catch (error) {
            throw createPriorityApiError(`getEntityText(${entity})`, error, { keyExpr });
        }
    }
    /**
     * Add text to an entity
     * POST /Entity(Key)/Text
     * @param {string} entity - Entity name
     * @param {string} keyExpr - Entity key expression
     * @param {object} textData - Text data to add
     * @returns {Promise<object>} Response data
     */
    async addEntityText(entity, keyExpr, textData) {
        const path = `${stripSlashes(entity)}(${keyExpr})/Text`;
        try {
            const res = await this.axios.post(path, textData, {
                headers: { 'Content-Type': 'application/json' }
            });
            return res.data;
        }
        catch (error) {
            // attempt CSRF token fetch and retry if required
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = { 'Content-Type': 'application/json' };
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                const res2 = await this.axios.post(path, textData, { headers });
                return res2.data;
            }
            catch (retryError) {
                throw retryError;
            }
        }
    }
    /**
     * Update text for an entity
     * PATCH /Entity(Key)/Text
     * @param {string} entity - Entity name
     * @param {string} keyExpr - Entity key expression
     * @param {object} textData - Text data to update
     * @returns {Promise<object>} Response data
     */
    async updateEntityText(entity, keyExpr, textData) {
        const path = `${stripSlashes(entity)}(${keyExpr})/Text`;
        const send = async (headers) => {
            const res = await this.axios.patch(path, textData, {
                headers: {
                    'Content-Type': 'application/json',
                    'If-Match': '*',
                    ...headers
                }
            });
            return res.data;
        };
        try {
            return await send({});
        }
        catch (error) {
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                throw retryError;
            }
        }
    }
    /**
     * Get attachments for an entity
     * GET /Entity(Key)/Attachments
     * @param {string} entity - Entity name
     * @param {string} keyExpr - Entity key expression
     * @returns {Promise<object>} Attachments data
     */
    async getEntityAttachments(entity, keyExpr) {
        try {
            logApiCall('getEntityAttachments', entity, { keyExpr });
            const path = `${stripSlashes(entity)}(${keyExpr})/Attachments`;
            const params = { '$format': 'json' };
            const res = await this.axios.get(path, { params });
            
            if (this.strictDataIntegrity) {
                ensureNoMockData(res.data, `getEntityAttachments(${entity})`, true);
            }
            return res.data;
        } catch (error) {
            throw createPriorityApiError(`getEntityAttachments(${entity})`, error, { keyExpr });
        }
    }
    /**
     * Upload an attachment to an entity
     * POST /Entity(Key)/Attachments
     * @param {string} entity - Entity name
     * @param {string} keyExpr - Entity key expression
     * @param {Buffer|string} fileData - File data (Buffer or base64 string)
     * @param {string} fileName - File name
     * @param {string} contentType - Content type (optional, defaults to application/octet-stream)
     * @returns {Promise<object>} Response data
     */
    async uploadEntityAttachment(entity, keyExpr, fileData, fileName, contentType = 'application/octet-stream') {
        const path = `${stripSlashes(entity)}(${keyExpr})/Attachments`;
        
        // Create FormData for multipart/form-data
        const formData = new FormData();
        
        // Convert fileData to Buffer if it's a string (base64)
        let fileBuffer;
        if (typeof fileData === 'string') {
            fileBuffer = Buffer.from(fileData, 'base64');
        } else if (Buffer.isBuffer(fileData)) {
            fileBuffer = fileData;
        } else {
            throw new Error('fileData must be a Buffer or base64 string');
        }
        
        formData.append('file', fileBuffer, {
            filename: fileName,
            contentType: contentType
        });
        
        const send = async (headers) => {
            const res = await this.axios.post(path, formData, {
                headers: {
                    ...formData.getHeaders(),
                    ...headers
                }
            });
            return res.data;
        };
        
        try {
            return await send({});
        }
        catch (error) {
            // attempt CSRF token fetch and retry if required
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                throw retryError;
            }
        }
    }
    async runQuery(entity, options) {
        try {
            logApiCall('runQuery', entity, options);
            
            // Build OData query parameters - ensure correct casing with dollar signs
            const params = { '$format': 'json' };
            
            // Map filter parameter (critical: must be $filter, not filter)
            if (options.filter) {
                params['$filter'] = String(options.filter);
            }
            
            // Map other OData query parameters with correct casing
            if (options.select && options.select.length > 0) {
                params['$select'] = Array.isArray(options.select) 
                    ? options.select.map(s => String(s)).join(',')
                    : String(options.select);
            }
            if (typeof options.top === 'number' && !isNaN(options.top)) {
                params['$top'] = String(options.top);
            }
            if (typeof options.skip === 'number' && !isNaN(options.skip)) {
                params['$skip'] = String(options.skip);
            }
            if (options.orderby) {
                params['$orderby'] = String(options.orderby);
            }
            if (options.expand) {
                params['$expand'] = String(options.expand);
            }
            if (options.deltaToken) {
                params['$deltatoken'] = String(options.deltaToken);
            }
            if (options.count === true) {
                params['$count'] = 'true';
            }
            
            // Validation: If filter was provided in options, it MUST be in params
            if (options.filter && !params['$filter']) {
                throw new Error(
                    `Filter validation failed: Filter was provided in options (${JSON.stringify(options.filter)}) ` +
                    `but was not added to request parameters. This indicates a bug in parameter mapping.`
                );
            }
            
            // Build full URL for debugging and metadata
            const entityPath = stripSlashes(entity);
            const baseUrl = this.axios.defaults.baseURL || '';
            let fullRequestUrl;
            try {
                // Try to construct full URL if baseUrl is absolute
                if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
                    const url = new URL(entityPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
                    Object.entries(params).forEach(([key, value]) => {
                        url.searchParams.append(key, value);
                    });
                    fullRequestUrl = url.toString();
                } else {
                    // Relative base URL - construct manually
                    const queryString = Object.entries(params)
                        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                        .join('&');
                    fullRequestUrl = `${baseUrl}${entityPath}?${queryString}`;
                }
            } catch (err) {
                // Fallback: construct manually
                const queryString = Object.entries(params)
                    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                    .join('&');
                fullRequestUrl = `${baseUrl}${entityPath}?${queryString}`;
            }
            
            const logLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
            const isInfo = logLevel !== 'DEBUG';
            const countParam = params['$count'] === 'true';
            const topParam = params['$top'];
            if (isInfo && typeof this.log === 'function') {
                const paramSummary = [countParam && '$count=true', topParam != null && `$top=${topParam}`].filter(Boolean).join(' ');
                this.log(`[API Call] runQuery - Entity: ${entity}${paramSummary ? ` ${paramSummary}` : ''}`);
                this.log(`[odata] req entity=${entity} method=GET baseUrl=${baseUrl} url=${fullRequestUrl} $count=${countParam}`);
            }
            
            // Debug logging (guarded by DEBUG or MCP_DEBUG env var)
            const debugEnabled = process.env.DEBUG === 'true' || process.env.MCP_DEBUG === 'true';
            if (debugEnabled) {
                console.log('[MCP_DEBUG] runQuery request details:');
                console.log(`  Entity: ${entity}`);
                console.log(`  Full URL: ${fullRequestUrl}`);
                console.log(`  Query params:`, JSON.stringify(params, null, 2));
                console.log(`  $filter present: ${params['$filter'] ? 'YES' : 'NO'}`);
                if (params['$filter']) {
                    console.log(`  $filter value: ${params['$filter']}`);
                }
            }
            
            // ================================================================
            // Field validation: Auto-discover fields when $select is used
            // Prevents 400 errors from invalid field names
            // ================================================================
            const selectFields = options.select;
            if (selectFields && selectFields.length > 0) {
                const entityUpper = (entity || '').toUpperCase();
                if (!this.fieldCache.has(entityUpper)) {
                    if (typeof this.log === 'function') {
                        this.log(`[FieldValidator] Auto-discovering fields for ${entity} (first query with $select)`);
                    }
                    try {
                        // Fetch a minimal sample record to discover field names
                        const sampleParams = { '$format': 'json', '$top': 1 };
                        const sampleRes = await this.axios.get(entityPath, { params: sampleParams });
                        const sample = sampleRes?.data?.value?.[0];
                        if (sample && typeof sample === 'object') {
                            const fieldNames = new Set(Object.keys(sample));
                            this.fieldCache.set(entityUpper, fieldNames);
                            if (typeof this.log === 'function') {
                                this.log(`[FieldValidator] Cached ${fieldNames.size} fields for ${entity}`);
                            }
                        }
                    } catch (discErr) {
                        // Silently fall through — if we can't discover fields, let the OData call fail naturally
                        this.log(`[FieldValidator] Could not discover fields for ${entity}: ${discErr?.message || 'unknown'}`);
                    }
                }
                const knownFields = this.fieldCache.get(entityUpper);
                if (knownFields) {
                    const invalidFields = selectFields.filter(f => !knownFields.has(f));
                    if (invalidFields.length > 0) {
                        const validFields = [...knownFields].sort();
                        const errMsg =
                            `Invalid $select field(s): [${invalidFields.join(', ')}]. ` +
                            `Valid fields for ${entity}: [${validFields.join(', ')}]. ` +
                            `Always call metadata_schema_get(entity) first to verify field names.`;
                        if (typeof this.log === 'function') {
                            this.log(`[FieldValidator] BLOCKED query to ${entity}: ${errMsg}`);
                        }
                        throw new Error(errMsg);
                    }
                }
            }
            
            // Make the HTTP request
            const res = await this.axios.get(entityPath, { params });
            
            let data = res.data;
            const valueArr = data?.value;
            const valueLen = Array.isArray(valueArr) ? valueArr.length : (valueArr ? 1 : 0);
            let hasOdataCount = data && (typeof data['@odata.count'] !== 'undefined' || typeof data['odata.count'] !== 'undefined');
            let odataCountVal = data && (data['@odata.count'] ?? data['odata.count']);
            let countSource = hasOdataCount ? 'odata_count' : null;

            // Fallback: when count was requested but Priority didn't return @odata.count, try entity/$count + paging
            if (options.count === true && !hasOdataCount) {
                const countResult = await this.tryEstimateCount(entityPath, entity, params['$filter']);
                if (countResult) {
                    odataCountVal = countResult.count;
                    hasOdataCount = true;
                    countSource = countResult.source;
                    if (res.data && typeof res.data === 'object') res.data['@odata.count'] = countResult.count;
                    if (isInfo && typeof this.log === 'function') {
                        this.log(`[odata] ${countResult.source} fallback ok: entity=${entity} count=${countResult.count}`);
                    }
                }
            }

            if (isInfo && typeof this.log === 'function') {
                this.log(`[odata] resp status=${res.status} value_len=${valueLen} has_odata_count=${hasOdataCount}${hasOdataCount ? ` odata_count=${odataCountVal}` : ''}`);
            }
            
            // Debug logging for response
            const resultCount = valueLen;
            if (debugEnabled) {
                console.log(`[MCP_DEBUG] runQuery response:`);
                console.log(`  Status: ${res.status}`);
                console.log(`  Result count: ${resultCount}`);
                if (params['$filter'] && res.data?.value && Array.isArray(res.data.value)) {
                    // Sample first few CURDATE values if present (for date filter validation)
                    const sampleDates = res.data.value
                        .slice(0, 3)
                        .map(r => r.CURDATE || r.ORDDATE || r.SHIPDATE || 'N/A')
                        .filter(d => d !== 'N/A');
                    if (sampleDates.length > 0) {
                        console.log(`  Sample dates in results: ${sampleDates.join(', ')}`);
                    }
                }
            }
            
            // Post-check: Validate that filter was applied (for date filters only)
            if (params['$filter'] && res.data?.value && Array.isArray(res.data.value) && res.data.value.length > 0) {
                const filterStr = params['$filter'];
                
                // Known date fields in Priority ERP (to avoid validating numeric fields)
                const knownDateFields = ['CURDATE', 'ORDDATE', 'SHIPDATE', 'DUEDATE', 'STATUSDATE', 'CREATEDDATE', 'UDATE'];
                
                // Check for year-based date filters (e.g., "year(CURDATE) eq 2025")
                const yearMatch = filterStr.match(/year\s*\(\s*(\w+)\s*\)\s*eq\s*(\d{4})/i);
                
                // Check for date range filters with date fields only (e.g., "CURDATE ge 2025-01-01")
                // Match: DATE_FIELD operator YYYY-MM-DD or DATE_FIELD operator YYYY
                // Only match if field is a known date field
                let dateFilterMatch = null;
                const dateFilterPatterns = [
                    // Pattern: CURDATE ge 2025-01-01T...
                    /(CURDATE|ORDDATE|SHIPDATE|DUEDATE|STATUSDATE|CREATEDDATE|UDATE)\s+(ge|gt|le|lt|eq)\s+['"]?(\d{4})/i,
                    // Pattern: CURDATE ge 2025-01-01 (full date)
                    /(CURDATE|ORDDATE|SHIPDATE|DUEDATE|STATUSDATE|CREATEDDATE|UDATE)\s+(ge|gt|le|lt|eq)\s+['"]?(\d{4}-\d{2}-\d{2})/i
                ];
                
                for (const pattern of dateFilterPatterns) {
                    const match = filterStr.match(pattern);
                    if (match && knownDateFields.includes(match[1].toUpperCase())) {
                        dateFilterMatch = match;
                        break;
                    }
                }
                
                if (yearMatch || dateFilterMatch) {
                    const fieldName = yearMatch ? yearMatch[1] : dateFilterMatch[1];
                    const operator = yearMatch ? 'eq' : dateFilterMatch[2].toLowerCase(); // year() always uses eq
                    
                    // Extract expected year from match
                    let expectedYearStr;
                    if (yearMatch) {
                        expectedYearStr = yearMatch[2];
                    } else {
                        // For dateFilterMatch, the year/date is in match[3]
                        expectedYearStr = dateFilterMatch[3];
                        // If it's a full date like "2025-01-01", extract just the year
                        if (expectedYearStr.includes('-')) {
                            expectedYearStr = expectedYearStr.substring(0, 4);
                        }
                    }
                    const expectedYear = expectedYearStr;
                    
                    // Verify field is actually a date field (safety check)
                    if (!knownDateFields.includes(fieldName.toUpperCase())) {
                        // Skip validation for non-date fields
                        if (debugEnabled) {
                            console.log(`[MCP_DEBUG] Skipping date validation for non-date field: ${fieldName}`);
                        }
                    } else {
                        // Check if any results violate the date filter
                        const violatingRecords = res.data.value.filter(record => {
                            const dateValue = record[fieldName];
                            if (!dateValue) return false; // Skip records without the date field
                            
                            // Verify it's actually a date value (contains T or matches date pattern)
                            const dateStr = String(dateValue);
                            const isDateValue = dateStr.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateStr);
                            if (!isDateValue) {
                                // Not a date value, skip validation
                                return false;
                            }
                            
                            // Extract year from date string (handles ISO format: "2025-12-01T00:00:00+02:00")
                            const dateYear = parseInt(dateStr.substring(0, 4), 10);
                            const expectedYearNum = parseInt(expectedYear, 10);
                            
                            // Validate based on operator
                            let violates = false;
                            switch (operator) {
                                case 'eq':
                                    // Exact match: year must equal expectedYear
                                    violates = dateYear !== expectedYearNum;
                                    break;
                                case 'ge':
                                case 'gt':
                                    // Greater than or equal: year must be >= expectedYear
                                    // Only flag if year is LESS than expectedYear
                                    violates = dateYear < expectedYearNum;
                                    break;
                                case 'le':
                                case 'lt':
                                    // Less than or equal: year must be <= expectedYear
                                    // Only flag if year is GREATER than expectedYear
                                    violates = dateYear > expectedYearNum;
                                    break;
                                default:
                                    // Unknown operator, skip validation
                                    return false;
                            }
                            
                            return violates;
                        });
                        
                        if (violatingRecords.length > 0) {
                            const error = new FilterNotAppliedError(
                                filterStr,
                                params,
                                {
                                    totalResults: res.data.value.length,
                                    violatingCount: violatingRecords.length,
                                    operator: operator,
                                    expectedYear: expectedYear,
                                    sampleViolatingDates: violatingRecords
                                        .slice(0, 3)
                                        .map(r => r[fieldName])
                                }
                            );
                            
                            if (debugEnabled) {
                                console.error(`[MCP_DEBUG] Filter validation failed:`, error.message);
                                console.error(`[MCP_DEBUG] Operator: ${operator}, Expected year: ${expectedYear}`);
                            }
                            
                            throw error;
                        }
                    }
                }
            }
            
            // Store metadata for LangSmith inspection
            const metadata = {
                entity,
                requestUrl: fullRequestUrl,
                queryParams: { ...params },
                responseStatus: res.status,
                resultCount: res.data?.value ? (Array.isArray(res.data.value) ? res.data.value.length : 1) : 0,
                filterApplied: !!params['$filter'],
                filterValue: params['$filter'] || null
            };
            if (options.count === true && hasOdataCount && odataCountVal != null) {
                metadata.count = odataCountVal;
                metadata.count_source = countSource || 'odata_count';
            }
            
            // Attach metadata to response for LangSmith
            if (res.data && typeof res.data === 'object') {
                res.data._mcp_metadata = metadata;
            }
            
            if (this.strictDataIntegrity) {
                ensureNoMockData(res.data, `runQuery(${entity})`, true);
            }
            
            return res.data;
        } catch (error) {
            throw createPriorityApiError(`runQuery(${entity})`, error, options);
        }
    }
    /** Entity -> amount field for SUM. PORDERS/ORDERS use TOTPRICE. */
    static ENTITY_AMOUNT_FIELD = {
        PORDERS: 'TOTPRICE', ORDERS: 'TOTPRICE', AINVOICES: 'TOTPRICE',
        CINVOICES: 'TOTPRICE', TINVOICES: 'TOTPRICE'
    };
    static MINIMAL_KEY = {
        CUSTOMERS: 'CUSTNAME', ORDERS: 'ORDNAME', USERS: 'USERLOGIN',
        PART: 'PARTNAME', LOGPART: 'PARTNAME', SUPPLIERS: 'SUPNAME', PORDERS: 'PORDNAME'
    };
    /**
     * Estimate record count via /$count endpoint first, then paging fallback.
     * The MINIMAL_KEY map is hardcoded for 7 known entities; unknown entities
     * fall back to 'CUSTNAME' which may or may not be correct.
     * @param {string} entityPath - OData entity path
     * @param {string} entity - Original entity name (for logging/lookup)
     * @param {string|null} filter - $filter expression
     * @returns {Promise<{count: number, source: string}>|null}
     */
    async tryEstimateCount(entityPath, entity, filter) {
        const isInfo = (process.env.LOG_LEVEL || 'INFO').toUpperCase() !== 'DEBUG';
        const log = typeof this.log === 'function' ? this.log : (() => {});
        const params = {};
        if (filter) params['$filter'] = filter;
        try {
            const countRes = await this.axios.get(`${entityPath}/$count`, {
                params: Object.keys(params).length ? params : undefined
            });
            if (countRes.status === 200 && typeof countRes.data !== 'undefined') {
                let n;
                if (typeof countRes.data === 'number' && Number.isInteger(countRes.data)) {
                    n = countRes.data;
                } else {
                    const countBody = typeof countRes.data === 'string' ? countRes.data : String(countRes.data);
                    const countText = countBody.trim();
                    if (/^\d+$/.test(countText)) n = parseInt(countText, 10);
                }
                if (typeof n === 'number') {
                    return { count: n, source: 'count_endpoint' };
                }
            }
        } catch (countErr) {
            log(`[count-fallback] /$count failed: entity=${entity} err=${countErr?.message || 'unknown'}`);
        }
        // Paging fallback
        const MINIMAL_KEY_MAP = {
            CUSTOMERS: 'CUSTNAME', ORDERS: 'ORDNAME', USERS: 'USERLOGIN',
            PART: 'PARTNAME', LOGPART: 'PARTNAME', SUPPLIERS: 'SUPNAME', PORDERS: 'PORDNAME'
        };
        const oneField = MINIMAL_KEY_MAP[(entity || '').toUpperCase()] || 'CUSTNAME';
        const PAGE_SIZE = 500;
        const PAGING_CAP = 10000;
        let total = 0;
        let skip = 0;
        try {
            while (total < PAGING_CAP) {
                const pageParams = { $top: PAGE_SIZE, $skip: skip, $select: oneField };
                if (filter) pageParams['$filter'] = filter;
                const pageRes = await this.axios.get(entityPath, { params: pageParams });
                const pageVal = pageRes?.data?.value;
                const nPage = Array.isArray(pageVal) ? pageVal.length : 0;
                total += nPage;
                if (nPage < PAGE_SIZE) break;
                skip += PAGE_SIZE;
            }
            if (total > 0 && total < PAGING_CAP) {
                log(`[count-fallback] paging ok: entity=${entity} estimated=${total}`);
                return { count: total, source: 'paging_fallback' };
            }
        } catch (pageErr) {
            log(`[count-fallback] paging failed: entity=${entity} err=${pageErr?.message || 'unknown'}`);
        }
        return null;
    }
    async runSum(entity, options = {}) {
        const entityPath = stripSlashes(entity);
        const entUpper = (entity || '').toUpperCase();
        const amountField = (options.field || '').trim() || PriorityClient.ENTITY_AMOUNT_FIELD[entUpper];
        if (!amountField) {
            throw createPriorityApiError('runSum', new Error(`Entity ${entity} has no known amount field. Add to ENTITY_AMOUNT_FIELD.`), { entity, field: options.field });
        }
        const filterVal = options.filter ? String(options.filter) : null;
        const baseUrl = this.axios.defaults.baseURL || '';
        const log = typeof this.log === 'function' ? this.log : (() => {});
        log(`[API Call] sumQuery - Entity: ${entity} Field: ${amountField}`);
        const applyVal = `aggregate(${amountField} with sum as Total)`;
        const paramsApply = { $format: 'json', $apply: applyVal, $top: 0 };
        if (filterVal) paramsApply.$filter = filterVal;
        try {
            const res = await this.axios.get(entityPath, { params: paramsApply });
            if (res.status === 200 && res.data?.value && Array.isArray(res.data.value) && res.data.value.length > 0) {
                const row = res.data.value[0];
                const totalVal = row?.Total;
                if (totalVal != null) {
                    const v = typeof totalVal === 'number' ? totalVal : parseFloat(totalVal);
                    if (!isNaN(v)) {
                        log(`[odata] apply aggregate supported: entity=${entity} field=${amountField} value=${v}`);
                        return {
                            action: 'sum',
                            entity,
                            field: amountField,
                            value: v,
                            method: 'odata_apply',
                            _mcp_metadata: {
                                method: 'odata_apply',
                                rows_scanned: 1,
                                filter_applied: !!filterVal,
                                apply_supported: true
                            }
                        };
                    }
                }
            }
            log(`[odata] apply aggregate unsupported or empty: status=${res.status}`);
        } catch (e) {
            log(`[odata] apply aggregate failed: ${e?.message || 'unknown'}`);
        }
        const keyField = PriorityClient.MINIMAL_KEY[entUpper] || 'ORDNAME';
        const selectFields = [amountField, keyField].join(',');
        const PAGE_SIZE = 500;
        const PAGING_CAP = 100000;
        let totalSum = 0;
        let rowsScanned = 0;
        let skip = 0;
        let lastStatus = 0;
        let lastUrl = '';
        let lastSnippet = '';
        log(`[odata] paging sum fallback: entity=${entity} field=${amountField}`);
        while (rowsScanned < PAGING_CAP) {
            const pagingParams = { $format: 'json', $top: PAGE_SIZE, $skip: skip, $select: selectFields };
            if (filterVal) pagingParams.$filter = filterVal;
            const r = await this.axios.get(entityPath, { params: pagingParams });
            try {
                lastUrl = new URL(entityPath, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').toString() + '?' + new URLSearchParams(pagingParams).toString();
            } catch (_) {
                lastUrl = `${baseUrl}/${entityPath}?$top=${PAGE_SIZE}&$skip=${skip}`;
            }
            lastStatus = r.status;
            lastSnippet = (r.data && typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 300) : String(r.data || '')).replace(/\n/g, ' ');
            if (r.status !== 200) {
                log(`[odata] sum failed: status=${r.status} url=${lastUrl} snippet=${lastSnippet}`);
                throw createPriorityApiError('runSum', new Error(`SUM_FAILED: entity=${entity} field=${amountField} status=${r.status} url=${lastUrl} response_snippet=${lastSnippet}`), {
                    entity, field: amountField, last_status: r.status, last_url: lastUrl, response_snippet: lastSnippet
                });
            }
            const value = r.data?.value;
            const arr = Array.isArray(value) ? value : [];
            for (const rec of arr) {
                if (rec && typeof rec === 'object') {
                    const v = rec[amountField];
                    if (v != null && v !== '') {
                        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
                        if (!isNaN(n)) totalSum += n;
                    }
                }
            }
            rowsScanned += arr.length;
            if (arr.length < PAGE_SIZE) break;
            skip += PAGE_SIZE;
        }
        log(`[odata] paging sum ok: entity=${entity} field=${amountField} value=${totalSum} rows=${rowsScanned}`);
        return {
            action: 'sum',
            entity,
            field: amountField,
            value: totalSum,
            method: 'paging_sum',
            rows_scanned: rowsScanned,
            _mcp_metadata: {
                method: 'paging_sum',
                rows_scanned: rowsScanned,
                filter_applied: !!filterVal,
                apply_supported: false
            }
        };
    }
    async createEntity(entity, data) {
        const path = stripSlashes(entity);
        const startTime = Date.now();
        const writeTimeout = this.config.writeTimeoutMs || 15000;
        try {
            const res = await this.axios.post(path, data, {
                headers: { 'Content-Type': 'application/json' },
                timeout: writeTimeout
            });
            this._debugLog('createEntity', entity, { status: res.status, duration: Date.now() - startTime, data });
            return res.data;
        }
        catch (error) {
            this._debugLog('createEntity', entity, { error, duration: Date.now() - startTime, data });
            if (error.code === 'ECONNABORTED') {
                throw this._createTimeoutError('entity_create', entity, writeTimeout, data, path);
            }
            // attempt CSRF token fetch and retry if required
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = { 'Content-Type': 'application/json' };
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                const res2 = await this.axios.post(path, data, { headers, timeout: writeTimeout });
                const retryDuration = Date.now() - startTime;
                this._debugLog('createEntity', entity, { status: res2.status, duration: retryDuration, data });
                return res2.data;
            }
            catch (retryError) {
                this._debugLog('createEntity', entity, { error: retryError, duration: Date.now() - startTime, data });
                throw createPriorityApiError(`createEntity(${entity})`, retryError, { data });
            }
        }
    }
    async updateEntity(entity, keyExpr, data) {
        const encodedKey = String(keyExpr).replace(/'([^']*)'/g, (_, val) => `'${encodeURIComponent(val)}'`);
        const resource = `${stripSlashes(entity)}(${encodedKey})`;
        const startTime = Date.now();
        const writeTimeout = this.config.writeTimeoutMs || 15000;
        const send = async (headers) => {
            const res = await this.axios.patch(resource, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'If-Match': '*',
                    ...headers
                },
                timeout: writeTimeout
            });
            this._debugLog('updateEntity', entity, { status: res.status, duration: Date.now() - startTime, data, url: resource });
            return res.data;
        };
        try {
            return await send({});
        }
        catch (error) {
            this._debugLog('updateEntity', entity, { error, duration: Date.now() - startTime, data, url: resource });
            if (error.code === 'ECONNABORTED') {
                throw this._createTimeoutError('entity_update', entity, writeTimeout, data, resource);
            }
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                this._debugLog('updateEntity', entity, { error: retryError, duration: Date.now() - startTime, data, url: resource });
                throw createPriorityApiError(`updateEntity(${entity})`, retryError, { data, keyExpr });
            }
        }
    }
    async deleteEntity(entity, keyExpr) {
        const encodedKey = String(keyExpr).replace(/'([^']*)'/g, (_, val) => `'${encodeURIComponent(val)}'`);
        const resource = `${stripSlashes(entity)}(${encodedKey})`;
        const startTime = Date.now();
        const writeTimeout = this.config.writeTimeoutMs || 15000;
        const send = async (headers) => {
            const res = await this.axios.delete(resource, {
                headers: {
                    'If-Match': '*',
                    ...headers
                },
                timeout: writeTimeout
            });
            this._debugLog('deleteEntity', entity, { status: res.status, duration: Date.now() - startTime, url: resource });
            return res.data;
        };
        try {
            return await send({});
        }
        catch (error) {
            this._debugLog('deleteEntity', entity, { error, duration: Date.now() - startTime, url: resource });
            if (error.code === 'ECONNABORTED') {
                throw this._createTimeoutError('entity_delete', entity, writeTimeout, null, resource);
            }
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                this._debugLog('deleteEntity', entity, { error: retryError, duration: Date.now() - startTime, url: resource });
                throw createPriorityApiError(`deleteEntity(${entity})`, retryError, { keyExpr });
            }
        }
    }
    /**
     * Create/update/delete a related entity (subform)
     * @param parentEntity Parent entity name (e.g., "ORDERS")
     * @param parentKey Parent entity key (e.g., "SO18000002" or "IVNUM='T9696',IVTYPE='A',DEBIT='D'")
     * @param subform Subform name (e.g., "ORDERITEMS_SUBFORM")
     * @param subformKey Subform key (e.g., "1" for line number)
     * @param operation 'create' | 'update' | 'delete'
     * @param data Data payload (for create/update)
     */
    async subformOperation(parentEntity, parentKey, subform, subformKey, operation, data) {
        // Construct path: ORDERS('SO18000002')/ORDERITEMS_SUBFORM(1)
        // URL-encode the value inside single-quoted string keys (e.g. 'Zedland Demo' → 'Zedland%20Demo')
        const encodedParentKey = String(parentKey).replace(/'([^']*)'/g, (_, val) => `'${encodeURIComponent(val)}'`);
        const parentPath = `${stripSlashes(parentEntity)}(${encodedParentKey})`;
        // Format and encode subform row key the same way: wrap strings in quotes, encode spaces
        const encodedSubformKey = subformKey != null
            ? String(this.formatODataValue(subformKey)).replace(/'([^']*)'/g, (_, val) => `'${encodeURIComponent(val)}'`)
            : null;
        const subformPath = encodedSubformKey
            ? `${parentPath}/${stripSlashes(subform)}(${encodedSubformKey})`
            : `${parentPath}/${stripSlashes(subform)}`;
        const startTime = Date.now();
        const writeTimeout = this.config.writeTimeoutMs || 15000;
        const send = async (headers) => {
            let res;
            switch (operation) {
                case 'create':
                    res = await this.axios.post(subformPath, data, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers
                        },
                        timeout: writeTimeout
                    });
                    break;
                case 'update':
                    res = await this.axios.patch(subformPath, data, {
                        headers: {
                            'Content-Type': 'application/json',
                            'If-Match': '*',
                            ...headers
                        },
                        timeout: writeTimeout
                    });
                    break;
                case 'delete':
                    res = await this.axios.delete(subformPath, {
                        headers: {
                            'If-Match': '*',
                            ...headers
                        },
                        timeout: writeTimeout
                    });
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            this._debugLog(`subform_${operation}`, `${parentEntity}/${subform}`, { status: res.status, duration: Date.now() - startTime, data, url: subformPath });
            return res.data;
        };
        
        try {
            return await send({});
        }
        catch (error) {
            this._debugLog(`subform_${operation}`, `${parentEntity}/${subform}`, { error, duration: Date.now() - startTime, data, url: subformPath });
            if (error.code === 'ECONNABORTED') {
                throw this._createTimeoutError(`subform_${operation}`, `${parentEntity}/${subform}`, writeTimeout, data, subformPath);
            }
            // Handle CSRF token retry
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                // Enhanced error handling for subform operations
                const statusCode = retryError?.response?.status;
                const responseData = retryError?.response?.data;
                
                if (statusCode === 400 || statusCode === 422) {
                    // Extract detailed error information
                    const errorDetails = {
                        operation: 'subform_' + operation,
                        parentEntity,
                        parentKey,
                        subform,
                        subformKey,
                        subformPath,
                        httpStatus: statusCode,
                        rawResponse: responseData,
                        interfaceErrors: null,
                        validationErrors: []
                    };

                    // Try to extract InterfaceErrors
                    if (responseData && typeof responseData === 'object') {
                        if (responseData.InterfaceErrors) {
                            errorDetails.interfaceErrors = responseData.InterfaceErrors;
                        }
                        if (responseData.error && responseData.error.details) {
                            errorDetails.validationErrors = responseData.error.details;
                        }
                        // Look for other common error formats
                        if (responseData.value && Array.isArray(responseData.value)) {
                            const errorMessages = responseData.value
                                .filter(item => item.Message || item.message)
                                .map(item => item.Message || item.message);
                            if (errorMessages.length > 0) {
                                errorDetails.validationErrors = errorMessages;
                            }
                        }
                    }

                    const errorMessage = `Subform ${operation} failed: ${retryError.message}`;
                    const enhancedError = new Error(errorMessage);
                    enhancedError.details = errorDetails;
                    enhancedError.statusCode = statusCode;
                    throw enhancedError;
                }
                
                this._debugLog(`subform_${operation}`, `${parentEntity}/${subform}`, { error: retryError, duration: Date.now() - startTime, data, url: subformPath });
                throw createPriorityApiError(`subformOperation(${parentEntity}/${subform})`, retryError, { parentEntity, subform, operation });
            }
        }
    }
    /**
     * Execute batch operations
     * Priority REST API supports JSON batch format
     * @param requests Array of batch request objects with { id, method, url, headers, body, dependsOn? }
     */
    async batchOperations(requests) {
        // Pre-flight check: warn about unencoded spaces in URLs
        for (const req of requests) {
            if (req.url && typeof req.url === 'string' && req.url.includes(' ') && !req.url.includes('%20')) {
                console.warn(`[batch] Warning: URL "${req.url}" contains unencoded spaces. ` +
                    `Use %20 instead of spaces in batch URLs (no auto-encoding in batch mode). ` +
                    `See MCP_GUIDE.md §10.`);
            }
        }
        const batchPayload = {
            requests: requests.map(req => {
                const batchReq = {
                    id: req.id,
                    method: req.method,
                    url: req.url,
                    headers: req.headers || {
                        'content-type': 'application/json; odata.metadata=minimal; odata.streaming=true',
                        'odata-version': '4.0'
                    }
                };
                if (req.body) {
                    batchReq.body = req.body;
                }
                if (req.dependsOn && req.dependsOn.length > 0) {
                    batchReq.dependsOn = req.dependsOn;
                }
                return batchReq;
            })
        };
        const startTime = Date.now();
        const procTimeout = this.config.procTimeoutMs || 45000;
        const send = async (headers) => {
            const res = await this.axios.post('$batch', batchPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...headers
                },
                timeout: procTimeout
            });
            this._debugLog('batchOperations', '$batch', { status: res.status, duration: Date.now() - startTime });
            return res.data;
        };
        
        try {
            return await send({});
        }
        catch (error) {
            this._debugLog('batchOperations', '$batch', { error, duration: Date.now() - startTime });
            if (error.code === 'ECONNABORTED') {
                throw this._createTimeoutError('batch_operations', 'batch', procTimeout, null, '$batch');
            }
            // Handle CSRF token
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                this._debugLog('batchOperations', '$batch', { error: retryError, duration: Date.now() - startTime });
                throw createPriorityApiError('batchOperations', retryError, { requestCount: requests.length });
            }
        }
    }
    /**
     * Clear metadata for an entity (or all entities if entityName is not provided)
     * @param entityName Optional entity name to clear metadata for
     */
    async clearEntityMetadata(entityName) {
        const send = async (headers) => {
            const res = await this.axios.post('ClearEntityMetadata', entityName ? { Entity: entityName } : {}, {
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            });
            return res.data;
        };
        
        try {
            return await send({});
        }
        catch (error) {
            // Handle CSRF token
            try {
                const fetchRes = await this.axios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                throw retryError;
            }
        }
    }
    async runReport(form, reportName, parameters) {
        // Reports are accessed via /restapi/{FORM}/RPT_{REPORT_NAME}
        // REST API uses the same base URL structure as OData but with /restapi/ instead of /odata/
        const baseUrl = ensureTrailingSlash(this.config.baseUrl);
        // Replace /odata/ with /restapi/ keeping the same path structure
        // Example: https://host/odata/priority/tabula.ini/demo/ -> https://host/restapi/priority/tabula.ini/demo/
        const restApiBaseUrl = baseUrl.replace('/odata/', '/restapi/');
        const reportPath = `${stripSlashes(form)}/RPT_${reportName}`;
        // Create a new axios instance for REST API calls
        const httpsAgent = new https.Agent({
            rejectUnauthorized: this.config.rejectUnauthorized
        });
        const restApiAxios = axios.create({
            baseURL: restApiBaseUrl,
            timeout: this.config.timeoutMs,
            httpsAgent
        });
        restApiAxios.interceptors.request.use((req) => {
            applyAuth(req, this.config);
            applyLicenseHeaders(req, this.config);
            req.headers = req.headers || {};
            req.headers['Accept'] = req.headers['Accept'] || 'application/json';
            return req;
        });
        const send = async (headers) => {
            const res = await restApiAxios.post(reportPath, parameters ? { parameters } : {}, {
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            });
            return res.data;
        };
        try {
            return await send({});
        }
        catch (error) {
            // attempt CSRF token fetch and retry if required
            try {
                const fetchRes = await restApiAxios.get('', {
                    headers: { 'X-CSRF-Token': 'Fetch' }
                });
                const headersLower = {};
                for (const [k, v] of Object.entries(fetchRes.headers || {})) {
                    headersLower[String(k).toLowerCase()] = v;
                }
                const tokenHeader = headersLower['x-csrf-token'];
                const setCookie = headersLower['set-cookie'];
                const cookieHeader = Array.isArray(setCookie)
                    ? String(setCookie[0]).split(';')[0]
                    : undefined;
                const headers = {};
                if (tokenHeader)
                    headers['X-CSRF-Token'] = tokenHeader;
                if (cookieHeader)
                    headers['Cookie'] = cookieHeader;
                return await send(headers);
            }
            catch (retryError) {
                throw retryError;
            }
        }
    }
}
function ensureTrailingSlash(url) {
    return url.endsWith('/') ? url : `${url}/`;
}
function stripSlashes(path) {
    return path.replace(/^\/+|\/+$/g, '');
}
function applyAuth(req, cfg) {
    req.headers = req.headers || {};
    switch (cfg.authType) {
        case 'basic': {
            const user = cfg.username || '';
            const pass = cfg.password || '';
            const token = Buffer.from(`${user}:${pass}`).toString('base64');
            req.headers['Authorization'] = `Basic ${token}`;
            break;
        }
        case 'pat': {
            // Priority PAT uses Basic auth: username = token, password = literal "PAT"
            // See https://prioritysoftware.github.io/restapi/authenticate/
            if (cfg.pat) {
                const token = Buffer.from(`${cfg.pat}:PAT`).toString('base64');
                req.headers['Authorization'] = `Basic ${token}`;
            }
            break;
        }
        case 'oauth2': {
            // OAuth2 access tokens use Bearer (distinct from Priority PAT Basic auth)
            if (cfg.pat) {
                req.headers['Authorization'] = `Bearer ${cfg.pat}`;
            }
            break;
        }
        case 'none': {
            break;
        }
        default:
            break;
    }
}
function applyLicenseHeaders(req, cfg) {
    if (!req.headers)
        req.headers = {};
    if (cfg.appId)
        req.headers['X-App-Id'] = cfg.appId;
    if (cfg.appKey)
        req.headers['X-App-Key'] = cfg.appKey;
}

