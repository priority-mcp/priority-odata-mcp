export class ToolRegistry {
    tools = new Map();
    registerTool(desc, handler) {
        this.tools.set(desc.name, { desc, handler });
    }
    listTools() {
        return Array.from(this.tools.values()).map((v) => v.desc);
    }
    /** @returns {Array<{ desc: object, handler: Function }>} */
    listToolEntries() {
        return Array.from(this.tools.values());
    }
    async callTool(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return tool.handler(args);
    }
}

