import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'gcode-universal.html'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
const body = fs.readFileSync(path.join(ROOT, 'src/body.html'), 'utf8');

let problems = [];
function problem(msg){ problems.push(msg); }

/* 1. уникальность id (только разметка, без JS) */
const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '');
const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const seen = new Map();
for (const id of ids) seen.set(id, (seen.get(id) || 0) + 1);
for (const [id, n] of seen) if (n > 1) problem('дубликат id: ' + id + ' ×' + n);

/* 2. ссылки из ui.js на статические id */
const staticRefs = new Set();
for (const m of ui.matchAll(/\$\('([^']+)'\)/g)) staticRefs.add(m[1]);
for (const m of ui.matchAll(/getElementById\('([^']+)'\)/g)) staticRefs.add(m[1]);
for (const m of ui.matchAll(/fillSelect\('([^']+)'/g)) staticRefs.add(m[1]);
for (const id of staticRefs){
  if (!seen.has(id)) problem('ui.js ссылается на отсутствующий id: ' + id);
}

/* 3. MAIN_IDS */
const mainIds = ui.match(/var MAIN_IDS = \[([\s\S]*?)\];/);
if (!mainIds) problem('не найден MAIN_IDS');
else {
  const list = [...mainIds[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const id of list) if (!seen.has(id)) problem('MAIN_IDS: нет поля ' + id);
}

/* 4. label for -> существует */
const labelTargets = [...markup.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]);
for (const id of labelTargets) if (!seen.has(id)) problem('label for="' + id + '" — поля нет');

/* 5. каждое поле в панели имеет label или подсказку */
const bodyIds = [...body.matchAll(/<(input|select|textarea)[^>]*id="([^"]+)"/g)].map((m) => m[2]);
const tipsBlock = ui.match(/var TIPS = \{([\s\S]*?)\n\};/);
const tipKeys = tipsBlock ? [...tipsBlock[1].matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)].map((m) => m[1]) : [];
const hasTip = (id) => tipKeys.includes(id);
const hasLabel = (id) => labelTargets.includes(id);
for (const id of bodyIds){
  if (id === 'output') continue;
  if (!hasLabel(id) && !hasTip(id)) problem('поле без label и без подсказки: ' + id);
  if (!hasTip(id)) problem('поле без текста подсказки в TIPS: ' + id);
}
if (tipKeys.length < 40) problem('мало подсказок: ' + tipKeys.length);

/* 6. внешних ресурсов нет */
if (/<script[^>]+src=/i.test(html)) problem('внешний <script src>');
if (/<link[^>]+href=/i.test(html)) problem('внешний <link href>');
if (/<img[^>]+src=/i.test(html)) problem('внешняя картинка');
if (/https?:\/\/(?!www\.w3\.org)/i.test(markup)) problem('в разметке есть внешний URL');

/* 7. скрипты и данные */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 3) problem('ожидалось 3 скрипта, найдено ' + scripts.length);
if (!/var GLYPHS = \{/.test(scripts[0] || '')) problem('нет данных GLYPHS');
if (!/var TABLES = \{/.test(scripts[0] || '')) problem('нет данных TABLES');
if (!/function buildProgram/.test(scripts[1] || '')) problem('нет core.js');
if (!/G-CODE STUDIO|init\(\)/.test(scripts[2] || '')) problem('нет ui.js');
if (/<\/script/i.test(scripts.join(''))) problem('в JS есть </script>');

/* 8. кириллица в данных шрифта */
if (!/"Ж":/.test(scripts[0] || '') || !/"Я":/.test(scripts[0] || '')) problem('в данных нет кириллицы');

/* 9. мусор */
for (const bad of ['undefined', 'NaN', 'TODO', 'FIXME']) {
  if (new RegExp('>' + bad + '<').test(html)) problem('в разметке найден ' + bad);
}
if (ids.length < 60) problem('подозрительно мало id: ' + ids.length);

console.log('id всего:', ids.length, '| подсказок:', tipKeys.length, '| ссылок ui.js:', staticRefs.size, '| label for:', labelTargets.length);
if (problems.length){
  console.log('\n❌ Проблемы (' + problems.length + '):');
  problems.forEach((p) => console.log('  -', p));
  process.exit(1);
} else {
  console.log('✅ Аудит сборки пройден: id, ссылки, подсказки, автономность');
}
