export function isFiniteNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Check if an entity has API access enabled in FORMLIMITED
 * @param {PriorityClient} client - Priority API client
 * @param {string} entityName - Entity name to check
 * @returns {Promise<{exists: boolean, hasAccess: boolean, formType?: string, currentRestFlag?: string}>}
 */
export async function checkEntityAPIAccess(client, entityName) {
    try {
        const result = await client.runQuery('FORMLIMITED', {
            filter: `ENAME eq '${entityName}'`,
            select: ['ENAME', 'RESTFLAG', 'TYPE']
        });

        if (!result || !result.value || result.value.length === 0) {
            return { exists: false, hasAccess: false };
        }

        const formRecord = result.value[0];
        const hasAccess = formRecord.RESTFLAG === 'Y';
        
        return {
            exists: true,
            hasAccess: hasAccess,
            formType: formRecord.TYPE || 'F',
            currentRestFlag: formRecord.RESTFLAG || null
        };
    } catch (error) {
        // If we can't check FORMLIMITED, assume we don't know
        return { exists: false, hasAccess: false, error: error.message };
    }
}

/**
 * Create a helpful error message suggesting to enable API access
 * @param {string} entityName - Entity name
 * @param {string} formType - Form type (typically 'F')
 * @returns {object} Error response with suggestion
 */
export function createAPIAccessSuggestion(entityName, formType = 'F') {
    return {
        error: `Entity "${entityName}" is not accessible via Priority REST API`,
        reason: 'RESTFLAG is not set to "Y" in FORMLIMITED',
        suggestion: `Enable API access for "${entityName}" by setting RESTFLAG='Y' in FORMLIMITED`,
        solution: {
            tool: 'priority_config.restflag_update',
            args: {
                formName: entityName,
                restFlag: 'Y',
                formType: formType
            },
            description: `Use the priority_config.restflag_update tool to enable API access for this entity`
        }
    };
}

