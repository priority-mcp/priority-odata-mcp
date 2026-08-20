/**
 * ESM port of src/utils/filter-resolver.js for Priority REST API MCP server.
 */

export function extractFilterFields(filter) {
  if (!filter || typeof filter !== 'string') return [];
  const fields = new Set();
  const re = /\b([A-Z][A-Z0-9_]*)\s+(eq|ne|gt|ge|lt|le|contains|startswith|endswith)\b/gi;
  let match;
  while ((match = re.exec(filter)) !== null) {
    fields.add(match[1].toUpperCase());
  }
  return [...fields];
}

function replaceFieldInFilter(filter, fromField, toField) {
  if (!filter || fromField === toField) return filter;
  const re = new RegExp(
    `\\b${fromField}\\b(?=\\s+(?:eq|ne|gt|ge|lt|le|contains|startswith|endswith)\\b)`,
    'gi'
  );
  return filter.replace(re, toField);
}

export function getFieldAliases(entity, context = {}) {
  const upper = (entity || '').toUpperCase();
  const aliases = { ...(context.fieldAliases?.[upper] || {}) };
  if (upper === 'ACCOUNTS_PAYABLE') {
    if (!aliases.SUPNAME) aliases.SUPNAME = 'ACCNAME';
    if (!aliases.SUPDES) aliases.SUPDES = 'ACCDES';
  }
  if (upper === 'ACCOUNTS_RECEIVABLE') {
    if (!aliases.CUSTNAME) aliases.CUSTNAME = 'ACCNAME';
    if (!aliases.CUSTDES) aliases.CUSTDES = 'ACCDES';
    if (!aliases.CDES) aliases.CDES = 'ACCDES';
  }
  return aliases;
}

export function resolveFilter(entity, filter, context = {}) {
  if (!filter || typeof filter !== 'string') {
    return { filter, warnings: [], corrections: [] };
  }

  const aliases = getFieldAliases(entity, context);
  const template = context.queryTemplates?.[(entity || '').toUpperCase()];
  const knownFields = new Set([
    ...(template?.listFields || []),
    ...(template?.searchFields || []),
    ...(template?.filterFields || []),
    ...(template?.exportFields || []),
  ]);

  let resolved = filter;
  const warnings = [];
  const corrections = [];

  for (const field of extractFilterFields(filter)) {
    const alias = aliases[field];
    if (!alias || alias === field) continue;
    if (knownFields.size > 0 && knownFields.has(field)) continue;

    resolved = replaceFieldInFilter(resolved, field, alias);
    corrections.push({ from: field, to: alias, kind: 'filter' });
    warnings.push(
      `[${entity}] $filter field "${field}" → "${alias}" (entity uses different field name than master data)`
    );
  }

  return { filter: resolved, warnings, corrections };
}

export function resolveLookup(entity, lookup, context = {}) {
  if (!lookup || typeof lookup !== 'object' || Array.isArray(lookup)) {
    return { lookup, warnings: [], corrections: [] };
  }

  const aliases = getFieldAliases(entity, context);
  const resolved = { ...lookup };
  const warnings = [];
  const corrections = [];

  for (const [key, value] of Object.entries(lookup)) {
    const upperKey = key.toUpperCase();
    const alias = aliases[upperKey];
    if (!alias || alias === upperKey) continue;
    delete resolved[key];
    resolved[alias] = value;
    corrections.push({ from: upperKey, to: alias, kind: 'lookup' });
    warnings.push(`[${entity}] lookup field "${upperKey}" → "${alias}"`);
  }

  return { lookup: resolved, warnings, corrections };
}

export function resolveFilterArgs(entity, args, context = {}) {
  const warnings = [];
  const corrections = [];
  let filter = args.filter;
  let lookup = args.lookup;

  if (filter) {
    const f = resolveFilter(entity, String(filter), context);
    filter = f.filter;
    warnings.push(...f.warnings);
    corrections.push(...f.corrections);
  }
  if (lookup) {
    const l = resolveLookup(entity, lookup, context);
    lookup = l.lookup;
    warnings.push(...l.warnings);
    corrections.push(...l.corrections);
  }

  return { filter, lookup, warnings, corrections };
}
