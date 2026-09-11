import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { loadConfigFromEnv } from './config.js';
import { ToolRegistry } from './mcp/registry.js';
import { PromptRegistry } from './mcp/prompt-registry.js';
import { ResourceRegistry } from './mcp/resource-registry.js';
import { MCPProtocolHandler } from './mcp/handler.js';
import { createPriorityMcpServer } from './mcp/priority-mcp-sdk-server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { PriorityClient } from './priority/client.js';
import { registerPriorityTools } from './tools/priorityTools.js';
import { registerPriorityPrompts } from './prompts/priorityPrompts.js';
import { registerPriorityResources } from './resources/priorityResources.js';
import { createSSEServer } from './sseServer.js';
import { SERVER_VERSION, KNOWN_ISSUES } from './version.js';
export class PriorityMCPServer {
    app = express();
    cfg = loadConfigFromEnv();
    tools = new ToolRegistry();
    prompts = new PromptRegistry();
    resources = new ResourceRegistry();
    handler = new MCPProtocolHandler(this.tools, {
        prompts: this.prompts,
        resources: this.resources,
        strictDataIntegrity: this.cfg.dataIntegrity?.strict !== false
    });
    priorityClient = new PriorityClient(this.cfg.priority, { 
        logger: (l) => this.log(l),
        strictDataIntegrity: this.cfg.dataIntegrity?.strict !== false
    });
    sse;
    constructor() {
        this.setupTools();
        this.setupPrompts();
        this.setupResources();
        this.setupMiddleware();
        this.setupRoutes();
        if (this.cfg.server.sseEnabled) {
            this.sse = createSSEServer();
            this.setupSSERoutes();
        }
    }
    listen() {
        const server = this.app.listen(this.cfg.server.port, this.cfg.server.host, () => {
            this.log(`Priority MCP server listening on http://${this.cfg.server.host}:${this.cfg.server.port}`);
        });
        // Force short/closed connections so CLI callers (curl) never appear to "hang"
        try {
            // Streamable HTTP MCP relies on keep-alive for the handshake sequence
            // (initialize → notifications/initialized → tools/list).
            // Setting keepAliveTimeout=0 breaks connection reuse causing "Loading tools" hangs.
            server.keepAliveTimeout = 60000; // 60s idle before closing keep-alive
            server.headersTimeout = 30000; // 30s for headers (Docker/WSL2 adds latency)
            // @ts-ignore - not always present, but set when available
            if (server.requestTimeout !== undefined) server.requestTimeout = 120000;
        }
        catch (_e) {
            // noop - best-effort hardening
        }
    }
    setupTools() {
        registerPriorityTools(this.tools, this.priorityClient);
    }
    setupPrompts() {
        registerPriorityPrompts(this.prompts, this.priorityClient);
    }
    setupResources() {
        registerPriorityResources(this.resources, this.priorityClient);
    }
    setupMiddleware() {
        this.app.disable('x-powered-by');
        const corsOptions = {
            origin: true,
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['Content-Length', 'Content-Type']
        };
        this.app.use(cors(corsOptions));
        this.app.options('*', cors(corsOptions));
        this.app.use(express.json({ limit: '10mb' }));
        // Bearer token guard — prefer ODATA_MCP_TOKEN from the environment (never hardcode secrets).
        // If absent, a random token is generated per-process and printed once at startup.
        this.mcpBearerToken = (() => {
            if (process.env.ODATA_MCP_TOKEN) return process.env.ODATA_MCP_TOKEN;
            const generated = crypto.randomUUID();
            console.warn('[security] ODATA_MCP_TOKEN is not set. A random token has been generated for this session:');
            console.warn(`[security]   Bearer ${generated}`);
            console.warn('[security] Set ODATA_MCP_TOKEN in your environment to use a stable, known token.');
            return generated;
        })();
        // /token is intentionally NOT open: it returns the MCP bearer token, so callers must already hold it.
        const _OPEN = new Set(['/', '/health', '/authorize', '/register']);
        this.app.use((req, res, next) => {
            if (_OPEN.has(req.path) || req.path.startsWith('/.well-known/')) return next();
            if ((req.headers['authorization'] || '') === `Bearer ${this.mcpBearerToken}`) return next();
            return res.status(401).json({ error: 'Unauthorized' });
        });
    }
    setupRoutes() {
        // OAuth 2.1 endpoints (required by MCP 2025-03-26 / Claude Code 2.1.92+)
        // Implements authorization_code + PKCE flow for localhost. /authorize auto-approves, but /token sits
        // behind the Bearer guard, so the flow never grants access to a caller without ODATA_MCP_TOKEN.
        const pendingCodes = new Map(); // code -> { redirectUri, codeChallenge }
        const httpPort = this.cfg.server.port;
        const defaultPublicHost = this.cfg.server.host === '0.0.0.0' ? 'localhost' : this.cfg.server.host;
        this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
            const base = `http://${defaultPublicHost}:${httpPort}`;
            res.json({
                issuer: base,
                authorization_endpoint: `${base}/authorize`,
                token_endpoint: `${base}/token`,
                registration_endpoint: `${base}/register`,
                response_types_supported: ['code'],
                grant_types_supported: ['authorization_code', 'client_credentials'],
                token_endpoint_auth_methods_supported: ['none']
            });
        });
        this.app.post('/register', (req, res) => {
            res.json({
                client_id: `mcp-client-${Date.now()}`,
                client_secret: 'mcp-local-secret',
                token_endpoint_auth_method: 'none',
                grant_types: req.body.grant_types || ['authorization_code'],
                redirect_uris: req.body.redirect_uris || []
            });
        });
        // Authorization endpoint — auto-approve, redirect back with code
        this.app.get('/authorize', (req, res) => {
            const { redirect_uri, state, code_challenge } = req.query;
            if (!redirect_uri) { res.status(400).send('Missing redirect_uri'); return; }
            const code = crypto.randomUUID();
            pendingCodes.set(code, { redirectUri: redirect_uri, codeChallenge: code_challenge });
            setTimeout(() => pendingCodes.delete(code), 5 * 60 * 1000);
            const target = new URL(redirect_uri);
            target.searchParams.set('code', code);
            if (state) target.searchParams.set('state', state);
            res.redirect(target.toString());
        });

        this.app.post('/token', express.urlencoded({ extended: false }), (req, res) => {
            const { grant_type, code, code_verifier } = req.body || {};
            if (grant_type === 'authorization_code') {
                const codeData = pendingCodes.get(code);
                if (!codeData) { res.status(400).json({ error: 'invalid_grant' }); return; }
                // Verify PKCE
                if (codeData.codeChallenge && code_verifier) {
                    const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
                    if (hash !== codeData.codeChallenge) {
                        res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE failed' }); return;
                    }
                }
                pendingCodes.delete(code);
            }
            // Reached only with a valid Bearer header (see guard), so this never discloses the token
            // to an unauthenticated caller. Clients reuse it on /mcp.
            res.json({ access_token: this.mcpBearerToken, token_type: 'Bearer', expires_in: 86400 });
        });

        this.app.get('/', (req, res) => {
            res.json({
                name: 'Priority MCP Server',
                version: SERVER_VERSION,
                endpoints: {
                    mcp: '/mcp',
                    mcpInfo: '/mcp/info',
                    health: '/health',
                    capabilities: '/capabilities',
                    sse: this.cfg.server.sseEnabled ? '/sse' : undefined
                }
            });
        });
        this.app.get('/health', async (req, res) => {
            try {
                // lightweight check: do not block on remote call by default
                res.json({
                    status: 'ok',
                    time: new Date().toISOString()
                });
            }
            catch (err) {
                res.status(500).json({ status: 'error', message: err?.message || 'unknown error' });
            }
        });
        // Proxy the OData $metadata endpoint so external tools (e.g. WebFetch) can discover
        // entity sets, key fields, and navigation properties without needing direct access to
        // the internal Docker network (host.docker.internal).
        // Note: Escaping the $ with [strict] because Express's path-to-regexp treats bare $ as "end of string".
        this.app.get('/[$]metadata', async (req, res) => {
            try {
                const response = await this.priorityClient.axios.get('$metadata', {
                    responseType: 'text',
                    transformResponse: [(data) => data]
                });
                const xml = typeof response.data === 'string' ? response.data : String(response.data);
                res.set('Content-Type', 'application/xml; charset=utf-8');
                res.send(xml);
            } catch (error) {
                const statusCode = error?.response?.status || 502;
                const errMsg = error?.response?.data
                    ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
                    : (error.message || 'Unknown error');
                this.log(`[$metadata] failed: ${statusCode} ${errMsg}`);
                res.status(statusCode).set('Content-Type', 'application/json').json({
                    error: 'Failed to fetch $metadata from Priority server',
                    detail: errMsg,
                    statusCode
                });
            }
        });

        this.app.get('/capabilities', (req, res) => {
            const tools = this.tools.listTools();
            res.json({
                name: 'Priority MCP Server',
                version: SERVER_VERSION,
                protocolVersion: 'streamable-http (@modelcontextprotocol/sdk)',
                serverInfo: {
                    name: 'Priority MCP Server',
                    version: SERVER_VERSION
                },
                capabilities: {
                    tools: {
                        listChanged: true
                    },
                    prompts: {},
                    resources: {}
                },
                tools: {
                    count: tools.length,
                    list: tools.map(tool => ({
                        name: tool.name,
                        description: tool.description
                    }))
                },
                transport: {
                    type: 'http',
                    version: '1.0',
                    sseEnabled: this.cfg.server.sseEnabled,
                    endpoints: {
                        mcp: '/mcp',
                        mcpInfo: '/mcp/info',
                        health: '/health',
                        capabilities: '/capabilities',
                        sse: this.cfg.server.sseEnabled ? '/sse' : undefined
                    }
                },
                priority: {
                    baseUrl: this.cfg.priority.baseUrl,
                    authType: this.cfg.priority.authType,
                    timeoutMs: this.cfg.priority.timeoutMs
                },
                knownIssues: KNOWN_ISSUES
            });
        });
        this.app.get('/mcp/info', (req, res) => {
            res.json({
                name: 'Priority MCP Server',
                version: SERVER_VERSION,
                endpoint: '/mcp',
                transport: 'Streamable HTTP (@modelcontextprotocol/sdk StreamableHTTPServerTransport, stateless)',
                description: 'MCP endpoint for Priority ERP (OData). POST JSON-RPC batches per MCP streamable HTTP spec.',
                note: 'GET /mcp returns MCP discovery JSON; this route is extra human-oriented metadata.',
                exampleTool: 'query_run',
                documentation: 'See README.md for full API documentation'
            });
        });
        const mcpInfo405 = {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed for this path. Use POST /mcp for MCP (streamable HTTP). Discovery: GET /mcp/info' },
            id: null
        };
        this.app.get('/mcp', (req, res) => {
            res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8').json({
                jsonrpc: '2.0',
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: { listChanged: true },
                        prompts: { listChanged: true },
                        resources: { listChanged: true }
                    },
                    serverInfo: { name: 'Priority MCP Server', version: SERVER_VERSION }
                }
            });
        });
        this.app.delete('/mcp', (req, res) => {
            res.status(405).setHeader('Content-Type', 'application/json; charset=utf-8').json(mcpInfo405);
        });
        const quietMcpMethods = ['tools/list', 'prompts/list', 'resources/list', 'initialize', 'notifications/initialized', 'resources/subscribe'];
        const mcpLogLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
        const shouldLogMcpRequest = (method) => !quietMcpMethods.includes(method) || mcpLogLevel === 'DEBUG';
        this.app.post('/mcp', async (req, res) => {
            const startTime = Date.now();
            const body = req.body;
            const method = body?.method || 'unknown';
            const toolName = body?.params?.name || 'unknown';
            let mcpServer;
            let transport;
            try {
                if (shouldLogMcpRequest(method)) {
                    this.log(`[REQUEST] ${method}${toolName ? ` tool=${toolName}` : ''} id=${body?.id ?? 'null'}`);
                }
                mcpServer = createPriorityMcpServer(this.tools, this.prompts, this.resources, {
                    strictDataIntegrity: this.cfg.dataIntegrity?.strict !== false
                });
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined
                });
                await mcpServer.connect(transport);
                await transport.handleRequest(req, res, body);
                const duration = Date.now() - startTime;
                if (shouldLogMcpRequest(method)) {
                    this.log(`[RESPONSE] ${method} streamable-http finished (${duration}ms)`);
                }
            }
            catch (err) {
                const duration = Date.now() - startTime;
                if (shouldLogMcpRequest(method)) {
                    this.log(`[ERROR] ${method} EXCEPTION: ${err?.message || 'unknown'} (${duration}ms)`);
                }
                if (!res.headersSent) {
                    res.status(500).json({
                        jsonrpc: '2.0',
                        id: body?.id ?? null,
                        error: { code: -32000, message: err?.message || 'Internal error' }
                    });
                }
            }
            finally {
                let cleaned = false;
                const cleanup = async () => {
                    if (cleaned) return;
                    cleaned = true;
                    try {
                        if (transport) await transport.close();
                        if (mcpServer) await mcpServer.close();
                    }
                    catch (_e) {
                        // ignore shutdown errors
                    }
                };
                res.once('close', () => void cleanup());
                res.once('finish', () => void cleanup());
            }
        });
        this.app.use((err, req, res, next) => {
            res.status(500).json({ error: 'Internal Server Error', message: err.message });
        });
    }
    setupSSERoutes() {
        if (!this.sse)
            return;
        this.app.get('/sse', (req, res) => {
            this.sse.handleConnection(req, res);
        });
        // Accept POST to either /sse (Cursor default) or /sse/message (our original)
        const handleMessagePost = async (req, res) => {
            try {
                // Accept multiple shapes:
                // 1) { connectionId, message }
                // 2) just the MCP message object (jsonrpc: "2.0", ...)
                // 3) header X-Connection-Id or infer single active connection
                const body = req.body || {};
                const hasJsonRpc = typeof body === 'object' && body.jsonrpc && body.method;
                const msg = hasJsonRpc ? body : body.message;
                const headerConn = req.header('x-connection-id') || req.header('X-Connection-Id');
                let connectionId = body.connectionId || headerConn;
                if (!connectionId && this.sse?.getFirstConnectionId) {
                    connectionId = this.sse.getFirstConnectionId();
                }
                if (!connectionId || !msg) {
                    res.status(400).json({ error: 'Missing connectionId or message' });
                    return;
                }
                const response = await this.handler.handle(msg);
                this.sse.sendTo(connectionId, 'mcp_response', response);
                res.json({ sent: true });
            }
            catch (err) {
                res.status(500).json({ error: err?.message || 'Internal error' });
            }
        };
        this.app.post('/sse', handleMessagePost);
        this.app.post('/sse/message', async (req, res) => {
            try { await handleMessagePost(req, res); }
            catch (err) { /* already handled */ }
        });
        this.app.get('/sse/status', (req, res) => {
            res.json(this.sse.status());
        });
    }
    log(line) {
        // eslint-disable-next-line no-console
        console.log(`[priority-mcp] ${line}`);
    }
}

