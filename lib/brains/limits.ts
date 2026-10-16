/** Per-user and per-brain ceilings. Pure constants: shared by the repo (enforced) and the client (checked early). */
export const MAX_BRAINS_PER_USER = 100;
export const MAX_NODES_PER_BRAIN = 300;
export const BRAIN_FULL_MESSAGE = `this brain is full (${MAX_NODES_PER_BRAIN} nodes)`;
