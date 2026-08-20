/**
 * Script to check all unmarked entities in FORMLIMITED
 * Marks each entity with RESTFLAG=Y, tries to read data, then unmarks it
 */

import { PriorityClient } from '../../src/priority/client.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file manually
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
  rejectUnauthorized: !rejectUnauthorized // Invert: rejectUnauthorized=false means accept self-signed
}, {
  strictDataIntegrity: true
});

// Results storage
const results = {
  withData: [],      // Entities with data successfully read
  empty: [],         // Entities accessible but without data
  notAccessible: []  // Entities not accessible (400, 404, etc.)
};

async function checkEntity(entityName, entityType = 'F') {
  try {
    // Mark with RESTFLAG=Y
    const compositeKey = `ENAME='${entityName}',TYPE='${entityType}'`;
    await client.updateEntity('FORMLIMITED', compositeKey, {
      RESTFLAG: 'Y'
    });

    // Try to read data
    try {
      const response = await client.runQuery(entityName, { top: 1 });
      
      if (response.value && response.value.length > 0) {
        // Entity has data
        results.withData.push({
          entity: entityName,
          sampleRecord: response.value[0]
        });
        return 'withData';
      } else {
        // Entity is accessible but empty
        results.empty.push({
          entity: entityName
        });
        return 'empty';
      }
    } catch (queryError) {
      // Query failed - entity not accessible
      let statusCode = 'unknown';
      let errorMessage = queryError.message || queryError.toString();
      
      // Try to extract status code from various error formats
      // PriorityApiError exposes statusCode directly
      if (queryError.statusCode) {
        statusCode = queryError.statusCode;
      } else if (queryError.originalError?.response?.status) {
        statusCode = queryError.originalError.response.status;
      } else if (queryError.response?.status) {
        statusCode = queryError.response.status;
      } else if (queryError.status) {
        statusCode = queryError.status;
      }
      
      // Extract error message from original error if available
      if (queryError.originalError?.message) {
        errorMessage = queryError.originalError.message;
      } else if (queryError.responseData?.error?.message) {
        errorMessage = queryError.responseData.error.message.value || queryError.responseData.error.message;
      }
      
      results.notAccessible.push({
        entity: entityName,
        error: errorMessage,
        statusCode: statusCode
      });
      return 'notAccessible';
    } finally {
      // Always unmark the entity
      try {
        const compositeKey = `ENAME='${entityName}',TYPE='${entityType}'`;
        await client.updateEntity('FORMLIMITED', compositeKey, {
          RESTFLAG: 'N'
        });
      } catch (unmarkError) {
        console.error(`Failed to unmark ${entityName}:`, unmarkError.message);
      }
    }
  } catch (markError) {
    console.error(`Failed to mark ${entityName}:`, markError.message);
    return 'error';
  }
}

async function main() {
  try {
    // Get all entities from FORMLIMITED
    const formlimitedResponse = await client.runQuery('FORMLIMITED', {
      select: ['ENAME', 'TYPE', 'RESTFLAG'],
      orderby: 'ENAME'
    });

    // Filter entities that are NOT marked with RESTFLAG=Y
    const unmarkedEntities = formlimitedResponse.value.filter(
      entity => entity.RESTFLAG !== 'Y'
    );

    console.log(`Found ${unmarkedEntities.length} unmarked entities to check`);
    console.log('Starting checks...\n');

    // Check each entity
    let processed = 0;
    for (const entity of unmarkedEntities) {
      processed++;
      const status = await checkEntity(entity.ENAME, entity.TYPE || 'F');
      
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${unmarkedEntities.length} entities...`);
        console.log(`  - With data: ${results.withData.length}`);
        console.log(`  - Empty: ${results.empty.length}`);
        console.log(`  - Not accessible: ${results.notAccessible.length}\n`);
      }
    }

    console.log('\n=== Final Results ===');
    console.log(`Total checked: ${unmarkedEntities.length}`);
    console.log(`With data: ${results.withData.length}`);
    console.log(`Empty: ${results.empty.length}`);
    console.log(`Not accessible: ${results.notAccessible.length}`);

    // Generate report
    const report = generateReport(results, unmarkedEntities.length);
    
    // Ensure reports directory exists
    const reportsDir = join(process.cwd(), 'tests', 'reports');
    try {
      mkdirSync(reportsDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }
    
    // Save report
    const reportPath = join(reportsDir, 'FORMLIMITED_UNMARKED_ENTITIES_REPORT.md');
    writeFileSync(reportPath, report, 'utf8');
    
    console.log(`\nReport saved to: ${reportPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function generateReport(results, totalChecked) {
  const now = new Date().toISOString().split('T')[0];
  
  let report = `# דוח בדיקת יישויות לא מסומנות ב-FORMLIMITED\n\n`;
  report += `**תאריך בדיקה**: ${now}\n`;
  report += `**סה"כ יישויות שנבדקו**: ${totalChecked}\n\n`;
  report += `---\n\n`;
  report += `## סיכום כללי\n\n`;
  report += `| קטגוריה | מספר | אחוז |\n`;
  report += `|---------|------|------|\n`;
  report += `| **יישויות עם נתונים** | ${results.withData.length} | ${((results.withData.length / totalChecked) * 100).toFixed(1)}% |\n`;
  report += `| **יישויות ריקות** | ${results.empty.length} | ${((results.empty.length / totalChecked) * 100).toFixed(1)}% |\n`;
  report += `| **יישויות לא נגישות** | ${results.notAccessible.length} | ${((results.notAccessible.length / totalChecked) * 100).toFixed(1)}% |\n\n`;
  report += `---\n\n`;

  // Section 1: Entities with data
  report += `## 1. יישויות עם נתונים (${results.withData.length})\n\n`;
  report += `יישויות שלא מסומנות ב-RESTFLAG=Y אבל יש בהן נתונים והצלחנו לקרוא אותם:\n\n`;
  
  results.withData.forEach((item, index) => {
    report += `### ${index + 1}. ${item.entity}\n`;
    report += `- **סטטוס**: ✅ נגיש עם נתונים\n`;
    report += `- **דוגמא לרשומה**:\n`;
    report += `\`\`\`json\n${JSON.stringify(item.sampleRecord, null, 2)}\n\`\`\`\n\n`;
  });

  // Section 2: Empty entities
  report += `## 2. יישויות ריקות (${results.empty.length})\n\n`;
  report += `יישויות נגישות אבל ללא נתונים:\n\n`;
  
  results.empty.forEach((item, index) => {
    report += `${index + 1}. **${item.entity}**\n`;
  });
  report += `\n`;

  // Section 3: Not accessible entities
  report += `## 3. יישויות לא נגישות (${results.notAccessible.length})\n\n`;
  report += `יישויות שלא נגישות דרך REST API (400, 404, וכד'):\n\n`;
  
  // Group by error type
  const errorGroups = {};
  results.notAccessible.forEach(item => {
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
      report += `${index + 1}. **${item.entity}**\n`;
      if (item.error) {
        report += `   - שגיאה: ${item.error}\n`;
      }
    });
    report += `\n`;
  });

  return report;
}

main();

