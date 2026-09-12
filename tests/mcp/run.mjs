import fs from 'node:fs';
import { rpc, callTool, record, results, rows, short, httpChecks, protocolChecks, listAll } from './suite.mjs';

const t0 = Date.now();
await httpChecks();
await protocolChecks();
const { tools, prompts, resources } = await listAll();
const has = (n) => tools.some((t) => t.name === n);

const G = 'tools';
let r;

r = await callTool('version_get', {});
record(G, 'version_get', !r.isError && !!r.data, short(r.data), r.ms);

r = await callTool('instructions_get', {});
record(G, 'instructions_get returns guidance', !r.isError && !!r.data?.authentication, `keys=${Object.keys(r.data || {}).length}`, r.ms);
record(G, 'instructions_get documents PAT as Basic', /Basic <base64\(<PAT>:PAT\)>/.test(JSON.stringify(r.data || '')), '', 0);

r = await callTool('metadata_entities_list', {}, { timeout: 180000 });
const entList = rows(r.data) || r.data?.entities || null;
record(G, 'metadata_entities_list', !r.isError && Array.isArray(entList) && entList.length > 0, Array.isArray(entList) ? `${entList.length} entities` : short(r.data), r.ms);

r = await callTool('metadata_schema_get', { entity: 'CUSTOMERS' });
record(G, 'metadata_schema_get CUSTOMERS', !r.isError && !!r.data, short(r.data, 160), r.ms);

r = await callTool('metadata_schema_get', { entity: 'ZZZ_NO_SUCH_ENTITY' });
record(G, 'metadata_schema_get unknown entity -> graceful error', !!r.isError || /error|not found|400|404/i.test(JSON.stringify(r.data || '')), short(r.data, 160), r.ms);

r = await callTool('query_run', { entity: 'CUSTOMERS', top: 2 });
const cust = rows(r.data);
record(G, 'query_run CUSTOMERS top=2', !r.isError && cust?.length === 2, cust ? `fields=${Object.keys(cust[0]).length}` : short(r.data), r.ms);

r = await callTool('query_run', { entity: 'CUSTOMERS', top: 2, select: ['CUSTNAME', 'CUSTDES'] });
const sel = rows(r.data);
const selKeys = sel ? Object.keys(sel[0]).filter((k) => !k.startsWith('@') && k !== '_mcp_metadata') : [];
record(G, 'query_run $select narrows fields', !r.isError && sel?.length > 0 && selKeys.length <= 3, `keys=${selKeys.join(',')}`, r.ms);

r = await callTool('query_run', { entity: 'CUSTOMERS', filter: "CUSTNAME eq '1001'", top: 5 });
const filt = rows(r.data);
record(G, 'query_run $filter applied', !r.isError && filt?.length >= 1 && filt.every((x) => x.CUSTNAME === '1001'), `rows=${filt?.length}`, r.ms);

r = await callTool('query_run', { entity: 'CUSTOMERS', top: 3, orderby: 'CUSTNAME desc' });
const ord = rows(r.data);
const ordNames = ord ? ord.map((x) => x.CUSTNAME) : [];
record(G, 'query_run $orderby desc', !r.isError && ord?.length === 3 && [...ordNames].sort().reverse().join() === ordNames.join(), ordNames.join(' > '), r.ms);

r = await callTool('query_run', { entity: 'CUSTOMERS', top: 1, count: true }, { timeout: 180000 });
const cnt = r.data?.['@odata.count'] ?? r.data?.['odata.count'];
record(G, 'query_run count=true returns @odata.count', !r.isError && typeof cnt === 'number', `count=${cnt} source=${r.data?._mcp_metadata?.count_source}`, r.ms);

r = await callTool('query_run', { entity: 'CUSTOMERS', top: 1, select: ['NO_SUCH_FIELD_X'] });
const blockedMsg = JSON.stringify(r.data || r.raw || '');
record(G, 'query_run invalid $select blocked with field list', /Invalid \$select field|Valid fields/i.test(blockedMsg), short(blockedMsg, 160), r.ms);

r = await callTool('query_run', { entity: 'ZZZ_NO_SUCH_ENTITY', top: 1 });
record(G, 'query_run unknown entity -> graceful error', !!r.isError || /error|404|400/i.test(JSON.stringify(r.data || '')), short(r.data, 140), r.ms);

