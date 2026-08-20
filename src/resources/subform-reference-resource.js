export function registerSubformReferenceResource(registry, client) {
    registry.registerResource('priority://subforms/reference', {
        name: 'Subform Reference',
        description: 'Comprehensive reference guide for Priority subforms including structure, operations, and examples',
        mimeType: 'application/json',
        handler: async () => {
            const baseUrl = client.config?.baseUrl || 'https://<priority-host>/odata/Priority/tabula.ini/demo/';

            const reference = {
                lastUpdated: new Date().toISOString(),
                overview: 'Subforms in Priority ERP represent related records (child records) that belong to a parent entity. They are accessed via the parent entity using $expand.',
                importantNotes: [
                    'Subforms do NOT need RESTFLAG=Y in FORMLIMITED - only the parent entity needs it',
                    'Subforms are accessed via the parent entity, not as standalone entities',
                    'To add records to subforms, update the parent entity with the subform as an array',
                    'When updating subforms, you must include ALL existing records plus new ones',
                    'Subforms appear as nested objects or arrays in API responses'
                ],
                commonSubforms: {
                    ORDERITEMS_SUBFORM: {
                        parentEntity: 'ORDERS',
                        description: 'Line items in an order',
                        commonFields: [
                            'KLINE - Line number',
                            'PARTNAME - Part/product name',
                            'PDES - Part description',
                            'TQUANT - Quantity',
                            'PRICE - Unit price',
                            'CHARGEIV - Charge IV',
                            'ORDISTATUSLOG_SUBFORM - Nested subform for status history'
                        ],
                        operations: {
                            query: {
                                description: 'Get order with items',
                                example: {
                                    entity: 'ORDERS',
                                    expand: 'ORDERITEMS_SUBFORM',
                                    select: ['ORDNAME', 'ORDDATE', 'ORDERITEMS_SUBFORM']
                                }
                            },
                            add: {
                                description: 'Add item to order',
                                steps: [
                                    '1. Get current order with ORDERITEMS_SUBFORM expanded',
                                    '2. Add new item to existing ORDERITEMS_SUBFORM array',
                                    '3. Update order with complete array'
                                ],
                                example: {
                                    note: 'Update ORDERS with ORDERITEMS_SUBFORM array including existing + new items'
                                }
                            }
                        },
                        nestedSubforms: ['ORDISTATUSLOG_SUBFORM']
                    },
                    SHIPTO2_SUBFORM: {
                        parentEntity: 'ORDERS, CUSTOMERS',
                        description: 'Shipping addresses',
                        commonFields: [
                            'CUSTDES - Customer description',
                            'NAME - Contact name',
                            'PHONENUM - Phone number',
                            'EMAIL - Email address',
                            'ADDRESS - Street address',
                            'STATE - State/province',
                            'ZIP - ZIP/postal code',
                            'COUNTRYNAME - Country name'
                        ],
                        operations: {
                            query: {
                                description: 'Get entity with shipping addresses',
                                example: {
                                    entity: 'ORDERS',
                                    expand: 'SHIPTO2_SUBFORM',
                                    select: ['ORDNAME', 'SHIPTO2_SUBFORM']
                                }
                            }
                        }
                    },
                    PARTARC_SUBFORM: {
                        parentEntity: 'PART',
                        description: 'Child products (מוצרי בן) - components or child parts of a parent part',
                        important: 'This is the child products subform for PART entity',
                        commonFields: [
                            'SONNAME - Child part name (NOT PARTNAME)',
                            'SONQUANT - Quantity (NOT TQUANT)',
                            'SONDES - Child part description',
                            'TYPE - Part type (typically "R")',
                            'UNITNAME - Unit name',
                            'COEF - Coefficient',
                            'OP - Operation code'
                        ],
                        operations: {
                            query: {
                                description: 'Get part with child products',
                                example: {
                                    entity: 'PART',
                                    expand: 'PARTARC_SUBFORM',
                                    select: ['PARTNAME', 'PARTDES', 'PARTARC_SUBFORM']
                                }
                            },
                            add: {
                                description: 'Add child products to part',
                                steps: [
                                    '1. Get current PART with PARTARC_SUBFORM expanded',
                                    '2. Add new child to existing PARTARC_SUBFORM array',
                                    '3. Update PART with complete PARTARC_SUBFORM array'
                                ],
                                warning: 'Always include existing children in the array - do not replace unless intended',
                                commonMistakes: [
                                    'Using PARTNAME instead of SONNAME',
                                    'Using TQUANT instead of SONQUANT',
                                    'Trying to set RESTFLAG=Y for subform in FORMLIMITED (not needed)',
                                    'Trying to create directly in subform endpoint (use update with array instead)'
                                ]
                            }
                        }
                    },
                    KITITEMS_SUBFORM: {
                        parentEntity: 'SERIAL',
                        description: 'Kit items in a serial number',
                        commonFields: [
                            'PARTNAME - Part name',
                            'TQUANT - Quantity',
                            'PDES - Part description'
                        ],
                        operations: {
                            query: {
                                description: 'Get serial with kit items',
                                example: {
                                    entity: 'SERIAL',
                                    expand: 'KITITEMS_SUBFORM',
                                    select: ['SERIALNAME', 'KITITEMS_SUBFORM']
                                }
                            }
                        }
                    },
                    TRANSORDER_K_SUBFORM: {
                        parentEntity: 'SERIAL',
                        description: 'Transfer orders for serial number',
                        commonFields: [
                            'ORDNAME - Order name',
                            'ORDDATE - Order date',
                            'STATUS - Status'
                        ],
                        operations: {
                            query: {
                                description: 'Get serial with transfer orders',
                                example: {
                                    entity: 'SERIAL',
                                    expand: 'TRANSORDER_K_SUBFORM',
                                    select: ['SERIALNAME', 'TRANSORDER_K_SUBFORM']
                                }
                            }
                        }
                    },
                    ORDERSTEXT_SUBFORM: {
                        parentEntity: 'ORDERS',
                        description: 'Order text/notes',
                        commonFields: [
                            'TEXT - Text content',
                            'TEXT2 - Additional text'
                        ],
                        operations: {
                            query: {
                                description: 'Get order with text',
                                example: {
                                    entity: 'ORDERS',
                                    expand: 'ORDERSTEXT_SUBFORM',
                                    select: ['ORDNAME', 'ORDERSTEXT_SUBFORM']
                                }
                            }
                        }
                    },
                    INVOICEITEMS_SUBFORM: {
                        parentEntity: 'INVOICES',
                        description: 'Invoice line items',
                        commonFields: [
                            'KLINE - Line number',
                            'PARTNAME - Part name',
                            'TQUANT - Quantity',
                            'PRICE - Unit price'
                        ],
                        operations: {
                            query: {
                                description: 'Get invoice with items',
                                example: {
                                    entity: 'INVOICES',
                                    expand: 'INVOICEITEMS_SUBFORM',
                                    select: ['INVNAME', 'INVOICEITEMS_SUBFORM']
                                }
                            }
                        }
                    }
                },
                queryPatterns: {
                    singleSubform: {
                        description: 'Expand a single subform',
                        example: {
                            url: `${baseUrl}ORDERS?$expand=ORDERITEMS_SUBFORM`,
                            toolCall: {
                                entity: 'ORDERS',
                                expand: 'ORDERITEMS_SUBFORM'
                            }
                        }
                    },
                    multipleSubforms: {
                        description: 'Expand multiple subforms',
                        example: {
                            url: `${baseUrl}ORDERS?$expand=ORDERITEMS_SUBFORM,SHIPTO2_SUBFORM`,
                            toolCall: {
                                entity: 'ORDERS',
                                expand: 'ORDERITEMS_SUBFORM,SHIPTO2_SUBFORM'
                            }
                        }
                    },
                    nestedSubforms: {
                        description: 'Expand nested subforms (subform of a subform)',
                        example: {
                            url: `${baseUrl}ORDERS?$expand=ORDERITEMS_SUBFORM($expand=ORDISTATUSLOG_SUBFORM)`,
                            toolCall: {
                                entity: 'ORDERS',
                                expand: 'ORDERITEMS_SUBFORM($expand=ORDISTATUSLOG_SUBFORM)'
                            }
                        }
                    },
                    withFilter: {
                        description: 'Filter subform data',
                        example: {
                            url: `${baseUrl}ORDERS?$expand=ORDERITEMS_SUBFORM($filter=PRICE gt 3)`,
                            toolCall: {
                                entity: 'ORDERS',
                                expand: 'ORDERITEMS_SUBFORM($filter=PRICE gt 3)'
                            }
                        }
                    },
                    withSelect: {
                        description: 'Select specific subform fields',
                        example: {
                            url: `${baseUrl}ORDERS?$expand=ORDERITEMS_SUBFORM($select=PARTNAME,TQUANT,PRICE)`,
                            toolCall: {
                                entity: 'ORDERS',
                                expand: 'ORDERITEMS_SUBFORM($select=PARTNAME,TQUANT,PRICE)'
                            }
                        }
                    }
                },
                updatePatterns: {
                    addToSubform: {
                        description: 'Add records to a subform',
                        steps: [
                            '1. Get parent entity with subform expanded',
                            '2. Add new record(s) to existing subform array',
                            '3. Update parent entity with complete subform array'
                        ],
                        warning: 'Must include ALL existing subform records - otherwise they will be deleted!'
                    },
                    updateSubform: {
                        description: 'Update existing subform records',
                        steps: [
                            '1. Get parent entity with subform expanded',
                            '2. Modify the subform array (update existing records)',
                            '3. Update parent entity with modified subform array'
                        ]
                    },
                    replaceSubform: {
                        description: 'Replace entire subform (use with caution)',
                        steps: [
                            '1. Create new subform array with desired records',
                            '2. Update parent entity with new array'
                        ],
                        warning: 'This will DELETE all existing subform records!'
                    }
                }
            };

            return {
                contents: [
                    {
                        uri: 'priority://subforms/reference',
                        mimeType: 'application/json',
                        text: JSON.stringify(reference, null, 2)
                    }
                ]
            };
        }
    });
}


