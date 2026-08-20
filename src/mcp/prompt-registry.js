export class PromptRegistry {
    prompts = new Map();
    
    registerPrompt(desc, handler) {
        this.prompts.set(desc.name, { desc, handler });
    }
    
    listPrompts() {
        return Array.from(this.prompts.values()).map((v) => v.desc);
    }
    /** @returns {Array<{ desc: object, handler: Function }>} */
    listPromptEntries() {
        return Array.from(this.prompts.values());
    }
    
    async getPrompt(name, args = {}) {
        const prompt = this.prompts.get(name);
        if (!prompt) {
            throw new Error(`Prompt not found: ${name}`);
        }
        return prompt.handler(args);
    }
}