r = await callTool('query_run', {});
record(G, 'query_run missing entity -> validation error', !!r.isError || !!r.rpcError, short(r.rpcError?.message || r.data, 140), r.ms);

r = await callTool('query_run', { entity: 'ORDERS', top: 2, expand: 'ORDERITEMS_SUBFORM' }, { timeout: 180000 });
const exp = rows(r.data);
record(G, 'query_run $expand subform', !r.isError && exp?.length > 0 && 'ORDERITEMS_SUBFORM' in exp[0], exp ? `keys=${Object.keys(exp[0]).slice(0, 5).join(',')}` : short(r.data, 140), r.ms);

if (has('safe_query_run')) {
    r = await callTool('safe_query_run', { entity: 'CUSTOMERS', top: 2 }, { timeout: 180000 });
    record(G, 'safe_query_run CUSTOMERS top=2', !r.isError && (rows(r.data)?.length > 0 || !!r.data), short(r.data, 140), r.ms);
}

r = await callTool('query_run', { entity: 'CUSTOMERS', top: 2, skip: 1 });
const skipped = rows(r.data);
record(G, 'query_run $skip paginates', !r.isError && skipped?.length === 2 && skipped[0].CUSTNAME !== cust?.[0]?.CUSTNAME, `first=${skipped?.[0]?.CUSTNAME}`, r.ms);

r = await callTool('query_run', { entity: 'CUSTOMERS', top: 0, count: true }, { timeout: 180000 });
const cnt0 = r.data?.['@odata.count'] ?? r.data?.['odata.count'];
record(G, 'query_run top=0 + count=true (count-only)', !r.isError && typeof cnt0 === 'number', `count=${cnt0}`, r.ms);

r = await callTool('metadata_schema_get', { entity: 'ORDERS' }, { timeout: 180000 });
record(G, 'metadata_schema_get ORDERS', !r.isError && !!r.data, short(r.data, 100), r.ms);

// entity_get must return the actual record — '1001' is a string key that merely looks numeric
r = await callTool('entity_get', { entity: 'CUSTOMERS', lookup: { CUSTNAME: '1001' } }, { timeout: 180000 });
record(G, 'entity_get by lookup returns the record', !r.isError && r.data?.CUSTNAME === '1001' && !r.data?.error, short(r.data?.error ? r.data : r.data?.CUSTDES, 140), r.ms);

r = await callTool('entity_get', { entity: 'CUSTOMERS', key: '1001' }, { timeout: 180000 });
record(G, 'entity_get by numeric-looking string key', !r.isError && r.data?.CUSTNAME === '1001' && !r.data?.error, short(r.data?.error ? r.data : r.data?.CUSTDES, 140), r.ms);

r = await callTool('entity_get', { entity: 'CUSTOMERS', key: '1001', select: ['CUSTNAME', 'CUSTDES'] }, { timeout: 180000 });
record(G, 'entity_get with $select', !r.isError && r.data?.CUSTNAME === '1001', short(Object.keys(r.data || {}).filter((k) => !k.startsWith('@')).join(','), 140), r.ms);

r = await callTool('entity_get', { entity: 'CUSTOMERS', key: 'ZZ_NO_SUCH_CUSTOMER' }, { timeout: 180000 });
record(G, 'entity_get unknown key -> graceful error object', !!r.isError || !!r.data?.error || /not found|404/i.test(JSON.stringify(r.data || '')), short(r.data?.error ?? r.data, 120), r.ms);

r = await callTool('entity_get', { entity: 'ORDERS', key: 'SO15000005', expand: 'ORDERITEMS_SUBFORM' }, { timeout: 180000 });
record(G, 'entity_get with $expand subform', !r.isError && !r.data?.error && 'ORDERITEMS_SUBFORM' in (r.data || {}), short(r.data?.error ?? Object.keys(r.data || {}).slice(0, 4).join(','), 140), r.ms);
r = await callTool('entity_get', { entity: 'CUSTOMERS' });
record(G, 'entity_get without key/lookup -> validation error', !!r.isError || !!r.rpcError, short(r.rpcError?.message || r.data, 140), r.ms);

