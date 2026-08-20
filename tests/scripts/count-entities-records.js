/**
 * Script to count records in each FORMLIMITED entity
 * Usage: node count-entities-records.js
 */

import dotenv from 'dotenv';
import { PriorityClient } from '../../dist/priority/client.js';
import { loadConfig } from '../../dist/config.js';

dotenv.config();

const config = loadConfig();
const client = new PriorityClient(config, {
    strictDataIntegrity: true
});

// Get all entities from FORMLIMITED
async function getFormLimitedEntities() {
    const result = await client.runQuery('FORMLIMITED', {
        filter: "RESTFLAG eq 'Y'",
        select: ['ENAME', 'TITLE'],
        orderby: 'ENAME'
    });
    return result.value || [];
}

// Count records in an entity
async function countRecords(entityName) {
    try {
        // Try to get all records with a large top value
        const result = await client.runQuery(entityName, {
            top: 10000,
            select: ['*']
        });
        return result.value ? result.value.length : 0;
    } catch (error) {
        // If error, return -1 to indicate error
        return -1;
    }
}

// Get sample record
async function getSampleRecord(entityName) {
    try {
        const result = await client.runQuery(entityName, {
            top: 1
        });
        return result.value && result.value.length > 0 ? result.value[0] : null;
    } catch (error) {
        return null;
    }
}

// Main function
async function main() {
    console.log('Fetching FORMLIMITED entities...');
    const entities = await getFormLimitedEntities();
    console.log(`Found ${entities.length} entities\n`);

    const results = [];

    for (const entity of entities) {
        const entityName = entity.ENAME;
        console.log(`Processing ${entityName}...`);
        
        const count = await countRecords(entityName);
        const sample = await getSampleRecord(entityName);
        
        results.push({
            entityName,
            title: entity.TITLE,
            recordCount: count,
            sample: sample
        });
        
        console.log(`  Count: ${count >= 0 ? count : 'ERROR'}`);
    }

    // Generate report
    const report = {
        timestamp: new Date().toISOString(),
        totalEntities: entities.length,
        entities: results
    };

    return report;
}

main()
    .then(report => {
        const fs = await import('fs');
        fs.writeFileSync(
            'tests/reports/entities-count-report.json',
            JSON.stringify(report, null, 2)
        );
        console.log('\nReport saved to tests/reports/entities-count-report.json');
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });

