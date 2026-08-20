/**
 * ESM port of src/utils/entity-resolver.js for MCP servers.
 */

const DEFAULT_ENTITY_ALIASES = {
  TRANSFER: 'DOCUMENTS_T',
  TRANSFERS: 'DOCUMENTS_T',
  WAREHOUSE_TRANSFER: 'DOCUMENTS_T',
  STOCK_TRANSFER: 'DOCUMENTS_T',
  SHIPMENT: 'DOCUMENTS_D',
  SHIPPING: 'DOCUMENTS_D',
  DELIVERY: 'DOCUMENTS_D',
  GRV: 'DOCUMENTS_P',
  GOODS_RECEIPT: 'DOCUMENTS_P',
  CURRENCY: 'CURRENCIES',
  CUSTOMER: 'CUSTOMERS',
  SUPPLIER: 'SUPPLIERS',
  PRODUCT: 'PART',
  RECEIPT: 'TINVOICES',
  AP: 'ACCOUNTS_PAYABLE',
  AR: 'ACCOUNTS_RECEIVABLE',
};

const DEFAULT_DOC_PREFIXES = [
  { prefix: 'BT', entity: 'DOCUMENTS_T' },
  { prefix: 'GRV', entity: 'DOCUMENTS_P' },
  { prefix: 'SH', entity: 'DOCUMENTS_D' },
  { prefix: 'AS', entity: 'DOCUMENTS_H' },
  { prefix: 'PD', entity: 'PURDEMANDS' },
  { prefix: 'PO', entity: 'PORDERS' },
  { prefix: 'SO', entity: 'ORDERS' },
  { prefix: 'SI', entity: 'CINVOICES' },
  { prefix: 'GI', entity: 'PINVOICES' },
  { prefix: 'RC', entity: 'TINVOICES' },
];

const DOC_VALUE_RE = /(?:^|[&\s,])(?:IVNUM|DOCNO|ORDNAME|PRDNO|FNCNUM)\s*=\s*['"]?([A-Z][A-Z0-9-]*)/gi;

export function getEntityAliases(context = {}) {
  return { ...DEFAULT_ENTITY_ALIASES, ...(context.entityAliases || {}) };
}

export function getDocumentPrefixes(context = {}) {
  const custom = context.documentPrefixes || [];
  return [...DEFAULT_DOC_PREFIXES, ...custom].sort((a, b) => b.prefix.length - a.prefix.length);
}

export function extractDocumentNumbers(text) {
  if (!text || typeof text !== 'string') return [];
  const values = new Set();
  let match;
  const re = new RegExp(DOC_VALUE_RE.source, 'gi');
  while ((match = re.exec(text)) !== null) {
    values.add(match[1].toUpperCase());
  }
  return [...values];
}

export function inferEntityFromDocumentNumber(docNumber, context = {}) {
  if (!docNumber || typeof docNumber !== 'string') return null;
  const upper = docNumber.toUpperCase();
  for (const { prefix, entity } of getDocumentPrefixes(context)) {
    if (upper.startsWith(prefix)) return entity;
  }
  return null;
}

export function collectDocumentHints(args = {}) {
  const hints = [];
  if (args.recordKey) hints.push(String(args.recordKey));
  if (args.colfilter) hints.push(String(args.colfilter));
  if (args.filter) hints.push(String(args.filter));
  if (args.searchCriteria && typeof args.searchCriteria === 'object') {
    for (const v of Object.values(args.searchCriteria)) {
      if (v != null) hints.push(String(v));
    }
  }
  const numbers = [];
  for (const h of hints) {
    numbers.push(...extractDocumentNumbers(h));
    if (/^[A-Z][A-Z0-9-]+$/.test(h.trim())) numbers.push(h.trim().toUpperCase());
  }
  return [...new Set(numbers)];
}

export function resolveEntityName(entity, context = {}, hints = {}) {
  const warnings = [];
  const corrections = [];
  if (!entity || typeof entity !== 'string') {
    return { entity, warnings, corrections, inferredFrom: null };
  }

  const upper = entity.toUpperCase().trim();
  const aliases = getEntityAliases(context);
  let resolved = upper;

  if (aliases[upper] && aliases[upper] !== upper) {
    resolved = aliases[upper];
    corrections.push({ from: upper, to: resolved, kind: 'entity', source: 'alias' });
    warnings.push(`[entity] "${upper}" → "${resolved}" (invented name mapped to Priority ENAME)`);
  }

  const docNumbers = hints.docNumbers || [];
  if (docNumbers.length > 0) {
    const inferred = inferEntityFromDocumentNumber(docNumbers[0], context);
    if (inferred && aliases[upper] && inferred !== resolved) {
      const from = resolved;
      resolved = inferred;
      corrections.push({ from, to: resolved, kind: 'entity', source: 'docPrefix', docNumber: docNumbers[0] });
      warnings.push(`[entity] "${from}" → "${resolved}" (inferred from document number "${docNumbers[0]}")`);
    }
  }

  return { entity: resolved, warnings, corrections, inferredFrom: null };
}

export function resolveToolArgs(toolName, args = {}, context = {}) {
  if (!args || typeof args !== 'object') {
    return { args, warnings: [], corrections: [] };
  }

  const docNumbers = collectDocumentHints(args);
  const entityField = args.formName != null ? 'formName' : (args.entity != null ? 'entity' : null);
  if (!entityField) return { args, warnings: [], corrections: [] };

  const resolved = resolveEntityName(args[entityField], context, { docNumbers });
  if (!resolved.corrections.length) return { args, warnings: [], corrections: [] };

  return {
    args: { ...args, [entityField]: resolved.entity },
    warnings: resolved.warnings,
    corrections: resolved.corrections,
  };
}
