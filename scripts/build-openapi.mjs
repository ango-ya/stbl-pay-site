import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {translateGenerated} from './openapi-en/translate.mjs';

const yaml = createRequire(new URL('../docs-site/package.json', import.meta.url))('js-yaml');
const annotations = new Set(['description', 'summary', 'title', 'example', 'examples', '$comment', 'comment']);
// $ref の兄弟として許す注釈。これ以外の検証キーは、参照先との積（JSON Schema 2020-12 では両方を満たす）になり、
// 展開してマージした形とは意味が違う（additionalProperties など）ため、比べられないものとして拒否する
const refSiblingAnnotations = new Set([
  'description', 'summary', 'title', 'examples', 'example', 'deprecated', 'readOnly', 'writeOnly', 'default', '$comment', 'comment',
]);
const operationMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const normalizePathTemplate = path => path.replace(/\{[^}]*\}/g, '{}');
const dataKeys = new Set(['default', 'const', 'enum', 'required', 'security', 'mapping', 'flows']);
const maps = new Set([
  'properties', 'patternProperties', '$defs', 'dependentSchemas', 'schemas',
  'parameters', 'securitySchemes', 'headers', 'responses', 'content',
]);
const escapePointer = value => value.replaceAll('~', '~0').replaceAll('/', '~1');

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function createComparison(handwrittenRoot, generatedRoot) {
  return {
    handwrittenRoot,
    generatedRoot,
    pairs: {object: new WeakMap(), map: new WeakMap(), data: new WeakMap(), set: new WeakMap()},
  };
}

export function assertCompatibleDefinition(name, handwritten, generated, roots = {handwritten, generated}) {
  const comparison = createComparison(roots.handwritten, roots.generated);
  const resolved = new Map([
    [roots.handwritten, new WeakMap()], [roots.generated, new WeakMap()],
  ]);

  function resolve(node, root, ancestors = new Set()) {
    if (!node?.$ref) return node;
    const cache = resolved.get(root);
    if (cache.has(node)) return cache.get(node);
    if (!node.$ref.startsWith('#/')) throw new Error(`Unsupported reference ${node.$ref}`);
    if (ancestors.has(node)) throw new Error(`Reference-only cycle at ${node.$ref}`);
    const target = node.$ref.slice(2).split('/').reduce(
      (value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root,
    );
    if (target === undefined) throw new Error(`Unresolved reference ${node.$ref}`);
    const expanded = resolve(target, root, new Set([...ancestors, node]));
    const {$ref, ...siblings} = node;
    for (const key of Object.keys(siblings)) {
      if (!refSiblingAnnotations.has(key) && !key.startsWith('x-') && !(key in expanded)) {
        throw new Error(`${name}: $ref ${node.$ref} has validation keyword sibling ${key}; handwritten${node.$ref.slice(1)} conflicts with generated${node.$ref.slice(1)}`);
      }
    }
    const definition = Object.keys(siblings).length ? {...expanded, ...siblings} : expanded;
    cache.set(node, definition);
    for (const [key, value] of Object.entries(siblings)) {
      if (!annotations.has(key) && key in expanded) {
        equal({[key]: expanded[key]}, {[key]: value}, node.$ref.slice(1), 'object', createComparison(root, root));
      }
    }
    return definition;
  }

  function equal(left, right, path, kind = 'object', context = comparison) {
    if (kind === 'object') {
      left = resolve(left, context.handwrittenRoot);
      right = resolve(right, context.generatedRoot);
    }
    const fail = () => { throw new Error(`${name}: handwritten${path} conflicts with generated${path}`); };
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
      if (left !== right) fail();
      return;
    }
    if (Array.isArray(left) !== Array.isArray(right)) fail();
    const compared = context.pairs[kind].get(left) ?? new WeakSet();
    if (compared.has(right)) return;
    compared.add(right);
    context.pairs[kind].set(left, compared);
    if (Array.isArray(left)) {
      if (left.length !== right.length) fail();
      if (kind === 'set') {
        if (JSON.stringify(left.map(canonicalJson).sort()) !== JSON.stringify(right.map(canonicalJson).sort())) fail();
        return;
      }
      left.forEach((value, index) => equal(value, right[index], `${path}/${index}`, kind, context));
      return;
    }
    const keys = value => Object.keys(value).filter(key => kind !== 'object' || !annotations.has(key)).sort();
    if (JSON.stringify(keys(left)) !== JSON.stringify(keys(right))) fail();
    for (const key of keys(left)) {
      const childKind = kind === 'data' || kind === 'set' ? 'data' : kind === 'map' ? 'object'
        : key === 'required' || key === 'enum' ? 'set' : dataKeys.has(key) ? 'data' : maps.has(key) ? 'map' : 'object';
      equal(left[key], right[key], `${path}/${escapePointer(key)}`, childKind, context);
    }
  }

  equal(handwritten, generated, `/${name.split('/').map(escapePointer).join('/')}`);
}

