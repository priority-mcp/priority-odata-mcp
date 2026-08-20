# תוכנית הרחבה והשלמה - Priority MCP Server

**תאריך יצירה**: 2025-12-01  
**גרסה נוכחית**: 18 כלים  
**מטרה**: השלמת פעולות הליבה והרחבת הפונקציונליות

---

## סיכום המצב הנוכחי

### כלים קיימים (18 כלים)

#### 1. System & Metadata (4 כלים) ✅
- `priority_version.get` - גרסת Priority
- `priority_metadata.entities_list` - רשימת entities (מאוחד)
- `priority_metadata.schema_get` - סכמה של entity
- `priority_metadata.refresh` - רענון metadata

#### 2. Querying (2 כלים) ✅
- `priority_entity.get` - קבלת entity בודד
- `priority_query.run` - שאילתות עם OData options (כולל delta token)

#### 3. CRUD Operations (4 כלים) ✅
- `priority_entity.create` - יצירת entity
- `priority_entity.update` - עדכון entity
- `priority_entity.delete` - מחיקת entity
- `priority_batch.operations` - פעולות batch

#### 4. Text Fields (3 כלים) ✅
- `priority_entity_text.get` - קבלת טקסט
- `priority_entity_text.create` - יצירת טקסט
- `priority_entity_text.update` - עדכון טקסט

#### 5. Attachments (2 כלים) ⚠️ חלקי
- `priority_entity_attachments.get` - רשימת attachments
- `priority_entity_attachments.upload` - העלאת attachment
- ❌ **חסר**: Download attachment
- ❌ **חסר**: Delete attachment

#### 6. Configuration & Help (2 כלים) ✅
- `priority_instructions.get` - הנחיות שימוש
- `priority_config.restflag_update` - עדכון RESTFLAG

---

## פעולות חסרות - סדר עדיפויות

### 🔴 עדיפות גבוהה (Core Operations)

#### 1. Attachments - השלמת מחזור החיים

##### 1.1 `priority_entity_attachments.download`
**תיאור**: הורדת קובץ attachment ספציפי  
**Endpoint**: `GET /Entity(Key)/Attachments(AttachmentKey)/$value`  
**פרמטרים**:
- `entity` (string, required) - שם ה-entity
- `key` (string, required) - מפתח ה-entity
- `attachmentKey` (string, required) - מפתח ה-attachment (לפי התוצאה של `get`)

**תכונות**:
- החזרת קובץ כ-base64 או binary
- תמיכה ב-content-type
- תמיכה בשם הקובץ המקורי

**קובץ**: `src/tools/entity-attachment-download-tool.js`  
**Method ב-Client**: `downloadEntityAttachment(entity, keyExpr, attachmentKey)`

##### 1.2 `priority_entity_attachments.delete`
**תיאור**: מחיקת attachment  
**Endpoint**: `DELETE /Entity(Key)/Attachments(AttachmentKey)`  
**פרמטרים**:
- `entity` (string, required) - שם ה-entity
- `key` (string, required) - מפתח ה-entity
- `attachmentKey` (string, required) - מפתח ה-attachment

**קובץ**: `src/tools/entity-attachment-delete-tool.js`  
**Method ב-Client**: `deleteEntityAttachment(entity, keyExpr, attachmentKey)`

**הערות**:
- צריך לבדוק את המבנה של attachment key ב-Priority
- ייתכן שזה composite key (למשל: `FILENAME='file.pdf',FILEEXT='pdf'`)

---

### 🟡 עדיפות בינונית (Enhanced Features)

#### 2. Delta Queries - שיפור ותיעוד

##### 2.1 שיפור `priority_query.run` עם Delta Queries
**תיאור**: שיפור התמיכה ב-delta queries שכבר קיימת  
**פעולות**:
- ✅ תמיכה ב-`deltaToken` כבר קיימת
- ⚠️ צריך להוסיף דוגמאות ותיעוד
- ⚠️ צריך לבדוק אם זה עובד נכון
- ⚠️ צריך להוסיף כלי עזר ל-`deltaLink` parsing

**שיפורים נדרשים**:
1. הוספת דוגמאות ב-README
2. בדיקות עבור delta queries
3. כלי עזר ל-parsing של `@odata.deltaLink`
4. תיעוד של איך להשתמש ב-delta queries

---

#### 3. Language Support - כלי עזר

##### 3.1 `priority_config.language_set`
**תיאור**: הגדרת שפת ברירת מחדל  
**פרמטרים**:
- `language` (string, optional) - קוד שפה (למשל: "he", "en", "en-US")
- אם לא מוגדר, מחזיר את השפה הנוכחית

**הערות**:
- זה רק כלי עזר - התמיכה ב-`Accept-Language` header כבר קיימת
- זה יכול להיות environment variable או כלי נפרד

---

#### 4. Trace Debugging - כלי עזר

##### 4.1 `priority_config.trace_toggle`
**תיאור**: הפעלה/כיבוי של trace debugging  
**פרמטרים**:
- `enabled` (boolean, required) - הפעל או כבה trace

