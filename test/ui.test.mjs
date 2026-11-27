import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'gcode-universal.html'), 'utf8');
const { window, document } = parseHTML(html);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = vm.createContext({
  window, document,
  navigator: { clipboard: null, userAgent: 'linkedom-test' },
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Blob: globalThis.Blob, URL: globalThis.URL,
  Event: window.Event, CustomEvent: window.CustomEvent,
  Math, JSON, isFinite, isNaN, parseFloat, parseInt, Number, String, Array, Object,
  Function, Date, RegExp, Error, Uint8Array, Map, Set, Promise
});
ctx.globalThis = ctx;
ctx.self = ctx;

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length < 3) throw new Error('в сборке меньше 3 скриптов: ' + scripts.length);
for (let i = 0; i < scripts.length; i++){
  vm.runInContext(scripts[i], ctx, { filename: 'inline-' + i + '.js' });
}
if (document.readyState !== 'complete') document.dispatchEvent(new window.Event('DOMContentLoaded'));

const F = (id) => document.getElementById(id);
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const output = () => F('output').value;
const errors = () => qa('#checklist .check.error').length;
const warnings = () => qa('#checklist .check.warn').length;
const cards = () => qa('.scene-card').length;
function click(sel){
  const el = typeof sel === 'string' ? q(sel) : sel;
  if (!el) throw new Error('нет элемента: ' + sel);
  el.dispatchEvent(new window.Event('click', { bubbles: true }));
}
function setVal(id, v){
  const el = F(id);
  if (!el) throw new Error('нет поля: ' + id);
  if (el.tagName === 'SELECT'){
    [...el.options].forEach((o) => {
      if (String(o.value) === String(v)) o.setAttribute('selected', 'selected');
      else o.removeAttribute('selected');
    });
  } else {
    el.value = v;
  }
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}
function setCheck(id, v){
  const el = F(id);
  el.checked = !!v;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}
function tab(name){ click('.tab[data-tab="' + name + '"]'); }
function subtab(name){ click('.subtab[data-sub="' + name + '"]'); }

let pass = 0, fail = 0;
function test(name, fn){
  try {
    const r = fn();
    if (r === false || typeof r === 'string') throw new Error(r || 'false');
    pass++;
    console.log('  ✅', name);
  } catch (e){
    fail++;
    console.log('  ❌', name, '\n     ', e.message);
  }
}

console.log('\n— Интерфейс: старт —');
test('G-код сгенерирован', () => output().length > 300 || 'длина ' + output().length);
test('есть M30 / M3 / G21 / G90', () => ['M30', 'M3 S', 'G21', 'G90', 'M5'].every((t) => output().includes(t)) || 'не все коды');
test('чек-лист без ошибок', () => errors() === 0 || 'ошибок ' + errors());
test('чек-лист построен (13+ пунктов)', () => qa('#checklist .check').length >= 13 || 'пунктов ' + qa('#checklist .check').length);
test('скачивание доступно', () => F('download').disabled === false);
test('статистика заполнена', () => qa('#statsBox .badge').length >= 5);
test('превью нарисовано', () => qa('#preview line, #preview polyline, #preview rect').length > 3);
test('легенда есть', () => qa('#legend span').length >= 1);
test('ссылка на GitHub для багов и доработок', () => {
  const a = qa('.app-footer a').find((x) => (x.getAttribute('href') || '').includes('github.com/Kozipot/gcode-studio/issues'));
  return !!a && a.getAttribute('target') === '_blank';
});
test('3D: включается', () => {
  click('#previewMode button[data-view="3d"]');
  return q('#preview3d').classList.contains('active') && q('#preview').classList.contains('hidden');
});
test('3D: легенда с быстрым ходом', () => F('legend').textContent.includes('быстрый ход'));
test('3D: масштаб Z по умолчанию', () => F('zScale').value === '3');
setVal('zScale', '5');
test('3D: масштаб Z меняется', () => F('zScale').value === '5');
click('#viewReset');
await sleep(100);
test('3D: сброс вида', () => F('zScale').value === '3');
click('#previewMode button[data-view="2d"]');
test('2D: возвращается', () => !q('#preview3d').classList.contains('active') && !q('#preview').classList.contains('hidden'));
const tips = qa('label .q');
test('тултипы навешаны (40+)', () => tips.length > 40 || 'найдено ' + tips.length);
const missing = qa('.panel input[id], .panel select[id], .panel textarea[id], .scene-card input, .scene-card select, .scene-card textarea')
  .filter((el) => {
    const label = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    const scope = el.closest('.field') || el.parentElement;
    return !((label && label.querySelector('.q')) || (scope && scope.querySelector('.q')));
  })
  .map((el) => el.id || el.dataset.field || '?');
