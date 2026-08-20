/**
 * Middleware: normalize query_run args ($expand, $filter, lookup) before OData.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { resolveExpand } from './expand-resolver.js';
import { resolveFilterArgs } from './filter-resolver.js';
import { collectDocumentHints, resolveEntityName } from './entity-resolver.js';
import { resolveSubformReadArgs } from './subform-query-resolver.js';

let _context = null;

function loadQueryContext() {
  if (_context) return _context;

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), 'data/entity-relationships.json'),
    '/app/data/entity-relationships.json',
    join(here, '../data/entity-relationships.json'),
    join(here, '../../data/entity-relationships.json'),
    join(here, '../../../data/entity-relationships.json'),
  ];

  for (const path of candidates) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      _context = {
        entityRelationships: raw.entityRelationships || {},
        queryTemplates: raw.queryTemplates || {},
        fieldAliases: raw.fieldAliases || {},
        entityAliases: raw.entityAliases || {},
        documentPrefixes: raw.documentPrefixes || [],
      };
      return _context;
    } catch {
      // try next path
    }
  }

  _context = { entityRelationships: {}, queryTemplates: {}, fieldAliases: {}, entityAliases: {}, documentPrefixes: [] };
  return _context;
}

/**
 * Resolve expand, filter, and lookup in query_run arguments.
 */
export function resolveQueryArgs(args) {
  if (!args?.entity) {
    return { args, warnings: [], corrections: [] };
  }

  const ctx = loadQueryContext();
  const warnings = [];
  const corrections = [];
  let next = { ...args };

  const docNumbers = collectDocumentHints(args);
  const entityResolved = resolveEntityName(String(args.entity), ctx, { docNumbers });
  if (entityResolved.corrections.length > 0) {
    next.entity = entityResolved.entity;
    warnings.push(...entityResolved.warnings);
    corrections.push(...entityResolved.corrections);
  }

  const subformResolved = resolveSubformReadArgs('query_run', next, ctx);
  if (subformResolved.rewritten) {
    next = subformResolved.args;
    warnings.push(...subformResolved.warnings);
    corrections.push(...subformResolved.corrections);
  }

  const entity = String(next.entity);

  if (args.expand) {
    const expanded = resolveExpand(entity, args.expand, ctx);
    if (expanded.corrections.length > 0) {
      next.expand = expanded.expand;
      warnings.push(...expanded.warnings);
      corrections.push(...expanded.corrections.map((c) => ({ ...c, kind: 'expand' })));
    }
  }

  if (args.filter || args.lookup) {
    const filtered = resolveFilterArgs(entity, args, ctx);
    if (filtered.corrections.length > 0) {
      if (filtered.filter != null) next.filter = filtered.filter;
      if (filtered.lookup) next.lookup = filtered.lookup;
      warnings.push(...filtered.warnings);
      corrections.push(...filtered.corrections);
    }
  }

  if (corrections.length === 0) {
    return { args, warnings: [], corrections: [] };
  }

  return { args: next, warnings, corrections };
}

/** @deprecated use resolveQueryArgs */
export function resolveQueryExpandArgs(args) {
  return resolveQueryArgs(args);
}

/**
 * Attach query correction metadata to a successful OData result.
 */
export function attachQueryMetadata(result, warnings, corrections) {
  if (!warnings?.length && !corrections?.length) return result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const expandCorrections = corrections.filter((c) => c.kind === 'expand');
    const filterCorrections = corrections.filter((c) => c.kind === 'filter');
    const entityCorrections = corrections.filter((c) => c.kind === 'entity');
    const subformCorrections = corrections.filter((c) => c.kind === 'subform');
    const expandWarnings = warnings.filter((w) => w.includes('$expand'));
    const filterWarnings = warnings.filter((w) => w.includes('$filter'));
    const entityWarnings = warnings.filter((w) => w.startsWith('[entity]'));
    const subformWarnings = warnings.filter((w) => w.startsWith('[subform]'));

    const meta = { ...result };
    if (expandWarnings.length || expandCorrections.length) {
      meta._expandWarnings = expandWarnings;
      meta._expandCorrections = expandCorrections;
    }
    if (filterWarnings.length || filterCorrections.length) {
      meta._filterWarnings = filterWarnings;
      meta._filterCorrections = filterCorrections;
    }
    if (entityWarnings.length || entityCorrections.length) {
      meta._entityWarnings = entityWarnings;
      meta._entityCorrections = entityCorrections;
    }
    if (subformWarnings.length || subformCorrections.length) {
      meta._subformWarnings = subformWarnings;
      meta._subformCorrections = subformCorrections;
    }
    return meta;
  }
  return result;
}

/** @deprecated use attachQueryMetadata */
export function attachExpandMetadata(result, warnings, corrections) {
  return attachQueryMetadata(result, warnings, corrections);
}
