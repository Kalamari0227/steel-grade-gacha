import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(process.env.SGG_APP_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
export const baselineRoot = path.resolve(process.env.SGG_BASELINE_ROOT || `${root}/.omo/baseline/site`);
export const evidenceRoot = path.resolve(process.env.SGG_EVIDENCE_DIR || (process.env.SGG_EVIDENCE_ROOT ? `${process.env.SGG_EVIDENCE_ROOT}/task-${process.env.SGG_TASK_ID || 2}` : `${root}/.omo/evidence/task-${process.env.SGG_TASK_ID || 2}`));
export const appURL = `http://127.0.0.1:${process.env.SGG_APP_PORT || 4273}`;
export const baselineURL = `http://127.0.0.1:${process.env.SGG_BASELINE_PORT || 4274}`;
export const fixedTime = '2026-11-01T00:00:00+09:00';
