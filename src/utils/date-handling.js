/**
 * Date handling utilities for Priority ERP queries
 * Implements strict date handling rules for OData queries
 */

/**
 * Convert a year to a full-day time range filter
 * Year-based queries MUST be translated to a full-day time range:
 * Start: YYYY-01-01T00:00:01+TZ
 * End: YYYY+1-01-01T00:00:00+TZ
 * 
 * @param {number|string} year - The year (e.g., 2025)
 * @param {string} dateField - The date field name (e.g., 'CURDATE')
 * @param {string} timezone - Timezone offset (e.g., '+02:00', default: '+00:00')
 * @returns {string} OData filter expression
 */
export function yearToDateRangeFilter(year, dateField = 'CURDATE', timezone = '+00:00') {
    const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
    const startYear = yearNum;
    const endYear = yearNum + 1;
    
    // Start: YYYY-01-01T00:00:01+TZ
    const startDate = `${startYear}-01-01T00:00:01${timezone}`;
    // End: YYYY+1-01-01T00:00:00+TZ
    const endDate = `${endYear}-01-01T00:00:00${timezone}`;
    
    // Return: (CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)
    return `(${dateField} ge ${startDate}) and (${dateField} lt ${endDate})`;
}

/**
 * Get the primary date field for an entity
 * For 99% of Priority entities, including ORDERS: Primary date field is CURDATE
 * Use ORDDATE only if explicitly documented in entity schema
 * 
 * @param {string} entity - Entity name
 * @param {object} schema - Optional entity schema (if available)
 * @returns {string} Primary date field name
 */
export function getPrimaryDateField(entity, schema = null) {
    // Default to CURDATE for most entities
    // ORDDATE should only be used if explicitly documented
    if (schema && schema.fields && schema.fields.ORDDATE) {
        // Only use ORDDATE if it's explicitly documented as the primary date field
        // For now, default to CURDATE
        return 'CURDATE';
    }
    
    // For ORDERS and most entities, use CURDATE
    return 'CURDATE';
}

/**
 * Validate that a date filter uses proper format
 * Do NOT use: cast(...), 'datetime'..., Date-only strings, String comparisons
 * 
 * @param {string} filter - OData filter expression
 * @returns {object} Validation result with isValid and message
 */
export function validateDateFilterFormat(filter) {
    const issues = [];
    
    // Check for forbidden patterns
    if (filter.includes('cast(')) {
        issues.push('Do NOT use cast() - not supported in Priority OData');
    }
    
    if (filter.match(/datetime['"]/i)) {
        issues.push('Do NOT use datetime\'...\' format - use ISO 8601 with timezone');
    }
    
    // Check for date-only strings (should have time component)
    const dateOnlyPattern = /\d{4}-\d{2}-\d{2}(?!T)/;
    if (dateOnlyPattern.test(filter)) {
        issues.push('Date-only strings detected - use full ISO 8601 with timezone (e.g., 2025-01-01T00:00:01+00:00)');
    }
    
    // Check for timezone awareness
    const hasTimezone = /[+-]\d{2}:\d{2}/.test(filter);
    if (!hasTimezone && filter.includes('T')) {
        issues.push('Datetime should include timezone offset (e.g., +02:00 or +00:00)');
    }
    
    return {
        isValid: issues.length === 0,
        issues,
        message: issues.length > 0 
            ? `Date filter validation issues: ${issues.join('; ')}`
            : 'Date filter format is valid'
    };
}

/**
 * Extract timezone from a date string or use default
 * @param {string} dateString - ISO date string
 * @param {string} defaultTz - Default timezone (default: '+00:00')
 * @returns {string} Timezone offset
 */
export function extractTimezone(dateString, defaultTz = '+00:00') {
    if (!dateString) return defaultTz;
    
    const tzMatch = dateString.match(/([+-]\d{2}:\d{2})/);
    return tzMatch ? tzMatch[1] : defaultTz;
}

/**
 * Normalize date to offset-aware format
 * Always produce offset-aware datetimes
 * @param {string|Date} date - Date to normalize
 * @param {string} timezone - Target timezone (default: '+00:00')
 * @returns {string} ISO 8601 string with timezone
 */
export function normalizeToOffsetAware(date, timezone = '+00:00') {
    if (typeof date === 'string') {
        // If already has timezone, return as-is
        if (/([+-]\d{2}:\d{2})/.test(date)) {
            return date;
        }
        // If has time component but no timezone, add it
        if (date.includes('T')) {
            return date + timezone;
        }
        // If date-only, add time and timezone
        return `${date}T00:00:01${timezone}`;
    }
    
    // For Date objects, convert to ISO and ensure timezone
    const iso = date.toISOString();
    return iso.replace('Z', timezone);
}

