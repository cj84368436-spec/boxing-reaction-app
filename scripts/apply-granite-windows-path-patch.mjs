import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const replacements = [
  {
    file: 'node_modules/@granite-js/plugin-micro-frontend/dist/index.js',
    before: 'path.resolve(modulePath)',
    after: 'path.resolve(modulePath).split(path.sep).join("/")',
  },
  {
    file: 'node_modules/@granite-js/plugin-micro-frontend/dist/index.cjs',
    before: 'path.default.resolve(modulePath)',
    after: 'path.default.resolve(modulePath).split(path.default.sep).join("/")',
  },
  {
    file: 'node_modules/@apps-in-toss/plugin-compat/dist/index.js',
    before: '__require.resolve("react18-use")',
    after: '__require.resolve("react18-use").replaceAll("\\\\", "/")',
  },
  {
    file: 'node_modules/@apps-in-toss/plugin-compat/dist/index.js',
    before: '__require.resolve("use-effect-event")',
    after: '__require.resolve("use-effect-event").replaceAll("\\\\", "/")',
  },
  {
    file: 'node_modules/@apps-in-toss/plugin-compat/dist/index.cjs',
    before: 'require.resolve("react18-use")',
    after: 'require.resolve("react18-use").replaceAll("\\\\", "/")',
  },
  {
    file: 'node_modules/@apps-in-toss/plugin-compat/dist/index.cjs',
    before: 'require.resolve("use-effect-event")',
    after: 'require.resolve("use-effect-event").replaceAll("\\\\", "/")',
  },
];

if (process.platform !== 'win32') {
  process.exit(0);
}

const changedFiles = new Set();
for (const replacement of replacements) {
  const filePath = resolve(replacement.file);
  let source = await readFile(filePath, 'utf8');
  if (source.includes(replacement.after)) {
    continue;
  }
  if (!source.includes(replacement.before)) {
    throw new Error(
      `Granite Windows path patch no longer matches ${replacement.file}. ` +
        'Review the installed framework before building.',
    );
  }
  source = source.replace(replacement.before, replacement.after);
  await writeFile(filePath, source, 'utf8');
  changedFiles.add(replacement.file);
}

if (changedFiles.size > 0) {
  console.log(
    `Normalized generated Windows module paths in ${changedFiles.size} Granite plugin files.`,
  );
}
