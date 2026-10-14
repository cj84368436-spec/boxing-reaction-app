// Model the documented shared module namespace, preserving the production
// package's ESM interpretation and Granite's module.exports = shared.get().
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');
const project = path.resolve(__dirname, '..');
async function check() {
  const results = [];
  for (const name of ['BoxerRig', 'CoachReaction', 'SpriteImage', 'PlayerDefenseFeedback']) {
    const file = path.join(project, `src/app/components/${name}.tsx`);
    const source = fs.readFileSync(file, 'utf8');
    const declaration = source.match(/^import .+ from 'react-native-svg';$/m)?.[0];
    if (!declaration) throw new Error(`SVG import missing: ${name}`);
    const bindings=declaration.match(/\{([^}]+)\}/)[1].split(',').map(value=>{
      const [exportName,localName]=value.trim().split(/\s+as\s+/);
      return {exportName,localName:localName??exportName};
    });
    async function compile(importDeclaration,localName='Svg') { return esbuild.build({
      entryPoints: [file],
      bundle: true, format: 'cjs', write: false, platform: 'neutral',
      plugins: [{name: 'shared-svg', setup(build) {
        build.onLoad({filter: /\.tsx$/}, args => args.path === file ? {
          contents: `${importDeclaration}\nexport const component = ${localName};`,
          loader: 'tsx', resolveDir: path.dirname(file),
        } : undefined);
        build.onResolve({filter: /^react-native-svg$/}, () => ({path: 'react-native-svg', namespace: 'shared'}));
        build.onLoad({filter: /.*/, namespace: 'shared'}, () => ({contents: 'module.exports = global.sharedSvg;', loader: 'js'}));
      }}],
    }); }
    const defaultControl = await compile("import Svg from 'react-native-svg';");
    for(const {exportName,localName} of bindings){
    const built = await compile(declaration,localName);
    for (const esModule of [true, false]) {
      function Svg() {}
      const sharedSvg = {default: Svg, Svg, G() {}, Line() {}, Image() {}};
      if (esModule) Object.defineProperty(sharedSvg, '__esModule', {value: true});
      const sandbox = {module: {exports: {}}, sharedSvg};
      sandbox.global = sandbox;
      vm.runInNewContext(built.outputFiles[0].text, sandbox);
      const component = sandbox.module.exports.component;
      const control = {module: {exports: {}}, sharedSvg};
      control.global = control;
      vm.runInNewContext(defaultControl.outputFiles[0].text, control);
      results.push({name, exportName, esModule, type: typeof component,
        resolvesNamedComponent: component === sharedSvg[exportName], resolvesNamespace: component === sharedSvg,
        defaultControlResolvesNamespace: control.module.exports.component === sharedSvg});
    }
    }
  }
  console.log(JSON.stringify(results));
}
check().catch(error => {console.error(error); process.exitCode = 1;});
