export class ResourceRegistry {
    resources = new Map();
    
    registerResource(uri, handler) {
        this.resources.set(uri, handler);
    }
    
    listResources() {
        return Array.from(this.resources.keys()).map(uri => {
            const handler = this.resources.get(uri);
            return {
                uri,
                name: handler.name || uri,
                description: handler.description || '',
                mimeType: handler.mimeType || 'application/json'
            };
        });
    }
    /** @returns {Array<{ uri: string, name: string, description: string, mimeType: string, handler: Function }>} */
    listResourceEntries() {
        return Array.from(this.resources.entries()).map(([uri, meta]) => ({
            uri,
            name: meta.name || uri,
            description: meta.description || '',
            mimeType: meta.mimeType || 'application/json',
            handler: meta.handler
        }));
    }
    
    async readResource(uri) {
        const handler = this.resources.get(uri);
        if (handler) {
            return handler.handler();
        }
        
        // Try pattern matching for dynamic resources
        for (const [pattern, resourceHandler] of this.resources.entries()) {
            if (pattern.includes('{') && pattern.includes('}')) {
                // Simple pattern matching - convert pattern to regex
                const regexPattern = pattern.replace(/\{[^}]+\}/g, '([^/]+)');
                const regex = new RegExp(`^${regexPattern}$`);
                if (regex.test(uri)) {
                    const matches = uri.match(regex);
                    const args = {};
                    // Extract parameter names from pattern
                    const paramNames = pattern.match(/\{([^}]+)\}/g)?.map(p => p.slice(1, -1)) || [];
                    paramNames.forEach((name, index) => {
                        args[name] = matches[index + 1];
                    });
                    return resourceHandler.handler(args);
                }
            }
        }
        throw new Error(`Resource not found: ${uri}`);
    }
}

