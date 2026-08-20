# Priority MCP - Prompts and Resources Implementation Plan

## Overview

This document outlines the recommended prompts and resources to add to the Priority MCP server to enhance user experience and provide better context for AI assistants working with Priority ERP data.

## Current State

- ✅ **Tools**: 17 tools enabled (Priority OData REST API MCP)
- ❌ **Prompts**: 0 prompts
- ❌ **Resources**: 0 resources

## Recommended Prompts

### 1. **Query Builder Prompt**
**Name**: `query_priority_entity`
**Description**: Helps users construct OData queries for Priority entities with proper syntax
**Use Cases**:
- Building complex filters
- Understanding entity relationships
- Constructing $expand queries for subforms
- Formatting date filters correctly

**Example Template**:
```
I need to query the {entity} entity in Priority ERP.
- Filter criteria: {filter_description}
- Fields needed: {field_list}
- Include related data: {subforms}
- Sort by: {sort_field}
- Limit results: {top_count}

Please construct the proper OData query and explain each parameter.
```

### 2. **Entity Relationship Explorer**
**Name**: `explore_entity_relationships`
**Description**: Helps users understand relationships between Priority entities
**Use Cases**:
- Finding related entities
- Understanding subform structures
- Discovering parent-child relationships
- Mapping entity hierarchies

**Example Template**:
```
I'm working with the {entity} entity in Priority ERP.
- What are the related entities/subforms?
- How do I access child records?
- What are the key fields for relationships?
- Show me examples of $expand queries for this entity.
```

### 3. **Data Modification Guide**
**Name**: `modify_priority_data`
**Description**: Guides users through creating, updating, or deleting Priority records
**Use Cases**:
- Creating new orders/customers/parts
- Updating existing records
- Understanding required fields
- Handling subform updates

**Example Template**:
```
I need to {operation} a {entity} record in Priority ERP.
- Entity: {entity_name}
- Key: {record_key}
- Fields to {operation}: {field_list}
- Subforms to update: {subform_list}

Please guide me through the process and show the proper API call structure.
```

### 4. **Error Troubleshooting Prompt**
**Name**: `troubleshoot_priority_error`
**Description**: Helps diagnose and fix Priority API errors
**Use Cases**:
- Understanding error messages
- Fixing authentication issues
- Resolving RESTFLAG errors
- Handling validation errors

**Example Template**:
```
I'm getting an error when working with Priority API:
- Error message: {error_message}
- Operation: {operation_type}
- Entity: {entity_name}
- Status code: {status_code}

Please help me understand what went wrong and how to fix it.
```

### 5. **Subform Operations Guide**
**Name**: `work_with_subforms`
**Description**: Comprehensive guide for working with Priority subforms
**Use Cases**:
- Adding child records to subforms
- Understanding PARTARC_SUBFORM structure
- Expanding nested subforms
- Updating subform arrays

**Example Template**:
```
I need to work with {subform_name} subform for {parent_entity} entity.
- Parent key: {parent_key}
- Operation: {add|update|query}
- Data: {subform_data}

Please show me the correct approach using $expand and update operations.
```

## Recommended Resources

### 1. **Entity Schema Resource**
**Name**: `priority://entity-schema/{entity}`
**Description**: Provides schema information for a specific entity
**Content**: Entity fields, types, relationships, subforms
**Example**: `priority://entity-schema/ORDERS`

### 2. **Available Entities List**
**Name**: `priority://entities/list`
**Description**: Complete list of all available Priority entities with RESTFLAG=Y
**Content**: Entity names, titles, descriptions, access status
**Refresh**: On-demand or periodic

### 3. **Entity Metadata Resource**
**Name**: `priority://entity-metadata/{entity}`
**Description**: Full metadata for an entity including field descriptions
**Content**: Field names, types, descriptions, required fields, relationships
**Example**: `priority://entity-metadata/CUSTOMERS`