**הערות**:
- זה רק כלי עזר - התמיכה ב-`X-App-Trace` header כבר קיימת
- זה יכול להיות environment variable או כלי נפרד

---

### 🟢 עדיפות נמוכה (Advanced Features)

#### 5. OData Functions/Actions

##### 5.1 `priority_function.call`
**תיאור**: קריאה ל-OData Functions  
**Endpoint**: `GET/POST /Entity(Key)/FunctionName(...)`  
**פרמטרים**:
- `entity` (string, required) - שם ה-entity
- `key` (string, optional) - מפתח ה-entity (אם function bound)
- `functionName` (string, required) - שם ה-function
- `parameters` (object, optional) - פרמטרים ל-function

**הערות**:
- צריך לבדוק אם Priority תומך ב-OData Functions
- ייתכן שזה לא זמין בגרסה הנוכחית

##### 5.2 `priority_action.call`
**תיאור**: קריאה ל-OData Actions  
**Endpoint**: `POST /Entity(Key)/ActionName`  
**פרמטרים**:
- `entity` (string, required) - שם ה-entity
- `key` (string, optional) - מפתח ה-entity (אם action bound)
- `actionName` (string, required) - שם ה-action
- `parameters` (object, optional) - פרמטרים ל-action

**הערות**:
- צריך לבדוק אם Priority תומך ב-OData Actions
- ייתכן שזה לא זמין בגרסה הנוכחית

---

#### 6. Advanced Querying

##### 6.1 `priority_query.count`
**תיאור**: ספירת רשומות ללא שליפת הנתונים  
**Endpoint**: `GET /Entity/$count`  
**פרמטרים**:
- `entity` (string, required) - שם ה-entity
- `filter` (string, optional) - OData $filter expression

**הערות**:
- זה יכול להיות שימושי לבדיקת מספר רשומות לפני שליפה
- יכול להיות חלק מ-`query.run` עם פרמטר `countOnly`

##### 6.2 `priority_query.search`
**תיאור**: חיפוש טקסטואלי (אם Priority תומך)  
**Endpoint**: `GET /Entity?$search=...`  
**פרמטרים**:
- `entity` (string, required) - שם ה-entity
- `search` (string, required) - טקסט לחיפוש

**הערות**:
- צריך לבדוק אם Priority תומך ב-`$search`
- ייתכן שזה לא זמין בגרסה הנוכחית

---

#### 7. Metadata Enhancements

##### 7.1 `priority_metadata.service_document`
**תיאור**: קבלת service document מלא  
**Endpoint**: `GET /`  
**פרמטרים**: אין

**הערות**:
- זה כבר קיים ב-`getServiceDocument()` ב-Client
- יכול להיות כלי נפרד או חלק מ-`metadata.entities_list`

##### 7.2 `priority_metadata.entity_metadata`
**תיאור**: קבלת metadata ספציפי ל-entity  
**Endpoint**: `GET /$metadata#EntityName`  
**פרמטרים**:
- `entity` (string, required) - שם ה-entity

**הערות**:
- זה יכול להיות שימושי לקבלת metadata מפורט יותר
- ייתכן שזה כבר חלק מ-`schema_get`

---

#### 8. Batch Operations Enhancements

##### 8.1 שיפורים ל-`priority_batch.operations`
**שיפורים נדרשים**:
- תמיכה ב-`$batch` עם `Content-Type: multipart/mixed`
- תמיכה ב-`changeset` ל-grouping של פעולות
- תמיכה ב-`dependsOn` (כבר קיים)
- שיפור error handling

**הערות**:
- התמיכה הבסיסית כבר קיימת
- צריך לבדוק אם Priority תומך ב-`changeset`

---

## תוכנית יישום

### Phase 1: השלמת Attachments (עדיפות גבוהה)

#### שלב 1.1: Download Attachment
1. ✅ הוספת `downloadEntityAttachment` ל-`PriorityClient`
2. ✅ יצירת `entity-attachment-download-tool.js`
3. ✅ רישום הכלי ב-`priorityTools.js`
4. ✅ עדכון README
5. ✅ בדיקות

**קובץ**: `src/priority/client.js`  
**Method**:
```javascript
async downloadEntityAttachment(entity, keyExpr, attachmentKey) {
    // GET /Entity(Key)/Attachments(AttachmentKey)/$value
    // Return binary data or base64
}
```

**קובץ**: `src/tools/entity-attachment-download-tool.js`  
**Tool**: `priority_entity_attachments.download`

#### שלב 1.2: Delete Attachment
1. ✅ הוספת `deleteEntityAttachment` ל-`PriorityClient`
2. ✅ יצירת `entity-attachment-delete-tool.js`
3. ✅ רישום הכלי ב-`priorityTools.js`
4. ✅ עדכון README
5. ✅ בדיקות

