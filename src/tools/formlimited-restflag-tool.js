export function registerFormLimitedRestFlagTool(registry, client) {
    registry.registerTool({
        name: 'config_restflag_update',
        description: 'Update RESTFLAG in FORMLIMITED to enable/disable REST API access for a specific form. FORMLIMITED uses a composite key (ENAME + TYPE). Args: { formName: string, restFlag: string, formType?: string }',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['formName', 'restFlag'],
            properties: {
                formName: {
                    type: 'string',
                    description: 'Form name (ENAME field in FORMLIMITED, e.g., "WAREHOUSES", "WARHSBAL")'
                },
                restFlag: {
                    type: 'string',
                    enum: ['Y', 'N'],
                    description: 'Set RESTFLAG to "Y" to enable API access, "N" to disable'
                },
                formType: {
                    type: 'string',
                    description: 'Form type (TYPE field in FORMLIMITED, typically "F" for forms). Default: "F"',
                    default: 'F'
                }
            }
        }
    }, async (args) => {
        if (!args?.formName || !args?.restFlag) {
            throw new Error('Args required: { formName, restFlag }');
        }

        const formName = String(args.formName);
        const restFlag = String(args.restFlag).toUpperCase();
        const formType = String(args.formType || 'F');

        if (restFlag !== 'Y' && restFlag !== 'N') {
            throw new Error('restFlag must be "Y" or "N"');
        }

        // First, verify the form exists in FORMLIMITED
        try {
            const checkResult = await client.runQuery('FORMLIMITED', {
                filter: `ENAME eq '${formName}' and TYPE eq '${formType}'`,
                select: ['ENAME', 'RESTFLAG', 'TYPE']
            });

            if (!checkResult || !checkResult.value || checkResult.value.length === 0) {
                return {
                    error: `Form "${formName}" with TYPE="${formType}" not found in FORMLIMITED`,
                    suggestion: 'Use priority_query.run to list all forms in FORMLIMITED'
                };
            }

            const currentRecord = checkResult.value[0];
            const currentRestFlag = currentRecord.RESTFLAG || 'null';

            // Update using composite key: ENAME='formName',TYPE='formType'
            const compositeKey = `ENAME='${formName}',TYPE='${formType}'`;
            const updateResult = await client.updateEntity('FORMLIMITED', compositeKey, {
                RESTFLAG: restFlag
            });

            // Verify the update
            const verifyResult = await client.runQuery('FORMLIMITED', {
                filter: `ENAME eq '${formName}' and TYPE eq '${formType}'`,
                select: ['ENAME', 'RESTFLAG', 'TYPE', 'USERLOGIN', 'UDATE']
            });

            return {
                success: true,
                formName: formName,
                formType: formType,
                previousRestFlag: currentRestFlag,
                newRestFlag: restFlag,
                updated: updateResult,
                verification: verifyResult.value && verifyResult.value[0] ? {
                    ENAME: verifyResult.value[0].ENAME,
                    RESTFLAG: verifyResult.value[0].RESTFLAG,
                    TYPE: verifyResult.value[0].TYPE,
                    USERLOGIN: verifyResult.value[0].USERLOGIN,
                    UDATE: verifyResult.value[0].UDATE
                } : null,
                note: restFlag === 'Y' 
                    ? `Form "${formName}" is now accessible via Priority REST API`
                    : `Form "${formName}" is now disabled for Priority REST API access`
            };
        } catch (error) {
            return {
                error: `Failed to update FORMLIMITED RESTFLAG for "${formName}": ${error.message}`,
                formName: formName,
                formType: formType,
                restFlag: restFlag,
                suggestion: 'Verify the form exists in FORMLIMITED and that you have permissions to update it'
            };
        }
    });
}

