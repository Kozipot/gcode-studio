import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCore } from './load-core.mjs';

const C = loadCore();
let passed = 0, failed = 0;
function test(name, fn){
  try { fn(); passed++; console.log('  ✅', name); }
  catch (e){ failed++; console.log('  ❌', name, '\n     ', e.message); }
}
function scene(blankW, blankH, items){
  return C.templateScene(blankW, blankH, items);
}
const BASE = { safeZ: 5, F: 800, Fz: 200, depth: -1, passDepth: 0.5, toolD: 3, stepover: 1.2, spindle: 12000, controller: 'universal' };
function gen(sc, extra){
  return C.buildProgram(sc, Object.assign({}, BASE, extra || {}));
}
function check(gcode, cfg){
  return C.validateGcode(gcode, Object.assign({
    minZ: -5, blank: {enabled:false}, safeZ: 5, toolD: 3
  }, cfg || {}));
}

console.log('\n— Шрифт —');
test('кириллица: все буквы имеют глифы', () => {
  const g = C.buildTextGeometry('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 10, 0, 0, {align:'left'});
  assert.equal(g.missing.length, 0);
  assert.ok(g.segs.length > 100, 'сегментов: ' + g.segs.length);
});
test('латиница и цифры не сломаны', () => {
  const g = C.buildTextGeometry('ABC 123', 10, 0, 0);
  assert.equal(g.missing.length, 0);
  assert.ok(g.segs.length >= 20);
  assert.ok(g.maxX > 0);
});
test('отсутствующий символ попадает в missing', () => {
  const g = C.buildTextGeometry('A#B', 10, 0, 0);
  assert.equal(g.missing.join(','), '#');
});
test('строчная кириллица становится прописной', () => {
  const g = C.buildTextGeometry('привет', 10, 0, 0);
  assert.equal(g.missing.length, 0);
  assert.ok(g.segs.length > 0);
});
test('многострочный текст растёт вверх', () => {
  const g = C.buildTextGeometry('A\nB', 10, 0, 0);
  assert.ok(g.maxY > 10.5, 'maxY=' + g.maxY);
});
test('«№» теперь есть', () => {
  const g = C.buildTextGeometry('№5', 10, 0, 0);
  assert.equal(g.missing.length, 0);
});
test('Ш: ровно три вертикали, без лишней палки', () => {
  const g = C.buildTextGeometry('Ш', 10, 0, 0);
  const verts = g.segs.filter((s) => Math.abs(s.x1 - s.x2) < 1e-9);
  assert.equal(verts.length, 3, 'вертикалей: ' + verts.length);
  assert.equal(new Set(verts.map((v) => Math.round(v.x1 * 100))).size, 3);
});
test('Щ: три стойки и хвост', () => {
  const g = C.buildTextGeometry('Щ', 10, 0, 0);
  const verts = g.segs.filter((s) => Math.abs(s.x1 - s.x2) < 1e-9);
  assert.equal(verts.length, 4, 'вертикалей: ' + verts.length);
});

console.log('\n— Фигуры —');
test('прямоугольник: 4 точки, замкнут', () => {
  const p = C.shapeRect(60, 40);
  assert.equal(p.pts.length, 4);
  assert.equal(p.closed, true);
  assert.equal(p.pts[0][0], -30);
});
test('круг: 96 точек и признак дуги', () => {
  const p = C.shapeCircle(40);
  assert.equal(p.pts.length, 96);
  assert.ok(p.circle && p.circle.r === 20);
});
test('шестиугольник: 6 вершин', () => {
  assert.equal(C.shapePoly(6, 50, 0).pts.length, 6);
});
test('звезда: 10 вершин', () => {
  assert.equal(C.shapeStar(5, 50, 22, 0).pts.length, 10);
});
test('спираль: радиус растёт', () => {
  const p = C.shapeSpiral(2, 25, 4, 'ccw');
  const r0 = Math.hypot(p.pts[0][0], p.pts[0][1]);
  const rN = Math.hypot(p.pts[p.pts.length-1][0], p.pts[p.pts.length-1][1]);
  assert.ok(Math.abs(r0 - 2) < 0.01, 'r0=' + r0);
  assert.ok(Math.abs(rN - 25) < 0.2, 'rN=' + rN);
});
test('синусоида: амплитуда', () => {
  const p = C.shapeSine(80, 8, 3);
  const ys = p.pts.map(q => q[1]);
  assert.ok(Math.abs(Math.max(...ys) - 8) < 0.2);
  assert.ok(Math.abs(Math.min(...ys) + 8) < 0.2);
});

console.log('\n— Генерация G-кода —');
test('сцена по умолчанию: M30/M3/G21/G90 и валидатор зелёный', () => {
  const sc = C.defaultScene();
  const prog = gen(sc);
  const g = prog.gcode;
  for (const token of ['M30', 'M3 S12000', 'G21', 'G90', 'G17', 'G94', 'M5']) assert.ok(g.includes(token), 'нет ' + token);
  const v = check(g, { blank: sc.blank, estSec: 100 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('все шаблоны собираются без undefined/NaN', () => {
  for (const t of C.SCENE_TEMPLATES){
    const sc = t.build();
    const prog = gen(sc);
    assert.ok(!/undefined|NaN/.test(prog.gcode), 'шаблон ' + t.id);
    assert.ok(prog.gcode.includes('M30'), t.id);
    const v = check(prog.gcode, { blank: sc.blank });
    const errs = v.items.filter(i => i.status === 'error').map(i => i.label + ': ' + i.detail);
    assert.equal(v.errors, 0, t.id + ' → ' + errs.join(' | '));
  }
});
test('поворот элемента работает', () => {
  const sc = scene(60, 60, [{ type:'rect', params:{ w:40, h:10 } }]);
  sc.elements[0].rot = 90;
  const prog = gen(sc);
  const b = C.geomBBox(C.transformGeom(C.elementGeometry(sc.elements[0]), sc.elements[0].place, 90));
  assert.ok(Math.abs((b.maxX - b.minX) - 10) < 0.01, 'ширина после поворота: ' + (b.maxX - b.minX));
  assert.ok(prog.moves.length > 0);
});
test('привязка «угол» ставит левый низ в точку', () => {
  const el = { type:'rect', params:{ w:20, h:10 }, place:{ mode:'corner', x:5, y:7 } };
  const g = C.transformGeom(C.elementGeometry(el), el.place, 0);
  const b = C.geomBBox(g);
  assert.ok(Math.abs(b.minX - 5) < 1e-6);
  assert.ok(Math.abs(b.minY - 7) < 1e-6);
});
test('без M30 — ошибка валидатора', () => {
  const v = check('G21\nG90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-1 F100\nM5\n');
  assert.ok(v.items.find(i => i.id === 'end').status === 'error');
});
test('рез ниже лимита Z — ошибка', () => {
  const sc = scene(50, 50, [{ type:'rect', params:{ w:20, h:20 } }]);
  const prog = gen(sc, { depth: -10, passDepth: 2 });
  const v = check(prog.gcode, { blank: sc.blank, minZ: -5 });
  const z = v.items.find(i => i.id === 'zlimit');
  assert.equal(z.status, 'error');
  assert.ok(/−|-\d/.test(z.detail));
});
test('выход за поле — ошибка', () => {
  const sc = scene(50, 50, [{ type:'rect', params:{ w:20, h:20 } }]);
  sc.elements[0].place = { mode:'center', x: 200, y: 200 };
  const prog = gen(sc);
  const v = check(prog.gcode, { blank: sc.blank });
  assert.equal(v.items.find(i => i.id === 'bounds').status, 'error');
});
test('скобки комментариев проверяются', () => {
  const v = check('( комментарий\nG21\nG90\nM3 S1000\nG1 X0 Y0 Z-1 F100\nM30\n');
  assert.equal(v.items.find(i => i.id === 'comments').status, 'error');
});
test('Fanuc: проценты, O-номер и N-строки', () => {
  const prog = gen(C.defaultScene(), { controller: 'fanuc' });
  assert.ok(prog.gcode.startsWith('%\nO0001'));
  assert.ok(/\nN\d+ G21/.test(prog.gcode));
  assert.ok(prog.gcode.includes('M30'));
  assert.ok(prog.gcode.trim().endsWith('%'));
});
test('GRBL: без процентов, комментарии латиницей', () => {
  const prog = gen(C.defaultScene(), { controller: 'grbl', asciiComments: true });
  assert.ok(!prog.gcode.includes('%'));
  assert.ok(!/[А-Яа-яЁё]/.test(prog.gcode), 'осталась кириллица');
});
test('СОЖ: M8 и M9', () => {
  const prog = gen(C.defaultScene(), { coolant: true });
  assert.ok(prog.gcode.includes('M8'));
  assert.ok(prog.gcode.includes('M9'));
});

console.log('\n— Карман / инверсия / отверстия —');
test('карман: резы внутри контура с отступом инструмента', () => {
  const sc = scene(60, 40, [{ type:'pocket', params:{ profile:'rect', w:40, h:24 } }]);
  const prog = gen(sc);
  const cuts = prog.moves.filter(m => m.t === 'line' && m.z < -0.5);
  assert.ok(cuts.length > 10, 'резов: ' + cuts.length);
  const el = sc.elements[0];
  const placed = C.transformGeom(C.elementGeometry(el), el.place, 0);
  const b = C.polygonBBox(placed.contour.pts);
  const r = 1.5;
  for (const m of cuts){
    assert.ok(m.x > b.minX + r - 0.1 && m.x < b.maxX - r + 0.1, 'X ' + m.x);
    assert.ok(m.y > b.minY + r - 0.1 && m.y < b.maxY - r + 0.1, 'Y ' + m.y);
  }
});
test('обратная гравировка: резы вне контура', () => {
  const sc = scene(70, 40, [{ type:'inv', params:{ profile:'rect', w:40, h:20, margin:2 } }]);
  const prog = gen(sc);
  const cuts = prog.moves.filter(m => m.t === 'line' && m.z < -0.5);
  assert.ok(cuts.length > 20);
  const el = sc.elements[0];
  const placed = C.transformGeom(C.elementGeometry(el), el.place, 0);
  const b = C.polygonBBox(placed.contour.pts);
  for (const m of cuts){
    const inside = m.x > b.minX && m.x < b.maxX && m.y > b.minY && m.y < b.maxY;
    assert.ok(!inside, 'рез внутри контура: ' + m.x + ',' + m.y);
  }
});
test('обратная гравировка текста', () => {
  const sc = scene(70, 40, [{ type:'text', params:{ text:'INV', height:10, align:'center', inverse:true } }]);
  const prog = gen(sc, { toolD: 2, stepover: 0.8 });
  assert.ok(prog.moves.length > 100);
  assert.equal(prog.warnings.length, 0, prog.warnings.join(' '));
});
test('отверстия: peck-проходы и глубина', () => {
  const sc = scene(60, 60, [{ type:'holes', params:{ rows:2, cols:2, dx:20, dy:20, d:3, depth:-6, peck:2 } }]);
  const prog = gen(sc);
  const lines = prog.moves.filter(m => m.t === 'line');
  assert.ok(lines.length >= 4 * 3, 'ходов: ' + lines.length);
  assert.equal(Math.min(...prog.moves.filter(m => m.t === 'line').map(m => m.z)), -6);
});

console.log('\n— Разбор и импорт —');
test('парсер видит M30, шпиндель и подачу', () => {
  const prog = gen(C.defaultScene());
  const st = C.parseProgram(prog.gcode);
  assert.equal(st.m30Line !== null, true);
  assert.equal(st.spindleStarted, true);
  assert.ok(st.f > 0);
  assert.ok(st.cutCount > 20);
});
test('цикл G83 разворачивается в движения', () => {
  const st = C.parseProgram('G21 G90\nM3 S1000\nG0 X0 Y0 Z5\nG83 X10 Y10 Z-9 R2 Q3 F100\nG80\nM5\nM30\n');
  assert.ok(st.moves.length >= 6);
  assert.ok(Math.abs(st.minCutZ + 9) < 1e-6, 'minCutZ=' + st.minCutZ);
});
test('дуги: I/J и отклонение конца', () => {
  const st = C.parseProgram('G21\nG0 X10 Y0\nG3 X0 Y10 I-10 J0 F100\nM30\n');
  const arc = st.moves.find(m => m.t === 'arc');
  assert.ok(arc);
  assert.equal(st.arcIssues.length, 0);
});
test('полный круг G3 только с I/J (без X/Y) распознаётся', () => {
  const st = C.parseProgram('G21 G90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-1 F100\nG3 I-20 J0\nG3 I-10 J0\nG0 Z5\nM5\nM30\n');
  const arcs = st.moves.filter(m => m.t === 'arc');
  assert.equal(arcs.length, 2);
  assert.ok(Math.abs(arcs[0].i + 20) < 1e-9);
  assert.ok(Math.abs(arcs[1].i + 10) < 1e-9);
  assert.ok(Math.abs(st.minCutZ + 1) < 1e-9);
  const v = C.validateGcode('G21 G90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-1 F100\nG3 I-20 J0\nG3 I-10 J0\nG0 Z5\nM5\nM30\n',
    { minZ:-25, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('калькулятор: полный круг из текущей точки в неё же', () => {
  const res = C.solveFullCircle(10, 0, 0, 0, 'G3');
  assert.ok(!res.error);
  assert.equal(res.full, true);
  assert.ok(Math.abs(res.r - 10) < 1e-9);
  assert.ok(Math.abs(res.i + 10) < 1e-9);
  assert.ok(Math.abs(res.j) < 1e-9);
  assert.equal(res.sweepDeg, 360);
  assert.equal(res.line, 'G3 X10 Y0 I-10 J0');
  const bad = C.solveFullCircle(10, 0, 10, 0, 'G3');
  assert.ok(bad.error);
});
test('картинка: точки, строки, инверсия и границы', () => {
  const black = new Array(16).fill(0);
  const dots = C.imageToMoves(black, 4, 4, { width:4, height:4, res:1, mode:'dots', depth:-0.5 });
  assert.equal(dots.dots, 16);
  assert.equal(dots.moves.length, 48);
  assert.equal(dots.gridW, 4);
  assert.equal(dots.gridH, 4);
  const lines = C.imageToMoves(black, 4, 4, { width:4, height:4, res:1, lineStep:1, mode:'lines', depth:-0.5 });
  assert.equal(lines.runs, 4);
  assert.equal(lines.moves.length, 16);
  assert.equal(lines.blank.w, 4);
  const inv = C.imageToMoves(black, 4, 4, { width:4, height:4, res:1, mode:'dots', invert:true, depth:-0.5 });
  assert.equal(inv.dots, 0);
  assert.ok(inv.warnings.length > 0);
  const grad = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) grad.push(x * 64 + y * 16);
  const dith = C.imageToMoves(grad, 4, 4, { width:4, height:4, res:1, mode:'dots', dither:'floyd', threshold:128, depth:-0.5 });
  assert.ok(dith.dots > 0 && dith.dots < 16);
  assert.ok(dith.moves.every(m => m.x >= 0 && m.x <= 4 && m.y >= 0 && m.y <= 4));
});
test('картинка: яркость, контраст, гамма и уровни', () => {
  const lut = C.imageToneLUT({brightness:100});
  assert.ok(lut[0] > 0 && lut[255] === 255);
  const con = C.imageToneLUT({contrast:100});
  assert.ok(con[0] === 0 && con[255] === 255 && con[100] < 100);
  const levels = C.imageToneLUT({black:50, white:200});
  assert.equal(levels[50], 0);
  assert.equal(levels[200], 255);
  const gamma = C.imageToneLUT({gamma:2});
  assert.ok(gamma[128] > 128);
  const black = new Array(4).fill(0);
  const bright = C.imageToMoves(black, 2, 2, { width:2, height:2, res:1, mode:'dots', brightness:100, depth:-0.5 });
  assert.equal(bright.dots, 0);
});
test('импорт кода без M30 — ошибка в чек-листе', () => {
  const v = check('G21\nG90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-1 F100\nG0 Z5\nM5\n');
  assert.equal(v.items.find(i => i.id === 'end').status, 'error');
});
test('макрос: #переменные и WHILE раскрываются для предпросмотра', () => {
  const code = fs.readFileSync(new URL('./fixtures/macro-star.nc', import.meta.url), 'utf8');
  const st = C.parseProgram(code);
  assert.equal(st.macroExpanded, true);
  assert.ok(st.moves.length > 50, 'движений: ' + st.moves.length);
  assert.ok(Math.abs(st.minCutZ + 10) < 1e-6, 'minCutZ=' + st.minCutZ);
  const est = C.estimateMoves(st.moves, 100, 100);
  assert.ok(est.totalSec > 60, 'время: ' + est.totalSec);
  const v = C.validateGcode(code, { minZ:-25, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('issue #1: две программы, полные круги G3 I/J и внутренние круги видны', () => {
  const code = fs.readFileSync(new URL('./fixtures/issue1.nc', import.meta.url), 'utf8');
  const st = C.parseProgram(code);
  const arcs = st.moves.filter(m => m.t === 'arc');
  assert.ok(st.moves.length > 900, 'движений: ' + st.moves.length);
  assert.ok(arcs.length > 300, 'дуг: ' + arcs.length);
  assert.equal(st.arcIssues.length, 0);
  assert.ok(Math.abs(st.minCutZ + 11) < 1e-6, 'minCutZ=' + st.minCutZ);
  const v = C.validateGcode(code, { minZ:-25, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('макрос: IF/THEN и IF/GOTO с меткой N', () => {
  const code = `G21 G90
M3 S1000
G0 X0 Y0 Z5
G1 Z-1 F100
#1 = 0
WHILE [#1 LT 3] DO1
  #1 = [#1 + 1]
  IF [#1 EQ 2] GOTO 10
  G1 X#1 F100
  N10
END1
#2 = 10
IF [#2 GT 5] THEN #2 = 5
G1 X#2
M5
M30`;
  const st = C.parseProgram(code);
  const xs = st.moves.filter(m => m.t === 'line' && m.z < 0).map(m => Math.round(m.x * 100) / 100);
  assert.ok(xs.includes(1), 'X1: ' + xs.join(','));
  assert.ok(xs.includes(3), 'X3: ' + xs.join(','));
  assert.ok(!xs.includes(2), 'X2 не должен резаться: ' + xs.join(','));
  assert.ok(xs.includes(5), 'IF/THEN clamp X5: ' + xs.join(','));
});

console.log('\n— Резьба / сверление / расточка —');
test('G84: F = P × S, сверло = D − P', () => {
  const r = C.calcTapping({ d:6, p:1, s:500, sManual:true, depth:-10, r:2, holes:[{x:0,y:0}] });
  assert.equal(r.S, 500);
  assert.equal(r.F, 500);
  assert.equal(r.tapDrill, 5);
  assert.ok(r.code.includes('G84'));
  assert.ok(r.code.includes('Z-10'));
  assert.ok(r.code.includes('G80'));
});
test('G84 мм/об: F = P и G95', () => {
  const r = C.calcTapping({ d:6, p:1, s:500, sManual:true, fmode:'rev', depth:-10, r:2, holes:[] });
  assert.equal(r.F, 1);
  assert.ok(r.code.includes('G95'));
});
test('G83: Q, G80, число заходов', () => {
  const r = C.calcDrilling({ d:5, depth:-12, r:2, q:3, cycle:'G83', holes:[{x:0,y:0}] });
  assert.equal(r.pecks, 4);
  assert.ok(r.code.includes('Q3'));
  assert.ok(r.code.includes('G83'));
  assert.ok(r.code.includes('G80'));
  assert.ok(r.S > 0 && r.F > 0);
});
test('G76: строка цикла', () => {
  const r = C.calcBoring({ d:20, depth:-20, r:2, q:0.2, p:0.5, s:600, f:48, holes:[{x:0,y:0}] });
  assert.ok(r.code.includes('G76'));
  assert.ok(r.code.includes('Q0.2'));
  assert.ok(r.code.includes('P0.5'));
});
test('сетка отверстий', () => {
  const hs = C.holeGrid({ rows:2, cols:3, dx:10, dy:5, x0:1, y0:2 });
  assert.equal(hs.length, 6);
  assert.equal(hs[0].x, 1); assert.equal(hs[0].y, 2);
  assert.equal(hs[5].x, 21); assert.equal(hs[5].y, 7);
});
test('полная программа из сниппета проходит валидатор', () => {
  const r = C.calcDrilling({ d:5, depth:-8, r:2, q:2, cycle:'G83', holes:[{x:10,y:10},{x:20,y:10}] });
  const code = C.wrapSnippet(r.code, 'СВЕРЛЕНИЕ', { safeZ:5, controller:'universal' });
  const v = check(code, { minZ: -10 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});

console.log('\n— Режимы резания —');
test('фреза: S/F/ap/ae положительные', () => {
  const r = C.calcFeeds({ material:'aluminium', op:'rough', d:3, z:2 });
  assert.ok(r.S > 0 && r.F > 0 && r.Fz > 0 && r.ap > 0 && r.ae > 0);
  assert.ok(r.S <= 24000);
});
test('чистовая: обороты выше черновой', () => {
  const a = C.calcFeeds({ material:'steel', op:'rough', d:6, z:3 });
  const b = C.calcFeeds({ material:'steel', op:'finish', d:6, z:3 });
  assert.ok(b.S > a.S);
  assert.ok(b.ap < a.ap);
});
test('подача F = S · fz · z', () => {
  const r = C.calcFeeds({ material:'aluminium', op:'rough', d:3, z:2 });
  const expect = r.S * r.fz * r.z;
  assert.ok(Math.abs(r.F - expect) < 2, 'F=' + r.F + ' ожидалось ' + expect);
});

console.log('\n— Дуги —');
test('полуокружность: 180° и R = хорда/2', () => {
  const r = C.solveArc(10, 0, 0, 10, null, 'G3');
  assert.ok(Math.abs(r.sweepDeg - 180) < 0.001, 'sweep=' + r.sweepDeg);
  assert.ok(Math.abs(r.r - Math.hypot(10, 10)/2) < 1e-9, 'r=' + r.r);
  assert.ok(r.line.includes('I-'), r.line);
});
test('слишком малый радиус — ошибка', () => {
  const r = C.solveArc(0, 0, 10, 0, 3, 'G3');
  assert.ok(r.error);
});

console.log('\n— Смещение, зеркало, массив, выравнивание —');
test('смещение прямоугольника наружу и внутрь', () => {
  const out = C.elementGeometry({ type:'rect', params:{ w:60, h:40, offset:1.5 } }).paths[0];
  const ob = C.polygonBBox(out.pts);
  assert.ok(Math.abs(ob.minX + 31.5) < 0.01 && Math.abs(ob.maxX - 31.5) < 0.01);
  assert.ok(Math.abs(ob.minY + 21.5) < 0.01 && Math.abs(ob.maxY - 21.5) < 0.01);
  const ins = C.elementGeometry({ type:'rect', params:{ w:60, h:40, offset:-5 } }).paths[0];
  const ib = C.polygonBBox(ins.pts);
  assert.ok(Math.abs(ib.maxX - ib.minX - 50) < 0.01);
  assert.ok(Math.abs(ib.maxY - ib.minY - 30) < 0.01);
});
test('смещение окружности меняет радиус', () => {
  const g = C.elementGeometry({ type:'circle', params:{ d:30, offset:-2 } });
  assert.ok(Math.abs(g.paths[0].circle.r - 13) < 1e-9);
});
test('слишком большое внутрь смещение даёт предупреждение', () => {
  const g = C.elementGeometry({ type:'circle', params:{ d:30, offset:-20 } });
  assert.ok(g.warnings.length > 0);
  assert.ok(Math.abs(g.paths[0].circle.r - 15) < 1e-9);
});
test('зеркало по X отражает координаты', () => {
  const g = { kind:'cut', paths:[{ pts:[[0,0],[10,0],[10,5]], closed:false }] };
  const m = C.transformGeom(g, { mode:'abs', x:5, y:5 }, 0, true, false);
  assert.ok(Math.abs(m.paths[0].pts[0][0] - 5) < 1e-9);
  assert.ok(Math.abs(m.paths[0].pts[1][0] + 5) < 1e-9);
});
test('выравнивание по левому краю', () => {
  const sc = C.templateScene(100, 60, [
    { type:'rect', params:{ w:20, h:10 } },
    { type:'rect', params:{ w:30, h:20 } }
  ]);
  C.alignElements(sc.elements, 'left', sc.blank);
  const boxes = sc.elements.map((el) => C.geomBBox(C.transformGeom(C.elementGeometry(el), el.place, el.rot, el.mirrorX, el.mirrorY)));
  assert.ok(Math.abs(boxes[0].minX) < 0.01 && Math.abs(boxes[1].minX) < 0.01);
});
test('выравнивание по центру X', () => {
  const sc = C.templateScene(100, 60, [
    { type:'rect', params:{ w:20, h:10 } },
    { type:'rect', params:{ w:30, h:20 } }
  ]);
  C.alignElements(sc.elements, 'centerX', sc.blank);
  const boxes = sc.elements.map((el) => C.geomBBox(C.transformGeom(C.elementGeometry(el), el.place, el.rot, el.mirrorX, el.mirrorY)));
  assert.ok(Math.abs((boxes[0].minX + boxes[0].maxX) / 2 - 50) < 0.01);
  assert.ok(Math.abs((boxes[1].minX + boxes[1].maxX) / 2 - 50) < 0.01);
});
test('массив создаёт копии с шагом', () => {
  const sc = C.templateScene(100, 60, [{ type:'rect', params:{ w:10, h:10 } }]);
  const out = C.arrayElements(sc.elements, { rows:2, cols:3, dx:10, dy:5 });
  assert.equal(out.length, 6);
  assert.equal(JSON.stringify(out.map((e) => [e.place.x, e.place.y])),
    JSON.stringify([[50, 30], [60, 30], [70, 30], [50, 35], [60, 35], [70, 35]]));
});

console.log('\n— Перемычки и плавный вход —');
function cutLenAtLevel(prog, z){
  let len = 0, prev = null;
  for (const m of prog.moves){
    if (m.t === 'comment' || m.t === 'dwell') continue;
    if (prev && m.t === 'line' && m.z === z && prev.z === z) len += Math.hypot(m.x - prev.x, m.y - prev.y);
    prev = m;
  }
  return len;
}
test('перемычки: на дне контур короче на 4 мостика', () => {
  const sc = C.templateScene(60, 60, [{ type:'rect', params:{ w:20, h:20, tabs:4, tabW:2, tabH:0.5 } }]);
  const prog = C.buildProgram(sc, { depth:-1, passDepth:-1, safeZ:5, F:800, Fz:200, toolD:3, stepover:1.2, spindle:12000, optimize:true });
  assert.ok(Math.abs(cutLenAtLevel(prog, -0.5) - 80) < 0.2, 'верх: ' + cutLenAtLevel(prog, -0.5));
  assert.ok(Math.abs(cutLenAtLevel(prog, -1) - 72) < 0.2, 'низ: ' + cutLenAtLevel(prog, -1));
});
test('плавный вход: рампа вместо вертикального врезания', () => {
  const sc = C.templateScene(60, 40, [{ type:'rect', params:{ w:20, h:20 } }]);
  const prog = C.buildProgram(sc, { depth:-1, passDepth:-1, safeZ:5, F:800, Fz:200, toolD:3, stepover:1.2, spindle:12000, ramp:5 });
  const lines = prog.moves.filter((m) => m.t === 'line');
  const idx = lines.findIndex((m, i) => i > 0 && m.z === -1 && lines[i-1].z === 0 && Math.hypot(m.x - lines[i-1].x, m.y - lines[i-1].y) > 0.5);
  assert.ok(idx > 0, 'рампа не найдена');
});
test('перемычка выше глубины — предупреждение сцены', () => {
  const sc = C.templateScene(60, 40, [{ type:'rect', params:{ w:20, h:20, tabs:2, tabW:2, tabH:2 } }]);
  const items = C.sceneChecks(sc, { toolD:3, depth:-1 });
  assert.ok(items.some((i) => i.id.indexOf('tabs') === 0 && i.status === 'warn'));
});

console.log('\n— Оптимизация быстрых ходов —');
test('оптимизация меняет порядок элементов на ближайший', () => {
  const sc = C.templateScene(100, 100, [
    { type:'circle', params:{ d:20 }, ox:35, oy:35 },
    { type:'rect', params:{ w:20, h:20 }, ox:-30, oy:-30 }
  ]);
  const off = C.buildProgram(sc, { depth:-1, passDepth:-1, safeZ:5, F:800, Fz:200, toolD:3, stepover:1.2, spindle:12000, optimize:false });
  const on = C.buildProgram(sc, { depth:-1, passDepth:-1, safeZ:5, F:800, Fz:200, toolD:3, stepover:1.2, spindle:12000, optimize:true });
  assert.ok(off.groups[0].name.indexOf('Окружность') === 0);
  assert.ok(on.groups[0].name.indexOf('Прямоугольник') === 0);
  assert.ok(on.moves.filter((m) => m.t === 'rapid').length <= off.moves.filter((m) => m.t === 'rapid').length + 2);
});

console.log('\n— Расширенные проверки —');
test('сцена без элементов — ошибка', () => {
  const items = C.sceneChecks({ blank:{ enabled:true, w:50, h:50 }, elements:[] }, { toolD:3, depth:-1 });
  assert.ok(items.some((i) => i.id === 'sceneEmpty' && i.status === 'error'));
});
test('фреза не проходит в карман — предупреждение', () => {
  const sc = C.templateScene(60, 40, [{ type:'pocket', params:{ profile:'rect', w:10, h:10 } }]);
  const items = C.sceneChecks(sc, { toolD:9.5, depth:-1 });
  assert.ok(items.some((i) => i.id.indexOf('toolfit') === 0 && i.status === 'warn'));
});
test('быстрый ход сквозь заготовку — ошибка', () => {
  const code = 'G21\nG90\nM3 S1000\nG0 X10 Y10 Z5\nG0 Z-2\nG0 X40\nG1 X0 Y0 F100\nM5\nM30\n';
  const v = C.validateGcode(code, { minZ:-10, blank:{ enabled:true, w:50, h:50 }, safeZ:5, toolD:3 });
  assert.equal(v.items.find((i) => i.id === 'rapidStock').status, 'error');
});
test('микросегменты — предупреждение', () => {
  let code = 'G21\nG90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-1 F100\n';
  for (let i = 0; i < 30; i++) code += 'G1 X' + (i * 0.001).toFixed(3) + ' F100\n';
  code += 'G0 Z5\nM5\nM30\n';
  const v = C.validateGcode(code, { minZ:-10, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.items.find((i) => i.id === 'tiny').status, 'warn');
});
test('M6 на глубине — предупреждение', () => {
  const code = 'G21\nG90\nM3 S1000\nG0 X0 Y0 Z5\nG1 Z-2 F100\nM6\nG0 Z5\nM5\nM30\n';
  const v = C.validateGcode(code, { minZ:-10, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.items.find((i) => i.id === 'toolchange').status, 'warn');
});
test('дополнительные проверки сцены попадают в чек-лист', () => {
  const v = C.validateGcode('G21\nG90\nM3 S1000\nG0 X0 Y0 Z5\nM5\nM30\n', {
    minZ:-10, blank:{ enabled:false }, safeZ:5, toolD:3,
    extraChecks: [{ id:'sceneX', label:'Проверка сцены', status:'warn', detail:'тест' }]
  });
  assert.ok(v.items.some((i) => i.id === 'sceneX' && i.status === 'warn'));
});

console.log('\n— Постпроцессор —');
test('custom: WCS, M6/G43, шапка, подвал, %, N-строки', () => {
  const prog = gen(C.defaultScene(), {
    controller:'custom', wcs:'G55', useM6:true, toolNum:3, percent:true, lineNumbers:true,
    decimals:1, customHeader:'G4 P1\n(TEST {TITLE})', customFooter:'G65 P1', title:'T'
  });
  const g = prog.gcode;
  assert.ok(g.startsWith('%'));
  assert.ok(g.includes('G55'));
  assert.ok(g.includes('T3 M6') && g.includes('G43 H3'));
  assert.ok(g.includes('G4 P1') && g.includes('(TEST T)') && g.includes('G65 P1'));
  assert.ok(/\nN\d+ G21/.test(g));
  assert.ok(g.trim().endsWith('%'));
});
test('custom: дуги в формате R без I/J', () => {
  const sc = scene(60, 40, [{ type:'circle', params:{ d:20 } }]);
  const g = gen(sc, { controller:'custom', arcMode:'r' }).gcode;
  const arcLines = g.split('\n').filter((l) => l.startsWith('G3') || /^N\d+ G3/.test(l));
  assert.ok(arcLines.length >= 2);
  assert.ok(arcLines.every((l) => l.includes(' R') && !l.includes(' I')));
});
test('точность координат: 1 знак', () => {
  const sc = scene(60, 40, [{ type:'rect', params:{ w:21.37, h:13.21 } }]);
  const g = gen(sc, { decimals:1 }).gcode;
  assert.ok(!/^G[01] X-?\d+\.\d{3}/m.test(g));
  assert.ok(/X-?\d+\.\d(?!\d)/.test(g));
});

console.log('\n— Инструменты и T/M6 —');
const toolSet = [
  { no:1, name:'T1', d:3, flutes:2, s:8000, f:500, fz:100 },
  { no:2, name:'T2', d:6, flutes:2, s:2000, f:250, fz:80 }
];
test('два инструмента: T1/T2, G43, разные S/F', () => {
  const sc = scene(60, 40, [
    { type:'rect', params:{ w:20, h:20 }, tool:1 },
    { type:'circle', params:{ d:12 }, tool:2 }
  ]);
  const prog = gen(sc, { useTools:true, tools:toolSet });
  const g = prog.gcode;
  assert.ok(g.includes('T1 M6') && g.includes('G43 H1'));
  assert.ok(g.includes('T2 M6') && g.includes('G43 H2'));
  assert.ok(g.includes('M3 S8000') && g.includes('M3 S2000'));
  assert.ok(g.includes('F250'));
  assert.equal(prog.toolsUsed.length, 2);
  const v = check(prog.gcode, { blank:sc.blank, safeZ:5, toolD:3, controller:'universal' });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i=>i.status==='error')));
});
test('смена инструмента поднимается на безопасную Z', () => {
  const sc = scene(60, 40, [
    { type:'rect', params:{ w:20, h:20 }, tool:1 },
    { type:'circle', params:{ d:12 }, tool:2 }
  ]);
  const g = gen(sc, { useTools:true, tools:toolSet, safeZ:7 }).gcode;
  const idx = g.indexOf('T2 M6');
  const before = g.slice(0, idx).trim().split('\n').slice(-3).join('\n');
  assert.ok(/G0 Z7/.test(before), before);
});
test('GRBL и M6 — предупреждение', () => {
  const sc = scene(60, 40, [
    { type:'rect', params:{ w:20, h:20 }, tool:1 },
    { type:'circle', params:{ d:12 }, tool:2 }
  ]);
  const prog = gen(sc, { controller:'grbl', useTools:true, tools:toolSet });
  const v = check(prog.gcode, { blank:sc.blank, safeZ:5, toolD:3, controller:'grbl' });
  const item = v.items.find((i) => i.id === 'toolchange');
  assert.equal(item.status, 'warn');
});
test('сниппет: WCS и M6', () => {
  const r = C.calcDrilling({ d:5, depth:-8, r:2, q:2, cycle:'G83', holes:[{x:10,y:10}] });
  const code = C.wrapSnippet(r.code, 'СВЕРЛЕНИЕ', { safeZ:5, wcs:'G56', useM6:true, toolNumber:4 });
  assert.ok(code.includes('G56'));
  assert.ok(code.includes('T4 M6') && code.includes('G43 H4'));
  const g = C.validateGcode(code, { minZ:-10, blank:{enabled:false}, safeZ:5, toolD:3 });
  assert.equal(g.errors, 0);
});

console.log('\n— Высоты элементов —');
test('elementHeightInfo: авто, своя глубина и наклон', () => {
  const a = C.elementHeightInfo({}, -1);
  assert.equal(a.profile, 'flat');
  assert.equal(a.z1, -1);
  const b = C.elementHeightInfo({ depth: -2.5 }, -1);
  assert.equal(b.z1, -2.5);
  const c = C.elementHeightInfo({ zProfile:'slopeX', z1:-1, z2:-3 }, -1);
  assert.equal(c.profile, 'slopeX');
  assert.equal(c.minZ, -3);
  assert.equal(c.maxZ, -1);
  assert.ok(c.short.includes('→'));
});
test('две фигуры режутся на разных глубинах', () => {
  const sc = scene(80, 40, [
    { type:'rect', params:{ w:20, h:10 }, depth:-1 },
    { type:'rect', params:{ w:20, h:10 }, ox:25, depth:-3 }
  ]);
  const prog = gen(sc, { passDepth: 0.5 });
  const zs = prog.moves.filter(m => m.t === 'line' && m.z < 0).map(m => m.z);
  assert.ok(zs.some(z => Math.abs(z + 1) < 1e-6), 'нет уровня -1');
  assert.ok(zs.some(z => Math.abs(z + 3) < 1e-6), 'нет уровня -3');
  assert.equal(prog.heights.length, 2);
});
test('наклон по X: Z плавно идёт от z1 к z2', () => {
  const sc = scene(60, 30, [{ type:'rect', params:{ w:40, h:10 }, zProfile:'slopeX', z1:-1, z2:-3 }]);
  const prog = gen(sc, { passDepth: 3 });
  const zs = prog.moves.filter(m => m.t === 'line' && m.z < 0).map(m => m.z);
  assert.ok(Math.min(...zs) <= -2.99, 'min=' + Math.min(...zs));
  assert.ok(Math.max(...zs) >= -1.01, 'max=' + Math.max(...zs));
  assert.ok(new Set(zs.map(z => Math.round(z * 100))).size > 1, 'Z не меняется');
});
test('ступени по X: четыре уровня и вертикальные переходы', () => {
  const sc = scene(80, 30, [{ type:'rect', params:{ w:60, h:10 }, zProfile:'stepsX', z1:-1, z2:-3, zSteps:4 }]);
  const prog = gen(sc, { passDepth: 3 });
  const cuts = prog.moves.filter(m => m.t === 'line' && m.z < 0);
  const zs = [...new Set(cuts.map(m => Math.round(m.z * 1000) / 1000))].sort((a, b) => a - b);
  assert.equal(zs.length, 4, 'уровни: ' + zs.join(','));
  const vertical = cuts.filter((m, i) => i > 0 && Math.abs(m.x - cuts[i-1].x) < 1e-9 &&
    Math.abs(m.y - cuts[i-1].y) < 1e-9 && m.z !== cuts[i-1].z);
  assert.ok(vertical.length > 0, 'нет вертикальных ступеней');
});
test('перемычки проверяются по глубине своего элемента', () => {
  const sc = scene(60, 40, [{ type:'rect', params:{ w:20, h:20, tabs:2, tabW:2, tabH:0.5 }, depth:-2 }]);
  const items = C.sceneChecks(sc, { toolD:3, depth:-1 });
  assert.ok(!items.some(i => i.id === 'tabs0'), JSON.stringify(items));
});
test('профиль ниже лимита Z — предупреждение сцены', () => {
  const sc = scene(60, 40, [{ type:'rect', params:{ w:20, h:20 }, zProfile:'slopeX', z1:-1, z2:-9 }]);
  const items = C.sceneChecks(sc, { toolD:3, depth:-1, minZ:-5 });
  assert.ok(items.some(i => i.id.indexOf('zlimit') === 0 && i.status === 'warn'));
});

console.log('\n— Параметрические выражения —');
test('приоритет, функции и переменные', () => {
  assert.equal(C.evalParamExpr('2+3*4'), 14);
  assert.ok(Math.abs(C.evalParamExpr('SIN[30]') - 0.5) < 1e-9);
  assert.ok(Math.abs(C.evalParamExpr('ATAN[1]/[1]') - 45) < 1e-9);
  assert.ok(Math.abs(C.evalParamExpr('SQRT[#1^2 + #2^2]', { 1:3, 2:4 }) - 5) < 1e-9);
  assert.equal(C.evalParamExpr('[#1 GT 2] AND [#1 LT 5]', { 1:3 }), 1);
  assert.equal(C.evalParamExpr('[#1 EQ 3] OR [#2 NE 0]', { 1:3 }), 1);
  assert.equal(C.evalParamExpr('17 MOD 5'), 2);
  assert.equal(C.evalParamExpr('ROUND[2.6] + FIX[2.6] + FUP[2.1]'), 8);
});
test('ошибки выражений: деление на 0 и SQRT[-1]', () => {
  assert.throws(() => C.evalParamExpr('1/0'), /Деление на ноль/);
  assert.throws(() => C.evalParamExpr('SQRT[-1]'), /SQRT/);
  assert.throws(() => C.evalParamExpr('SIN[30'), /Ожидалось/);
});
test('bolt: WHILE, #переменные, G83 и валидная числовая версия', () => {
  const r = C.buildParametric('bolt', { count:6, radius:40, depth:-6, dia:5, cycle:'G83' }, { safeZ:5 });
  assert.ok(!r.error, r.error);
  assert.ok(r.code.includes('WHILE') && r.code.includes('#100') && r.code.includes('G83'));
  assert.ok(r.code.includes('#108 = 1'), 'счётчик должен начинаться со второго отверстия');
  assert.ok(r.numericCode.includes('G83') && r.numericCode.includes('M30'));
  const v = C.validateGcode(r.numericCode, { minZ:-20, blank:{ enabled:false }, safeZ:5, toolD:5 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('grid: вложенные циклы и числовая сетка', () => {
  const r = C.buildParametric('grid', { cols:4, rows:3, dx:20, dy:15, x0:10, y0:10 }, { safeZ:5 });
  assert.ok(!r.error, r.error);
  assert.ok(r.code.includes('DO 2') && r.code.includes('END 2'));
  assert.ok(r.code.includes('#110 = 1') && r.code.includes('#110 = 0'), 'первая колонка не должна дублироваться');
  assert.ok(r.summary.includes('12'));
  const v = C.validateGcode(r.numericCode, { minZ:-20, blank:{ enabled:false }, safeZ:5, toolD:5 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('frame: проходы по глубине и валидатор', () => {
  const r = C.buildParametric('frame', { w:60, h:40, cx:45, cy:30, depth:-2, pass:0.5 }, { safeZ:5 });
  assert.ok(!r.error, r.error);
  assert.ok(r.code.includes('WHILE') && r.code.includes('G1 X'));
  const v = C.validateGcode(r.numericCode, { minZ:-20, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('circle: 72 сегмента и валидатор', () => {
  const r = C.buildParametric('circle', { radius:25, segments:72, depth:-2, pass:0.5 }, { safeZ:5 });
  assert.ok(!r.error, r.error);
  assert.ok(r.code.includes('COS[#110]') && r.code.includes('SIN[#110]'));
  const v = C.validateGcode(r.numericCode, { minZ:-20, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
});
test('fanuc: параметрическая программа с процентами и O-номером', () => {
  const r = C.buildParametric('bolt', {}, { safeZ:5, controller:'fanuc' });
  assert.ok(r.code.startsWith('%\nO0001'));
  assert.ok(r.code.includes('#100'));
});

console.log('\n— Наружная резьба фрезой —');
test('наружная резьба: винтовая G2, профиль и проходы', () => {
  const r = C.calcExternalThread({ d:10, p:1.5, len:20, toolD:3, pass:0.1, hand:'right', s:6000, f:300, fz:100, safeZ:5 });
  assert.equal(r.nPass, 10);
  assert.ok(Math.abs(r.h - 0.6134 * 1.5) < 1e-9, 'h=' + r.h);
  assert.ok(Math.abs(r.rMajor - 5) < 1e-9);
  assert.ok(Math.abs(r.rMinor - (5 - r.h)) < 1e-9);
  assert.ok(Math.abs(r.rEnd - (r.rMinor + 1.5)) < 1e-9);
  assert.ok(r.code.includes('G2 X-'));
  assert.ok(!r.code.includes('G3 X-'), 'правая резьба не должна быть G3');
  assert.ok(r.code.includes('НАРУЖНАЯ РЕЗЬБА'));
});
test('левая наружная резьба: G3', () => {
  const r = C.calcExternalThread({ d:12, p:1.75, len:15, toolD:3, pass:0.1, hand:'left', safeZ:5 });
  assert.ok(r.code.includes('G3 X-'));
  assert.ok(!r.code.includes('G2 X-'), 'левая резьба не должна быть G2');
});
test('наружная резьба: длина не кратна шагу — корректный неполный виток', () => {
  const r = C.calcExternalThread({ d:10, p:1.5, len:20, toolD:3, pass:0.1, hand:'right', safeZ:5 });
  const code = C.wrapSnippet(r.code, 'НАРУЖНАЯ', { safeZ:5, controller:'universal' });
  const v = C.validateGcode(code, { minZ:-25, blank:{ enabled:false }, safeZ:5, toolD:3 });
  assert.equal(v.errors, 0, JSON.stringify(v.items.filter(i => i.status === 'error')));
  assert.ok(Math.abs(v.parsed.minCutZ + 20) < 1e-6, 'minCutZ=' + v.parsed.minCutZ);
});
test('наружная резьба: слишком глубокая — предупреждение', () => {
  const r = C.calcExternalThread({ d:3, p:3, len:10, toolD:3, pass:0.1, safeZ:5 });
  assert.ok(r.warnings.length > 0);
});

console.log('\n— Производительность —');
test('карман 200×150 считается быстро (<1500 мс)', () => {
  const sc = scene(220, 170, [{ type:'pocket', params:{ profile:'rect', w:200, h:150 } }]);
  const t0 = Date.now();
  const prog = gen(sc, { stepover: 2, toolD: 6 });
  const dt = Date.now() - t0;
  assert.ok(prog.moves.length > 400, 'движений: ' + prog.moves.length);
  assert.ok(dt < 1500, 'заняло ' + dt + ' мс');
});
test('обратная гравировка текста 24 символа < 2500 мс', () => {
  const sc = scene(160, 40, [{ type:'text', params:{ text:'ОБРАТНАЯ ГРАВИРОВКА 2026', height:14, inverse:true } }]);
  const t0 = Date.now();
  gen(sc, { toolD: 2, stepover: 1 });
  const dt = Date.now() - t0;
  assert.ok(dt < 2500, 'заняло ' + dt + ' мс');
});

console.log('\nИтого: ✅ ' + passed + '  ❌ ' + failed);
if (failed) process.exit(1);
