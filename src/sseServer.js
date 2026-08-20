import { v4 as uuidv4 } from 'uuid';
export function createSSEServer() {
    const clients = new Map();
    const start = Date.now();
    function remove(connectionId) {
        const res = clients.get(connectionId);
        if (res) {
            try {
                res.end();
            }
            catch {
                // ignore
            }
        }
        clients.delete(connectionId);
    }
    return {
        handleConnection: (req, res) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();
            const id = uuidv4();
            clients.set(id, res);
            // Emit multiple compatibility events so different clients can pick up the connection id
            writeEvent(res, 'connection_established', { connectionId: id });
            writeEvent(res, 'open', { connectionId: id });
            writeEvent(res, 'ready', { connectionId: id });
            req.on('close', () => {
                remove(id);
            });
            req.on('end', () => {
                remove(id);
            });
        },
        sendTo: (connectionId, event, data) => {
            const res = clients.get(connectionId);
            if (!res)
                return;
            writeEvent(res, event, data);
        },
        // Expose minimal connection inspection helpers for servers that need to infer the target
        getFirstConnectionId: () => {
            const iter = clients.keys();
            const first = iter.next();
            return first && !first.done ? first.value : null;
        },
        getActiveConnectionIds: () => Array.from(clients.keys()),
        status: () => ({
            status: 'running',
            activeConnections: clients.size,
            uptimeSeconds: Math.floor((Date.now() - start) / 1000)
        })
    };
}
function writeEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

