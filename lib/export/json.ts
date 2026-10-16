import type { Brain } from '@/engine/types';
import { toTree } from '@/lib/export/markdown';

export const toJson = (brain: Brain): string => JSON.stringify(toTree(brain), null, 2);