### 4. **Common Queries Library**
**Name**: `priority://queries/common`
**Description**: Collection of common query patterns and examples
**Content**: Pre-built queries for common scenarios (orders, customers, inventory, etc.)
**Categories**: 
- Customer queries
- Order queries
- Inventory queries
- Document queries
- Part/product queries

### 5. **Subform Reference**
**Name**: `priority://subforms/reference`
**Description**: Reference guide for all available subforms
**Content**: Subform names, parent entities, structure, common operations
**Examples**: 
- ORDERITEMS_SUBFORM
- SHIPTO2_SUBFORM
- PARTARC_SUBFORM
- KITITEMS_SUBFORM

### 6. **API Connection Status**
**Name**: `priority://connection/status`
**Description**: Current connection status and configuration
**Content**: Base URL, auth type, connection health, available endpoints
**Refresh**: Real-time or on-demand

### 7. **Error Codes Reference**
**Name**: `priority://errors/reference`
**Description**: Common error codes and their meanings
**Content**: HTTP status codes, Priority-specific errors, resolution steps
**Examples**: 400, 401, 404, 500

### 8. **Entity Relationships Map**
**Name**: `priority://relationships/map`
**Description**: Visual/textual map of entity relationships
**Content**: Entity connections, parent-child relationships, foreign keys
**Format**: Graph structure or hierarchical tree

## Implementation Priority

### Phase 1: Essential Prompts (High Priority)
1. ✅ Query Builder Prompt
2. ✅ Entity Relationship Explorer
3. ✅ Data Modification Guide

### Phase 2: Essential Resources (High Priority)
1. ✅ Available Entities List
2. ✅ Entity Schema Resource
3. ✅ Common Queries Library

### Phase 3: Advanced Features (Medium Priority)
1. ⏳ Error Troubleshooting Prompt
2. ⏳ Subform Operations Guide
3. ⏳ Entity Metadata Resource
4. ⏳ Subform Reference

### Phase 4: Enhanced Features (Low Priority)
1. ⏳ API Connection Status
2. ⏳ Error Codes Reference
3. ⏳ Entity Relationships Map

## Technical Implementation

### MCP Protocol Support

The MCP protocol (2024-11-05) supports:
- `prompts/list` - List available prompts
- `prompts/get` - Get prompt template
- `resources/list` - List available resources
- `resources/read` - Read resource content

### Handler Extensions Needed

1. **Prompt Registry**: Similar to ToolRegistry, manage prompt templates
2. **Resource Registry**: Manage resource providers and caching
3. **Handler Updates**: Add cases for `prompts/list`, `prompts/get`, `resources/list`, `resources/read`

### File Structure

```
src/
├── prompts/
│   ├── prompt-registry.js
│   ├── query-builder-prompt.js
│   ├── entity-relationship-prompt.js
│   ├── data-modification-prompt.js
│   ├── error-troubleshooting-prompt.js
│   └── subform-operations-prompt.js
├── resources/
│   ├── resource-registry.js
│   ├── entity-schema-resource.js
│   ├── entities-list-resource.js
│   ├── entity-metadata-resource.js
│   ├── common-queries-resource.js
│   ├── subform-reference-resource.js
│   ├── connection-status-resource.js
│   ├── error-codes-resource.js
│   └── relationships-map-resource.js
└── mcp/
    └── handler.js (extend with prompts/resources support)
```

## Benefits

### For Users
- **Faster onboarding**: Prompts guide new users
- **Better context**: Resources provide reference material
- **Error resolution**: Troubleshooting prompts help fix issues quickly
- **Learning tool**: Understand Priority ERP structure better

### For AI Assistants
- **Richer context**: Resources provide background information
- **Template-based interactions**: Prompts structure conversations
- **Reduced errors**: Better understanding leads to fewer mistakes
- **More efficient**: Pre-built queries and patterns speed up operations

## Success Metrics

- Number of prompts used per session
- Resource access frequency
- Reduction in error rates
- User satisfaction with guidance
- Time saved on common operations

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 prompts and resources
3. Test with real Priority ERP data
4. Gather user feedback
5. Iterate and expand based on usage patterns