test('у каждого поля есть подсказка', () => missing.length === 0 || 'без подсказки: ' + missing.join(', '));

console.log('\n— Калькулятор режимов —');
test('режимы рассчитаны при старте', () => F('matOut').textContent.includes('мм/мин') || F('matOut').textContent);
test('есть ap/ae/fz/Vc', () => ['ap', 'ae', 'fz', 'Vc'].every((k) => F('matOut').textContent.includes(k)));
click('#matApply');
await sleep(350);
test('применение S/F в параметры', () => F('spindle').value === '24000' && F('feed').value === '2880');
test('код перегенерирован с новыми S/F', () => output().includes('M3 S24000') || output().slice(0, 200));

console.log('\n— Конструктор —');
tab('scene');
test('вкладка «Конструктор» открыта', () => q('#tab-scene').classList.contains('active'));
test('активная кнопка вкладки — «Конструктор»', () => q('.tab.active').dataset.tab === 'scene' || 'активна ' + q('.tab.active').dataset.tab);
test('в сцене по умолчанию 3 элемента', () => qa('.scene-card').length === 3 || 'карточек ' + qa('.scene-card').length);
test('код конструктора без ошибок', () => errors() === 0 || 'ошибок ' + errors());
test('есть комментарий элемента', () => output().includes('1. Прямоугольник'));

