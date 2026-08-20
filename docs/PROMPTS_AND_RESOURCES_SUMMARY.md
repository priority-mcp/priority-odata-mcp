# Priority MCP - Prompts & Resources Summary

## 🎯 Quick Overview

**Current State:**
- ✅ 17 Tools enabled
- ❌ 0 Prompts
- ❌ 0 Resources

**Recommended Additions:**
- 📝 **5 Essential Prompts**
- 📚 **8 Useful Resources**

---

## 📝 Recommended Prompts

### 1. **Query Builder** (`query_priority_entity`)
**Purpose**: Help users construct OData queries correctly
- Build complex filters
- Format $expand for subforms
- Handle date/time queries
- Construct proper $select statements

**Example Use**: "Help me query orders from last month with order items"

### 2. **Entity Relationship Explorer** (`explore_entity_relationships`)
**Purpose**: Understand entity connections and hierarchies
- Find related entities
- Discover subform structures
- Map parent-child relationships
- Understand foreign keys

**Example Use**: "What entities are related to ORDERS?"

### 3. **Data Modification Guide** (`modify_priority_data`)
**Purpose**: Guide through create/update/delete operations
- Create new records
- Update existing data
- Handle required fields
- Work with subform arrays

**Example Use**: "How do I create a new order with order items?"

### 4. **Error Troubleshooting** (`troubleshoot_priority_error`)
**Purpose**: Diagnose and fix API errors
- Understand error messages
- Fix authentication issues
- Resolve RESTFLAG errors
- Handle validation errors

**Example Use**: "I got a 401 error, what does it mean?"

### 5. **Subform Operations** (`work_with_subforms`)
**Purpose**: Comprehensive subform guide
- Add child records
- Understand PARTARC_SUBFORM
- Expand nested subforms
- Update subform arrays correctly

**Example Use**: "How do I add child products to a part?"

---

## 📚 Recommended Resources

### 1. **Available Entities List** (`priority://entities/list`)
**What**: Complete list of all entities with RESTFLAG=Y
**Why**: Quick reference for what's accessible
**Content**: Entity names, titles, descriptions

### 2. **Entity Schema** (`priority://entity-schema/{entity}`)
**What**: Schema info for specific entity
**Why**: Understand fields, types, relationships
**Example**: `priority://entity-schema/ORDERS`

### 3. **Common Queries Library** (`priority://queries/common`)
**What**: Pre-built query patterns
**Why**: Save time on common operations
**Categories**: Orders, Customers, Inventory, Documents, Parts

### 4. **Entity Metadata** (`priority://entity-metadata/{entity}`)
**What**: Full metadata with field descriptions
**Why**: Detailed field information
**Example**: `priority://entity-metadata/CUSTOMERS`

### 5. **Subform Reference** (`priority://subforms/reference`)
**What**: Guide to all subforms
**Why**: Understand subform structures
**Examples**: ORDERITEMS_SUBFORM, PARTARC_SUBFORM, SHIPTO2_SUBFORM

### 6. **Connection Status** (`priority://connection/status`)
**What**: Current API connection info
**Why**: Verify connectivity and config
**Content**: Base URL, auth type, health status

### 7. **Error Codes Reference** (`priority://errors/reference`)
**What**: Common error codes and fixes
**Why**: Quick error resolution
**Content**: HTTP codes, Priority errors, solutions

### 8. **Relationships Map** (`priority://relationships/map`)
**What**: Entity relationship visualization
**Why**: Understand data structure
**Format**: Graph or hierarchical tree

---

## 🚀 Implementation Priority

### Phase 1: Essential (Start Here)
1. ✅ Query Builder Prompt
2. ✅ Entity Relationship Explorer
3. ✅ Available Entities List Resource
4. ✅ Entity Schema Resource

### Phase 2: High Value
1. ✅ Data Modification Guide Prompt
2. ✅ Common Queries Library Resource
3. ✅ Subform Reference Resource

### Phase 3: Enhanced Features
1. ⏳ Error Troubleshooting Prompt
2. ⏳ Subform Operations Prompt
3. ⏳ Entity Metadata Resource
4. ⏳ Connection Status Resource

### Phase 4: Nice to Have
1. ⏳ Error Codes Reference
2. ⏳ Relationships Map

---

## 💡 Key Benefits

### For Users
- **Faster Learning**: Prompts guide new users
- **Better Context**: Resources provide reference
- **Fewer Errors**: Better understanding = fewer mistakes
- **Time Savings**: Pre-built patterns speed operations

### For AI Assistants
- **Richer Context**: Resources provide background
- **Structured Interactions**: Prompts organize conversations
- **Efficiency**: Templates reduce repetitive work
- **Accuracy**: Better guidance = better results

---

## 📋 Next Steps

1. **Review** this plan
2. **Implement** Phase 1 (Essential prompts & resources)
3. **Test** with real Priority data
4. **Gather** user feedback
5. **Iterate** based on usage

---

## 🔧 Technical Notes

- MCP Protocol supports `prompts/list`, `prompts/get`, `resources/list`, `resources/read`
- Need to extend `MCPProtocolHandler` to handle these methods
- Create `PromptRegistry` and `ResourceRegistry` similar to `ToolRegistry`
- Resources can be static or dynamic (fetched from Priority API)


