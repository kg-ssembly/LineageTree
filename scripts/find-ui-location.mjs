import fs from 'node:fs';
import path from 'node:path';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node scripts/find-ui-location.mjs "visible phrase or translation key"');
  process.exit(2);
}

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', 'dist', '.test-dist', 'android', 'ios', 'functions']);
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(path.join(directory, entry.name));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }
}
walk(root);

const catalogPath = path.join(root, 'i18n/keys.ts');
const catalog = fs.readFileSync(catalogPath, 'utf8');
const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keyLines = catalog.split(/\r?\n/);
const matches = keyLines.flatMap((line, index) => {
  const entry = line.match(/^\s*\[I18N_KEYS\.([\w.]+)\]:\s*(['"])(.*?)\2,?\s*$/);
  if (!entry) return [];
  const [, propertyPath, , phrase] = entry;
  if (phrase.toLocaleLowerCase().includes(query.toLocaleLowerCase()) || propertyPath.toLocaleLowerCase() === query.toLocaleLowerCase()) {
    return [{ key: propertyPath, phrase, line: index + 1 }];
  }
  return [];
});

const localeDirectory = path.join(root, 'i18n/locales');
const catalogEntries = keyLines.flatMap((line, index) => {
  const entry = line.match(/^\s*\[I18N_KEYS\.([\w.]+)\]:\s*(['"])(.*?)\2,?\s*$/);
  return entry ? [{ propertyPath: entry[1], phrase: entry[3], line: index + 1 }] : [];
});
const matchedKeys = new Set(matches.map(match => match.key));
for (const localeFile of fs.readdirSync(localeDirectory).filter(file => file.endsWith('.ts'))) {
  const lines = fs.readFileSync(path.join(localeDirectory, localeFile), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const localized = line.match(/^\s*\[K\.([\w.]+)\]:\s*(['"])(.*?)\2,?\s*$/);
    if (!localized || !localized[3].toLocaleLowerCase().includes(query.toLocaleLowerCase())) return;
    const catalogEntry = catalogEntries.find(entry => entry.propertyPath === localized[1]);
    if (!catalogEntry || matchedKeys.has(catalogEntry.propertyPath)) return;
    matches.push({ key: catalogEntry.propertyPath, phrase: catalogEntry.phrase, line: catalogEntry.line, locale: localeFile, localeLine: index + 1 });
    matchedKeys.add(catalogEntry.propertyPath);
  });
}
const keyToUsage = new Map();
for (const file of files) {
  const relative = path.relative(root, file);
  if (!/^(app|components|hooks|providers|stores|constants)[\\/]/.test(relative)) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const match of matches) {
    const escapedKey = match.key.split('.').map(part => part.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('\\.');
    const usage = new RegExp(`\\bK\\.${escapedKey}\\b|\\bI18N_KEYS\\.${escapedKey}\\b`);
    const usageLines = lines.flatMap((line, index) => usage.test(line) ? [`${relative}:${index + 1}`] : []);
    if (usageLines.length) {
      if (!keyToUsage.has(match.key)) keyToUsage.set(match.key, []);
      keyToUsage.get(match.key).push(...usageLines);
    }
  }
}
if (matches.length) {
  for (const match of matches) {
    console.log(`${match.phrase}\n  Key: K.${match.key} (i18n/keys.ts:${match.line})`);
    for (const usage of keyToUsage.get(match.key) ?? []) console.log(`  Use: ${usage}`);
  }
} else {
  const phrase = new RegExp(escaped, 'i');
  const hits = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (phrase.test(line)) hits.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
    });
  }
  if (hits.length) console.log(`No catalog entry matched. Direct source matches:\n${hits.join('\n')}`);
  else {
    console.log(`No translation key or source text matched "${query}".`);
    console.log('Search any language phrase literally in the source, or try a shorter distinctive word.');
    process.exitCode = 1;
  }
}
