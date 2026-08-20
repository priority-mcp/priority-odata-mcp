import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  resolveSubformReadArgs,
  extractSubformSampleFromParentResult,
} from '../utils/subform-query-resolver.js';

let _context = null;

function loadContext() {
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
        routingContext: raw.routingContext || {},
      };
      return _context;
    } catch {
      // try next
    }
  }
  _context = { entityRelationships: {}, routingContext: {} };
  return _context;
}

function formatExpandArg(expand) {
  if (!expand) return undefined;
  if (Array.isArray(expand)) return expand.map((s) => String(s)).join(',');
  return String(expand);
}

function inferType(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value) || (value.includes('T') && value.includes('Z'))) {
      return 'datetime';
    }
    return 'string';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

export function registerEntitySchemaTool(registry, client) {
  registry.registerTool({
    name: 'metadata_schema_get',
    description: 'Get metadata and schema information for a Priority entity. Subform navigation entities (e.g. PORDERITEMS_SUBFORM) are auto-redirected to parent + $expand. For child forms, prefer parent entity + filter + expand.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['entity'],
      properties: {
        entity: {
          type: 'string',
          description: 'Entity name (e.g., DOCUMENTS_D, ORDERS, CUSTOMERS, PART). Subforms: use parent + expand, not standalone subform entity.',
        },
        sample: {
          type: 'boolean',
          description: 'If true, fetch a sample record to understand structure (default: true)',
        },
        top: {
          type: 'number',
          description: 'Number of sample records to fetch (default: 1)',
        },
      },
    },
  }, async (args) => {
    if (!args?.entity) {
      throw new Error('Args required: { entity }');
    }

    const ctx = loadContext();
    const {
      args: readArgs,
      rewritten,
      subformTarget,
      warnings,
      corrections,
    } = resolveSubformReadArgs('metadata_schema_get', args, ctx);

    const entity = String(readArgs.entity);
    const originalEntity = String(args.entity);
    const fetchSample = readArgs.sample !== false;
    const top = readArgs.top || 1;

    const result = {
      entity: originalEntity,
      metadata: {
        description: rewritten
          ? `Schema for subform ${originalEntity} via parent ${entity} + $expand`
          : `Schema information for ${entity} entity`,
        note: 'Field names and types are inferred from sample data. Consult Priority documentation for authoritative schema.',
      },
    };

    if (warnings?.length) result._subformWarnings = warnings;
    if (corrections?.length) result._subformCorrections = corrections;
    if (rewritten) {
      result.accessPattern = {
        parentEntity: entity,
        expand: subformTarget,
        message: `Subform "${originalEntity}" is not a standalone OData entity. Sample fetched via parent + $expand.`,
      };
    }

    if (fetchSample) {
      const sampleData = await client.runQuery(entity, {
        top,
        expand: formatExpandArg(readArgs.expand),
        filter: readArgs.filter ? String(readArgs.filter) : undefined,
      });

      let sample = null;
      if (rewritten && subformTarget) {
        sample = extractSubformSampleFromParentResult(sampleData, subformTarget);
      } else if (sampleData?.value?.length) {
        sample = sampleData.value[0];
      }

      if (sample) {
        const fields = Object.keys(sample).map((key) => ({
          name: key,
          type: inferType(sample[key]),
          example: sample[key],
        }));

        result.schema = {
          fields,
          sampleRecord: sample,
          totalFields: fields.length,
          dataSource: rewritten ? `parent ${entity} + $expand ${subformTarget}` : 'Priority ERP API',
        };
      } else {
        result.schema = {
          note: rewritten
            ? `No ${subformTarget} rows in sample parent ${entity} record. Try filter on parent or increase top.`
            : 'No sample records found in Priority ERP. Entity may be empty or require specific filters.',
          fields: [],
          dataSource: 'Priority ERP API (empty result)',
        };
      }
    }

    return result;
  });
}
