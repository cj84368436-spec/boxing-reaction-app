import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

it('preserves SVG component identity through the shared-module production build', () => {
  // Jest's Babel import handling hides this production esbuild interop failure.
  const report = JSON.parse(execFileSync(process.execPath,
    [resolve(__dirname, '../../../scripts/check-shared-svg-imports.cjs')],
    {encoding: 'utf8'})) as {name: string; exportName:string; esModule: boolean; type: string;
      resolvesNamedComponent: boolean; resolvesNamespace: boolean; defaultControlResolvesNamespace: boolean}[];
  expect(report).toHaveLength(16);
  expect(report.filter(value=>value.name==='PlayerDefenseFeedback').map(value=>value.exportName)).toEqual(['G','G']);
  for (const result of report) {
    expect(result).toMatchObject({type: 'function', resolvesNamedComponent: true,
      resolvesNamespace: false, defaultControlResolvesNamespace: true});
  }
});
