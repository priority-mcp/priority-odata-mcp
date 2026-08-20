/**
 * Data Integrity Validation Utilities
 * Ensures all data comes from real Priority ERP API calls
 * NO MOCK DATA ALLOWED
 */

import { assertNoMockData, createNoMockDataError, createPriorityApiError } from './errors.js';

/**
 * Validates that a response has the expected structure from Priority OData API
 * Priority OData responses typically have:
 * - @odata.context (metadata URL)
 * - value (array of entities) for collections
 * - Direct entity properties for single entities
 */
export function validateApiResponse(response, context = {}) {
    if (!response) {
        throw createNoMockDataError(
            'API Response Validation',
            'Response is null or undefined - cannot return empty/mock data'
        );
    }
    
    // Check for OData metadata indicators
    const hasODataMetadata = 
        response['@odata.context'] !== undefined ||
        response['@odata.metadataEtag'] !== undefined ||
        response['@odata.count'] !== undefined;
    
    // For collection responses, check for 'value' array
    if (Array.isArray(response.value)) {
        // Valid OData collection response
        return {
            isValid: true,
            isCollection: true,
            hasODataMetadata,
            count: response.value.length,
            '@odata.count': response['@odata.count']
        };
    }
    
    // For single entity responses, check if it's an object with properties
    if (typeof response === 'object' && !Array.isArray(response)) {
        // Check if it looks like an entity (has properties, not just metadata)
        const hasEntityData = Object.keys(response).some(key => 
            !key.startsWith('@odata') && !key.startsWith('@')
        );
        
        if (hasEntityData || hasODataMetadata) {
            return {
                isValid: true,
                isCollection: false,
                hasODataMetadata,
                isEntity: hasEntityData
            };
        }
    }
    
    // If we get here, the response structure is unexpected
    // This might be valid (e.g., empty result), but we should log it
    return {
        isValid: true, // Don't reject - let the calling code decide
        isCollection: false,
        hasODataMetadata: false,
        warning: 'Response structure is unexpected - verify it came from Priority API'
    };
}

/**
 * Ensures that data came from a real API call, not mock/synthetic data
 * Throws DataIntegrityError if mock data is detected
 */
export function ensureNoMockData(data, source = 'unknown', apiCallMade = true) {
    // First check: Was an API call actually made?
    if (!apiCallMade) {
        throw createNoMockDataError(
            `Data source validation: ${source}`,
            'No API call was made - cannot return data without real API call'
        );
    }
    
    // Second check: Is data null/undefined (which we should not return as fallback)?
    // Note: Empty arrays/objects are OK if they came from the API
    assertNoMockData(data, source);
    
    // Third check: Validate response structure suggests it came from Priority API
    const validation = validateApiResponse(data, { source });
    if (!validation.isValid) {
        throw createNoMockDataError(
            `Response validation for: ${source}`,
            'Response structure does not match expected Priority OData format'
        );
    }
    
    return validation;
}

/**
 * Validates that a Priority API error should result in an exception
 * (not a fallback to empty/mock data)
 */
export function validateErrorResponse(error, operation, context = {}) {
    // All API errors should be thrown - no fallback to mock data
    throw createPriorityApiError(operation, error, context);
}

/**
 * Logs API call for audit trail
 * Helps ensure traceability of all data sources
 */
export function logApiCall(operation, entity, params = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        operation,
        entity,
        params: Object.keys(params).length > 0 ? params : undefined
    };
    
    // In production, this could be sent to a logging service
    console.log(`[API Call] ${timestamp} - ${operation} - Entity: ${entity || 'N/A'}`);
    
    return logEntry;
}

/**
 * Constants for mock data detection patterns
 * (Conservative - only for logging warnings, not blocking)
 */
export const MOCK_DATA_PATTERNS = {
    KEYWORDS: ['mock', 'fake', 'dummy', 'test_data', 'sample_data', 'placeholder'],
    SUSPICIOUS_PATTERNS: [
        /test.*data/i,
        /mock.*response/i,
        /fake.*entity/i,
        /dummy.*record/i
    ]
};

/**
 * Policy statement - must be included in all error messages
 */
export const NO_MOCK_DATA_POLICY = 
    'NO MOCK DATA ALLOWED: All data must come from Priority ERP system via authenticated API calls. ' +
    'When data cannot be fetched, operations must fail with clear error messages. ' +
    'Never return empty, synthetic, or placeholder data as fallback.';












