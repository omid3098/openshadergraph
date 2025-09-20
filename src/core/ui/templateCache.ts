import type { NodeTemplate } from "../schema/types";

export type TemplateFetcher = (path: string) => Promise<NodeTemplate>;

/**
 * Lightweight loader that caches node templates and coalesces concurrent fetches.
 * Useful for palette-driven template loads so we avoid hammering the network
 * when multiple nodes of the same type are spawned at once.
 */
export function createTemplateCache(fetchTemplate: TemplateFetcher) {
  const cache = new Map<string, NodeTemplate>();
  const inflight = new Map<string, Promise<NodeTemplate>>();
  let version = 0;

  const load = async (type: string, path: string | undefined): Promise<NodeTemplate | undefined> => {
    if (!type || !path) return undefined;
    if (cache.has(type)) {
      return cache.get(type);
    }
    if (inflight.has(type)) {
      return inflight.get(type);
    }
    const request = fetchTemplate(path)
      .then((template) => {
        cache.set(type, template);
        inflight.delete(type);
        return template;
      })
      .catch((err) => {
        inflight.delete(type);
        throw err;
      });
    inflight.set(type, request);
    return request;
  };

  const prime = (type: string, template: NodeTemplate | undefined) => {
    if (!type || !template) return;
    cache.set(type, template);
    inflight.delete(type);
  };

  const reset = () => {
    version += 1;
    cache.clear();
    inflight.clear();
  };

  return {
    load,
    prime,
    reset,
    version: () => version,
  };
}

export type TemplateCache = ReturnType<typeof createTemplateCache>;
