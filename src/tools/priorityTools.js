// Priority MCP Tools - Organized by Category
// Total: 19 tools

// ============================================
// 1. System & Metadata (4 tools)
// ============================================
import { registerVersionGetTool } from './version-get-tool.js';
import { registerMetadataEntitiesListTool } from './metadata-entities-list-tool.js';
import { registerEntitySchemaTool } from './entity-schema-tool.js';
import { registerMetadataRefreshTool } from './metadata-refresh-tool.js';

// ============================================
// 2. Querying (3 tools)
// ============================================
import { registerEntityGetTool } from './entity-get-tool.js';
import { registerQueryRunTool } from './query-run-tool.js';
import { registerQuerySumTool } from './query-sum-tool.js';
import { registerSafeQueryRunTool } from './safe-query-run-tool.js';

// ============================================
// 3. CRUD Operations (4 tools)
// ============================================
import { registerEntityCreateTool } from './entity-create-tool.js';
import { registerEntityUpdateTool } from './entity-update-tool.js';
import { registerEntityDeleteTool } from './entity-delete-tool.js';
import { registerBatchOperationsTool } from './batch-operations-tool.js';

// ============================================
// 4. Text Fields (3 tools)
// ============================================
import { registerEntityTextGetTool } from './entity-text-get-tool.js';
import { registerEntityTextCreateTool } from './entity-text-create-tool.js';
import { registerEntityTextUpdateTool } from './entity-text-update-tool.js';

// ============================================
// 5. Attachments (2 tools)
// ============================================
import { registerEntityAttachmentsGetTool } from './entity-attachments-get-tool.js';
import { registerEntityAttachmentUploadTool } from './entity-attachment-upload-tool.js';

// ============================================
// 6. Configuration & Help (2 tools)
// ============================================
import { registerInstructionsGetTool } from './instructions-get-tool.js';
import { registerFormLimitedRestFlagTool } from './formlimited-restflag-tool.js';

/**
 * Register all Priority MCP tools organized by category
 * 
 * Categories:
 * 1. System & Metadata: version, entities list, schema, metadata refresh
 * 2. Querying: get entity, run queries
 * 3. CRUD Operations: create, update, delete, batch operations
 * 4. Text Fields: get, create, update text
 * 5. Attachments: get, upload attachments
 * 6. Configuration & Help: instructions, REST flag configuration
 */
export function registerPriorityTools(registry, client) {
    // 1. System & Metadata
    registerVersionGetTool(registry, client);
    registerMetadataEntitiesListTool(registry, client);
    registerEntitySchemaTool(registry, client);
    registerMetadataRefreshTool(registry, client);
    
    // 2. Querying
    registerEntityGetTool(registry, client);
    registerQueryRunTool(registry, client);
    registerQuerySumTool(registry, client);
    registerSafeQueryRunTool(registry, client);
    
    // 3. CRUD Operations
    registerEntityCreateTool(registry, client);
    registerEntityUpdateTool(registry, client);
    registerEntityDeleteTool(registry, client);
    registerBatchOperationsTool(registry, client);
    
    // 4. Text Fields
    registerEntityTextGetTool(registry, client);
    registerEntityTextCreateTool(registry, client);
    registerEntityTextUpdateTool(registry, client);
    
    // 5. Attachments
    registerEntityAttachmentsGetTool(registry, client);
    registerEntityAttachmentUploadTool(registry, client);
    
    // 6. Configuration & Help
    registerInstructionsGetTool(registry, client);
    registerFormLimitedRestFlagTool(registry, client);
}
