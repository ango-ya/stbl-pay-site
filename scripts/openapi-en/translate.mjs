const textKeys = new Set(['description', 'summary', 'title']);
const dataKeys = new Set(['value', 'example', 'default', 'const', 'enum']);
const mapKeys = new Set([
  'properties', 'patternProperties', '$defs', 'dependentSchemas', 'responses',
  'headers', 'content', 'examples', 'encoding', 'mapping',
]);
const pointer = parts => '/' + parts.map(part => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/');

// 原文の一致検査を翻訳適用と分離しない。古い訳を新しい説明に適用しないため。
export function visitGeneratedText(generated, visit) {
  function walk(node, parts, prefix, kind = 'object') {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (kind === 'map') {
        walk(value, [...parts, key], prefix);
        continue;
      }
      if (dataKeys.has(key) || (key === 'examples' && Array.isArray(value))) continue;
      if (textKeys.has(key) && typeof value === 'string') {
        const fieldPath = [...parts, key];
        const translationKey = prefix.startsWith('operations.') && fieldPath.length > 1
          ? prefix + pointer(fieldPath)
          : prefix + '.' + fieldPath.filter(part => part !== 'properties').join('.');
        if (key === 'description' && value.startsWith('|')) {
          const lines = value.split('\n');
          if (lines[0] !== '| code | meaning | action |' || lines[1] !== '| --- | --- | --- |' || lines.length < 3) {
            throw new Error(`Invalid error table: ${translationKey}`);
          }
          const seen = new Set();
          node[key] = [lines[0], lines[1], ...lines.slice(2).map(line => {
            const match = /^\| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/.exec(line);
            if (!match || seen.has(match[1])) throw new Error(`Invalid error row: ${translationKey}`);
            const [, code, meaning, action] = match;
            seen.add(code);
            return `| ${code} | ${visit(`errors.${code}.meaning`, meaning)} | ${visit(`errors.${code}.action`, action)} |`;
          })].join('\n');
        } else node[key] = visit(translationKey, value);
      } else if (value && typeof value === 'object') {
        walk(value, [...parts, key], prefix, mapKeys.has(key) && !Array.isArray(value) ? 'map' : 'object');
      }
    }
  }

  for (const methods of Object.values(generated.paths ?? {})) {
    for (const operation of Object.values(methods)) walk(operation, [], `operations.${operation.operationId}`);
  }
  for (const [kind, definitions] of Object.entries(generated.components ?? {})) {
    for (const [name, definition] of Object.entries(definitions)) walk(definition, [], `${kind}.${name}`);
  }
  const names = new Map();
  for (const tag of generated.tags ?? []) {
    const name = tag.name;
    tag.name = visit(`tags.${name}.name`, name);
    names.set(name, tag.name);
    if (tag.description !== undefined) tag.description = visit(`tags.${name}.description`, tag.description);
  }
  for (const methods of Object.values(generated.paths ?? {})) {
    for (const operation of Object.values(methods)) {
      if (operation.tags) operation.tags = operation.tags.map(name => {
        if (!names.has(name)) throw new Error(`Undefined tag ${name}`);
        return names.get(name);
      });
    }
  }
  return generated;
}

export function translateGenerated(generated, translations) {
  const used = new Set();
  const translated = visitGeneratedText(structuredClone(generated), (key, source) => {
    used.add(key);
    const entry = translations[key];
    if (!entry || entry.source !== source || typeof entry.translation !== 'string' || !entry.translation.trim()) {
      throw new Error(`Missing or stale translation: ${key}`);
    }
    return entry.translation;
  });
  for (const key of Object.keys(translations)) {
    if (!used.has(key)) throw new Error(`Unused translation: ${key}`);
  }
  return translated;
}
