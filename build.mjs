import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const glyphs = JSON.parse(read('src/data/glyphs.json'));
const tables = JSON.parse(read('src/data/tables.json'));
const css = read('src/styles.css');
const body = read('src/body.html');
const core = read('src/core.js');
const ui = read('src/ui.js');

for (const [name, src] of [['core', core], ['ui', ui]]){
  if (/<\/script/i.test(src)) throw new Error('В ' + name + '.js найден </script> — сломает сборку');
}

const dataJs = [
  '/* Данные шрифта и таблиц — сгенерировано из src/data/*.json */',
  'var GLYPHS = ' + JSON.stringify(glyphs) + ';',
  'var TABLES = ' + JSON.stringify(tables) + ';'
].join('\n');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="G-CODE STUDIO build">
<title>G-CODE STUDIO — универсальный генератор G-кода</title>
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${dataJs}
</script>
<script>
${core}
</script>
<script>
${ui}
</script>
</body>
</html>
`;

const outPath = path.join(ROOT, 'gcode-universal.html');
fs.writeFileSync(outPath, html, 'utf8');
const distDir = path.join(ROOT, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('✅ собрано: gcode-universal.html — ' + kb + ' КиБ');
console.log('   Pages: dist/index.html');
console.log('   data ' + (Buffer.byteLength(dataJs) / 1024).toFixed(1) + ' КиБ · core ' + (Buffer.byteLength(core) / 1024).toFixed(1) + ' КиБ · ui ' + (Buffer.byteLength(ui) / 1024).toFixed(1) + ' КиБ');
