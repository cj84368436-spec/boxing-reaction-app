import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';

const projectRequire = createRequire(import.meta.url);
// Prefer project dependencies. A managed executor may supply QA tools separately.
export function requireQaModule(name) {
  try { return projectRequire(name); }
  catch (error) {
    if (!process.env.BOXING_QA_MODULES) throw new Error(`QA dependency ${name} unavailable. Install it in the QA environment or set BOXING_QA_MODULES.`, {cause:error});
    return createRequire(resolve(process.env.BOXING_QA_MODULES, '../qa-loader.cjs'))(resolve(process.env.BOXING_QA_MODULES, name));
  }
}
const {chromium: browserType} = requireQaModule('playwright');
export const chromium = {
  launch(options = {}) {
    return browserType.launch({...options,
      ...(process.env.BOXING_BROWSER_PATH ? {executablePath:process.env.BOXING_BROWSER_PATH} : {}),
    });
  },
};
mkdirSync('artifacts/cloud-qa', {recursive:true});
