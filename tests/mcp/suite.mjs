// Read-only MCP test suite for priority-odata-mcp.
// Usage: TEST_MCP_TOKEN=... node suite.mjs http://127.0.0.1:3011
const base = process.argv[2] || 'http://127.0.0.1:3011';
const token = process.env.TEST_MCP_TOKEN;
const results = [];
let id = 0;

const short = (v, n = 220) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s == null ? '' : (s.length > n ? s.slice(0, n) + '…' : s);
};
function record(group, name, ok, detail = '', ms = 0) {
    results.push({ group, name, ok, detail: short(detail), ms });
    console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${ms ? ` (${ms}ms)` : ''}${detail ? `  — ${short(detail, 200)}` : ''}`);
}

async function rpc(method, params, { auth = true, notify = false, timeout = 120000 } = {}) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (auth) headers.Authorization = `Bearer ${token}`;
    const body = notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params };
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    try {
        const res = await fetch(`${base}/mcp`, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
        const text = await res.text();
        let json = null;
        if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
            for (const line of text.split(/\r?\n/)) {
                if (!line.startsWith('data:')) continue;
                try { const j = JSON.parse(line.slice(5).trim()); if (j.id === body.id) json = j; } catch { }
            }
        } else if (text) { try { json = JSON.parse(text); } catch { } }
        return { status: res.status, json, text };
    } catch (e) {
        return { status: 0, json: null, text: String(e?.name === 'AbortError' ? `timeout after ${timeout}ms` : e) };
    } finally { clearTimeout(t); }
}

const toolPayload = (r) => {
    const txt = r.json?.result?.content?.find((c) => c.type === 'text')?.text;
    let data = txt;
    try { data = JSON.parse(txt); } catch { }
    return { isError: !!r.json?.result?.isError, rpcError: r.json?.error, data, raw: txt };
};
const rows = (d) => Array.isArray(d?.value) ? d.value : Array.isArray(d?.data?.value) ? d.data.value : Array.isArray(d) ? d : null;

async function callTool(name, args, opts = {}) {
    const t0 = Date.now();
    const r = await rpc('tools/call', { name, arguments: args }, opts);
    return { ...toolPayload(r), status: r.status, ms: Date.now() - t0 };
}

// ---------- HTTP surface ----------
async function httpChecks() {
    const g = 'http';
    let r = await fetch(`${base}/health`); record(g, 'GET /health -> 200', r.status === 200, `status=${r.status}`);
    r = await fetch(`${base}/capabilities`, { headers: { Authorization: `Bearer ${token}` } });
    let j = await r.json().catch(() => ({}));
    record(g, 'GET /capabilities lists tools', r.status === 200 && j?.tools?.count > 0, `count=${j?.tools?.count} auth=${j?.priority?.authType}`);
    r = await fetch(`${base}/capabilities`); record(g, 'GET /capabilities without token -> 401', r.status === 401, `status=${r.status}`);
    r = await fetch(`${base}/mcp/info`, { headers: { Authorization: `Bearer ${token}` } }); record(g, 'GET /mcp/info -> 200', r.status === 200, `status=${r.status}`);
    r = await fetch(`${base}/mcp`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); record(g, 'DELETE /mcp -> 405', r.status === 405, `status=${r.status}`);
    r = await fetch(`${base}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    const body = await r.text();
    record(g, 'POST /token unauthenticated -> 401, no token leak', r.status === 401 && !body.includes(token), `status=${r.status}`);
    r = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    record(g, 'POST /mcp without token -> 401', r.status === 401, `status=${r.status}`);
    r = await fetch(`${base}/$metadata`, { headers: { Authorization: `Bearer ${token}` } });
    const xml = await r.text();
    record(g, 'GET /$metadata proxies OData metadata', r.status === 200 && /edmx|EntityType/i.test(xml), `status=${r.status} len=${xml.length}`);
}

// ---------- protocol ----------
async function protocolChecks() {
    const g = 'protocol';
    let r = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'suite', version: '1' } });
    record(g, 'initialize', r.status === 200 && !!r.json?.result?.serverInfo, `server=${r.json?.result?.serverInfo?.name}`);
    r = await rpc('notifications/initialized', {}, { notify: true });
    record(g, 'notifications/initialized', r.status >= 200 && r.status < 300, `status=${r.status}`);
    r = await rpc('tools/call', { name: 'no_such_tool_xyz', arguments: {} });
    const p = toolPayload(r);
    record(g, 'unknown tool -> error (not crash)', !!(p.rpcError || p.isError), short(p.rpcError?.message || p.raw));
    return r;
}

async function listAll() {
    const tools = (await rpc('tools/list', {})).json?.result?.tools || [];
    const prompts = (await rpc('prompts/list', {})).json?.result?.prompts || [];
    const resources = (await rpc('resources/list', {})).json?.result?.resources || [];
    const templates = (await rpc('resources/templates/list', {})).json?.result?.resourceTemplates || [];
    record('discovery', 'tools/list', tools.length > 0, `${tools.length} tools`);
    record('discovery', 'prompts/list', prompts.length > 0, `${prompts.length}: ${prompts.map((p) => p.name).join(', ')}`);
    record('discovery', 'resources/list', resources.length > 0, `${resources.length}: ${resources.map((r) => r.uri).join(', ')}`);
    record('discovery', 'resources/templates/list', true, `${templates.length}: ${templates.map((t) => t.uriTemplate).join(', ')}`);
    for (const t of tools) {
        const s = t.inputSchema;
        record('schema', `${t.name} has description+schema`, !!t.description && !!s && s.type === 'object', !t.description ? 'missing description' : '');
    }
    return { tools, prompts, resources, templates };
}
export { rpc, callTool, record, results, rows, short, httpChecks, protocolChecks, listAll, toolPayload };
