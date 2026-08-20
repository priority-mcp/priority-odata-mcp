import { NO_MOCK_DATA_POLICY } from '../utils/data-integrity.js';
import { DataIntegrityError } from '../utils/errors.js';

/**
 * Execute a registered tool and return MCP CallToolResult (for SDK or JSON-RPC).
 * @param {import('./registry.js').ToolRegistry} tools
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {boolean} strictDataIntegrity
 * @returns {Promise<{ content: Array<{ type: string, text?: string }>, isError?: boolean }>}
 */
export async function runToolCallForMcp(tools, name, args, strictDataIntegrity) {
  const rawResult = await tools.callTool(name, args);

  if (strictDataIntegrity && rawResult) {
    try {
      if (typeof rawResult === 'object' && !Array.isArray(rawResult.content)) {
        const resultStr = JSON.stringify(rawResult).toLowerCase();
        if (
          resultStr.includes('"mock"') ||
          resultStr.includes('"fake"') ||
          resultStr.includes('"dummy"') ||
          resultStr.includes('"test_data"')
        ) {
          throw new DataIntegrityError(
            `NO MOCK DATA ALLOWED: Tool "${name}" returned data containing mock/fake patterns. ${NO_MOCK_DATA_POLICY}`,
            { tool: name, result: rawResult }
          );
        }
      }
    } catch (validationError) {
      if (validationError instanceof DataIntegrityError) {
        throw validationError;
      }
      // eslint-disable-next-line no-console
      console.warn(`[Data Integrity] Validation warning for tool "${name}":`, validationError.message);
    }
  }

  if (rawResult && typeof rawResult === 'object' && Array.isArray(rawResult.content)) {
    return rawResult;
  }
  
  // Special handling for OData responses with empty collections
  // Preserve @odata.* properties (count, deltaLink, context, etc.) rather than
  // discarding them — this is essential for count-only queries ($top=0&$count=true)
  // and delta query workflows that need @odata.deltaLink even when no results
  // are returned yet.
  if (rawResult && typeof rawResult === 'object' && Array.isArray(rawResult.value)) {
    const valueCount = rawResult.value.length;
    if (valueCount === 0) {
      // Collect all non-"value" properties so they survive the serialization
      const { value: _, ...rest } = rawResult;
      const extras = Object.keys(rest).length > 0 ? rest : null;

      // If there are @odata.* properties, preserve them alongside the message
      if (extras) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...extras,
              _info: 'No records found (0 rows returned).'
            }, null, 2)
          }],
          isError: false
        };
      }

      const entityInfo = rawResult['@odata.context'] ? 
        ` for ${rawResult['@odata.context'].split('/').pop()}` : '';
      return {
        content: [{ 
          type: 'text', 
          text: `Query executed successfully${entityInfo}. No records found (0 rows returned).` 
        }],
        isError: false
      };
    }
  }
  
  const resultText = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult, null, 2);
  return {
    content: [{ type: 'text', text: resultText }],
    isError: false
  };
}

/**
 * Map tool execution failure to a message (JSON-RPC layer uses -32603; SDK uses isError result).
 */
export function formatToolCallFailureMessage(error, name) {
  let errorMessage = error?.message || 'Tool execution failed';
  if (error instanceof DataIntegrityError || errorMessage.includes('NO MOCK DATA')) {
    errorMessage = `${errorMessage} ${NO_MOCK_DATA_POLICY}`;
  }
  return errorMessage;
}
