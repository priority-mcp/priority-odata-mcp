import { registerEntitiesListResource } from './entities-list-resource.js';
import { registerEntitySchemaResource } from './entity-schema-resource.js';
import { registerCommonQueriesResource } from './common-queries-resource.js';
import { registerSubformReferenceResource } from './subform-reference-resource.js';

export function registerPriorityResources(registry, client) {
    registerEntitiesListResource(registry, client);
    registerEntitySchemaResource(registry, client);
    registerCommonQueriesResource(registry, client);
    registerSubformReferenceResource(registry, client);
}

