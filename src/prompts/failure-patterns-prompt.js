export function registerFailurePatternsPrompt(registry, client) {
    registry.registerPrompt({
        name: 'known_failure_patterns',
        description: 'Documents known OData query failures and their workarounds: contains()/startswith() on EPROG.ENAME and EREP.ENAME return 501 (use eq() only), $expand=FORMHELP on EFORM returns 400 (use WebSDK priority_get_subform_data), subform entities (PORDERITEMS_SUBFORM, ORDERITEMS_SUBFORM, etc.) return 404 as standalone (use $expand on parent), GET /ENTITY/$count returns 500 (use $top=0&$count=true), entity_get requires key or lookup (keyless returns -32602). For entities not REST-enabled, fall back to WebSDK priority_get_form_data.',
        arguments: [
            {
                name: 'entity',
                description: 'Entity name to check known failures for',
                required: false
            }
        ],
    }, async (args) => {
            const entity = args.entity || 'any entity';

            const failurePatterns = {
                EPROG: "EPROG: contains()/startswith() on ENAME returns 501. Use eq(ENAME) for exact match only.",
                EREP: "EREP: contains()/startswith() on ENAME returns 501. Use eq(ENAME) for exact match only.",
                EFORM: "EFORM: $expand=FORMHELP returns 400. Use WebSDK priority_get_subform_data(formName:'EFORM',recordKey:'ENAME',subformName:'FORMHELP').",
                PORDERITEMS_SUBFORM: "PORDERITEMS_SUBFORM: 404 as standalone query. Use $expand=PORDERITEMS_SUBFORM on PORDERS parent entity, or WebSDK priority_get_subform_data.",
                ORDERITEMS_SUBFORM: "ORDERITEMS_SUBFORM: 404 as standalone query. Use $expand=ORDERITEMS_SUBFORM on ORDERS parent entity, or WebSDK priority_get_subform_data.",
                PINVOICEITEMS_SUBFORM: "PINVOICEITEMS_SUBFORM: 404 as standalone query. Use $expand on PINVOICES parent entity.",
                YINVOICEITEMS_SUBFORM: "YINVOICEITEMS_SUBFORM: 404 as standalone query. Use $expand on YINVOICES parent entity.",
                CINVOICEITEMS_SUBFORM: "CINVOICEITEMS_SUBFORM: 404 as standalone query. Use $expand on CINVOICES parent entity.",
                SUPPERSONNEL_SUBFORM: "SUPPERSONNEL_SUBFORM: 404 as standalone query. Use $expand on SUPPLIERS parent entity.",
                CUSTPERSONNEL_SUBFORM: "CUSTPERSONNEL_SUBFORM: 404 as standalone query. Use $expand on CUSTOMERS parent entity.",
                CURRHIS_SUBFORM: "CURRHIS_SUBFORM: 404 as standalone query. Use $expand on CURRENCIES parent entity.",
                USERPRIV_SUBFORM: "USERPRIV_SUBFORM: 404 as standalone query. Use $expand on USERS parent entity.",
            };

            const specific = failurePatterns[entity] || `No specific known failure for ${entity}.`;
            const general = [
                "NEVER use GET /ENTITY/$count (returns 500). Use $top=0&$count=true instead.",
                "entity_get REQUIRES key or lookup parameter. Keyless retrieval returns error -32602. Use query_run for listing.",
                "batch_operations may hang/timeout if FK references don't exist. Validate FKs first.",
                "For entities NOT REST-enabled (RESTFLAG≠Y in FORMLIMITED), fall back to WebSDK: priority_get_form_data(formName:'ENTITY').",
                "93 entities are REST-enabled. See FORMLIMITED for the authoritative list.",
                "Full docs: .cursor/rules/priority-odata-known-failures.mdc"
            ];

            const messages = [`## Known Failure Patterns for ${entity}\n`, specific, '', '## General Rules\n', ...general.map(r => `- ${r}`)];

            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: messages.join('\n')
                        }
                    }
                ]
            };
    });
}