**קובץ**: `src/priority/client.js`  
**Method**:
```javascript
async deleteEntityAttachment(entity, keyExpr, attachmentKey) {
    // DELETE /Entity(Key)/Attachments(AttachmentKey)
}
```

**קובץ**: `src/tools/entity-attachment-delete-tool.js`  
**Tool**: `priority_entity_attachments.delete`

**זמן משוער**: 2-3 שעות

---

### Phase 2: שיפורים ותיעוד (עדיפות בינונית)

#### שלב 2.1: שיפור Delta Queries
1. ✅ בדיקת תמיכה ב-delta queries
2. ✅ הוספת דוגמאות ב-README
3. ✅ יצירת כלי עזר ל-parsing של `deltaLink`
4. ✅ בדיקות

**קובץ**: `src/utils/delta-query-helper.js` (חדש)  
**Functions**:
- `parseDeltaLink(deltaLink)` - parse delta link
- `extractDeltaToken(deltaLink)` - extract token

**זמן משוער**: 1-2 שעות

#### שלב 2.2: כלי עזר ל-Language ו-Trace
1. ✅ יצירת `priority_config.language_set`
2. ✅ יצירת `priority_config.trace_toggle`
3. ✅ עדכון README

**קובץ**: `src/tools/config-language-tool.js` (חדש)  
**קובץ**: `src/tools/config-trace-tool.js` (חדש)

**זמן משוער**: 1 שעה

---

### Phase 3: תכונות מתקדמות (עדיפות נמוכה)

#### שלב 3.1: OData Functions/Actions
1. ⚠️ בדיקה אם Priority תומך
2. ⚠️ יישום אם זמין

**זמן משוער**: 2-4 שעות (אם זמין)

#### שלב 3.2: Advanced Querying
1. ⚠️ הוספת `count` ל-`query.run`
2. ⚠️ בדיקת תמיכה ב-`$search`

**זמן משוער**: 1-2 שעות

---

## מבנה קבצים מוצע

```
src/
├── priority/
│   └── client.js (extend with download/delete attachment methods)
├── tools/
│   ├── entity-attachment-download-tool.js (NEW)
│   ├── entity-attachment-delete-tool.js (NEW)
│   ├── config-language-tool.js (NEW - optional)
│   ├── config-trace-tool.js (NEW - optional)
│   └── priorityTools.js (register new tools)
└── utils/
    └── delta-query-helper.js (NEW - optional)
```

---

## בדיקות נדרשות

### בדיקות Attachments
1. ✅ Download attachment - בדיקת הורדה של קובץ
2. ✅ Delete attachment - בדיקת מחיקה
3. ✅ Error handling - בדיקת שגיאות (attachment לא קיים, וכו')
4. ✅ Edge cases - בדיקת מקרים קיצוניים

### בדיקות Delta Queries
1. ✅ בדיקת delta query בסיסי
2. ✅ בדיקת parsing של delta link
3. ✅ בדיקת שימוש חוזר ב-delta token

---

## הערות טכניות

### Attachments - מבנה Key
**חשוב**: צריך לבדוק את המבנה של attachment key ב-Priority. ייתכן שזה:
- Simple key: `"1"` או `"file.pdf"`
- Composite key: `"FILENAME='file.pdf',FILEEXT='pdf'"`
- או משהו אחר

**פתרון**: לבדוק את התוצאה של `getEntityAttachments` ולראות מה המבנה של ה-key.

### Delta Queries - Format
**חשוב**: לבדוק את הפורמט של delta link ב-Priority. ייתכן שזה:
- `@odata.deltaLink` ב-response
- או משהו אחר

**פתרון**: לבדוק את התוצאה של `query.run` עם delta token ולראות מה הפורמט.

---

## סיכום

### כלים חדשים מוצעים (Phase 1 - עדיפות גבוהה)
1. `priority_entity_attachments.download` - הורדת attachment
2. `priority_entity_attachments.delete` - מחיקת attachment

**סה"כ כלים חדשים**: 2 כלים  
**סה"כ כלים אחרי Phase 1**: 20 כלים

### כלים אופציונליים (Phase 2-3)
- `priority_config.language_set` - הגדרת שפה
- `priority_config.trace_toggle` - הפעלת trace
- `priority_function.call` - קריאה ל-functions (אם זמין)
- `priority_action.call` - קריאה ל-actions (אם זמין)
- `priority_query.count` - ספירת רשומות

**סה"כ כלים אופציונליים**: 5 כלים  
**סה"כ כלים מקסימלי**: 25 כלים

---

## הצעדים הבאים

1. ✅ **Phase 1.1**: יישום `priority_entity_attachments.download`
2. ✅ **Phase 1.2**: יישום `priority_entity_attachments.delete`
3. ⚠️ **Phase 2**: שיפורים ותיעוד (אופציונלי)
4. ⚠️ **Phase 3**: תכונות מתקדמות (אופציונלי)

---

**תאריך עדכון אחרון**: 2025-12-01  
**מחבר**: Priority MCP Server Development Team