setVal('templateSel', 'pocket');
click('#templateApply');
await sleep(400);
test('шаблон «карман + текст»: 2 элемента', () => qa('.scene-card').length === 2 || 'карточек ' + qa('.scene-card').length);
test('шаблон «карман»: много резов', () => (output().match(/G1 X/g) || []).length > 20);
test('шаблон «карман»: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());

setVal('addType', 'star');
click('#addEl');
await sleep(400);
test('добавление звезды: 3 элемента', () => qa('.scene-card').length === 3 || 'карточек ' + qa('.scene-card').length);
test('звезда в комментарии кода', () => output().includes('Звезда'));
test('после добавления без ошибок', () => errors() === 0 || 'ошибок ' + errors());

const firstCard = qa('.scene-card')[0];
const firstSummary = firstCard.querySelector('.nm').textContent;
test('карточка элемента показывает описание', () => firstSummary.length > 3 || firstSummary);

setVal('blankW', '15');
setVal('blankH', '15');
await sleep(450);
test('выход за поле: валидатор ловит', () => errors() > 0 || 'ошибок нет');
test('выход за поле: скачивание заблокировано', () => F('download').disabled === true);
setVal('blankW', '80');
setVal('blankH', '50');
await sleep(450);
test('после возврата поля: без ошибок', () => errors() === 0 || 'ошибок ' + errors());
test('после возврата поля: скачивание доступно', () => F('download').disabled === false);

console.log('\n— Резьба / сверление —');
tab('threads');
test('вкладка «Резьба» открыта', () => q('#tab-threads').classList.contains('active'));
test('G84 рассчитан', () => F('t84Out').textContent.includes('G84'));
test('G84: метаданные со сверлом', () => F('t84Meta').textContent.includes('сверло'));
test('G84: отверстий 1', () => F('t84Meta').textContent.includes('отверстий'));
subtab('t83');
test('вкладка G83 активна', () => F('sub-t83').classList.contains('active'));
test('G83 рассчитан', () => F('t83Out').textContent.includes('G83'));
test('G83: Q присутствует', () => F('t83Out').textContent.includes('Q'));
click('#t83Make');
await sleep(300);
test('G83: программа в основном поле', () => output().includes('G83') && output().includes('M30'));
test('G83: чек-лист без ошибок', () => errors() === 0 || 'ошибок ' + errors());
setVal('t83Depth', '-30');
click('#t83Make');
await sleep(400);
test('глубина ниже лимита Z: ошибка', () => errors() > 0 || 'ошибок нет');
setVal('t83Depth', '-12');
subtab('t76');
test('G76 рассчитан', () => F('t76Out').textContent.includes('G76'));
subtab('t84');
test('G84 снова активен', () => F('sub-t84').classList.contains('active'));

console.log('\n— Наружная резьба —');
subtab('tExt');
await sleep(250);
test('вкладка «Наружная резьба» активна', () => F('sub-tExt').classList.contains('active'));
test('четыре подвкладки резьбы', () => qa('.subtab').length === 4 || 'подвкладок ' + qa('.subtab').length);
test('наружная резьба рассчитана', () => F('tExtOut').textContent.includes('НАРУЖНАЯ РЕЗЬБА'));
test('наружная резьба: правая — G2', () => F('tExtOut').textContent.includes('G2 X-'));
test('наружная резьба: метаданные с проходами', () => F('tExtMeta').textContent.includes('проходов'));
setVal('tExtThread', 'M12');
await sleep(250);
test('таблица наружной резьбы: M12 → 12×1.75', () =>
  F('tExtD').value === '12' && F('tExtP').value === '1.75' && F('tExtOut').textContent.includes('12×1.75'));
setVal('tExtD', '12');
setVal('tExtP', '1.75');
setVal('tExtLen', '10');
click('#tExtCalc');
await sleep(250);
test('наружная резьба: параметры 12×1.75', () => F('tExtOut').textContent.includes('12×1.75'));
test('наружная резьба: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());
click('#tExtMake');
await sleep(300);
test('наружная резьба вставлена в программу', () => output().includes('НАРУЖНАЯ РЕЗЬБА') && output().includes('G2 X-'));
test('наружная резьба: программа валидна', () => errors() === 0 || 'ошибок ' + errors());
setVal('tExtHand', 'left');
await sleep(300);
test('левая наружная резьба: G3', () => F('tExtOut').textContent.includes('G3 X-'));
subtab('t84');

console.log('\n— Импорт —');
tab('import');
F('importCode').value = 'G21\nG90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-1 F100\nG0 Z5\nM5\n';
click('#importBtn');
await sleep(200);
test('импорт без M30: ошибка', () => errors() > 0 || 'ошибок нет');
F('importCode').value = 'G21 G90\nM3 S12000\nG0 X0 Y0 Z5\nG1 Z-1 F200\nG1 X30 F600\nG1 Y20\nG1 X0\nG1 Y0\nG0 Z5\nM5\nM30\n';
click('#importBtn');
await sleep(200);
test('импорт корректного кода: без ошибок', () => errors() === 0 || 'ошибок ' + errors());
test('импорт: код в поле', () => output().includes('G1 X30'));
test('импорт: превью нарисовано', () => qa('#preview line, #preview polyline').length > 2);
test('импорт: информация разобрана', () => F('importInfo').textContent.includes('Разобрано'));
const macroCode = fs.readFileSync(path.join(ROOT, 'test/fixtures/macro-star.nc'), 'utf8');
F('importCode').value = macroCode;
click('#importBtn');
await sleep(500);
test('макрос: предпросмотр не пустой', () => qa('#preview line, #preview polyline').length > 3);
test('макрос: время посчитано', () => F('statsBox').textContent.includes('мин') || F('statsBox').textContent);
test('макрос: информация о раскрытии', () => F('importInfo').textContent.includes('раскрыта'));
test('макрос: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());
const issueCode = fs.readFileSync(path.join(ROOT, 'test/fixtures/issue1.nc'), 'utf8');
F('importCode').value = issueCode;
click('#importBtn');
await sleep(500);
test('issue #1: предпросмотр с внутренними кругами', () => {
  const lines = qa('#preview line, #preview polyline').length;
  return lines > 20 || 'линий ' + lines;
});
test('issue #1: время посчитано', () => F('statsBox').textContent.includes('мин') || F('statsBox').textContent);
test('issue #1: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());

console.log('\n— Гравировка и кириллица —');
tab('engrave');
test('вкладка «Гравировка» открыта', () => q('#tab-engrave').classList.contains('active'));
setVal('engrMode', 'calc');
setVal('calcExpr', '123+456');
await sleep(400);
test('калькулятор: 579 в коде', () => output().includes('579') || output().slice(0, 300));
setVal('engrMode', 'text');
setVal('engrKind', 'normal');
setVal('engrText', 'ПРИВЕТ, МИР! №5');
setVal('engrSize', '10');
await sleep(500);
test('кириллица в комментарии', () => output().includes('ПРИВЕТ'));
test('нет undefined/NaN', () => !/undefined|NaN/.test(output()));
test('кириллица: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());
test('кириллица: резы есть', () => (output().match(/G1 Z-1/g) || []).length > 10);
test('примечание: ширина надписи', () => F('engrNote').textContent.includes('ширина'));

setVal('engrKind', 'inverse');
await sleep(900);
test('обратная гравировка: код собран', () => output().length > 2000);
test('обратная гравировка: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());
test('обратная гравировка: растр', () => (output().match(/G1 X/g) || []).length > 30);
test('нет ошибок в консоли', () => (ctx.window.__errs || []).length === 0 || (ctx.window.__errs || []).join(' | '));

console.log('\n— Картинка —');
tab('image');
await sleep(250);
test('вкладка «Картинка» открыта', () => q('#tab-image').classList.contains('active'));
test('картинка: поля загрузки и настроек', () => !!F('imageFile') && !!F('imageMode') && !!F('imageWidth') && !!F('imageGenerate'));
test('картинка: пустое состояние', () => F('imageInfo').textContent.includes('загрузите'));
test('картинка: шаг строк выключен для точек', () => F('imageLineStep').disabled === true);
setVal('imageMode', 'lines');
await sleep(250);
test('картинка: шаг строк включается для строк', () => F('imageLineStep').disabled === false);

console.log('\n— Шпаргалки —');
test('восемь вкладок в шапке', () => qa('.tab').length === 8 || 'вкладок ' + qa('.tab').length);
tab('ref');
test('вкладка «Шпаргалки» открыта', () => q('#tab-ref').classList.contains('active'));
test('активная кнопка — «Шпаргалки»', () => q('.tab.active').dataset.tab === 'ref');
test('правая колонка скрыта (широкий режим)', () => q('.layout').classList.contains('wide'));
test('структура программы — 12 строк', () => qa('.prog-struct .prow').length >= 12 || 'строк ' + qa('.prog-struct .prow').length);
test('структура: строка M30 с комментарием', () => {
  const rows = qa('.prog-struct .prow').map((r) => r.textContent);
  return rows.some((t) => t.includes('M30') && t.includes('конец программы'));
});
test('есть G65, WHILE, SIN, ATAN', () => {
  const t = document.body.textContent;
  return ['G65', 'WHILE', 'SIN', 'ATAN', 'MOD', '#3000'].every((k) => t.includes(k));
});
test('таблица аргументов G65: A → #1', () => {
  return qa('#ref-g65 table tr').some((r) => r.textContent.includes('A') && r.textContent.includes('#1'));
});
test('G- и M-таблицы заполнены', () => qa('#ref-gcodes tr').length > 20 && qa('#ref-mcodes tr').length > 10);
test('таблица резьб заполнена', () => qa('#ref-threads-body tr').length > 15);
test('есть совместимость контроллеров', () => {
  const t = document.body.textContent;
  return t.includes('Macro B') && t.includes('GRBL') && t.includes('LinuxCNC');
});

console.log('\n— Калькулятор дуг —');
tab('arc');
test('вкладка «Дуги» открыта', () => q('#tab-arc').classList.contains('active'));
test('дуги: расчёт выполнен', () => F('arcOut').textContent.includes('R =') || F('arcOut').textContent);
test('дуги: превью нарисовано', () => qa('#arcPreview polyline').length >= 1);
test('дуги: сводка R/угол', () => F('arcInfo').textContent.includes('R=') && F('arcInfo').textContent.includes('°'));
setCheck('arcFull', true);
await sleep(350);
test('дуги: полный круг включён', () => F('arcFull').checked && F('arcEx').disabled && F('arcCxWrap').style.display !== 'none');
test('дуги: полный круг — G3 X/Y и I/J', () => F('arcOut').textContent.includes('полный круг 360') && F('arcOut').textContent.includes('G3 X10 Y0 I-10 J0'));
test('дуги: полный круг нарисован', () => qa('#arcPreview polyline').length >= 1);
setVal('arcCx', '2');
setVal('arcCy', '3');
click('#arcSolve');
await sleep(250);
test('дуги: центр полного круга меняет I/J', () => F('arcOut').textContent.includes('I-8') && F('arcOut').textContent.includes('J3'));
setCheck('arcFull', false);
await sleep(300);
test('дуги: полный круг выключен, поля вернулись', () => !F('arcFull').checked && !F('arcEx').disabled && F('arcCxWrap').style.display === 'none');
setVal('arcEx', '0');
setVal('arcEy', '10');
setVal('arcR', '5');
click('#arcSolve');
await sleep(250);
test('дуги: малый радиус — предупреждение', () => F('arcOut').textContent.includes('⚠') || F('arcOut').textContent);
setVal('arcR', '');
click('#arcSolve');
await sleep(250);
test('дуги: пустой R — снова считается', () => F('arcOut').textContent.includes('I =') && !F('arcOut').textContent.includes('⚠'));
setVal('arcSx', '99');
setVal('arcEx', '77');
click('#arcReset');
await sleep(250);
test('дуги: кнопка сброса возвращает значения', () =>
  F('arcSx').value === '10' && F('arcEx').value === '0' && F('arcEy').value === '10' && F('arcR').value === '' ||
  'Sx=' + F('arcSx').value + ' Ex=' + F('arcEx').value + ' R=' + F('arcR').value);

F('output').value = '';
click('#arcInsert');
await sleep(450);
test('вставка дуги в пустую программу: полная программа', () =>
  output().includes('M3 S') && output().includes('G3 X0 Y10') && output().includes('M30'));
test('вставка дуги в пустую программу: без ошибок', () => errors() === 0 || 'ошибок ' + errors());

tab('engrave');
await sleep(500);
tab('arc');
await sleep(300);
click('#arcInsert');
await sleep(500);
test('вставка дуги в готовую программу: перед M5', () => {
  const o = output();
  const idxArc = o.indexOf('G3 X');
  const idxM5 = o.lastIndexOf('\nM5');
  return idxArc > 0 && idxM5 > 0 && idxArc < idxM5 || ('arc=' + idxArc + ' m5=' + idxM5);
});
test('вставка дуги в готовую программу: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());

console.log('\n— Возврат из шпаргалок —');
tab('engrave');
test('правая колонка снова видна', () => !q('.layout').classList.contains('wide'));
test('код сгенерирован после возврата', () => output().length > 300 && errors() === 0);
test('вкладка гравировки активна', () => q('#tab-engrave').classList.contains('active'));

console.log('\n— Редактируемый G-код —');
test('поле G-кода не readonly', () => !F('output').hasAttribute('readonly'));
F('output').value = 'G21\nG90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-1 F100\nG0 Z5\nM5\n';
F('output').dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(750);
test('ручная правка проверяется: нет M30', () => errors() > 0 || 'ошибок нет');
test('ошибка блокирует скачивание', () => F('download').disabled === true);
click('#regenBtn');
await sleep(650);
test('кнопка «Сгенерировать заново» вернула код', () => output().includes('M30') && errors() === 0);

console.log('\n— Проект: undo/redo, массив, зеркало, выравнивание —');
tab('scene');
await sleep(500);
const n0 = cards();
setVal('addType', 'text');
click('#addEl');
await sleep(650);
test('элемент добавлен', () => cards() === n0 + 1 || 'карточек ' + cards());
test('undo доступен', () => F('undoBtn').disabled === false);
click('#undoBtn');
await sleep(650);
test('undo вернул сцену', () => cards() === n0 || 'карточек ' + cards());
test('redo доступен', () => F('redoBtn').disabled === false);
click('#redoBtn');
await sleep(650);
test('redo вернул элемент', () => cards() === n0 + 1 || 'карточек ' + cards());

click(qa('.scene-card')[0].querySelector('[data-act="mirrorX"]'));
await sleep(650);
test('зеркало включилось', () => qa('.scene-card')[0].querySelector('[data-act="mirrorX"]').classList.contains('on'));
test('зеркало: код валиден', () => errors() === 0 || 'ошибок ' + errors());

const beforeArr = cards();
setVal('arrCols', '2');
setVal('arrRows', '1');
setVal('arrDx', '10');
setVal('arrDy', '0');
click('#arrApply');
await sleep(750);
test('массив удвоил элементы', () => cards() === beforeArr * 2 || 'карточек ' + cards());
click('#undoBtn');
await sleep(650);
test('undo массива', () => cards() === beforeArr || 'карточек ' + cards());

click('[data-align="left"]');
await sleep(650);
test('выравнивание: код без ошибок', () => errors() === 0 || 'ошибок ' + errors());

setCheck('blankEnabled', false);
await sleep(300);
setVal('ramp', '5');
setCheck('optimize', true);
await sleep(650);
test('плавный вход и оптимизация: код без ошибок', () => errors() === 0 || 'ошибок ' + errors());
test('поля ramp/optimize доступны', () => F('ramp').value === '5' && F('optimize').checked === true);
setVal('ramp', '0');
setCheck('blankEnabled', true);

console.log('\n— Поля перемычек —');
const tabsCard = qa('.scene-card').find((c) => c.querySelector('[data-field="tabs"]'));
test('есть контур с полем перемычек', () => !!tabsCard);
if (tabsCard){
  const ti = tabsCard.querySelector('[data-field="tabs"]');
  ti.value = '4';
  ti.dispatchEvent(new window.Event('input', { bubbles: true }));
  ti.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(650);
  test('ширина/высота перемычки появились', () => !!qa('.scene-card').find((c) => c.querySelector('[data-field="tabW"]')));
}

console.log('\n— Высоты фигур —');
setVal('templateSel', 'heights');
click('#templateApply');
await sleep(650);
test('шаблон «Рельеф»: 4 элемента', () => cards() === 4 || 'карточек ' + cards());
test('у карточек есть бейдж высоты', () => qa('.scene-card .z-badge').length === 4);
test('в G-коде разные высоты элементов', () =>
  output().includes('Z -1') && output().includes('Z -2.5') && output().includes('Z -3…-1'));
const zCard = qa('.scene-card')[0];
const zDepth = zCard.querySelector('[data-z="depth"]');
zDepth.value = '-4';
zDepth.dispatchEvent(new window.Event('input', { bubbles: true }));
zDepth.dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(650);
test('своя глубина элемента попала в код', () => output().includes('Z -4') || output().slice(0, 300));
const zProfile = qa('.scene-card')[1].querySelector('[data-z="profile"]');
[...zProfile.options].forEach((o) => {
  if (o.value === 'slopeY') o.setAttribute('selected', 'selected'); else o.removeAttribute('selected');
});
zProfile.dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(650);
test('профиль «Наклон по Y» показывает Z1/Z2', () => !!qa('.scene-card')[1].querySelector('[data-z="z1"]'));
const z1 = qa('.scene-card')[1].querySelector('[data-z="z1"]');
const z2 = qa('.scene-card')[1].querySelector('[data-z="z2"]');
z1.value = '-2'; z2.value = '-5';
z1.dispatchEvent(new window.Event('input', { bubbles: true }));
z2.dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(650);
test('наклон по Y: диапазон в коде', () => output().includes('Z -5…-2') || output().slice(0, 400));
test('высоты: чек-лист без ошибок', () => errors() === 0 || 'ошибок ' + errors());

console.log('\n— Параметрический калькулятор —');
tab('param');
await sleep(500);
test('вкладка «Параметры» открыта', () => q('#tab-param').classList.contains('active'));
test('общие параметры доступны для настройки постпроцессора', () => F('commonParams').style.display !== 'none');
test('переменные: 4 строки по умолчанию', () => qa('#paramVarList .pv-row').length === 4 || 'строк ' + qa('#paramVarList .pv-row').length);
test('выражение посчитано', () => F('paramExprOut').textContent.includes('80.5') || F('paramExprOut').textContent);
test('поля шаблона построены', () => qa('#paramFields [data-pf]').length >= 8);
test('параметрическая программа содержит WHILE и #', () =>
  F('paramOut').textContent.includes('WHILE') && F('paramOut').textContent.includes('#100'));
test('сводка шаблона заполнена', () => F('paramInfo').textContent.includes('отв.') || F('paramInfo').textContent);

const pvRow = qa('#paramVarList .pv-row')[0];
const pvExpr = pvRow.querySelector('[data-pv="expr"]');
pvExpr.value = '50';
pvExpr.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(150);
test('переменная пересчитана', () => F('paramExprOut').textContent.includes('100.5') || F('paramExprOut').textContent);

setVal('paramMode', 'grid');
await sleep(450);
test('смена шаблона: поля сетки', () => F('paramFields').textContent.includes('Колонок'));
test('смена шаблона: вложенные циклы', () => F('paramOut').textContent.includes('DO 2'));
click('#paramCalc');
await sleep(300);
click('#paramMake');
await sleep(500);
test('числовая версия в G-коде', () => output().includes('G83') && output().includes('M30'));
test('числовая версия: чек-лист чистый', () => errors() === 0 || 'ошибок ' + errors());
setVal('paramView', 'numeric');
await sleep(250);
test('числовая версия без # в предпросмотре', () => !F('paramOut').textContent.includes('#'));
test('числовая версия содержит G80', () => F('paramOut').textContent.includes('G80'));

console.log('\n— Постпроцессор и инструменты —');
tab('scene');
await sleep(400);
setVal('controller', 'custom');
await sleep(400);
test('Custom-постпроцессор: панель шапки/подвала видна', () => F('customPost').style.display !== 'none');
setVal('wcs', 'G55');
setVal('arcMode', 'r');
setVal('decimals', '1');
setCheck('useM6', true);
setVal('toolNum', '4');
setVal('customHeader', 'G4 P1\n(TEST {TITLE})');
setVal('customFooter', 'G65 P1');
await sleep(700);
test('Custom: WCS, M6/G43, шапка и подвал в коде', () =>
  output().includes('G55') && output().includes('T4 M6') && output().includes('G43 H4') &&
  output().includes('G4 P1') && output().includes('G65 P1'));
test('Custom: токен {TITLE} подставлен', () => output().includes('(TEST') && !output().includes('{TITLE}'));
test('Custom: чек-лист без ошибок', () => errors() === 0 || 'ошибок ' + errors());

setVal('controller', 'universal');
await sleep(400);
setCheck('useTools', true);
await sleep(500);
test('библиотека: один инструмент по умолчанию', () => qa('.tool-card').length === 1 || 'карточек ' + qa('.tool-card').length);
click('#addTool');
await sleep(500);
test('библиотека: добавлен второй инструмент', () => qa('.tool-card').length === 2 || 'карточек ' + qa('.tool-card').length);
test('у элементов появился выбор инструмента', () => qa('.scene-card select[data-tool]').length === cards());

const toolSel = qa('.scene-card')[0].querySelector('select[data-tool]');
[...toolSel.options].forEach((o) => {
  if (o.value === '2') o.setAttribute('selected', 'selected'); else o.removeAttribute('selected');
});
toolSel.dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(700);
test('смена T2 попала в G-код', () => output().includes('T2 M6') && output().includes('G43 H2'));
test('смена инструмента безопасна', () => errors() === 0 || 'ошибок ' + errors());

console.log('\nИтого: ✅ ' + pass + '  ❌ ' + fail);
process.exit(fail ? 1 : 0);