r = await callTool('query_run', { entity: 'ORDERS', top: 1, select: ['ORDNAME'] }, { timeout: 180000 });
const ordName = rows(r.data)?.[0]?.ORDNAME;
record(G, 'query_run ORDERS fixture row', !!ordName, `ORDNAME=${ordName}`, r.ms);
if (ordName) {
    // Priority answers 404 for these on an order with no text/attachments — the tool must
    // surface that as a clear error rather than hanging or returning empty success.
    r = await callTool('entity_text_get', { entity: 'ORDERS', key: `'${ordName}'` }, { timeout: 120000 });
    record(G, 'entity_text_get surfaces 404 clearly', (!!r.isError || !!r.data?.error || /404|not found|Failed to fetch/i.test(JSON.stringify(r.data || ''))) && r.ms < 60000, short(r.data, 120), r.ms);
    r = await callTool('entity_attachments_get', { entity: 'ORDERS', key: `'${ordName}'` }, { timeout: 120000 });
    record(G, 'entity_attachments_get surfaces 404 clearly', (!!r.isError || !!r.data?.error || /404|not found|Failed to fetch/i.test(JSON.stringify(r.data || ''))) && r.ms < 60000, short(r.data, 120), r.ms);
}

if (has('query_sum')) {
    r = await callTool('query_sum', { entity: 'ORDERS', filter: "CUSTNAME eq '1001'" }, { timeout: 240000 });
    record(G, 'query_sum ORDERS filtered', !r.isError && typeof r.data?.value === 'number', `value=${r.data?.value} method=${r.data?.method}`, r.ms);
}

for (const tool of ['entity_create', 'entity_update', 'entity_delete', 'entity_text_create', 'entity_text_update', 'entity_attachments_upload', 'batch_operations', 'config_restflag_update']) {
    if (!has(tool)) continue;
    r = await callTool(tool, {}, { timeout: 30000 });
    record('validation', `${tool} empty args -> error, no write`, !!r.isError || !!r.rpcError, short(r.rpcError?.message || r.data, 120), r.ms);
}

for (const p of prompts) {
    const args = {};
    for (const a of p.arguments || []) {
        if (!a.required) continue;
        const n = a.name.toLowerCase();
        args[a.name] = n.includes('entity') ? 'CUSTOMERS' : n.includes('year') ? '2025' : n.includes('date') ? '2025-01-01' : n.includes('field') ? 'CUSTNAME' : n.includes('count') ? '10' : n.includes('operation') ? 'create' : 'test';
    }
    const res = await rpc('prompts/get', { name: p.name, arguments: args });
    const msgs = res.json?.result?.messages;
    record('prompts', `prompts/get ${p.name}`, res.status === 200 && Array.isArray(msgs) && msgs.length > 0, res.json?.error ? short(res.json.error.message) : `messages=${msgs?.length}`);
}

for (const res of resources) {
    const rr = await rpc('resources/read', { uri: res.uri }, { timeout: 180000 });
    const c = rr.json?.result?.contents?.[0];
    record('resources', `resources/read ${res.uri}`, rr.status === 200 && !!c && (!!c.text || !!c.blob), rr.json?.error ? short(rr.json.error.message) : `len=${c?.text?.length ?? 0}`);
}
{
    const uri = 'priority://entity-schema/CUSTOMERS';
    const rr = await rpc('resources/read', { uri }, { timeout: 180000 });
    const c = rr.json?.result?.contents?.[0];
    record('resources', `resources/read ${uri} (template)`, rr.status === 200 && !!c?.text, rr.json?.error ? short(rr.json.error.message) : `len=${c?.text?.length ?? 0}`);
}
{
    const badRes = await rpc('resources/read', { uri: 'priority://nope/xyz' });
    record('resources', 'resources/read unknown uri -> error', !!badRes.json?.error || badRes.status >= 400, short(badRes.json?.error?.message));
}

const failed = results.filter((x) => !x.ok);
const bygroup = {};
for (const x of results) { bygroup[x.group] ??= { pass: 0, fail: 0 }; x.ok ? bygroup[x.group].pass++ : bygroup[x.group].fail++; }
console.log('\n================ SUMMARY ================');
for (const [g, v] of Object.entries(bygroup)) console.log(`  ${g.padEnd(12)} pass=${v.pass} fail=${v.fail}`);
console.log(`  TOTAL pass=${results.length - failed.length} fail=${failed.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed.length) { console.log('\nFAILURES:'); for (const f of failed) console.log(`  [${f.group}] ${f.name} — ${f.detail}`); }
fs.writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
