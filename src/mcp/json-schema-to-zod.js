/**
 * Convert Priority tool JSON Schema (subset) to Zod v4 for @modelcontextprotocol/sdk McpServer.registerTool.
 */
import * as z from 'zod/v4';

/**
 * @param {Record<string, unknown>} jsonSchema
 * @returns {import('zod/v4').ZodObject}
 */
export function jsonSchemaObjectToZod(jsonSchema) {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.object({}).catchall(z.unknown());
  }
  if (jsonSchema.type !== 'object' || !jsonSchema.properties || typeof jsonSchema.properties !== 'object') {
    return z.object({}).catchall(z.unknown());
  }
  const required = new Set(Array.isArray(jsonSchema.required) ? jsonSchema.required : []);
  /** @type {Record<string, import('zod/v4').ZodTypeAny>} */
  const shape = {};
  for (const [key, prop] of Object.entries(jsonSchema.properties)) {
    let field = jsonSchemaPropertyToZod(prop);
    if (prop && typeof prop === 'object' && prop.description) {
      field = field.describe(String(prop.description));
    }
    shape[key] = required.has(key) ? field : field.optional();
  }
  let obj = z.object(shape);
  if (jsonSchema.additionalProperties === false) {
    obj = obj.strict();
  }
  return obj;
}

/**
 * @param {unknown} prop
 * @returns {import('zod/v4').ZodTypeAny}
 */
function jsonSchemaPropertyToZod(prop) {
  if (!prop || typeof prop !== 'object') {
    return z.unknown();
  }
  const t = prop.type;
  if (t === 'string') {
    return z.string();
  }
  if (t === 'number') {
    return z.number();
  }
  if (t === 'integer') {
    return z.number().int();
  }
  if (t === 'boolean') {
    return z.boolean();
  }
  if (t === 'array') {
    const item = prop.items ? jsonSchemaPropertyToZod(prop.items) : z.unknown();
    return z.array(item);
  }
  if (t === 'object' && prop.properties && typeof prop.properties === 'object') {
    return jsonSchemaObjectToZod(prop);
  }
  if (t === 'object') {
    return z.record(z.string(), z.unknown());
  }
  return z.unknown();
}
