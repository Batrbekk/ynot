import type { RenderedTemplate } from "./render-template-registry-types";

export type { RenderedTemplate };

type Renderer = (payload: unknown) => Promise<RenderedTemplate>;

const REGISTRY: Record<string, Renderer> = {};

/**
 * Register a renderer under a stable name. Group D template files call this
 * at module load to advertise themselves; the worker then looks them up by
 * the same name stored on `EmailJob.template`.
 */
export function registerTemplate(name: string, renderer: Renderer): void {
  REGISTRY[name] = renderer;
}

/**
 * Look up a registered renderer and invoke it. Throws if `name` is unknown
 * — this should be impossible in production because every `EmailJob` is
 * enqueued with a name that some `_register.ts` side-effect file has bound.
 */
export async function renderTemplate(
  name: string,
  payload: unknown,
): Promise<RenderedTemplate> {
  const renderer = REGISTRY[name];
  if (!renderer) {
    throw new Error(`Email template not registered: ${name}`);
  }
  return renderer(payload);
}

/**
 * Test-only escape hatch: clears the registry so tests don't leak state
 * across files. Not for production use.
 */
export function _clearRegistryForTests(): void {
  for (const k of Object.keys(REGISTRY)) delete REGISTRY[k];
}
