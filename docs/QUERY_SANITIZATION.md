# Query sanitization middleware

`query_run` and `metadata_schema_get` normalize agent-guessed arguments before OData calls.

## Corrections

| Layer | Example input | Corrected to |
|-------|---------------|--------------|
| Entity alias | `TRANSFER` | `DOCUMENTS_T` |
| `$expand` | `SUPPART` on `SUPPLIERS` | `SUPPART_SUBFORM` |
| `$filter` | `SUPNAME eq '2001'` on `ACCOUNTS_PAYABLE` | `ACCNAME eq '2001'` |
| Subform standalone | `entity: PORDERITEMS_SUBFORM` | `PORDERS` + `$expand=PORDERITEMS_SUBFORM` |

## Implementation

- `src/utils/resolve-query-args.js` — orchestrates all layers
- `src/utils/expand-resolver.js`, `filter-resolver.js`, `entity-resolver.js`, `subform-query-resolver.js`
- `data/entity-relationships.json` — subform mappings, field aliases, entity aliases

Regenerate `data/entity-relationships.json` from the infrastructure repo after `domain-model.js` changes:

```bash
# In priority-erp-ai-infrastructure
npm run generate:mcp-query
# Copy output to this repo:
# integrations/priority-rest-api-mcp/data/entity-relationships.json → data/entity-relationships.json
```

## Response metadata

Successful `query_run` responses may include:

- `_expandWarnings` / `_expandCorrections`
- `_filterWarnings` / `_filterCorrections`
- `_entityWarnings` / `_entityCorrections`
- `_subformWarnings` / `_subformCorrections`

`metadata_schema_get` on subform entities returns `accessPattern` with parent + expand when redirected.
