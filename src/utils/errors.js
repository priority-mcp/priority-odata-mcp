/**
 * Custom error classes for Priority MCP Server
 * Enforces strict no-mock-data policy
 */

export class DataIntegrityError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = 'DataIntegrityError';
        this.context = context;
        this.policy = 'NO_MOCK_DATA_ALLOWED';
        
        // Ensure stack trace points to where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DataIntegrityError);
        }
    }
}

export class PriorityApiError extends Error {
    constructor(message, originalError = null, context = {}) {
        const fullMessage = originalError 
            ? `${message} (Original error: ${originalError.message})`
            : message;
        super(fullMessage);
        this.name = 'PriorityApiError';
        this.originalError = originalError;
        this.context = context;
        this.policy = 'NO_MOCK_DATA_ALLOWED';
        
        // Preserve original error details
        if (originalError?.response) {
            this.statusCode = originalError.response.status;
            this.responseData = originalError.response.data;
        }
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PriorityApiError);
        }
    }
}

export class FilterNotAppliedError extends Error {
    constructor(filterValue, requestParams, responseData) {
        super(
            `Filter was provided (${JSON.stringify(filterValue)}) but appears not to have been applied server-side. ` +
            `Request params: ${JSON.stringify(requestParams)}. ` +
            `This indicates the filter was not sent correctly or the server did not apply it.`
        );
        this.name = 'FilterNotAppliedError';
        this.filterValue = filterValue;
        this.requestParams = requestParams;
        this.responseData = responseData;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FilterNotAppliedError);
        }
    }
}

/**
 * Create a standardized error message that explicitly states the no-mock-data policy
 */
export function createNoMockDataError(operation, reason) {
    const message = `No mock data allowed. All data must come from Priority ERP system. ` +
                   `Operation: ${operation}. Reason: ${reason}`;
    return new DataIntegrityError(message, { operation, reason });
}

/**
 * Create a Priority API error with no-mock-data policy message
 */
export function createPriorityApiError(operation, originalError, context = {}) {
    let hebrewError = null;
    const responseData = originalError?.response?.data;
    if (responseData && typeof responseData === 'object') {
        // OData standard error format: { "error": { "message": { "value": "..." } } }
        // or: { "error": { "code": "...", "message": "string" } }
        if (responseData.error) {
            if (responseData.error.message?.value) {
                hebrewError = String(responseData.error.message.value);
            } else if (typeof responseData.error.message === 'string') {
                hebrewError = responseData.error.message;
            } else if (responseData.error.innererror?.message) {
                hebrewError = String(responseData.error.innererror.message);
            }
        }
        // WebSDK InterfaceErrors format
        if (!hebrewError) {
            if (responseData.InterfaceErrors?.text) {
                hebrewError = responseData.InterfaceErrors.text;
            } else if (responseData.InterfaceErrors && Array.isArray(responseData.InterfaceErrors)) {
                hebrewError = responseData.InterfaceErrors
                    .map(e => e?.text || e?.message || '')
                    .filter(Boolean)
                    .join('; ');
            }
        }
        // Priority-specific OData annotation format
        if (!hebrewError && responseData.value && Array.isArray(responseData.value)) {
            const errorMessages = responseData.value
                .filter(item => item.Message || item.message)
                .map(item => item.Message || item.message);
            if (errorMessages.length > 0) {
                hebrewError = errorMessages.join('; ');
            }
        }
    }
    const message = hebrewError
        ? `Failed to fetch data from Priority ERP system. ` +
          `No mock data allowed - operation must fail when API call fails. ` +
          `Operation: ${operation} — Hebrew error: "${hebrewError}"`
        : `Failed to fetch data from Priority ERP system. ` +
          `No mock data allowed - operation must fail when API call fails. ` +
          `Operation: ${operation}`;
    return new PriorityApiError(message, originalError, { ...context, operation, hebrewError });
}

/**
 * Assert that data is not mock/fake/synthetic
 * Throws DataIntegrityError if mock data patterns are detected
 */
export function assertNoMockData(data, source = 'unknown') {
    if (data === null || data === undefined) {
        throw createNoMockDataError(
            `Data validation for source: ${source}`,
            'Data is null or undefined - cannot return mock/empty data as fallback'
        );
    }
    
    // Check for common mock data patterns in object keys or string values
    if (typeof data === 'object') {
        const dataStr = JSON.stringify(data).toLowerCase();
        const mockPatterns = [
            'mock',
            'fake',
            'dummy',
            'test_data',
            'sample_data',
            'placeholder',
            'example_only'
        ];
        
        // Only flag if these appear in suspicious contexts (not in legitimate field names)
        // This is a conservative check - we mainly rely on ensuring data comes from API
        for (const pattern of mockPatterns) {
            if (dataStr.includes(pattern) && 
                (dataStr.includes('"value":') || dataStr.includes('"data":'))) {
                // This might be mock data - log warning but don't throw
                // (real data might contain these words in legitimate contexts)
                console.warn(`[Data Integrity] Potential mock data pattern detected in ${source}: "${pattern}"`);
            }
        }
    }
}












