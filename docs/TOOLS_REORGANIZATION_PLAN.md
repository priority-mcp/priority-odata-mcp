# Priority MCP Tools - Reorganization Plan

## Current State Analysis

### Total Tools: 18

### Issues Identified

1. **Naming Inconsistencies**:
   - Mixed use of dots (`.`) and underscores (`_`)
   - `priority_entity_attachments.get` vs `priority_entity_attachment.upload` (plural vs singular)
   - `priority_formlimited_restflag.update` (mixed)
   - `priority_batch_operations` (no separator)

2. **Functional Duplication**:
   - `priority_entities.list` with `apiOnly=true` duplicates `priority_api_entities.list`
   - Both return API-accessible entities but with different formats

3. **Organization Issues**:
   - Tools registered in random order
   - No clear categorization
   - Hard for LLM to understand relationships

## Proposed Solution

### Unified Naming Convention

**Pattern**: `priority_<category>_<action>`

Where:
- `<category>`: entity, query, metadata, text, attachment, config
- `<action>`: get, list, create, update, delete, run, refresh

### Categorization

#### 1. System & Metadata (4 tools)
- `priority_version.get` → Keep as is
- `priority_metadata.entities_list` → Merge `entities_list` and `api_entities_list`
- `priority_metadata.schema_get` → Rename from `entity_schema`
- `priority_metadata.refresh` → Keep as is

#### 2. Querying (2 tools)
- `priority_entity.get` → Keep as is
- `priority_query.run` → Keep as is

#### 3. CRUD Operations (4 tools)
- `priority_entity.create` → Keep as is
- `priority_entity.update` → Keep as is
- `priority_entity.delete` → Keep as is
- `priority_batch.operations` → Rename from `batch_operations`

#### 4. Text Fields (3 tools)
- `priority_entity_text.get` → Keep as is
- `priority_entity_text.create` → Keep as is
- `priority_entity_text.update` → Keep as is

#### 5. Attachments (2 tools)
- `priority_entity_attachments.get` → Keep as is (fix plural)
- `priority_entity_attachments.upload` → Rename from `entity_attachment_upload` (fix plural)

#### 6. Configuration (2 tools)
- `priority_instructions.get` → Keep as is
- `priority_config.restflag_update` → Rename from `formlimited_restflag_update`

### Consolidation Decisions

1. **Merge `entities_list` and `api_entities_list`**:
   - New tool: `priority_metadata.entities_list`
   - Parameters: `apiOnly` (boolean, default: false), `includeMetadata` (boolean, default: false)
   - Returns consistent format regardless of apiOnly value

2. **Rename for consistency**:
   - `entity_schema` → `metadata.schema_get`
   - `batch_operations` → `batch.operations`
   - `formlimited_restflag_update` → `config.restflag_update`
   - `entity_attachment_upload` → `entity_attachments.upload`

### Final Tool List (18 tools, organized)

1. **System & Metadata** (4):
   - `priority_version.get`
   - `priority_metadata.entities_list` (merged)
   - `priority_metadata.schema_get`
   - `priority_metadata.refresh`

2. **Querying** (2):
   - `priority_entity.get`
   - `priority_query.run`

3. **CRUD Operations** (4):
   - `priority_entity.create`
   - `priority_entity.update`
   - `priority_entity.delete`
   - `priority_batch.operations`

4. **Text Fields** (3):
   - `priority_entity_text.get`
   - `priority_entity_text.create`
   - `priority_entity_text.update`

5. **Attachments** (2):
   - `priority_entity_attachments.get`
   - `priority_entity_attachments.upload`

6. **Configuration & Help** (2):
   - `priority_instructions.get`
   - `priority_config.restflag_update`

### Implementation Steps

1. Create merged `metadata.entities_list` tool
2. Rename tools for consistency
3. Reorganize `priorityTools.js` by category
4. Update all descriptions for clarity
5. Update README.md
6. Test all tools

