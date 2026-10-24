const path = require('node:path');

const initialJsBudgetBytes = 3.125 * 1048576;
const forbiddenInitialModules = /(?:@babylonjs\/core\/(?:index\.js$|XR\/|Physics\/|FlowGraph\/|FrameGraph\/|Meshes\/(?:Node|GaussianSplatting)\/)|@babylonjs\/(?:inspector|gui-editor|node-editor|node-geometry-editor)\/|@babylonjs\/loaders\/glTF\/1\.0\/|src\/examples\/Rocket\.ts$)/;
// Required transitively by the glTF object-model mapper and the SSAO/depth renderers.
// These small value/type predicates do not include their corresponding rendering/graph systems.
const requiredHelpers = ['@babylonjs/core/FlowGraph/CustomTypes/flowGraphInteger.pure.js',
  '@babylonjs/core/Meshes/GaussianSplatting/gaussianSplatting.functions.js'];

function assertInitialModules(modules) {
  const forbidden = modules.filter(name => forbiddenInitialModules.test(name) && !requiredHelpers.some(helper => name.endsWith(helper)));
  if (forbidden.length) throw new Error(`Unexpected initial Babylon dependencies:\n${forbidden.join('\n')}`);
}

function analyzeBundle(compilation, context) {
  const normalize = value => value.split(path.sep).join('/');
  const flatten = module => module.modules ? [...module.modules].flatMap(flatten) :
    module.resource ? [{ name: normalize(path.relative(context, module.resource)), sourceBytes: module.size() }] : [];
  const chunks = [...compilation.chunks].map(chunk => {
    const modules = [...compilation.chunkGraph.getChunkModulesIterable(chunk)].flatMap(flatten);
    return { id: chunk.id, initial: chunk.canBeInitial(), files: [...chunk.files].sort(), modules };
  });
  const initialModules = [...new Map(chunks.filter(chunk => chunk.initial).flatMap(chunk => chunk.modules).map(module => [module.name, module])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const initialJsFiles = [...new Set(chunks.filter(chunk => chunk.initial).flatMap(chunk => chunk.files).filter(file => file.endsWith('.js')))].sort();
  const initialJsBytes = initialJsFiles.reduce((sum, file) => sum + compilation.getAsset(file).source.size(), 0);
  assertInitialModules(initialModules.map(module => module.name));
  if (initialJsBytes > initialJsBudgetBytes) throw new Error(`Initial JS budget exceeded: ${initialJsBytes} > ${initialJsBudgetBytes}`);
  return { schemaVersion: 1, initialJsBudgetBytes, initialJsFiles, initialJsBytes, initialModules,
    chunks: chunks.map(({ modules, ...chunk }) => ({ ...chunk, moduleCount: modules.length }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en')),
    note: 'Source module sizes are not minified file bytes. Browser validation separately counts mandatory async shader/loader requests.' };
}

module.exports = { analyzeBundle, assertInitialModules, initialJsBudgetBytes };
