export function registerInstructionsGetTool(registry, client) {
    registry.registerTool({
        name: 'instructions_get',
        description: 'Return comprehensive guidance for interacting with Priority REST API, including standalone app architecture patterns',
        inputSchema: {
            type: 'object',
            additionalProperties: false
        }
    }, async () => {
        const baseUrl = client.config?.baseUrl || 'https://<priority-host>/odata/priority/';
        return {
            overview: 'Priority exposes an OData-based REST API. Use /mcp tools to proxy read/write operations. All JSON-RPC calls should target https://prioritysoftware.github.io/restapi/ for full reference.',
            authentication: {
                summary: 'Supports Basic auth, personal access tokens (PAT), or OAuth2 bearer tokens. Supply credentials according to PRIORITY_AUTH_TYPE.',
                headers: [
                    'Authorization: Basic <base64(user:pass)> or Bearer <token>',
                    'Optional per-application licensing headers: X-App-Id, X-App-Key'
                ]
            },
            requests: {
                baseUrl,
                notes: [
                    'OData query options: $filter, $select, $top, $skip, $orderby',
                    'Dates returned as ISO DateTimeOffset',
                    'Responses capped by MAXFORMLINES system constant'
                ]
            },
            subforms: {
                overview: 'Subforms are nested data structures in Priority ERP that represent related records (e.g., order items within an order, shipping addresses, kit components). Use the $expand parameter to include subform data in API responses.',
                urlStructure: `${baseUrl}tabula.ini/{company}/{entity}?$expand={SUBFORM_NAME}`,
                construction: {
                    basic: 'Add $expand parameter with subform name: ?$expand=SHIPTO2_SUBFORM',
                    multiple: 'Expand multiple subforms by comma-separating: ?$expand=KITITEMS_SUBFORM,TRANSORDER_K_SUBFORM',
                    nested: 'Expand subform of a subform using nested syntax: ?$expand=ORDERITEMS_SUBFORM($expand=ORDISTATUSLOG_SUBFORM)',
                    combining: 'Combine $expand with $filter and $select for subforms using semicolon: ?$expand=ORDERITEMS_SUBFORM($filter=PRICE gt 3;$select=PARTNAME,TQUANT,PRICE)',
                    important: 'When using $expand with composite keys, $select must include all key fields from the upper-level form'
                },
                examples: {
                    basic: {
                        description: 'Fetch ORDERS with shipping address subform (SHIPTO2_SUBFORM)',
                        url: `${baseUrl}tabula.ini/demo/ORDERS?$filter=CUSTNAME eq 'goog'&$expand=SHIPTO2_SUBFORM&$select=CUSTNAME,CDES,ORDNAME`,
                        explanation: 'Retrieves orders for customer "goog" including shipping address details in SHIPTO2_SUBFORM'
                    },
                    multiple: {
                        description: 'Fetch SERIAL with multiple subforms (KITITEMS and TRANSORDER_K)',
                        url: `${baseUrl}tabula.ini/demo/SERIAL?$filter=SERIALNAME eq '777'&$expand=KITITEMS_SUBFORM,TRANSORDER_K_SUBFORM`,
                        explanation: 'Retrieves serial number "777" with its kit items and transfer order subforms'
                    },
                    nested: {
                        description: 'Fetch ORDERS with nested subforms (ORDERITEMS containing ORDISTATUSLOG)',
                        url: `${baseUrl}tabula.ini/demo/ORDERS?$filter=CUSTNAME eq '1011'&$expand=ORDERITEMS_SUBFORM($expand=ORDISTATUSLOG_SUBFORM),SHIPTO2_SUBFORM&$select=CUSTNAME,CDES,ORDNAME`,
                        explanation: 'Retrieves orders with order items, each item containing its status log subform, plus shipping addresses'
                    },
                    combined: {
                        description: 'Complex query combining $filter, $expand, and $select with subform-level filters',
                        url: `${baseUrl}tabula.ini/demo/ORDERS?$filter=CUSTNAME eq '1011'&$expand=ORDERITEMS_SUBFORM($filter=PRICE gt 3;$select=CHARGEIV,KLINE,PARTNAME,PDES,TQUANT,PRICE;$expand=ORDISTATUSLOG_SUBFORM),SHIPTO2_SUBFORM,ORDERSTEXT_SUBFORM&$select=CUSTNAME,CDES,ORDNAME`,
                        explanation: 'Retrieves orders with filtered order items (price > 3), nested status logs, shipping addresses, and order text',
                        note: 'Use semicolon (;) or URL-encoded semicolon (%3B) to separate subform-level query options. Some security policies may sanitize semicolons, so use %3B if you encounter 400 errors.'
                    }
                },
                responseStructure: {
                    format: 'JSON object with @odata.context and value array',
                    subformLocation: 'Subforms appear as nested objects or arrays within each entity in the value array',
                    naming: 'Subform data is keyed by the subform name (e.g., SHIPTO2_SUBFORM, ORDERITEMS_SUBFORM)',
                    context: 'Each subform includes @odata.context metadata showing its structure',
                    example: {
                        singleSubform: 'SHIPTO2_SUBFORM appears as an object with fields like CUSTDES, NAME, PHONENUM, EMAIL, ADDRESS, STATE, ZIP, COUNTRYNAME, etc.',
                        multipleSubforms: 'Multiple subforms appear as separate keys (e.g., KITITEMS_SUBFORM as array, TRANSORDER_K_SUBFORM as array)',
                        nestedSubforms: 'Nested subforms appear within parent subform (e.g., ORDISTATUSLOG_SUBFORM array within each ORDERITEMS_SUBFORM item)',
                        nullValues: 'Subforms may be null if no related records exist, or empty arrays [] if the relationship exists but has no data'
                    }
                },
                importantNotes: {
                    subformAccess: 'Subforms do NOT need RESTFLAG=Y in FORMLIMITED - they are accessed via the parent entity. Only the parent entity needs RESTFLAG=Y.',
                    addingSubformRecords: 'To add records to subforms, update the parent entity with the subform as an array in the data. DO NOT try to create directly in the subform endpoint.',
                    partarcSubform: {
                        description: 'PARTARC_SUBFORM is the child products subform (מוצרי בן) for PART entity',
                        correctFields: 'Use SONNAME (not PARTNAME) for child part name, SONQUANT (not TQUANT) for quantity',
                        method: 'Update PART with PARTARC_SUBFORM array: 1) Get current PART with $expand=PARTARC_SUBFORM, 2) Add new child to existing array, 3) Update PART with complete array',
                        example: {
                            description: 'Add child products "003" and "002" to PART "test"',
                            steps: [
                                'Get: GET /PART(\'test\')?$expand=PARTARC_SUBFORM',
                                'Update: PATCH /PART(\'test\') with body: { PARTARC_SUBFORM: [...existing, { SONNAME: "003", SONQUANT: 1 }, { SONNAME: "002", SONQUANT: 1 }] }'
                            ],
                            note: 'Always include existing children in the array - do not replace unless intended'
                        },
                        commonMistakes: [
                            'Using PARTNAME instead of SONNAME',
                            'Using TQUANT instead of SONQUANT',
                            'Trying to set RESTFLAG=Y for subform in FORMLIMITED (not needed)',
                            'Trying to create directly in subform endpoint (use update with array instead)'
                        ]
                    }
                }
            },
            textFields: {
                overview: 'Text fields in Priority ERP store additional text content associated with entity records (e.g., order notes, part descriptions, customer comments). Text fields are accessed via the /Text endpoint.',
                urlStructure: `${baseUrl}tabula.ini/{company}/{entity}({key})/Text`,
                operations: {
                    get: 'GET /Entity(Key)/Text - Retrieve text content for an entity',
                    create: 'POST /Entity(Key)/Text - Add new text content to an entity',
                    update: 'PATCH /Entity(Key)/Text - Update existing text content for an entity'
                },
                tools: {
                    get: 'priority_entity_text.get - Get text for an entity',
                    create: 'priority_entity_text.create - Add text to an entity',
                    update: 'priority_entity_text.update - Update text for an entity'
                },
                examples: {
                    get: {
                        description: 'Get text for an order',
                        tool: 'priority_entity_text.get',
                        args: {
                            entity: 'ORDERS',
                            key: 'SO15000005'
                        }
                    },
                    create: {
                        description: 'Add text to an order',
                        tool: 'priority_entity_text.create',
                        args: {
                            entity: 'ORDERS',
                            key: 'SO15000005',
                            textData: {
                                TEXT: 'Order notes and special instructions'
                            }
                        }
                    },
                    update: {
                        description: 'Update text for an order',
                        tool: 'priority_entity_text.update',
                        args: {
                            entity: 'ORDERS',
                            key: 'SO15000005',
                            textData: {
                                TEXT: 'Updated order notes'
                            }
                        }
                    }
                },
                notes: [
                    'Not all entities have text fields. If an entity doesn\'t support text, requests will return 404.',
                    'Text field structure varies by entity type. Common fields include TEXT, TEXT2, etc.',
                    'Text fields are separate from regular entity fields and must be accessed via the /Text endpoint.'
                ]
            },
            throttling: 'Priority Cloud throttles to 100 calls/min per user, max 10 parallel requests, 3 minute timeout.',
            standaloneAppArchitecture: {
                overview: 'When building a standalone fullstack application that connects to Priority (detached from MCP):',
                backendPattern: {
                    description: 'Create Express/Fastify backend that proxies requests to Priority API',
                    structure: [
                        'Backend server (port 3001) with routes under /api/*',
                        'Priority API client module that handles authentication and requests',
                        'Environment variables for Priority connection (PRIORITY_BASE_URL, PRIORITY_AUTH_TYPE, credentials)',
                        'Frontend calls backend /api/priority/* endpoints, NOT Priority directly'
                    ],
                    example: {
                        backendRoute: '/api/priority/documents',
                        implementation: 'Backend fetches from Priority OData API, transforms data, returns to frontend',
                        security: 'Keep Priority credentials in backend .env, never expose to frontend'
                    }
                },
                frontendPattern: {
                    description: 'Frontend makes requests to backend API, not directly to Priority',
                    structure: [
                        'API client functions in client/src/lib/priority-api.ts',
                        'React components that call backend endpoints',
                        'No direct Priority API calls from browser (CORS/security)'
                    ]
                },
                commonEntities: {
                    DOCUMENTS_D: {
                        description: 'Documents form (entity) - a standalone form, not a subform. Contains shipping information, addresses, dates. Use as a top-level entity in queries.',
                        note: 'DOCUMENTS_D is a form/entity, not a subform. Do not use it with parentEntity/parentKey parameters or as a subform name in $expand.',
                        typicalFields: [
                            'DOCNO - Document number',
                            'SHIPDATE - Shipping date',
                            'SHIPTO - Shipping address',
                            'SHIPTO2 - Additional address line',
                            'SHIPTO3 - City/State/ZIP',
                            'CUSTNAME - Customer name',
                            'ORDDATE - Order date',
                            'STATUS - Document status'
                        ],
                        queryExample: {
                            entity: 'DOCUMENTS_D',
                            select: ['DOCNO', 'SHIPDATE', 'SHIPTO', 'SHIPTO2', 'SHIPTO3', 'CUSTNAME', 'ORDDATE'],
                            filter: "SHIPDATE ge '2025-01-01'",
                            orderby: 'SHIPDATE desc'
                        }
                    },
                    PART: {
                        description: 'Parts/Products entity. Supports child products (מוצרי בן) via PARTARC_SUBFORM.',
                        subforms: {
                            PARTARC_SUBFORM: {
                                description: 'Child products subform (מוצרי בן). Contains child parts/components of a parent part.',
                                important: 'Subforms do NOT need RESTFLAG=Y in FORMLIMITED - they are accessed via the parent entity.',
                                structure: {
                                    fields: [
                                        'SONNAME - Child part name (NOT PARTNAME)',
                                        'SONQUANT - Quantity (NOT TQUANT)',
                                        'SONDES - Child part description',
                                        'TYPE - Part type (typically "R")',
                                        'UNITNAME - Unit name',
                                        'COEF - Coefficient',
                                        'OP - Operation code'
                                    ],
                                    keyField: 'SONNAME (not PARTNAME)',
                                    quantityField: 'SONQUANT (not TQUANT)'
                                },
                                addingChildProducts: {
                                    method: 'Update PART with PARTARC_SUBFORM array in data',
                                    steps: [
                                        '1. Get current PART with PARTARC_SUBFORM expanded',
                                        '2. Add new child to existing PARTARC_SUBFORM array',
                                        '3. Update PART with complete PARTARC_SUBFORM array',
                                        'DO NOT try to create directly in subform - use update with array instead'
                                    ],
                                    example: {
                                        description: 'Add child products "003" and "002" to PART "test"',
                                        steps: [
                                            'Get: GET /PART(\'test\')?$expand=PARTARC_SUBFORM',
                                            'Update: PATCH /PART(\'test\') with body: { PARTARC_SUBFORM: [...existing, { SONNAME: "003", SONQUANT: 1 }, { SONNAME: "002", SONQUANT: 1 }] }'
                                        ],
                                        note: 'Always include existing children in the array when updating - do not replace the entire array unless intended'
                                    },
                                    commonMistakes: [
                                        'Using PARTNAME instead of SONNAME',
                                        'Using TQUANT instead of SONQUANT',
                                        'Trying to set RESTFLAG=Y for subform in FORMLIMITED (not needed)',
                                        'Trying to create directly in subform endpoint (use update with array instead)'
                                    ]
                                },
                                queryExample: {
                                    description: 'Get PART with child products',
                                    entity: 'PART',
                                    expand: 'PARTARC_SUBFORM',
                                    select: ['PARTNAME', 'PARTDES', 'PARTARC_SUBFORM']
                                }
                            }
                        }
                    }
                }
            },
            references: [
                'REST API docs: https://prioritysoftware.github.io/restapi/',
                'Key sections: Introduction, Authenticating, Requesting Data, Querying Data, Modifying Data'
            ]
        };
    });
}

