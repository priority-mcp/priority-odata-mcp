import { registerQueryBuilderPrompt } from './query-builder-prompt.js';
import { registerEntityRelationshipPrompt } from './entity-relationship-prompt.js';
import { registerDataModificationPrompt } from './data-modification-prompt.js';
import { registerDateHandlingPrompt } from './date-handling-prompt.js';
import { registerFailurePatternsPrompt } from './failure-patterns-prompt.js';
import { registerPaginationGuidePrompt } from './pagination-guide-prompt.js';

export function registerPriorityPrompts(registry, client) {
    registerQueryBuilderPrompt(registry, client);
    registerEntityRelationshipPrompt(registry, client);
    registerDataModificationPrompt(registry, client);
    registerDateHandlingPrompt(registry, client);
    registerFailurePatternsPrompt(registry, client);
    registerPaginationGuidePrompt(registry);
}

