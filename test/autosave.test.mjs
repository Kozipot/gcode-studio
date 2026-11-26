import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'gcode-universal.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function boot(store){
  const { window, document } = parseHTML(html);
  Object.defineProperty(window, 'localStorage', { configurable: true, value: store });
  const ctx = vm.createContext({
    window, document,
    navigator: {},
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Blob: globalThis.Blob, URL: globalThis.URL,
    Event: window.Event,
    Math, JSON, isFinite, isNaN, parseFloat, parseInt, Number, String, Array, Object,
    Function, Date, RegExp, Error, Uint8Array, Map, Set, Promise
  });
  ctx.globalThis = ctx;
  ctx.self = ctx;
  for (let i = 0; i < scripts.length; i++) vm.runInContext(scripts[i], ctx, { filename: 'app-' + i + '.js' });
  if (document.readyState !== 'complete') document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { window, document, ctx };
}
function click(doc, sel){
  const el = doc.querySelector(sel);
  if (!el) throw new Error('нет ' + sel);
  el.dispatchEvent(new (el.ownerDocument.defaultView.Event)('click', { bubbles: true }));
}

const map = new Map();
const store = {
  getItem: (k) => (map.has(k) ? map.get(k) : null),
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: (k) => map.delete(k),
  clear: () => map.clear(),
  key: (i) => [...map.keys()][i] || null,
  get length(){ return map.size; }
};

const app1 = boot(store);
click(app1.document, '.tab[data-tab="scene"]');
await sleep(400);
const before = app1.document.querySelectorAll('.scene-card').length;
const useTools = app1.document.getElementById('useTools');
useTools.checked = true;
useTools.dispatchEvent(new (app1.window.Event)('change', { bubbles: true }));
click(app1.document, '#addTool');
click(app1.document, '#addEl');
await sleep(400);
const zDepth = app1.document.querySelector('.scene-card [data-z="depth"]');
if (zDepth){
  zDepth.value = '-3';
  zDepth.dispatchEvent(new (app1.window.Event)('input', { bubbles: true }));
  zDepth.dispatchEvent(new (app1.window.Event)('change', { bubbles: true }));
}
click(app1.document, '.tab[data-tab="param"]');
await sleep(400);
const pMode = app1.document.getElementById('paramMode');
if (pMode){
  [...pMode.options].forEach((o) => {
    if (o.value === 'grid') o.setAttribute('selected', 'selected'); else o.removeAttribute('selected');
  });
  pMode.dispatchEvent(new (app1.window.Event)('change', { bubbles: true }));
}
await sleep(1800);
const after = app1.document.querySelectorAll('.scene-card').length;
const raw = map.get('gcodeStudio.project.v1');
console.log('карточек до/после:', before, after, '| сохранение:', raw ? (raw.length + ' байт') : 'нет');

const app2 = boot(store);
await sleep(500);
const restored = app2.document.querySelectorAll('.scene-card').length;
const restoredTools = app2.document.querySelectorAll('.tool-card').length;
const restoredUseTools = app2.document.getElementById('useTools').checked;
const restoredDepth = app2.document.querySelector('.scene-card [data-z="depth"]');
const restoredParamMode = app2.document.getElementById('paramMode');
console.log('после перезапуска карточек:', restored, '| инструментов:', restoredTools, '| useTools:', restoredUseTools);
console.log('глубина:', restoredDepth ? restoredDepth.value : '—', '| параметрический шаблон:', restoredParamMode ? restoredParamMode.value : '—');

let ok = true;
if (!raw) { console.log('❌ проект не сохранён'); ok = false; }
if (after !== before + 1) { console.log('❌ элемент не добавился'); ok = false; }
if (restored !== after) { console.log('❌ проект не восстановлен'); ok = false; }
if (restoredTools !== 2) { console.log('❌ инструменты не восстановлены'); ok = false; }
if (!restoredUseTools) { console.log('❌ флаг useTools не восстановлен'); ok = false; }
if (!restoredDepth || restoredDepth.value !== '-3') { console.log('❌ глубина элемента не восстановлена'); ok = false; }
if (!restoredParamMode || restoredParamMode.value !== 'grid') { console.log('❌ параметрический шаблон не восстановлен'); ok = false; }
if (ok) console.log('✅ автосохранение и восстановление проекта работают');
process.exit(ok ? 0 : 1);
