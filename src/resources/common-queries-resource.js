export function registerCommonQueriesResource(registry, client) {
    registry.registerResource('priority://queries/common', {
        name: 'Common Queries Library',
        description: 'Collection of common query patterns and examples for Priority ERP entities',
        mimeType: 'application/json',
        handler: async () => {
            const baseUrl = client.config?.baseUrl || 'https://<priority-host>/odata/Priority/tabula.ini/demo/';

            const queries = {
                lastUpdated: new Date().toISOString(),
                categories: {
                    orders: {
                        name: 'Order Queries',
                        description: 'Common queries for ORDERS entity',
                        examples: [
                            {
                                name: 'Recent Orders',
                                description: 'Get orders from the last 30 days',
                                query: {
                                    entity: 'ORDERS',
                                    filter: "CURDATE ge " + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '+00:00'),
                                    orderby: 'CURDATE desc',
                                    top: 50
                                },
                                toolCall: {
                                    entity: 'ORDERS',
                                    filter: `CURDATE ge ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '+00:00')}`,
                                    orderby: 'CURDATE desc',
                                    top: 50
                                },
                                notes: [
                                    'Uses CURDATE (primary date field for ORDERS)',
                                    'Date filter uses ISO 8601 with timezone offset (+00:00)',
                                    'Always validate returned results fall within the date range'
                                ]
                            },
                            {
                                name: 'Orders by Customer',
                                description: 'Get all orders for a specific customer',
                                query: {
                                    entity: 'ORDERS',
                                    filter: "CUSTNAME eq 'CUSTOMER123'",
                                    expand: 'ORDERITEMS_SUBFORM',
                                    select: ['ORDNAME', 'CURDATE', 'CDES', 'TOTPRICE']
                                },
                                toolCall: {
                                    entity: 'ORDERS',
                                    filter: "CUSTNAME eq 'CUSTOMER123'",
                                    expand: 'ORDERITEMS_SUBFORM',
                                    select: ['ORDNAME', 'CURDATE', 'CDES', 'TOTPRICE']
                                },
                                notes: [
                                    'Uses CURDATE (primary date field for ORDERS)',
                                    'ORDDATE should only be used if explicitly documented in entity schema'
                                ]
                            },
                            {
                                name: 'All Orders with Items',
                                description: 'Get all orders with their complete order items subform data, sorted by date',
                                query: {
                                    entity: 'ORDERS',
                                    expand: 'ORDERITEMS_SUBFORM',
                                    orderby: 'CURDATE desc',
                                    select: ['ORDNAME', 'CUSTNAME', 'CDES', 'CURDATE', 'ORDSTATUSDES', 'TOTPRICE', 'CODE', 'DOERNAME', 'STATUSDATE']
                                },
                                toolCall: {
                                    entity: 'ORDERS',
                                    expand: 'ORDERITEMS_SUBFORM',
                                    orderby: 'CURDATE desc',
                                    select: ['ORDNAME', 'CUSTNAME', 'CDES', 'CURDATE', 'ORDSTATUSDES', 'TOTPRICE', 'CODE', 'DOERNAME', 'STATUSDATE']
                                },
                                notes: [
                                    'This query retrieves all orders with their ORDERITEMS_SUBFORM expanded, showing complete line item details',
                                    'ORDERITEMS_SUBFORM contains: PARTNAME, PDES, TQUANT, PRICE, VATPRICE, PURCHASEPRICE, QPROFIT, DUEDATE, CLOSEDBOOL, and many more fields',
                                    'Results are sorted by CURDATE (order date) descending, showing newest orders first',
                                    'Each order includes all its line items with pricing, quantities, profit margins, and status information',
                                    'Use $top parameter to limit results if you have many orders'
                                ],
                                exampleResult: {
                                    order: {
                                        ORDNAME: 'SO25000001',
                                        CUSTNAME: '1002',
                                        CDES: 'Customer Description',
                                        CURDATE: '2025-12-01T00:00:00+02:00',
                                        ORDSTATUSDES: 'Active',
                                        TOTPRICE: 0,
                                        CODE: 'USD',
                                        DOERNAME: 'demo-user'
                                    },
                                    items: {
                                        ORDERITEMS_SUBFORM: [
                                            {
                                                PARTNAME: 'PART-001',
                                                PDES: 'Sample Part Description',
                                                TQUANT: 50,
                                                PRICE: 0,
                                                VATPRICE: 0,
                                                QPROFIT: 0,
                                                DUEDATE: '2025-12-01T00:00:00+02:00'
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                name: 'Orders by Year',
                                description: 'Get all orders from a specific year (e.g., 2025) with items',
                                query: {
                                    entity: 'ORDERS',
                                    filter: "(CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)",
                                    expand: 'ORDERITEMS_SUBFORM',
                                    orderby: 'CURDATE desc',
                                    select: ['ORDNAME', 'CUSTNAME', 'CDES', 'CURDATE', 'ORDSTATUSDES', 'TOTPRICE', 'CODE', 'DOERNAME', 'STATUSDATE']
                                },
                                toolCall: {
                                    entity: 'ORDERS',
                                    filter: "(CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)",
                                    expand: 'ORDERITEMS_SUBFORM',
                                    orderby: 'CURDATE desc',
                                    select: ['ORDNAME', 'CUSTNAME', 'CDES', 'CURDATE', 'ORDSTATUSDES', 'TOTPRICE', 'CODE', 'DOERNAME', 'STATUSDATE']
                                },
                                notes: [
                                    '⚠️ CRITICAL: Year-based queries MUST be translated to full-day time range',
                                    'Pattern: (CURDATE ge YYYY-01-01T00:00:01+TZ) and (CURDATE lt YYYY+1-01-01T00:00:00+TZ)',
                                    'Uses CURDATE (primary date field for ORDERS)',
                                    'Always use offset-aware datetimes with timezone (e.g., +00:00 or +02:00)',
                                    'DO NOT use: year(CURDATE) eq 2025, cast(...), or date-only strings',
                                    'Post-query validation: Verify all returned CURDATE values are within 2025',
                                    'The ORDERITEMS_SUBFORM contains all line items with details like PARTNAME, PDES, TQUANT, PRICE, VATPRICE, etc.'
                                ],
                                exampleResult: {
                                    order: {
                                        ORDNAME: 'SO25000001',
                                        CUSTNAME: '1002',
                                        CDES: 'Customer Description',
                                        CURDATE: '2025-12-01T00:00:00+02:00',
                                        ORDSTATUSDES: 'Active',
                                        TOTPRICE: 0,
                                        CODE: 'USD'
                                    },
                                    items: {
                                        ORDERITEMS_SUBFORM: 'Array of line items with PARTNAME, TQUANT, PRICE, etc.'
                                    }
                                }
                            }
                        ]
                    },
                    customers: {
                        name: 'Customer Queries',
                        description: 'Common queries for CUSTOMERS entity',
                        examples: [
                            {
                                name: 'All Customers',
                                description: 'Get list of all customers',
                                query: {
                                    entity: 'CUSTOMERS',
                                    select: ['CUSTNAME', 'CUSTDES', 'EMAIL', 'PHONE'],
                                    orderby: 'CUSTNAME asc'
                                },
                                toolCall: {
                                    entity: 'CUSTOMERS',
                                    select: ['CUSTNAME', 'CUSTDES', 'EMAIL', 'PHONE'],
                                    orderby: 'CUSTNAME asc'
                                }
                            },
                            {
                                name: 'Customers with Shipping Addresses',
                                description: 'Get customers with their shipping addresses',
                                query: {
                                    entity: 'CUSTOMERS',
                                    expand: 'SHIPTO2_SUBFORM',
                                    select: ['CUSTNAME', 'CUSTDES', 'SHIPTO2_SUBFORM']
                                },
                                toolCall: {
                                    entity: 'CUSTOMERS',
                                    expand: 'SHIPTO2_SUBFORM',
                                    select: ['CUSTNAME', 'CUSTDES']
                                }
                            }
                        ]
                    },
                    inventory: {
                        name: 'Inventory Queries',
                        description: 'Common queries for inventory and warehouse balance',
                        examples: [
                            {
                                name: 'Warehouse Balance',
                                description: 'Get inventory levels for a specific part',
                                query: {
                                    entity: 'WARHSBAL',
                                    filter: "PARTNAME eq 'PART123'",
                                    select: ['PARTNAME', 'WARHSNAME', 'BALANCE', 'ONORDER']
                                },
                                toolCall: {
                                    entity: 'WARHSBAL',
                                    filter: "PARTNAME eq 'PART123'",
                                    select: ['PARTNAME', 'WARHSNAME', 'BALANCE', 'ONORDER']
                                }
                            },
                            {
                                name: 'Low Stock Items',
                                description: 'Find parts with low inventory',
                                query: {
                                    entity: 'WARHSBAL',
                                    filter: "BALANCE lt 10",
                                    orderby: 'BALANCE asc'
                                },
                                toolCall: {
                                    entity: 'WARHSBAL',
                                    filter: "BALANCE lt 10",
                                    orderby: 'BALANCE asc'
                                }
                            }
                        ]
                    },
                    parts: {
                        name: 'Part/Product Queries',
                        description: 'Common queries for PART entity',
                        examples: [
                            {
                                name: 'Part with Child Products',
                                description: 'Get part with its child products (מוצרי בן)',
                                query: {
                                    entity: 'PART',
                                    expand: 'PARTARC_SUBFORM',
                                    select: ['PARTNAME', 'PARTDES', 'PARTARC_SUBFORM']
                                },
                                toolCall: {
                                    entity: 'PART',
                                    expand: 'PARTARC_SUBFORM',
                                    select: ['PARTNAME', 'PARTDES']
                                }
                            },
                            {
                                name: 'Parts by Description',
                                description: 'Search parts by description',
                                query: {
                                    entity: 'PART',
                                    filter: "PARTDES contains 'widget'",
                                    select: ['PARTNAME', 'PARTDES', 'FAMILYDES']
                                },
                                toolCall: {
                                    entity: 'PART',
                                    filter: "PARTDES contains 'widget'",
                                    select: ['PARTNAME', 'PARTDES', 'FAMILYDES']
                                }
                            }
                        ]
                    },
                    documents: {
                        name: 'Document Queries',
                        description: 'Common queries for DOCUMENTS_D entity',
                        examples: [
                            {
                                name: 'Shipping Documents',
                                description: 'Get shipping documents for a date range',
                                query: {
                                    entity: 'DOCUMENTS_D',
                                    filter: "SHIPDATE ge 2025-01-01T00:00:01+00:00 and SHIPDATE le 2025-12-31T23:59:59+00:00",
                                    select: ['DOCNO', 'SHIPDATE', 'SHIPTO', 'SHIPTO2', 'SHIPTO3', 'CUSTNAME'],
                                    orderby: 'SHIPDATE desc'
                                },
                                toolCall: {
                                    entity: 'DOCUMENTS_D',
                                    filter: "SHIPDATE ge 2025-01-01T00:00:01+00:00 and SHIPDATE le 2025-12-31T23:59:59+00:00",
                                    select: ['DOCNO', 'SHIPDATE', 'SHIPTO', 'SHIPTO2', 'SHIPTO3', 'CUSTNAME'],
                                    orderby: 'SHIPDATE desc'
                                },
                                notes: [
                                    'Uses offset-aware datetimes with timezone (+00:00)',
                                    'DO NOT use date-only strings - always include time and timezone',
                                    'Always validate returned results fall within the date range'
                                ]
                            },
                            {
                                name: 'Documents by Customer',
                                description: 'Get all documents for a customer',
                                query: {
                                    entity: 'DOCUMENTS_D',
                                    filter: "CUSTNAME eq 'CUSTOMER123'",
                                    select: ['DOCNO', 'ORDDATE', 'SHIPDATE', 'STATUS'],
                                    orderby: 'ORDDATE desc'
                                },
                                toolCall: {
                                    entity: 'DOCUMENTS_D',
                                    filter: "CUSTNAME eq 'CUSTOMER123'",
                                    select: ['DOCNO', 'ORDDATE', 'SHIPDATE', 'STATUS'],
                                    orderby: 'ORDDATE desc'
                                }
                            }
                        ]
                    },
                    users: {
                        name: 'User Queries',
                        description: 'Common queries for USERS entity',
                        examples: [
                            {
                                name: 'User by Login with All Subforms',
                                description: 'Get user data including all subforms (privileges, printers, profiles, groups, change log)',
                                query: {
                                    entity: 'USERS',
                                    filter: "USERLOGIN eq 'demo-user'",
                                    expand: '*',
                                    select: ['USERLOGIN', 'USERNAME', 'SNAME', 'USERID', 'GROUPNAME', 'BUSERID', 'USER']
                                },
                                toolCall: {
                                    entity: 'USERS',
                                    filter: "USERLOGIN eq 'demo-user'",
                                    expand: '*',
                                    select: ['USERLOGIN', 'USERNAME', 'SNAME', 'USERID', 'GROUPNAME', 'BUSERID', 'USER']
                                },
                                notes: [
                                    'Use expand: "*" to get all available subforms automatically',
                                    'Subforms include: USERPRIV_SUBFORM (privileges), USERPRINTERS_SUBFORM, USERPROFILES_SUBFORM, USERGROUPS_SUBFORM, USERENVGROUPS_SUBFORM, CHANGES_LOG_SUBFORM',
                                    'USERPRIV_SUBFORM contains important fields like EMAIL, WINDOWSLOGIN, SQLFLAG, REST (REST API access), ACTIVE status, etc.',
                                    'CHANGES_LOG_SUBFORM shows the history of changes to the user record'
                                ],
                                exampleResult: {
                                    user: {
                                        USERLOGIN: 'demo-user',
                                        USERNAME: 'Demo User',
                                        SNAME: 'Demo User',
                                        USERID: 1
                                    },
                                    subforms: {
                                        USERPRIV_SUBFORM: 'Contains privileges, email, REST API access flag',
                                        CHANGES_LOG_SUBFORM: 'Contains change history with dates and fields changed'
                                    }
                                }
                            },
                            {
                                name: 'List All Users',
                                description: 'Get list of all users with basic information',
                                query: {
                                    entity: 'USERS',
                                    select: ['USERLOGIN', 'USERNAME', 'SNAME', 'USERID'],
                                    orderby: 'USERLOGIN asc'
                                },
                                toolCall: {
                                    entity: 'USERS',
                                    select: ['USERLOGIN', 'USERNAME', 'SNAME', 'USERID'],
                                    orderby: 'USERLOGIN asc'
                                }
                            }
                        ]
                    }
                },
                tips: [
                    'Use $filter for filtering records',
                    'Use $select to limit returned fields (improves performance)',
                    'Use $expand to include related subform data',
                    'Use $orderby to sort results',
                    'Use $top to limit the number of results',
                    'String comparisons are case-sensitive',
                    'Use \'and\', \'or\', \'not\' for logical operations',
                    'Subforms don\'t need RESTFLAG=Y - only parent entity needs it'
                ],
                dateHandlingRules: {
                    primaryDateField: {
                        rule: 'For 99% of Priority entities, including ORDERS: Primary date field is CURDATE',
                        note: 'Use ORDDATE only if explicitly documented in entity schema or validated via Entity Schema resource'
                    },
                    yearBasedQueries: {
                        rule: 'Year-based queries MUST be translated to a full-day time range',
                        pattern: '(CURDATE ge YYYY-01-01T00:00:01+TZ) and (CURDATE lt YYYY+1-01-01T00:00:00+TZ)',
                        example: 'For year 2025: (CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)'
                    },
                    forbiddenFormats: [
                        'cast(...) - Not supported',
                        'datetime prefix format (e.g., datetime\'2025-01-01\') - Invalid format',
                        'Date-only strings (e.g., "2025-01-01") - Missing timezone',
                        'String comparisons against Edm.DateTimeOffset'
                    ],
                    requiredFormat: {
                        rule: 'Always use offset-aware datetimes',
                        example: '2025-01-01T00:00:01+02:00',
                        note: 'Normalize all comparisons to the same timezone. Never compare offset-aware with offset-naive datetimes'
                    },
                    postQueryValidation: {
                        rule: 'After receiving results, validate all records fall within requested date range',
                        action: 'If mismatch detected, report via planner_metadata. Do NOT silently trim results'
                    },
                    fallbackPolicy: {
                        rule: 'If OData rejects the filter, retry only with documented formats',
                        action: 'If still rejected, return a clear MCP error. Do NOT fallback to unfiltered $top queries unless explicitly allowed'
                    },
                    logging: {
                        required: [
                            'Chosen date field',
                            'Final $filter string',
                            'Timezone used',
                            'Validation summary'
                        ]
                    }
                }
            };

            return {
                contents: [
                    {
                        uri: 'priority://queries/common',
                        mimeType: 'application/json',
                        text: JSON.stringify(queries, null, 2)
                    }
                ]
            };
        }
    });
}


