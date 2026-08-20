import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables for the REST MCP server.
// Priority:
// - Prefer an explicit ENV_FILE_PATH if provided
// - Otherwise, look for the submodule-specific .env under the main project
// - Finally, fall back to the current working directory .env if present
let envPath = process.env.ENV_FILE_PATH;
if (!envPath) {
  const submoduleEnv = path.join(process.cwd(), 'mcp-servers', 'Priority-REST-API-MCP-Server', '.env');
  const rootEnv = path.join(process.cwd(), '.env');
  if (fs.existsSync(submoduleEnv)) {
    envPath = submoduleEnv;
  } else if (fs.existsSync(rootEnv)) {
    envPath = rootEnv;
  }
}

if (envPath) {
  dotenv.config({ path: envPath });
}

export function loadConfigFromEnv() {
    const baseUrl = process.env.PRIORITY_BASE_URL || 'https://localhost:443/odata/priority/tabula.ini/demo/';
    const authType = (process.env.PRIORITY_AUTH_TYPE || 'none');
    const username = process.env.PRIORITY_USERNAME;
    const password = process.env.PRIORITY_PASSWORD;
    const pat = process.env.PRIORITY_PAT;
    const appId = process.env.PRIORITY_APP_ID;
    const appKey = process.env.PRIORITY_APP_KEY;
    const language = process.env.PRIORITY_LANGUAGE;
    const enableTrace = (process.env.PRIORITY_ENABLE_TRACE || 'false').toLowerCase() === 'true';
    const rejectUnauthorized = (process.env.TLS_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
    const timeoutMs = Number(process.env.PRIORITY_HTTP_TIMEOUT_MS || '30000');
    const writeTimeoutMs = Number(process.env.MCP_WRITE_TIMEOUT || '15000');
    const procTimeoutMs = Number(process.env.MCP_PROC_TIMEOUT || '45000');
    const host = process.env.HTTP_HOST || '0.0.0.0';
    const port = Number(process.env.HTTP_PORT || '3000');
    const sseEnabled = (process.env.SSE_ENABLED || 'false').toLowerCase() === 'true';
    const strictDataIntegrity = (process.env.STRICT_DATA_INTEGRITY || 'true').toLowerCase() === 'true';
    
    // Validate that Priority API connection is configured
    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('example.com')) {
        console.warn('[Config] Warning: PRIORITY_BASE_URL appears to be a placeholder. Ensure it points to a real Priority ERP system.');
    }
    
    if (strictDataIntegrity && (!baseUrl || authType === 'none')) {
        console.warn('[Config] Warning: Strict data integrity is enabled but Priority API connection may not be properly configured.');
    }
    
    return {
        priority: {
            baseUrl,
            authType,
            username,
            password,
            pat,
            appId,
            appKey,
            language,
            enableTrace,
            rejectUnauthorized,
            timeoutMs,
            writeTimeoutMs,
            procTimeoutMs
        },
        server: {
            host,
            port,
            sseEnabled
        },
        dataIntegrity: {
            strict: strictDataIntegrity
        }
    };
}

