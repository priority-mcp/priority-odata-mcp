/**
 * Comprehensive check script for all entities marked with RESTFLAG=Y in FORMLIMITED
 * Collects data statistics, sample records, and generates detailed report
 */

import { PriorityClient } from '../../src/priority/client.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
const envPath = join(projectRoot, '.env');

let config = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      config[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (err) {
  // .env file not found, use environment variables directly
}

const rejectUnauthorized = process.env.TLS_REJECT_UNAUTHORIZED === 'false' || 
                           config.TLS_REJECT_UNAUTHORIZED === 'false' || 
                           config.TLS_REJECT_UNAUTHORIZED === false;

const client = new PriorityClient({
  baseUrl: process.env.PRIORITY_BASE_URL || config.PRIORITY_BASE_URL,
  authType: process.env.PRIORITY_AUTH_TYPE || config.PRIORITY_AUTH_TYPE || 'basic',
  username: process.env.PRIORITY_USERNAME || config.PRIORITY_USERNAME,
  password: process.env.PRIORITY_PASSWORD || config.PRIORITY_PASSWORD,
  pat: process.env.PRIORITY_PAT || config.PRIORITY_PAT,
  appId: process.env.PRIORITY_APP_ID || config.PRIORITY_APP_ID,
  appKey: process.env.PRIORITY_APP_KEY || config.PRIORITY_APP_KEY,
  timeoutMs: parseInt(process.env.PRIORITY_HTTP_TIMEOUT_MS || config.PRIORITY_HTTP_TIMEOUT_MS || '30000'),
  rejectUnauthorized: !rejectUnauthorized
}, {
  strictDataIntegrity: true
});

// Results storage
const results = {
  withData: [],      // Entities with data
  empty: [],         // Entities accessible but without data
  errors: []          // Entities with errors
};

// Categories for grouping
const categories = {
  'Finance & Accounting': [],
  'Customers & Suppliers': [],
  'Products & Inventory': [],
  'Orders & Documents': [],
  'System & Configuration': [],
  'Other': []
};

function categorizeEntity(entityName, title) {
  const name = entityName.toUpperCase();
  const titleLower = (title || '').toLowerCase();
  
  if (name.includes('ACCOUNT') || name.includes('FNC') || name.includes('INVOICE') || 
      name.includes('CASH') || name.includes('BANK') || name.includes('TAX') || 
      name.includes('VAT') || name.includes('PAYMENT') || name.includes('CREDIT')) {
    return 'Finance & Accounting';
  }
  if (name.includes('CUSTOMER') || name.includes('SUPPLIER') || name.includes('AGENT') || 
      name.includes('CTYPE') || name.includes('CUST')) {
    return 'Customers & Suppliers';
  }
  if (name.includes('PART') || name.includes('SERIAL') || name.includes('WAREHOUSE') || 
      name.includes('INVENTORY') || name.includes('LOG') || name.includes('DOCUMENT')) {
    return 'Products & Inventory';
  }
  if (name.includes('ORDER') || name.includes('DOCUMENT') || name.includes('INVOICE') || 
      name.includes('PORDER') || name.includes('TRANS')) {
    return 'Orders & Documents';
  }
  if (name.includes('USER') || name.includes('ENVIRONMENT') || name.includes('COMPDATA') || 
      name.includes('FORM') || name.includes('CONST') || name.includes('STATUS') || 
      name.includes('TYPE') || name.includes('CODE')) {
    return 'System & Configuration';
  }
  return 'Other';
}

async function checkEntity(entity) {
  const { ENAME, TITLE, TYPE } = entity;
  console.log(`Checking entity: ${ENAME} (${TITLE || 'No title'})`);
  
  try {
    // Try to get count first
    let recordCount = 0;
    let sampleRecord = null;
    let hasData = false;
    
    try {
      // Try to get a sample record
      const sampleResponse = await client.runQuery(ENAME, { top: 1 });
      
      if (sampleResponse && sampleResponse.value && sampleResponse.value.length > 0) {
        hasData = true;
        sampleRecord = sampleResponse.value[0];
        
        // Try to get count
        try {
          const countResponse = await client.runQuery(ENAME, { 
            top: 1,
            // Use $count=true if supported
          });
          
          // Try to get @odata.count if available
          if (countResponse['@odata.count'] !== undefined) {
            recordCount = countResponse['@odata.count'];
          } else {
            // If count not available, try to get more records to estimate
            const largeResponse = await client.runQuery(ENAME, { top: 1000 });
            if (largeResponse && largeResponse.value) {
              recordCount = largeResponse.value.length;
              if (recordCount === 1000) {
                recordCount = '1000+'; // Indicate there might be more
              }
            }
          }
        } catch (countError) {
          // Count failed, but we have data
          recordCount = 'Unknown';
        }
      } else {
        hasData = false;
      }
    } catch (queryError) {
      // Query failed
      let statusCode = 'unknown';
      let errorMessage = queryError.message || queryError.toString();
      
      if (queryError.statusCode) {
        statusCode = queryError.statusCode;
      } else if (queryError.originalError?.response?.status) {
        statusCode = queryError.originalError.response.status;
      } else if (queryError.response?.status) {
        statusCode = queryError.response.status;
      }
      
      results.errors.push({
        entity: ENAME,
        title: TITLE,
        type: TYPE,
        statusCode,
        error: errorMessage
      });
      
      return 'error';
    }
    
    if (hasData) {
      const category = categorizeEntity(ENAME, TITLE);
      results.withData.push({
        entity: ENAME,
        title: TITLE,
        type: TYPE,
        recordCount,
        sampleRecord,
        category
      });
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(ENAME);
      return 'withData';
    } else {
      results.empty.push({
        entity: ENAME,
        title: TITLE,
        type: TYPE
      });
      return 'empty';
    }
  } catch (error) {
    console.error(`Error checking ${ENAME}:`, error.message);
    results.errors.push({
      entity: ENAME,
      title: TITLE,
      type: TYPE,
      error: error.message
    });
    return 'error';
  }
}

async function main() {
  try {
    console.log('Starting comprehensive check of entities with RESTFLAG=Y...\n');
    
    // Get all entities with RESTFLAG=Y
    const formlimitedResponse = await client.runQuery('FORMLIMITED', {
      filter: "RESTFLAG eq 'Y'",
      select: ['ENAME', 'TYPE', 'RESTFLAG', 'TITLE'],
      orderby: 'ENAME'
    });

    const markedEntities = formlimitedResponse.value;
    console.log(`Found ${markedEntities.length} entities marked with RESTFLAG=Y\n`);

    // Check each entity
    let processed = 0;
    for (const entity of markedEntities) {
      processed++;
      await checkEntity(entity);
      
      if (processed % 10 === 0) {
        console.log(`\nProgress: ${processed}/${markedEntities.length} entities checked`);
        console.log(`  - With data: ${results.withData.length}`);
        console.log(`  - Empty: ${results.empty.length}`);
        console.log(`  - Errors: ${results.errors.length}\n`);
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n=== Final Results ===');
    console.log(`Total checked: ${markedEntities.length}`);
    console.log(`With data: ${results.withData.length}`);
    console.log(`Empty: ${results.empty.length}`);
    console.log(`Errors: ${results.errors.length}`);

    // Generate comprehensive report
    const report = generateComprehensiveReport(results, markedEntities.length, categories);
    
    // Ensure reports directory exists
    const reportsDir = join(projectRoot, 'tests', 'reports');
    try {
      mkdirSync(reportsDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }
    
    // Save report
    const reportPath = join(reportsDir, 'FORMLIMITED_MARKED_ENTITIES_COMPREHENSIVE_REPORT.md');
    writeFileSync(reportPath, report, 'utf8');
    
    console.log(`\nComprehensive report saved to: ${reportPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function generateComprehensiveReport(results, totalChecked, categories) {
  const now = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('he-IL');
  
  let report = `# דוח מקיף - יישויות מסומנות ב-RESTFLAG=Y מ-FORMLIMITED\n\n`;
  report += `**תאריך בדיקה**: ${now} ${time}\n`;
  report += `**סה"כ יישויות שנבדקו**: ${totalChecked}\n\n`;
  report += `---\n\n`;

  // Executive Summary
  report += `## 📊 סיכום מנהלים\n\n`;
  report += `| קטגוריה | מספר | אחוז |\n`;
  report += `|---------|------|------|\n`;
  report += `| **יישויות עם נתונים** | ${results.withData.length} | ${((results.withData.length / totalChecked) * 100).toFixed(1)}% |\n`;
  report += `| **יישויות ריקות** | ${results.empty.length} | ${((results.empty.length / totalChecked) * 100).toFixed(1)}% |\n`;
  report += `| **יישויות עם שגיאות** | ${results.errors.length} | ${((results.errors.length / totalChecked) * 100).toFixed(1)}% |\n\n`;
  
  // Calculate total records
  let totalRecords = 0;
  let recordsWithCount = 0;
  results.withData.forEach(item => {
    if (typeof item.recordCount === 'number') {
      totalRecords += item.recordCount;
      recordsWithCount++;
    }
  });
  
  report += `### סטטיסטיקות נתונים\n\n`;
  report += `- **סה"כ רשומות ביישויות עם נתונים**: ${totalRecords > 0 ? totalRecords.toLocaleString() : 'לא ניתן לחשב'}\n`;
  report += `- **מספר יישויות עם נתונים**: ${results.withData.length}\n`;
  report += `- **מספר יישויות ריקות**: ${results.empty.length}\n`;
  report += `- **מספר יישויות עם שגיאות**: ${results.errors.length}\n\n`;
  
  report += `---\n\n`;

  // Group by categories
  report += `## 📁 יישויות לפי קטגוריות\n\n`;
  
  Object.keys(categories).forEach(category => {
    const entitiesInCategory = results.withData.filter(item => item.category === category);
    if (entitiesInCategory.length > 0) {
      report += `### ${category} (${entitiesInCategory.length} יישויות)\n\n`;
      entitiesInCategory.forEach(item => {
        report += `- **${item.entity}** - ${item.title || 'ללא כותרת'}\n`;
        report += `  - מספר רשומות: ${item.recordCount}\n`;
      });
      report += `\n`;
    }
  });
  
  report += `---\n\n`;

  // Section 1: Entities with data
  report += `## ✅ 1. יישויות עם נתונים (${results.withData.length})\n\n`;
  report += `יישויות מסומנות ב-RESTFLAG=Y עם נתונים פעילים:\n\n`;
  
  // Sort by record count (descending)
  const sortedWithData = [...results.withData].sort((a, b) => {
    const countA = typeof a.recordCount === 'number' ? a.recordCount : 0;
    const countB = typeof b.recordCount === 'number' ? b.recordCount : 0;
    return countB - countA;
  });
  
  sortedWithData.forEach((item, index) => {
    report += `### ${index + 1}. ${item.entity}\n`;
    report += `- **כותרת**: ${item.title || 'ללא כותרת'}\n`;
    report += `- **סוג**: ${item.type}\n`;
    report += `- **קטגוריה**: ${item.category}\n`;
    report += `- **מספר רשומות**: ${item.recordCount}\n`;
    report += `- **דוגמא לרשומה**:\n`;
    report += `\`\`\`json\n${JSON.stringify(item.sampleRecord, null, 2)}\n\`\`\`\n\n`;
  });

  // Section 2: Empty entities
  report += `## 📭 2. יישויות ריקות (${results.empty.length})\n\n`;
  report += `יישויות מסומנות ב-RESTFLAG=Y אבל ללא נתונים:\n\n`;
  
  results.empty.forEach((item, index) => {
    report += `${index + 1}. **${item.entity}** - ${item.title || 'ללא כותרת'}\n`;
  });
  report += `\n`;

  // Section 3: Entities with errors
  if (results.errors.length > 0) {
    report += `## ❌ 3. יישויות עם שגיאות (${results.errors.length})\n\n`;
    report += `יישויות מסומנות ב-RESTFLAG=Y אבל עם שגיאות בקריאה:\n\n`;
    
    // Group by error type
    const errorGroups = {};
    results.errors.forEach(item => {
      const key = item.statusCode || 'unknown';
      if (!errorGroups[key]) {
        errorGroups[key] = [];
      }
      errorGroups[key].push(item);
    });

    Object.keys(errorGroups).sort().forEach(statusCode => {
      const items = errorGroups[statusCode];
      report += `### שגיאות ${statusCode} (${items.length} יישויות)\n\n`;
      items.forEach((item, index) => {
        report += `${index + 1}. **${item.entity}** - ${item.title || 'ללא כותרת'}\n`;
        if (item.error) {
          report += `   - שגיאה: ${item.error}\n`;
        }
      });
      report += `\n`;
    });
  }

  // Insights section
  report += `---\n\n`;
  report += `## 💡 תובנות והמלצות\n\n`;
  
  report += `### תובנות מרכזיות:\n\n`;
  report += `1. **${results.withData.length} מתוך ${totalChecked} יישויות (${((results.withData.length / totalChecked) * 100).toFixed(1)}%) מכילות נתונים פעילים**\n`;
  report += `2. **${results.empty.length} יישויות (${((results.empty.length / totalChecked) * 100).toFixed(1)}%) מסומנות אבל ריקות** - ייתכן שהן מוכנות לשימוש עתידי\n`;
  if (results.errors.length > 0) {
    report += `3. **${results.errors.length} יישויות (${((results.errors.length / totalChecked) * 100).toFixed(1)}%) עם שגיאות** - דורשות בדיקה נוספת\n`;
  }
  
  // Find largest entities
  const largestEntities = sortedWithData.slice(0, 10).filter(item => typeof item.recordCount === 'number');
  if (largestEntities.length > 0) {
    report += `\n### היישויות הגדולות ביותר (לפי מספר רשומות):\n\n`;
    largestEntities.forEach((item, index) => {
      report += `${index + 1}. **${item.entity}** - ${item.recordCount.toLocaleString()} רשומות\n`;
    });
    report += `\n`;
  }
  
  report += `### המלצות:\n\n`;
  report += `1. ✅ **יישויות עם נתונים** - כל ${results.withData.length} היישויות פעילות ומכילות נתונים\n`;
  report += `2. ⚠️ **יישויות ריקות** - לבדוק אם הן אמורות להכיל נתונים או מוכנות לשימוש עתידי\n`;
  if (results.errors.length > 0) {
    report += `3. ❌ **יישויות עם שגיאות** - לבדוק מדוע הן מחזירות שגיאות למרות שהן מסומנות ב-RESTFLAG=Y\n`;
  }
  
  report += `\n---\n\n`;
  report += `**הערות:**\n`;
  report += `- הבדיקה בוצעה על כל היישויות המסומנות ב-RESTFLAG=Y ב-FORMLIMITED\n`;
  report += `- מספר הרשומות הוא משוער - חלק מהיישויות לא תומכות בספירה מדויקת\n`;
  report += `- דוגמאות הרשומות הן הרשומה הראשונה שנמצאה בכל יישות\n`;

  return report;
}

main();

