/**
 * ESM port of src/utils/expand-resolver.js for Priority REST API MCP server.
 * Keep in sync with the infrastructure package expand-resolver.
 */

export const EXPAND_SUFFIX_EXCEPTIONS = new Set([
  'FORMHELP',
  'REPHELP',
  'PROGHELP',
]);

export function parseExpandToken(token) {
  if (!token || typeof token !== 'string') {
    return { name: '', options: null };
  }
  const trimmed = token.trim();
  const paren = trimmed.indexOf('(');
  if (paren === -1) {
    return { name: trimmed.toUpperCase(), options: null };
  }
  return {
    name: trimmed.slice(0, paren).toUpperCase(),
    options: trimmed.slice(paren),
  };
}

export function formatExpandToken(name, options) {
  return options ? `${name}${options}` : name;
}

export function isODataExpandShape(name) {
  return name.endsWith('_SUBFORM') || EXPAND_SUFFIX_EXCEPTIONS.has(name);
}

export function resolveExpandName(parentEntity, expandName, context = {}) {
  const upperParent = (parentEntity || '').toUpperCase();
  const upper = (expandName || '').toUpperCase();
  const rels = context.entityRelationships || {};
  const templates = context.queryTemplates || {};
  const parent = rels[upperParent] || null;

  if (!upper) {
    return { resolved: upper, corrected: false, warning: null };
  }

  const childRel = rels[upper] || rels[upper.replace(/_SUBFORM$/, '')];
  if (childRel && childRel.subformExpand) {
    const resolved = childRel.subformExpand;
    if (resolved !== upper) {
      return {
        resolved,
        corrected: true,
        warning: `[${upperParent}] $expand "${upper}" → "${resolved}" (subformExpand on ${childRel.subformOf || upper})`,
      };
    }
    return { resolved, corrected: false, warning: null };
  }

  const template = templates[upper] || templates[upper.replace(/_SUBFORM$/, '')];
  if (template && template.expandName) {
    const resolved = template.expandName;
    if (resolved !== upper) {
      return {
        resolved,
        corrected: true,
        warning: `[${upperParent}] $expand "${upper}" → "${resolved}" (queryTemplates.expandName)`,
      };
    }
    return { resolved, corrected: false, warning: null };
  }

  if (parent && parent.keySubform === upper && parent.keyExpand) {
    const resolved = parent.keyExpand;
    return {
      resolved,
      corrected: resolved !== upper,
      warning: resolved !== upper
        ? `[${upperParent}] $expand "${upper}" → "${resolved}" (keyExpand for keySubform)`
        : null,
    };
  }

  if (parent && Array.isArray(parent.subforms) && parent.subforms.includes(upper)) {
    if (EXPAND_SUFFIX_EXCEPTIONS.has(upper)) {
      return { resolved: upper, corrected: false, warning: null };
    }
    if (upper.endsWith('_SUBFORM')) {
      return { resolved: upper, corrected: false, warning: null };
    }
    const resolved = `${upper}_SUBFORM`;
    return {
      resolved,
      corrected: true,
      warning: `[${upperParent}] $expand "${upper}" → "${resolved}" (WebSDK subform name → OData navigation property)`,
    };
  }

  if (isODataExpandShape(upper)) {
    return { resolved: upper, corrected: false, warning: null };
  }

  const resolved = `${upper}_SUBFORM`;
  return {
    resolved,
    corrected: true,
    warning: `[${upperParent}] $expand "${upper}" → "${resolved}" (default _SUBFORM suffix — verify with priority_get_form_subforms if this fails)`,
  };
}

export function resolveExpand(parentEntity, expand, context = {}) {
  if (expand == null || expand === '') {
    return { expand, warnings: [], corrections: [] };
  }

  const wasArray = Array.isArray(expand);
  const tokens = wasArray ? expand : [expand];
  const warnings = [];
  const corrections = [];
  const resolved = [];

  for (const token of tokens) {
    const { name, options } = parseExpandToken(String(token));
    const result = resolveExpandName(parentEntity, name, context);
    const formatted = formatExpandToken(result.resolved, options);
    resolved.push(formatted);

    if (result.warning) warnings.push(result.warning);
    if (result.corrected) {
      corrections.push({ from: name, to: result.resolved });
    }
  }

  return {
    expand: wasArray ? resolved : resolved[0],
    warnings,
    corrections,
  };
}
