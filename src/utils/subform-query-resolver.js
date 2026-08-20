/**
 * ESM port of src/utils/subform-query-resolver.js for Priority REST API MCP server.
 */

const READ_TOOLS = new Set(['query_run', 'metadata_schema_get', 'entity_get']);

const WRITE_TOOLS = new Set([
  'entity_create',
  'entity_update',
  'entity_delete',
  'batch_operations',
]);

/** Fallback when entity-relationships.json is not loaded (e.g. bundled path miss). */
const KNOWN_SUBFORM_PARENTS = {
  PORDERITEMS_SUBFORM: { parentEntity: 'PORDERS', expand: 'PORDERITEMS_SUBFORM' },
  ORDERITEMS_SUBFORM: { parentEntity: 'ORDERS', expand: 'ORDERITEMS_SUBFORM' },
  PINVOICEITEMS_SUBFORM: { parentEntity: 'PINVOICES', expand: 'PINVOICEITEMS_SUBFORM' },
  YINVOICEITEMS_SUBFORM: { parentEntity: 'YINVOICES', expand: 'YINVOICEITEMS_SUBFORM' },
  CINVOICEITEMS_SUBFORM: { parentEntity: 'CINVOICES', expand: 'CINVOICEITEMS_SUBFORM' },
  SUPPART_SUBFORM: { parentEntity: 'SUPPLIERS', expand: 'SUPPART_SUBFORM' },
  SUPPERSONNEL_SUBFORM: { parentEntity: 'SUPPLIERS', expand: 'SUPPERSONNEL_SUBFORM' },
  CUSTPERSONNEL_SUBFORM: { parentEntity: 'CUSTOMERS', expand: 'CUSTPERSONNEL_SUBFORM' },
  CURRHIS_SUBFORM: { parentEntity: 'CURRENCIES', expand: 'CURRHIS_SUBFORM' },
  USERPRIV_SUBFORM: { parentEntity: 'USERS', expand: 'USERPRIV_SUBFORM' },
  PRDITEMS_SUBFORM: { parentEntity: 'PURDEMANDS', expand: 'PRDITEMS_SUBFORM' },
  TRANSORDER_D_SUBFORM: { parentEntity: 'DOCUMENTS_D', expand: 'TRANSORDER_D_SUBFORM' },
  TRANSORDER_P_SUBFORM: { parentEntity: 'DOCUMENTS_P', expand: 'TRANSORDER_P_SUBFORM' },
};

export function buildSubformMap(entityRelationships = {}, routingContext = {}) {
  const map = {};

  for (const [parent, rel] of Object.entries(entityRelationships)) {
    if (!rel || typeof rel !== 'object') continue;

    if (rel.keyExpand) {
      map[rel.keyExpand.toUpperCase()] = {
        parentEntity: parent,
        expand: rel.keyExpand,
      };
    }

    if (Array.isArray(rel.subforms)) {
      for (const sf of rel.subforms) {
        const base = String(sf).toUpperCase();
        const nav = base.endsWith('_SUBFORM') ? base : `${base}_SUBFORM`;
        if (!map[nav]) {
          map[nav] = { parentEntity: parent, expand: nav };
        }
        if (!map[base] && rel.keyExpand === nav) {
          map[base] = { parentEntity: parent, expand: nav };
        }
      }
    }
  }

  for (const [child, rel] of Object.entries(entityRelationships)) {
    if (!rel || typeof rel !== 'object') continue;
    if (rel.subformOf && rel.subformExpand) {
      const nav = String(rel.subformExpand).toUpperCase();
      map[nav] = { parentEntity: rel.subformOf, expand: nav };
      const base = nav.replace(/_SUBFORM$/, '');
      if (!map[base]) map[base] = { parentEntity: rel.subformOf, expand: nav };
    }
  }

  for (const [name, routes] of Object.entries(routingContext)) {
    if (!routes || typeof routes !== 'object') continue;
    const read = routes.read;
    if (read?.parentEntity && read?.entity) {
      const nav = String(read.entity).toUpperCase();
      map[nav] = { parentEntity: read.parentEntity, expand: nav };
      const base = nav.replace(/_SUBFORM$/, '');
      if (!map[base]) map[base] = { parentEntity: read.parentEntity, expand: nav };
    }
  }

  return map;
}

export function lookupSubformParent(entity, context = {}) {
  if (!entity) return null;
  const upper = String(entity).toUpperCase().trim();
  const map = context.subformMap || buildSubformMap(
    context.entityRelationships,
    context.routingContext
  );

  if (map[upper]) return map[upper];

  if (KNOWN_SUBFORM_PARENTS[upper]) return KNOWN_SUBFORM_PARENTS[upper];

  if (upper.endsWith('_SUBFORM')) {
    return map[upper] || null;
  }

  const withSuffix = `${upper}_SUBFORM`;
  return map[withSuffix] || null;
}

function normalizeExpandList(expand) {
  if (!expand) return [];
  if (Array.isArray(expand)) return expand.map((e) => String(e));
  return [String(expand)];
}

function shouldRewriteSubformRead(toolName, args, context = {}) {
  if (!args?.entity || args.path) return false;
  if (WRITE_TOOLS.has(toolName)) return false;
  if (toolName === 'entity_create' && args.parentEntity) return false;
  if (!READ_TOOLS.has(toolName) && toolName !== 'entity_get') return false;

  const entity = String(args.entity).toUpperCase();
  const parent = lookupSubformParent(entity, context);
  if (!parent) return false;

  if (entity === parent.parentEntity.toUpperCase()) {
    const expands = normalizeExpandList(args.expand).map((e) => e.toUpperCase());
    if (expands.includes(parent.expand.toUpperCase())) return false;
  }

  return true;
}

export function resolveSubformReadArgs(toolName, args = {}, context = {}) {
  if (!shouldRewriteSubformRead(toolName, args, context)) {
    return {
      args,
      rewritten: false,
      subformTarget: null,
      warnings: [],
      corrections: [],
    };
  }

  const entity = String(args.entity).toUpperCase();
  const parent = lookupSubformParent(entity, context);
  if (!parent) {
    return {
      args,
      rewritten: false,
      subformTarget: null,
      warnings: [],
      corrections: [],
    };
  }

  const expandList = normalizeExpandList(args.expand);
  const expandUpper = new Set(expandList.map((e) => e.toUpperCase()));
  expandUpper.add(parent.expand.toUpperCase());

  const subformTarget = entity.endsWith('_SUBFORM')
    ? entity
    : parent.expand.toUpperCase();

  const warnings = [
    `[subform] "${entity}" cannot be queried standalone (OData 404). ` +
    `Rewrote to entity="${parent.parentEntity}" with $expand="${parent.expand}".`,
  ];

  const corrections = [{
    from: entity,
    to: parent.parentEntity,
    kind: 'subform',
    expand: parent.expand,
    source: 'standalone_redirect',
  }];

  return {
    args: {
      ...args,
      entity: parent.parentEntity,
      expand: [...expandUpper],
      _subformSchemaTarget: subformTarget,
    },
    rewritten: true,
    subformTarget,
    warnings,
    corrections,
  };
}

export function extractSubformSampleFromParentResult(sampleData, subformNav) {
  if (!sampleData?.value?.length || !subformNav) return null;
  const parent = sampleData.value[0];
  const children = parent[subformNav];
  if (!children) return null;
  if (Array.isArray(children)) return children[0] || null;
  if (typeof children === 'object') return Object.values(children)[0] || null;
  return null;
}
