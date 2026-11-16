import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {translateGenerated} from './openapi-en/translate.mjs';

const yaml = createRequire(new URL('../docs-site/package.json', import.meta.url))('js-yaml');
const annotations = new Set(['description', 'summary', 'title', 'example', 'examples', '$comment', 'comment']);
const dataKeys = new Set(['default', 'const', 'enum', 'required', 'security', 'mapping', 'flows']);
const maps = new Set([
  'properties', 'patternProperties', '$defs', 'dependentSchemas', 'schemas',
  'parameters', 'securitySchemes', 'headers', 'responses', 'content',
]);
const escapePointer = value => value.replaceAll('~', '~0').replaceAll('/', '~1');

export function assertCompatibleDefinition(name, handwritten, generated, roots = {handwritten, generated}) {
  const pairs = {object: new WeakMap(), map: new WeakMap(), data: new WeakMap()};
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
    for (const [key, value] of Object.entries(siblings)) {
      if (!annotations.has(key) && key in expanded && JSON.stringify(value) !== JSON.stringify(expanded[key])) {
        throw new Error(`Conflicting reference sibling ${node.$ref}/${escapePointer(key)}`);
      }
    }
    const definition = Object.keys(siblings).length ? {...expanded, ...siblings} : expanded;
    cache.set(node, definition);
    return definition;
  }

  function equal(left, right, path, kind = 'object') {
    if (kind === 'object') {
      left = resolve(left, roots.handwritten);
      right = resolve(right, roots.generated);
    }
    const fail = () => { throw new Error(`${name}: handwritten${path} conflicts with generated${path}`); };
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
      if (left !== right) fail();
      return;
    }
    if (Array.isArray(left) !== Array.isArray(right)) fail();
    const compared = pairs[kind].get(left) ?? new WeakSet();
    if (compared.has(right)) return;
    compared.add(right);
    pairs[kind].set(left, compared);
    if (Array.isArray(left)) {
      if (left.length !== right.length) fail();
      if (path.endsWith('/required') || path.endsWith('/enum')) {
        left = [...left].sort();
        right = [...right].sort();
      }
      left.forEach((value, index) => equal(value, right[index], `${path}/${index}`, kind));
      return;
    }
    const keys = value => Object.keys(value).filter(key => kind !== 'object' || !annotations.has(key)).sort();
    if (JSON.stringify(keys(left)) !== JSON.stringify(keys(right))) fail();
    for (const key of keys(left)) {
      const childKind = kind === 'data' ? 'data' : kind === 'map' ? 'object'
        : dataKeys.has(key) ? 'data' : maps.has(key) ? 'map' : 'object';
      equal(left[key], right[key], `${path}/${escapePointer(key)}`, childKind);
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
  for (const [path, methods] of Object.entries(input.paths ?? {})) {
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

function run() {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const generated = JSON.parse(read('./fixtures/merchant-openapi.json'));
  const translations = JSON.parse(read('./openapi-en/translations.json'));
  for (const locale of ['ja', 'en']) {
    const handwritten = yaml.load(read(`../docs-site/openapi/handwritten.${locale}.yaml`));
    const text = yaml.dump(buildOpenApi(handwritten, generated, locale, translations), {lineWidth: 120, noRefs: true});
    const destination = new URL(locale === 'ja' ? '../docs-site/static/openapi.yaml' : '../docs-site/i18n/en/openapi.yaml', import.meta.url);
    if (process.argv.includes('--check')) {
      if (readFileSync(destination, 'utf8') !== text) {
        throw new Error(`${destination.pathname} is stale; run npm run openapi:build`);
      }
    } else writeFileSync(destination, text);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