export function buildOpenApi(handwritten, generated, locale, translations) {
  if (!['ja', 'en'].includes(locale)) throw new Error(`Unsupported locale ${locale}`);
  if (typeof generated.info?.version !== 'string' || generated.info.version.includes('-')) {
    throw new Error('Public OpenAPI requires a stable generated version');
  }
  const input = locale === 'en' ? translateGenerated(generated, translations) : structuredClone(generated);
  const output = structuredClone(handwritten);
  output.info.version = input.info.version;
  const templates = new Map(Object.keys(output.paths).map(path => [normalizePathTemplate(path), path]));
  for (const [path, methods] of Object.entries(input.paths ?? {})) {
    const known = templates.get(normalizePathTemplate(path));
    if (known !== undefined && known !== path) {
      throw new Error(`Path template collision: handwritten ${known} and generated ${path}`);
    }
    const pathLevel = value => Object.fromEntries(Object.entries(value).filter(([key]) => !operationMethods.includes(key)));
    if (known !== undefined && canonicalJson(pathLevel(output.paths[path])) !== canonicalJson(pathLevel(methods))) {
      throw new Error(`Path-level fields differ for shared path ${path}; they would apply to operations of the other input`);
    }
    templates.set(normalizePathTemplate(path), path);
    const target = output.paths[path] ??= {};
    for (const [method, operation] of Object.entries(methods)) {
      if (method in target) {
        const pointer = `/paths/${escapePointer(path)}/${method}`;
        throw new Error(`Operation collision: handwritten${pointer} and generated${pointer}`);
      }
      target[method] = operation;
    }
  }
  output.components ??= {};
  for (const [kind, definitions] of Object.entries(input.components ?? {})) {
    const target = output.components[kind] ??= {};
    for (const [name, definition] of Object.entries(definitions)) {
      if (name in target) {
        assertCompatibleDefinition(`components/${kind}/${name}`, target[name], definition, {handwritten, generated: input});
      } else target[name] = definition;
    }
  }
  output.tags ??= [];
  for (const tag of input.tags ?? []) {
    const previous = output.tags.find(value => value.name === tag.name);
    if (previous) assertCompatibleDefinition(`tags/${tag.name}`, previous, tag);
    else output.tags.push(tag);
  }
  return output;
}

export function run({
  argv = process.argv,
  read = path => readFileSync(new URL(path, import.meta.url), 'utf8'),
  write = (destination, text) => writeFileSync(destination, text),
} = {}) {
  const generated = JSON.parse(read('./fixtures/merchant-openapi.json'));
  const translations = JSON.parse(read('./openapi-en/translations.json'));
  // 片方の言語だけ更新された状態を残さないため、両方を組み立てて直列化してから書く
  const outputs = ['ja', 'en'].map(locale => {
    const handwritten = yaml.load(read(`../docs-site/openapi/handwritten.${locale}.yaml`));
    const text = yaml.dump(buildOpenApi(handwritten, generated, locale, translations), {lineWidth: 120, noRefs: true});
    const destination = new URL(locale === 'ja' ? '../docs-site/static/openapi.yaml' : '../docs-site/i18n/en/openapi.yaml', import.meta.url);
    return {destination, text};
  });
  if (argv.includes('--check')) {
    for (const {destination, text} of outputs) {
      if (readFileSync(destination, 'utf8') !== text) throw new Error(`${destination.pathname} is stale; run npm run openapi:build`);
    }
  } else for (const {destination, text} of outputs) write(destination, text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
