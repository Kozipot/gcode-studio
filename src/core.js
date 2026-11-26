/* ============================================================================
   core.js — «мозг» приложения. Чистые функции, без DOM.
   Данные приходят глобально: GLYPHS (glyphs.json), TABLES (tables.json).
   ========================================================================== */
var CORE_VERSION = '2.0';

/* ---------------------------------------------------------------- 1. Числа */
function fmt(v, dec){
  if (v === null || v === undefined || !isFinite(v)) return '0';
  var k = (dec === undefined || dec === null) ? 3 : dec;
  var p = Math.pow(10, k);
  var r = Math.round(v * p) / p;
  if (Object.is(r, -0)) r = 0;
  return String(r);
}
function numOr(v, d){
  var n = parseFloat(v);
  return isFinite(n) ? n : d;
}
function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }
function rad(deg){ return deg * Math.PI / 180; }
function distance(x1,y1,x2,y2){ return Math.hypot(x2-x1, y2-y1); }

function distPointToSegment(px, py, x1, y1, x2, y2){
  var dx = x2 - x1, dy = y2 - y1;
  var len2 = dx*dx + dy*dy;
  if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
  var t = ((px - x1)*dx + (py - y1)*dy) / len2;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}
function pointInPolygon(x, y, poly){
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++){
    var xi = poly[i][0], yi = poly[i][1];
    var xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function nearPoly(x, y, poly, r){
  var n = poly.length;
  for (var i = 0; i < n; i++){
    var a = poly[i], b = poly[(i+1) % n];
    if (x < Math.min(a[0],b[0]) - r || x > Math.max(a[0],b[0]) + r) continue;
    if (y < Math.min(a[1],b[1]) - r || y > Math.max(a[1],b[1]) + r) continue;
    if (distPointToSegment(x, y, a[0], a[1], b[0], b[1]) < r) return true;
  }
  return false;
}
function polygonBBox(pts){
  var b = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
  for (var i = 0; i < pts.length; i++){
    var p = pts[i];
    if (p[0] < b.minX) b.minX = p[0];
    if (p[0] > b.maxX) b.maxX = p[0];
    if (p[1] < b.minY) b.minY = p[1];
    if (p[1] > b.maxY) b.maxY = p[1];
  }
  if (!isFinite(b.minX)) { b.minX = b.minY = b.maxX = b.maxY = 0; }
  return b;
}
function polygonArea(pts){
  var a = 0;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++){
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return a / 2;
}
function lineIntersect(a, b, c, d){
  var rx = b[0] - a[0], ry = b[1] - a[1];
  var sx = d[0] - c[0], sy = d[1] - c[1];
  var den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  var t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
  return [a[0] + t * rx, a[1] + t * ry];
}

/**
 * Смещение замкнутого многоугольника (митра). d > 0 — наружу, d < 0 — внутрь.
 * Для окружностей используйте offsetPath — там радиус меняется точно.
 */
function offsetPolygon(pts, d){
  d = numOr(d, 0);
  if (!pts || pts.length < 3) return pts.slice();
  if (Math.abs(d) < 1e-9) return pts.slice();
  var src = polygonArea(pts) < 0 ? pts.slice().reverse() : pts.slice();
  var area0 = Math.abs(polygonArea(src));
  var n = src.length, out = [];
  for (var i = 0; i < n; i++){
    var prev = src[(i - 1 + n) % n], cur = src[i], next = src[(i + 1) % n];
    var e1x = cur[0] - prev[0], e1y = cur[1] - prev[1];
    var e2x = next[0] - cur[0], e2y = next[1] - cur[1];
    var l1 = Math.hypot(e1x, e1y), l2 = Math.hypot(e2x, e2y);
    if (l1 < 1e-9 || l2 < 1e-9){ out.push([cur[0], cur[1]]); continue; }
    /* для CCW внешняя нормаль — справа от направления ребра */
    var n1x = e1y / l1, n1y = -e1x / l1;
    var n2x = e2y / l2, n2y = -e2x / l2;
    var a1 = [prev[0] + n1x*d, prev[1] + n1y*d];
    var a2 = [cur[0] + n1x*d, cur[1] + n1y*d];
    var b1 = [cur[0] + n2x*d, cur[1] + n2y*d];
    var b2 = [next[0] + n2x*d, next[1] + n2y*d];
    var hit = lineIntersect(a1, a2, b1, b2);
    if (hit){
      var miter = Math.hypot(hit[0] - cur[0], hit[1] - cur[1]);
      if (miter > Math.abs(d) * 6){
        out.push([cur[0] + (n1x + n2x) * 0.5 * d, cur[1] + (n1y + n2y) * 0.5 * d]);
      } else out.push(hit);
    } else {
      out.push([cur[0] + n1x * d, cur[1] + n1y * d]);
    }
  }
  var area1 = polygonArea(out);
  if (Math.abs(area1) < 0.01 || (area0 > 0) !== (area1 > 0)) return null;
  return out;
}

function offsetPath(path, d){
  d = numOr(d, 0);
  if (!path || Math.abs(d) < 1e-9) return path;
  if (path.circle){
    var r = path.circle.r + d;
    if (r < 0.05) return null;
    return makePath(circlePoints(r * 2, 0), true, {circle: {r: r}, name: path.name});
  }
  var pts = offsetPolygon(path.pts, d);
  if (!pts) return null;
  return makePath(pts, !!path.closed, {name: path.name});
}

function shapeWithOffset(path, p, warnings){
  var d = numOr(p && p.offset, 0);
  if (!d) return path;
  var res = offsetPath(path, d);
  if (!res){
    warnings.push('Смещение ' + fmt(d, 2) + ' мм слишком велико для контура — взято без смещения.');
    return path;
  }
  return res;
}
function circlePoints(d, rotDeg){
  var r = Math.abs(d) / 2, n = 96, pts = [];
  for (var i = 0; i < n; i++){
    var a = rad(rotDeg || 0) + i * 2 * Math.PI / n;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/* ---------------------------------------------------------------- 2. Шрифт */
/* 7-сегментные цифры */
var SEGS = {
  a: [[0,1],[1,1]], b: [[1,1],[1,0.5]], c: [[1,0.5],[1,0]],
  d: [[0,0],[1,0]], e: [[0,0],[0,0.5]], f: [[0,0.5],[0,1]],
  g: [[0,0.5],[1,0.5]]
};
var DIGITS = {
  '0':'abcdef', '1':'bc', '2':'abged', '3':'abgcd', '4':'fgbc',
  '5':'afgcd', '6':'afgecd', '7':'abc', '8':'abcdefg', '9':'abcdfg'
};

var _glyphCache = null;
function glyphCache(){
  if (_glyphCache) return _glyphCache;
  var m = {};
  function addPolys(polys){
    if (!polys || !polys.length) return;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < polys.length; i++){
      var poly = polys[i];
      for (var j = 0; j < poly.length; j++){
        var p = poly[j];
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
    }
    return {polys: polys, minX: minX, maxX: maxX, minY: minY, maxY: maxY};
  }
  if (typeof GLYPHS !== 'undefined'){
    var src = GLYPHS.latin || {};
    for (var ch in src){ if (Array.isArray(src[ch])) m[ch] = addPolys(src[ch]); }
    var cyr = GLYPHS.cyrillic || {};
    for (var c2 in cyr){ if (Array.isArray(cyr[c2])) m[c2] = addPolys(cyr[c2]); }
    var pun = GLYPHS.punctuation || {};
    for (var c3 in pun){
      if (Array.isArray(pun[c3]) && pun[c3].length && Array.isArray(pun[c3][0])) m[c3] = addPolys(pun[c3]);
    }
  }
  /* цифры — из 7-сегментного набора */
  for (var d in DIGITS){
    var polys = [];
    var letters = DIGITS[d];
    for (var k = 0; k < letters.length; k++){
      var seg = SEGS[letters[k]];
      if (seg) polys.push([[seg[0][0], seg[0][1]], [seg[1][0], seg[1][1]]]);
    }
    m[d] = addPolys(polys);
  }
  _glyphCache = m;
  return m;
}

function glyphFor(ch){
  var cache = glyphCache();
  if (cache[ch]) return cache[ch];
  var up = String(ch).toUpperCase();
  if (cache[up]) return cache[up];
  return null;
}

/**
 * Геометрия текста. Возвращает сегменты (штрихи) и точки (точки/запятые).
 * @param {string} text
 * @param {number} size высота прописной, мм
 * @param {number} x0   X привязки
 * @param {number} y0   Y низа первой строки
 * @param {object} opts {align:'left'|'center'|'right', lineSpacing:1.6}
 */
function buildTextGeometry(text, size, x0, y0, opts){
  var o = opts || {};
  var align = o.align || 'left';
  var lineSpacing = numOr(o.lineSpacing, 1.6);
  var h = Math.max(0.5, numOr(size, 10));
  var w = h * 0.7;
  var gap = w * 0.48;
  var spaceAdv = w * 0.62;
  var segs = [], dots = [], missing = [];
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  function acc(x, y){
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  var lines = String(text === null || text === undefined ? '' : text).split('\n');

  function glyphAdvance(ch, baseX, baseY){
    var g = glyphFor(ch);
    if (!g){
      if (ch !== ' ' && missing.indexOf(ch) < 0) missing.push(ch);
      return spaceAdv;
    }
    var gw = (g.maxX - g.minX) * w;
    return Math.max(gw, w * 0.3) + gap;
  }
  function measureLine(line){
    var total = 0;
    for (var i = 0; i < line.length; i++){
      var ch = line[i];
      if (ch === '.') total += w * 0.45;
      else if (ch === '-') total += w * 0.9;
      else total += glyphAdvance(ch);
    }
    return Math.max(0, total - gap);
  }
  function drawGlyph(g, cx, baseY){
    var gw = (g.maxX - g.minX) * w;
    var cell = Math.max(gw, w * 0.3);
    var gx = cx + (cell - gw) / 2 - g.minX * w;
    for (var i = 0; i < g.polys.length; i++){
      var poly = g.polys[i];
      for (var j = 0; j < poly.length - 1; j++){
        var a = poly[j], b = poly[j+1];
        var x1 = gx + a[0]*w, y1 = baseY + a[1]*h;
        var x2 = gx + b[0]*w, y2 = baseY + b[1]*h;
        if (Math.abs(x2 - x1) < 1e-9 && Math.abs(y2 - y1) < 1e-9){
          dots.push({x: x1, y: y1});
          acc(x1, y1);
        } else {
          segs.push({x1: x1, y1: y1, x2: x2, y2: y2});
          acc(x1, y1); acc(x2, y2);
        }
      }
    }
    return cell + gap;
  }

  for (var li = 0; li < lines.length; li++){
    var line = lines[li];
    var lw = measureLine(line);
    var cx = x0;
    if (align === 'center') cx = x0 - lw / 2;
    else if (align === 'right') cx = x0 - lw;
    var baseY = y0 + li * h * lineSpacing;
    for (var ci = 0; ci < line.length; ci++){
      var ch = line[ci];
      if (ch === ' '){ cx += spaceAdv; continue; }
      if (ch === '.'){
        var dx = cx + w * 0.32, dy = baseY + h * 0.08;
        dots.push({x: dx, y: dy});
        acc(dx, dy);
        cx += w * 0.45;
        continue;
      }
      if (ch === '-'){
        var yy = baseY + h * 0.5;
        segs.push({x1: cx, y1: yy, x2: cx + w, y2: yy});
        acc(cx, yy); acc(cx + w, yy);
        cx += w * 0.9 + gap * 0.4;
        continue;
      }
      var g = glyphFor(ch);
      if (!g){
        if (ch !== ' ' && missing.indexOf(ch) < 0) missing.push(ch);
        cx += spaceAdv;
        continue;
      }
      cx += drawGlyph(g, cx, baseY);
    }
  }
  if (!isFinite(minX)){
    minX = x0; maxX = x0 + w * 0.5;
    minY = y0; maxY = y0 + h;
  }
  return {
    segs: segs, dots: dots, missing: missing,
    minX: minX, minY: minY, maxX: maxX, maxY: maxY,
    width: maxX - minX, height: maxY - minY,
    lines: lines.length
  };
}

/* --------------------------- 3. Фигуры (локальные координаты, центр = 0,0) */
function makePath(pts, closed, extra){
  var p = {pts: pts, closed: !!closed};
  if (extra) for (var k in extra) p[k] = extra[k];
  return p;
}
function shapeRect(w, h){
  w = Math.abs(numOr(w, 50)); h = Math.abs(numOr(h, 30));
  if (w < 0.05) w = 0.05;
  if (h < 0.05) h = 0.05;
  return makePath([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]], true, {name:'rect'});
}
function shapeCircle(d){
  d = Math.max(0.1, Math.abs(numOr(d, 30)));
  return makePath(circlePoints(d, 0), true, {circle: {r: d/2}, name:'circle'});
}
function shapePoly(sides, d, rot){
  var n = Math.round(clamp(numOr(sides, 6), 3, 64));
  var r = Math.max(0.05, Math.abs(numOr(d, 40)) / 2);
  var a0 = rad(numOr(rot, 0)) - Math.PI / 2 + Math.PI / n;
  var pts = [];
  for (var i = 0; i < n; i++){
    var a = a0 + i * 2 * Math.PI / n;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return makePath(pts, true, {name:'poly', sides:n});
}
function shapeStar(points, od, id, rot){
  var n = Math.round(clamp(numOr(points, 5), 3, 32));
  var ro = Math.max(0.1, Math.abs(numOr(od, 50)) / 2);
  var ri = Math.max(0.05, Math.abs(numOr(id, 22)) / 2);
  if (ri >= ro) ri = ro * 0.45;
  var a0 = rad(numOr(rot, 0)) - Math.PI / 2;
  var pts = [];
  for (var i = 0; i < n * 2; i++){
    var a = a0 + i * Math.PI / n;
    var r = (i % 2 === 0) ? ro : ri;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return makePath(pts, true, {name:'star', points:n});
}
function shapeSpiral(r0, r1, turns, dir){
  var a = Math.max(0.01, Math.abs(numOr(r0, 2)));
  var b = Math.max(0.05, Math.abs(numOr(r1, 25)));
  var t = Math.max(0.1, Math.abs(numOr(turns, 4)));
  var dirSign = (dir === 'cw' || dir === -1) ? -1 : 1;
  var n = Math.max(64, Math.ceil(t * 96));
  var pts = [];
  for (var i = 0; i <= n; i++){
    var u = i / n;
    var ang = dirSign * u * t * 2 * Math.PI;
    var r = a + (b - a) * u;
    pts.push([r * Math.cos(ang), r * Math.sin(ang)]);
  }
  return makePath(pts, false, {name:'spiral'});
}
function shapeSine(len, amp, periods, phase){
  var L = Math.max(1, Math.abs(numOr(len, 80)));
  var A = Math.abs(numOr(amp, 6));
  var per = Math.max(0.1, Math.abs(numOr(periods, 3)));
  var ph = rad(numOr(phase, 0));
  var n = Math.max(48, Math.ceil(per * 64));
  var pts = [];
  for (var i = 0; i <= n; i++){
    var x = -L/2 + L * i / n;
    var y = A * Math.sin(ph + 2 * Math.PI * per * i / n);
    pts.push([x, y]);
  }
  return makePath(pts, false, {name:'sine'});
}
function profilePath(p){
  var prof = p.profile || 'rect';
  if (prof === 'circle') return shapeCircle(p.d);
  if (prof === 'poly') return shapePoly(p.sides, p.d, p.rot);
  if (prof === 'star') return shapeStar(p.points, p.od, p.id, p.rot);
  return shapeRect(p.w, p.h);
}
function shapeSlot(len, d){
  /* паз: два полукруга + прямые */
  var L = Math.max(0, Math.abs(numOr(len, 40)));
  var r = Math.max(0.1, Math.abs(numOr(d, 8)) / 2);
  var pts = [];
  var n = 24;
  for (var i = 0; i <= n; i++){
    var a = -Math.PI/2 + Math.PI * i / n;
    pts.push([L/2 + r * Math.cos(a), r * Math.sin(a)]);
  }
  for (var j2 = 0; j2 <= n; j2++){
    var a2 = Math.PI/2 + Math.PI * j2 / n;
    pts.push([-L/2 + r * Math.cos(a2), r * Math.sin(a2)]);
  }
  return makePath(pts, true, {name:'slot'});
}

/* --------------------------- 4. Схемы элементов конструктора (UI + defaults) */
function contourExtraFields(){
  return [
    {k:'offset', label:'Смещение контура, мм', def:0, step:0.5, tip:'+ наружу, − внутрь. Для вырезания детали в размер ставьте +радиус фрезы.'},
    {k:'tabs', label:'Перемычки, шт', def:0, min:0, step:1, tip:'Сколько мостиков оставить на контуре, чтобы деталь не вылетела. 0 — без перемычек.'},
    {k:'tabW', label:'Ширина перемычки, мм', def:4, min:0.5, step:0.5, show:function(p){ return numOr(p.tabs, 0) > 0; }, tip:'Длина перемычки вдоль контура.'},
    {k:'tabH', label:'Высота перемычки, мм', def:1, min:0.1, step:0.1, show:function(p){ return numOr(p.tabs, 0) > 0; }, tip:'Сколько материала оставить по высоте. Не больше глубины реза.'}
  ];
}
var ELEMENT_TYPES = {
  rect: {
    name: 'Прямоугольник', icon: '▭',
    fields: [
      {k:'w', label:'Ширина, мм', def:60, min:0.1, step:1, tip:'Внешняя ширина контура по X.'},
      {k:'h', label:'Высота, мм', def:40, min:0.1, step:1, tip:'Высота контура по Y.'}
    ].concat(contourExtraFields()),
    summary: function(p){ return 'Прямоугольник ' + fmt(p.w,1) + '×' + fmt(p.h,1); }
  },
  circle: {
    name: 'Окружность', icon: '○',
    fields: [
      {k:'d', label:'Диаметр, мм', def:30, min:0.1, step:1, tip:'Диаметр по внешнему контуру. Режется дугами G3.'}
    ].concat(contourExtraFields()),
    summary: function(p){ return 'Окружность Ø' + fmt(p.d,1); }
  },
  poly: {
    name: 'Многоугольник', icon: '⬡',
    fields: [
      {k:'sides', label:'Сторон', def:6, min:3, step:1, tip:'3 = треугольник, 6 = шестиугольник, 8 = октагон.'},
      {k:'d', label:'Диаметр описанной, мм', def:50, min:0.1, step:1, tip:'Диаметр окружности через вершины.'},
      {k:'rot', label:'Поворот, °', def:0, step:15, tip:'0° = плоская грань сверху у чётного числа сторон.'}
    ].concat(contourExtraFields()),
    summary: function(p){ return 'Многоугольник ' + (p.sides||6) + ' сторон Ø' + fmt(p.d,1); }
  },
  star: {
    name: 'Звезда', icon: '★',
    fields: [
      {k:'points', label:'Лучей', def:5, min:3, step:1, tip:'Количество лучей звезды.'},
      {k:'od', label:'Внешний Ø, мм', def:50, min:0.1, step:1, tip:'Диаметр по вершинам лучей.'},
      {k:'id', label:'Внутренний Ø, мм', def:22, min:0.1, step:1, tip:'Диаметр по впадинам. Должен быть меньше внешнего.'},
      {k:'rot', label:'Поворот, °', def:0, step:15, tip:'Поворот звезды вокруг центра.'}
    ].concat(contourExtraFields()),
    summary: function(p){ return 'Звезда ' + (p.points||5) + '-луч, Ø' + fmt(p.od,1); }
  },
  spiral: {
    name: 'Спираль', icon: '◉',
    fields: [
      {k:'r0', label:'Начальный R, мм', def:2, min:0.1, step:1, tip:'Радиус начала спирали.'},
      {k:'r1', label:'Конечный R, мм', def:25, min:0.1, step:1, tip:'Радиус конца спирали.'},
      {k:'turns', label:'Витов', def:4, min:0.1, step:0.5, tip:'Количество оборотов. 0.5 = пол-оборота.'},
      {k:'dir', label:'Направление', type:'select', def:'ccw', options:[['ccw','Против часов'],['cw','По часовой']], tip:'Направление закручивания спирали.'}
    ],
    summary: function(p){ return 'Спираль R' + fmt(p.r0,1) + '→' + fmt(p.r1,1) + ', ' + fmt(p.turns,1) + ' вит.'; }
  },
  sine: {
    name: 'Синусоида', icon: '∿',
    fields: [
      {k:'length', label:'Длина, мм', def:80, min:1, step:5, tip:'Длина волны по X.'},
      {k:'amp', label:'Амплитуда, мм', def:6, min:0, step:1, tip:'Размах от осевой линии в каждую сторону.'},
      {k:'periods', label:'Периодов', def:3, min:0.1, step:0.5, tip:'Сколько полных волн уложить на длину.'},
      {k:'phase', label:'Сдвиг фазы, °', def:0, step:15, tip:'Сдвиг начала волны по фазе.'}
    ],
    summary: function(p){ return 'Синусоида ' + fmt(p.length,1) + ' мм, ' + fmt(p.periods,1) + ' пер.'; }
  },
  slot: {
    name: 'Паз', icon: '▬',
    fields: [
      {k:'len', label:'Длина паза, мм', def:40, min:0, step:1, tip:'Расстояние между центрами полукругов.'},
      {k:'d', label:'Ширина (Ø), мм', def:8, min:0.2, step:1, tip:'Ширина паза = диаметр фрезы для одного прохода по контуру.'}
    ].concat(contourExtraFields()),
    summary: function(p){ return 'Паз ' + fmt(p.len,1) + '×' + fmt(p.d,1); }
  },
  text: {
    name: 'Текст / надпись', icon: '✍',
    fields: [
      {k:'text', label:'Текст', type:'textarea', def:'G-CODE', tip:'Латиница A–Z и кириллица А–Я, цифры, . - , : + = / ? !'},
      {k:'height', label:'Высота, мм', def:8, min:1, step:0.5, tip:'Высота прописных букв. Строчные автоматически становятся прописными.'},
      {k:'align', label:'Выравнивание', type:'select', def:'center', options:[['left','По левому краю'],['center','По центру'],['right','По правому краю']], tip:'Положение текста относительно точки привязки.'},
      {k:'inverse', label:'Инверсия (фон вокруг букв)', type:'check', def:false, tip:'Снимает слой вокруг букв, оставляя надпись выпуклой. Нужен инструмент Ø и шаг растра.'}
    ],
    summary: function(p){ return 'Текст «' + String(p.text||'').replace(/\n/g,' / ').slice(0,28) + '», ' + fmt(p.height,1) + ' мм'; }
  },
  pocket: {
    name: 'Карман по контуру', icon: '▨',
    fields: [
      {k:'profile', label:'Профиль кармана', type:'select', def:'rect', options:[['rect','Прямоугольник'],['circle','Круг'],['poly','Многоугольник'],['star','Звезда']], tip:'Форма границы, внутри которой выбирается материал.'},
      {k:'offset', label:'Смещение кармана, мм', def:0, step:0.5, tip:'+ наружу, − внутрь. Меняет размер кармана относительно профиля.'},
      {k:'w', label:'Ширина, мм', def:50, min:1, step:1, tip:'Для прямоугольного кармана.', show:function(p){return (p.profile||'rect')==='rect';}},
      {k:'h', label:'Высота, мм', def:30, min:1, step:1, tip:'Для прямоугольного кармана.', show:function(p){return (p.profile||'rect')==='rect';}},
      {k:'d', label:'Диаметр, мм', def:40, min:1, step:1, tip:'Для круглого или многоугольного кармана.', show:function(p){return p.profile==='circle'||p.profile==='poly';}},
      {k:'sides', label:'Сторон', def:6, min:3, step:1, tip:'Для многоугольного кармана.', show:function(p){return p.profile==='poly';}},
      {k:'od', label:'Внешний Ø, мм', def:50, min:1, step:1, tip:'Для звёздчатого кармана.', show:function(p){return p.profile==='star';}},
      {k:'id', label:'Внутренний Ø, мм', def:22, min:1, step:1, tip:'Для звёздчатого кармана.', show:function(p){return p.profile==='star';}},
      {k:'points', label:'Лучей', def:5, min:3, step:1, tip:'Для звёздчатого кармана.', show:function(p){return p.profile==='star';}},
      {k:'rot', label:'Поворот, °', def:0, step:15, tip:'Поворот профиля.', show:function(p){return p.profile==='poly'||p.profile==='star';}}
    ],
    summary: function(p){
      var n = {rect:'прямоугольник', circle:'круг', poly:'многоугольник', star:'звезда'}[p.profile||'rect'];
      return 'Карман: ' + n;
    }
  },
  inv: {
    name: 'Обратная гравировка', icon: '◧',
    fields: [
      {k:'profile', label:'Контур', type:'select', def:'rect', options:[['rect','Прямоугольник'],['circle','Круг'],['poly','Многоугольник'],['star','Звезда']], tip:'Контур остаётся выпуклым, материал снимается вокруг него.'},
      {k:'w', label:'Ширина, мм', def:50, min:1, step:1, tip:'Для прямоугольного контура.', show:function(p){return (p.profile||'rect')==='rect';}},
      {k:'h', label:'Высота, мм', def:30, min:1, step:1, tip:'Для прямоугольного контура.', show:function(p){return (p.profile||'rect')==='rect';}},
      {k:'d', label:'Диаметр, мм', def:40, min:1, step:1, tip:'Для круглого контура.', show:function(p){return p.profile==='circle'||p.profile==='poly';}},
      {k:'sides', label:'Сторон', def:6, min:3, step:1, tip:'Для многоугольного контура.', show:function(p){return p.profile==='poly';}},
      {k:'od', label:'Внешний Ø, мм', def:50, min:1, step:1, tip:'Для звёздчатого контура.', show:function(p){return p.profile==='star';}},
      {k:'id', label:'Внутренний Ø, мм', def:22, min:1, step:1, tip:'Для звёздчатого контура.', show:function(p){return p.profile==='star';}},
      {k:'points', label:'Лучей', def:5, min:3, step:1, tip:'Для звёздчатого контура.', show:function(p){return p.profile==='star';}},
      {k:'margin', label:'Поле вокруг, мм', def:3, min:0, step:1, tip:'Насколько расширить зону съёма вокруг контура (сверх радиуса инструмента).'},
      {k:'offset', label:'Смещение контура, мм', def:0, step:0.5, tip:'+ наружу, − внутрь. Меняет размер выпуклого контура.'},
      {k:'rot', label:'Поворот, °', def:0, step:15, tip:'Поворот контура.', show:function(p){return p.profile==='poly'||p.profile==='star';}}
    ],
    summary: function(p){ return 'Обратная гравировка: ' + ({rect:'прямоугольник',circle:'круг',poly:'многоугольник',star:'звезда'}[p.profile||'rect']); }
  },
  holes: {
    name: 'Отверстия (сетка)', icon: '⊙',
    fields: [
      {k:'rows', label:'Рядов', def:3, min:1, step:1, tip:'Количество отверстий по Y.'},
      {k:'cols', label:'Колонок', def:4, min:1, step:1, tip:'Количество отверстий по X.'},
      {k:'dx', label:'Шаг по X, мм', def:15, min:0.1, step:1, tip:'Расстояние между отверстиями по X.'},
      {k:'dy', label:'Шаг по Y, мм', def:12, min:0.1, step:1, tip:'Расстояние между отверстиями по Y.'},
      {k:'d', label:'Ø сверла, мм', def:3, min:0.1, step:0.1, tip:'Диаметр отверстия; используется для подписи и проверки.'},
      {k:'depth', label:'Глубина, мм', def:-5, max:0, step:0.5, tip:'Абсолютная глубина сверления (отрицательное значение). 0 = как у всей программы.'},
      {k:'peck', label:'Peck Q, мм', def:2, min:0.1, step:0.5, tip:'Глубина одного захода при сверлении с выводом стружки.'}
    ],
    summary: function(p){ return 'Отверстия ' + (p.rows||1) + '×' + (p.cols||1) + ' Ø' + fmt(p.d,1); }
  }
};

function elementDefaults(type){
  var t = ELEMENT_TYPES[type];
  var p = {};
  if (!t) return p;
  for (var i = 0; i < t.fields.length; i++){
    var f = t.fields[i];
    p[f.k] = f.def;
  }
  return p;
}
function elementSummary(el){
  var t = ELEMENT_TYPES[el.type];
  if (!t) return el.type;
  try { return t.summary(el.params || {}); } catch(e){ return t.name; }
}

/* --------------------------- 4b. Высоты элементов (Z) */
var Z_PROFILES = {
  flat: 'Постоянная',
  slopeX: 'Наклон по X',
  slopeY: 'Наклон по Y',
  stepsX: 'Ступени по X',
  stepsY: 'Ступени по Y'
};
function depthValue(v, fallback){
  var n = numOr(v, NaN);
  if (!isFinite(n) || Math.abs(n) < 1e-9) n = numOr(fallback, -1);
  return -Math.abs(n);
}
function elementDepth(el, baseDepth){
  if (!el) return depthValue(baseDepth, -1);
  var d = el.depth;
  if (d === null || d === undefined || d === '') return depthValue(baseDepth, -1);
  return depthValue(d, baseDepth);
}
/**
 * Итоговые высоты элемента: базовая глубина, профиль, диапазон Z.
 * Профили: flat, slopeX, slopeY, stepsX, stepsY.
 */
function elementHeightInfo(el, baseDepth){
  var base = elementDepth(el, baseDepth);
  var profile = (el && Z_PROFILES[el.zProfile]) ? el.zProfile : 'flat';
  var z1 = depthValue(el && el.z1, base);
  var z2 = depthValue(el && el.z2, base);
  var steps = Math.round(clamp(numOr(el && el.zSteps, 4), 2, 64));
  if (profile === 'flat'){
    return {
      profile: 'flat', z1: base, z2: base, steps: 1,
      minZ: base, maxZ: base, maxAbs: Math.abs(base),
      base: base, baseAbs: Math.abs(base),
      short: 'Z ' + fmt(base, 2),
      label: 'постоянная Z ' + fmt(base, 2) + ' мм',
      override: !!(el && el.depth !== null && el.depth !== undefined && el.depth !== '')
    };
  }
  var minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  var axis = profile.indexOf('X') >= 0 ? 'X' : 'Y';
  var kind = profile.indexOf('slope') === 0 ? 'наклон' : 'ступени';
  var short = 'Z ' + fmt(z1, 2) + '→' + fmt(z2, 2) + ' · ' + axis;
  var label = kind + ' по ' + axis + ' от Z' + fmt(z1, 2) + ' до Z' + fmt(z2, 2) +
    (kind === 'ступени' ? ' (' + steps + ' ступ.)' : '');
  return {
    profile: profile, z1: z1, z2: z2, steps: steps,
    minZ: minZ, maxZ: maxZ, maxAbs: Math.max(Math.abs(z1), Math.abs(z2)),
    base: base, baseAbs: Math.abs(base),
    short: short, label: label,
    override: !!(el && el.depth !== null && el.depth !== undefined && el.depth !== '')
  };
}

function elementGeometry(el){
  var p = el.params || {};
  var warnings = [];
  function off(path){ return shapeWithOffset(path, p, warnings); }
  switch (el.type){
    case 'rect': return {kind:'cut', paths:[off(shapeRect(p.w, p.h))], warnings:warnings};
    case 'circle': return {kind:'cut', paths:[off(shapeCircle(p.d))], warnings:warnings};
    case 'poly': return {kind:'cut', paths:[off(shapePoly(p.sides, p.d, p.rot))], warnings:warnings};
    case 'star': return {kind:'cut', paths:[off(shapeStar(p.points, p.od, p.id, p.rot))], warnings:warnings};
    case 'spiral': return {kind:'cut', paths:[shapeSpiral(p.r0, p.r1, p.turns, p.dir)], warnings:warnings};
    case 'sine': return {kind:'cut', paths:[shapeSine(p.length, p.amp, p.periods, p.phase)], warnings:warnings};
    case 'slot': return {kind:'cut', paths:[off(shapeSlot(p.len, p.d))], warnings:warnings};
    case 'text': {
      var g = buildTextGeometry(p.text || '', numOr(p.height, 8), 0, 0, {align: p.align || 'center'});
      var paths = [];
      for (var i = 0; i < g.segs.length; i++){
        var s = g.segs[i];
        paths.push(makePath([[s.x1, s.y1], [s.x2, s.y2]], false));
      }
      return {
        kind: p.inverse ? 'textInv' : 'cut',
        paths: paths, dots: g.dots, missing: g.missing,
        box: {minX:g.minX, minY:g.minY, maxX:g.maxX, maxY:g.maxY},
        warnings: warnings
      };
    }
    case 'pocket': {
      var c = off(profilePath(p));
      return {kind:'pocket', contour:c, paths:[c], warnings:warnings};
    }
    case 'inv': {
      var c2 = off(profilePath(p));
      return {kind:'inv', contour:c2, paths:[c2], margin:numOr(p.margin, 3), warnings:warnings};
    }
    case 'holes': {
      var rows = Math.max(1, Math.round(numOr(p.rows, 1)));
      var cols = Math.max(1, Math.round(numOr(p.cols, 1)));
      var dx = numOr(p.dx, 10), dy = numOr(p.dy, 10);
      var holes = [], minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var r = 0; r < rows; r++){
        for (var cc = 0; cc < cols; cc++){
          var hx = (cc - (cols - 1) / 2) * dx;
          var hy = (r - (rows - 1) / 2) * dy;
          holes.push({x:hx, y:hy});
          minX = Math.min(minX, hx); maxX = Math.max(maxX, hx);
          minY = Math.min(minY, hy); maxY = Math.max(maxY, hy);
        }
      }
      return {kind:'holes', holes:holes, paths:[], dots:[], box:{minX:minX, minY:minY, maxX:maxX, maxY:maxY}, warnings:warnings};
    }
  }
  return {kind:'cut', paths:[], warnings:warnings};
}

function geomBBox(geom){
  var b = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
  function acc(x, y){
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
  }
  if (geom.box){ acc(geom.box.minX, geom.box.minY); acc(geom.box.maxX, geom.box.maxY); }
  for (var i = 0; i < (geom.paths||[]).length; i++){
    var pts = geom.paths[i].pts;
    for (var j = 0; j < pts.length; j++) acc(pts[j][0], pts[j][1]);
  }
  for (var k = 0; k < (geom.dots||[]).length; k++) acc(geom.dots[k].x, geom.dots[k].y);
  for (var h = 0; h < (geom.holes||[]).length; h++) acc(geom.holes[h].x, geom.holes[h].y);
  if (!isFinite(b.minX)){ b.minX = b.minY = b.maxX = b.maxY = 0; }
  return b;
}

function transformGeom(geom, place, rotDeg, mirrorX, mirrorY){
  var b = geomBBox(geom);
  var pl = place || {mode:'center', x:0, y:0};
  var ax, ay;
  if (pl.mode === 'corner'){ ax = b.minX; ay = b.minY; }
  else if (pl.mode === 'abs'){ ax = 0; ay = 0; }
  else { ax = (b.minX + b.maxX) / 2; ay = (b.minY + b.maxY) / 2; }
  var a = rad(numOr(rotDeg, 0));
  var cs = Math.cos(a), sn = Math.sin(a);
  var mX = mirrorX ? -1 : 1, mY = mirrorY ? -1 : 1;
  function tr(x, y){
    var dx = (x - ax) * mX, dy = (y - ay) * mY;
    return [pl.x + dx*cs - dy*sn, pl.y + dx*sn + dy*cs];
  }
  var out = {kind: geom.kind, paths: [], dots: [], holes: [], missing: geom.missing, margin: geom.margin, contour: null, warnings: geom.warnings || []};
  for (var i = 0; i < (geom.paths||[]).length; i++){
    var src = geom.paths[i];
    var pts = [];
    for (var j = 0; j < src.pts.length; j++) pts.push(tr(src.pts[j][0], src.pts[j][1]));
    var np = makePath(pts, src.closed);
    if (src.circle) np.circle = {r: src.circle.r};
    out.paths.push(np);
    if (geom.contour && src === geom.contour) out.contour = np;
  }
  for (var k = 0; k < (geom.dots||[]).length; k++){
    var pp = tr(geom.dots[k].x, geom.dots[k].y);
    out.dots.push({x: pp[0], y: pp[1]});
  }
  for (var h = 0; h < (geom.holes||[]).length; h++){
    var hp = tr(geom.holes[h].x, geom.holes[h].y);
    out.holes.push({x: hp[0], y: hp[1]});
  }
  /* контур, если не совпал по ссылке (на всякий случай) */
  if (!out.contour && geom.contour){
    var cpts = [];
    for (var q = 0; q < geom.contour.pts.length; q++) cpts.push(tr(geom.contour.pts[q][0], geom.contour.pts[q][1]));
    out.contour = makePath(cpts, true);
  }
  return out;
}

/* --------------------------- 5. Массив, выравнивание, проверки сцены */
function alignElements(elements, mode, blank){
  var enabled = [];
  var boxes = [];
  for (var i = 0; i < elements.length; i++){
    var el = elements[i];
    if (el.enabled === false) continue;
    var geom = elementGeometry(el);
    var placed = transformGeom(geom, el.place || {mode:'center', x:0, y:0}, el.rot, el.mirrorX, el.mirrorY);
    enabled.push(el);
    boxes.push(geomBBox(placed));
  }
  if (!enabled.length) return elements;
  var ref;
  if (blank && blank.enabled && blank.w > 0 && blank.h > 0){
    ref = {minX:0, minY:0, maxX:blank.w, maxY:blank.h};
  } else {
    ref = {minX:Infinity, minY:Infinity, maxX:-Infinity, maxY:-Infinity};
    for (var b = 0; b < boxes.length; b++){
      ref.minX = Math.min(ref.minX, boxes[b].minX);
      ref.minY = Math.min(ref.minY, boxes[b].minY);
      ref.maxX = Math.max(ref.maxX, boxes[b].maxX);
      ref.maxY = Math.max(ref.maxY, boxes[b].maxY);
    }
  }
  for (var k = 0; k < enabled.length; k++){
    var el2 = enabled[k], bb = boxes[k], dx = 0, dy = 0;
    if (mode === 'left') dx = ref.minX - bb.minX;
    else if (mode === 'right') dx = ref.maxX - bb.maxX;
    else if (mode === 'centerX') dx = (ref.minX + ref.maxX) / 2 - (bb.minX + bb.maxX) / 2;
    else if (mode === 'bottom') dy = ref.minY - bb.minY;
    else if (mode === 'top') dy = ref.maxY - bb.maxY;
    else if (mode === 'middleY') dy = (ref.minY + ref.maxY) / 2 - (bb.minY + bb.maxY) / 2;
    if (!el2.place) el2.place = {mode:'center', x:0, y:0};
    el2.place.x += dx;
    el2.place.y += dy;
  }
  return elements;
}

function arrayElements(elements, opts){
  var o = opts || {};
  var rows = Math.max(1, Math.min(20, Math.round(numOr(o.rows, 1))));
  var cols = Math.max(1, Math.min(20, Math.round(numOr(o.cols, 1))));
  var dx = numOr(o.dx, 0), dy = numOr(o.dy, 0);
  if (rows * cols <= 1) return elements;
  var out = [];
  for (var r = 0; r < rows; r++){
    for (var c = 0; c < cols; c++){
      for (var i = 0; i < elements.length; i++){
        var clone = JSON.parse(JSON.stringify(elements[i]));
        clone.place = clone.place || {mode:'center', x:0, y:0};
        clone.place.x += c * dx;
        clone.place.y += r * dy;
        if (!clone.params) clone.params = {};
        out.push(clone);
        if (out.length > 400) return out;
      }
    }
  }
  return out;
}

function segmentIntersectsRect(x1, y1, x2, y2, r){
  var dx = x2 - x1, dy = y2 - y1;
  var t0 = 0, t1 = 1;
  var p = [-dx, dx, -dy, dy];
  var q = [x1 - r.x1, r.x2 - x1, y1 - r.y1, r.y2 - y1];
  for (var i = 0; i < 4; i++){
    if (Math.abs(p[i]) < 1e-12){
      if (q[i] < 0) return false;
    } else {
      var t = q[i] / p[i];
      if (p[i] < 0){
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

function sceneChecks(scene, opts){
  var o = opts || {};
  var items = [];
  var toolD = numOr(o.toolD, 3);
  var depthAbs = Math.abs(numOr(o.depth, -1));
  var els = (scene && scene.elements ? scene.elements : []).filter(function(e){ return e.enabled !== false; });
  if (!els.length) items.push({id:'sceneEmpty', label:'Сцена содержит элементы', status:'error', detail:'Нет включённых элементов — программа будет пустой.'});
  var seen = {};
  for (var i = 0; i < els.length; i++){
    var el = els[i], p = el.params || {}, name = elementSummary(el);
    var hi = elementHeightInfo(el, o.depth);
    var elDepthAbs = Math.abs(hi.maxAbs);
    if (hi.profile !== 'flat'){
      var zid = 'zprofile' + i;
      if (Math.abs(hi.z1 - hi.z2) < 0.01){
        items.push({id:zid, label:'Профиль высоты: ' + name, status:'warn', detail:'Z в начале и в конце совпадают — профиль не изменит высоту.'});
      }
      if (o.minZ !== undefined && hi.minZ < numOr(o.minZ, -25) - 1e-6){
        items.push({id:'zlimit' + i, label:'Высота в лимите Z: ' + name, status:'warn', detail:'Профиль опускается до Z' + fmt(hi.minZ, 2) + ' мм при лимите ' + fmt(numOr(o.minZ, -25), 2) + ' мм.'});
      }
      if (numOr(p.tabs, 0) > 0){
        items.push({id:'ztabs' + i, label:'Перемычки: ' + name, status:'warn', detail:'Профиль высоты несовместим с перемычками — перемычки будут отключены.'});
      }
    }
    if (numOr(p.tabs, 0) > 0){
      if (!(numOr(p.tabH, 0) > 0) || numOr(p.tabH, 0) >= elDepthAbs - 0.01){
        items.push({id:'tabs' + i, label:'Перемычки: ' + name, status:'warn', detail:'Высота перемычки должна быть меньше глубины реза (' + fmt(elDepthAbs, 2) + ' мм).'});
      }
    }
    if (el.type === 'pocket' || el.type === 'inv'){
      var geom = elementGeometry(el);
      var b = geomBBox(geom);
      var minSide = Math.min(b.maxX - b.minX, b.maxY - b.minY);
      if (toolD > minSide * 0.9){
        items.push({id:'toolfit' + i, label:'Фреза проходит в контур: ' + name, status:'warn', detail:'Ø' + fmt(toolD, 2) + ' мм при минимальном размере контура ' + fmt(minSide, 2) + ' мм — уменьшите фрезу или увеличьте контур.'});
      }
    }
    var key = el.type + '|' + JSON.stringify(p) + '|' + JSON.stringify(el.place || {}) +
      '|' + (el.depth === null || el.depth === undefined ? '' : el.depth) + '|' + (el.zProfile || 'flat') +
      '|' + numOr(el.z1, '') + '|' + numOr(el.z2, '') + '|' + numOr(el.zSteps, '');
    if (seen[key]){
      items.push({id:'dup' + i, label:'Дубликат элемента: ' + name, status:'warn', detail:'Два одинаковых элемента полностью совпадают — возможно, лишний проход.'});
    } else seen[key] = true;
  }
  return items;
}

/* --------------------------- 5. Растровый съём (карман / инверсия) */
function rasterScan(region, stepover, test){
  var w = region.x2 - region.x1, h = region.y2 - region.y1;
  if (!(w > 0) || !(h > 0)) return [];
  var so = Math.max(0.05, numOr(stepover, 1.2));
  var nLines = Math.max(1, Math.ceil(h / so));
  var yStep = h / nLines;
  var sample = 0.25;
  var nS = clamp(Math.ceil(w / sample), 2, 8000);
  var out = [];
  for (var i = 0; i < nLines; i++){
    var y = region.y1 + (i + 0.5) * yStep;
    var raw = [], cur = null;
    for (var j = 0; j <= nS; j++){
      var x = region.x1 + w * j / nS;
      var ok = false;
      try { ok = !!test(x, y); } catch(e){ ok = false; }
      if (ok){ if (cur === null) cur = x; }
      else if (cur !== null){
        if (x - cur > 0.12) raw.push([cur, x]);
        cur = null;
      }
    }
    if (cur !== null && region.x2 - cur > 0.12) raw.push([cur, region.x2]);
    if (!raw.length) continue;
    var segs = [];
    if (i % 2 === 0) segs = raw;
    else {
      for (var k = raw.length - 1; k >= 0; k--) segs.push([raw[k][1], raw[k][0]]);
    }
    out.push({y: y, segs: segs});
  }
  return out;
}

function textSegments(placed){
  var segs = [];
  for (var i = 0; i < placed.paths.length; i++){
    var pts = placed.paths[i].pts;
    if (pts.length < 2) continue;
    segs.push({x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1]});
  }
  return segs;
}
function nearSegs(x, y, segs, r){
  for (var i = 0; i < segs.length; i++){
    var s = segs[i];
    if (x < Math.min(s.x1,s.x2) - r || x > Math.max(s.x1,s.x2) + r) continue;
    if (y < Math.min(s.y1,s.y2) - r || y > Math.max(s.y1,s.y2) + r) continue;
    if (distPointToSegment(x, y, s.x1, s.y1, s.x2, s.y2) < r) return true;
  }
  return false;
}

function polylineLength(pts){
  var len = 0;
  for (var i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
  return len;
}
function pathStartPoint(path){
  if (path.circle){
    var b = polygonBBox(path.pts);
    return [ (b.minX + b.maxX) / 2 + path.circle.r, (b.minY + b.maxY) / 2 ];
  }
  return [path.pts[0][0], path.pts[0][1]];
}
function pathEndPoint(path){
  if (path.circle) return pathStartPoint(path);
  if (path.closed) return [path.pts[0][0], path.pts[0][1]];
  var p = path.pts[path.pts.length-1];
  return [p[0], p[1]];
}
function nearestOrder(items, start, pointFn){
  var left = items.slice(), out = [];
  var cur = [start[0], start[1]];
  while (left.length){
    var best = 0, bestD = Infinity;
    for (var i = 0; i < left.length; i++){
      var p = pointFn(left[i]);
      var d = Math.hypot(p[0]-cur[0], p[1]-cur[1]);
      if (d < bestD){ bestD = d; best = i; }
    }
    var item = left.splice(best, 1)[0];
    out.push(item);
    var ep = pointFn(item);
    cur = [ep[0], ep[1]];
  }
  return out;
}

/* --------------------------- 6. Траектории */
function buildToolpaths(scene, options){
  var o = {
    safeZ: 5, F: 800, Fz: 200, depth: -1, passDepth: 0.5,
    toolD: 3, stepover: 1.2, originX: 0, originY: 0, rPlane: 1,
    ramp: 0, optimize: true, useTools: false, tools: null
  };
  if (options) for (var k in options) if (options[k] !== undefined && options[k] !== null) o[k] = options[k];
  var moves = [], groups = [], warnings = [];
  var toolR = Math.max(0.05, numOr(o.toolD, 3) / 2);
  var depth = numOr(o.depth, -1);
  if (depth > 0) depth = -depth;
  if (Math.abs(depth) < 0.005){
    depth = -0.05;
    warnings.push('Глубина 0 мм — принято -0,05 мм, иначе реза не будет.');
  }
  var totalAbs = Math.abs(depth);
  var passAbs = Math.abs(numOr(o.passDepth, totalAbs)) || totalAbs;
  function levelsFor(absDepth){
    absDepth = Math.max(0.005, Math.abs(numOr(absDepth, totalAbs)));
    var n = Math.max(1, Math.ceil(absDepth / Math.max(0.01, passAbs)));
    var arr = [];
    for (var i = 1; i <= n; i++) arr.push(-absDepth * i / n);
    return arr;
  }
  var levels = levelsFor(totalAbs);
  var nPasses = levels.length;
  var safeZ = numOr(o.safeZ, 5);
  var rampLen = Math.max(0, numOr(o.ramp, 0));
  if (safeZ <= 0) warnings.push('Z безопасная должна быть больше 0.');

  function rapid(x, y, z){ moves.push({t:'rapid', x:x, y:y, z:z}); }
  function line(x, y, z, f){ moves.push({t:'line', x:x, y:y, z:z, f:f}); }
  function arc(x, y, z, i2, j2, dir, f){ moves.push({t:'arc', x:x, y:y, z:z, i:i2, j:j2, dir:dir, f:f}); }
  function dwell(p){ moves.push({t:'dwell', p:p}); }
  function comment(text){ moves.push({t:'comment', text:text}); }
  function retract(x, y){ rapid(x, y, safeZ); }

  /**
   * Режет ломаную с индивидуальной Z в каждой точке (для наклонов и ступеней).
   * zs — массив целевых Z той же длины, что pts.
   */
  function cutPolylineZ(pts, zs, closed, ramp, zStart){
    if (!pts || pts.length < 2) return;
    var sx = pts[0][0], sy = pts[0][1];
    var ex = closed ? sx : pts[pts.length-1][0];
    var ey = closed ? sy : pts[pts.length-1][1];
    var zFirst = zs && zs.length ? zs[0] : zStart;
    var rampStart = null;
    if (ramp > 0 && closed && pts.length > 1 && Math.abs(zFirst - zStart) > 1e-6){
      var dx = pts[1][0] - sx, dy = pts[1][1] - sy;
      var l = Math.hypot(dx, dy);
      if (l > 1e-9) rampStart = [sx - dx / l * ramp, sy - dy / l * ramp];
    }
    if (rampStart){
      rapid(rampStart[0], rampStart[1], safeZ);
      line(rampStart[0], rampStart[1], zStart, o.Fz);
      line(sx, sy, zFirst, o.F);
    } else {
      rapid(sx, sy, safeZ);
      line(sx, sy, zFirst, o.Fz);
    }
    for (var q = 1; q < pts.length; q++) line(pts[q][0], pts[q][1], zs && zs[q] !== undefined ? zs[q] : zFirst, o.F);
    if (closed) line(sx, sy, zs && zs.length ? zs[0] : zFirst, o.F);
    retract(ex, ey);
  }

  function cutPolyline(pts, z, closed, ramp, zStart){
    var zs = [];
    for (var i = 0; i < pts.length; i++) zs.push(z);
    cutPolylineZ(pts, zs, closed, ramp, zStart);
  }

  function tabPlan(path, count, width, tabH, absDepth){
    if (!path.closed || path.pts.length < 3) return null;
    count = Math.max(1, Math.round(count));
    if (!(tabH > 0.02) || tabH >= absDepth - 0.02) return null;
    var pts = path.pts, segs = [], total = 0;
    for (var i2 = 0; i2 < pts.length; i2++){
      var a = pts[i2], b = pts[(i2+1) % pts.length];
      var len = Math.hypot(b[0]-a[0], b[1]-a[1]);
      if (len < 1e-9) continue;
      segs.push({a:a, b:b, len:len, start:total});
      total += len;
    }
    if (total < 1e-6) return null;
    var tw = Math.max(0.2, width);
    if (tw * count >= total * 0.8) return {error:'Перемычки слишком широкие или частые — уменьшите ширину/количество.'};
    var tabs = [];
    for (var t2 = 0; t2 < count; t2++){
      var c = total * (t2 + 0.5) / count;
      tabs.push([c - tw/2, c + tw/2]);
    }
    tabs.sort(function(x, y){ return x[0] - y[0]; });
    var cuts = [], cur = 0;
    for (var t3 = 0; t3 < tabs.length; t3++){
      if (tabs[t3][0] > cur) cuts.push([cur, Math.min(tabs[t3][0], total)]);
      cur = Math.max(cur, tabs[t3][1]);
    }
    if (cur < total) cuts.push([cur, total]);
    function pointAt(d){
      d = clamp(d, 0, total);
      for (var j = 0; j < segs.length; j++){
        var s = segs[j];
        if (d <= s.start + s.len + 1e-9){
          var u = s.len > 1e-9 ? (d - s.start) / s.len : 0;
          return [s.a[0] + (s.b[0]-s.a[0])*u, s.a[1] + (s.b[1]-s.a[1])*u];
        }
      }
      return [pts[0][0], pts[0][1]];
    }
    var segments = [];
    for (var c2 = 0; c2 < cuts.length; c2++){
      var s0 = cuts[c2][0], e0 = cuts[c2][1];
      var out = [pointAt(s0)];
      for (var v = 0; v < segs.length; v++){
        if (segs[v].start > s0 + 1e-7 && segs[v].start < e0 - 1e-7) out.push([segs[v].a[0], segs[v].a[1]]);
      }
      out.push(pointAt(e0));
      if (polylineLength(out) > 0.1) segments.push(out);
    }
    if (!segments.length) return null;
    return {segments: segments, zTab: -(absDepth - tabH), total: total};
  }

  function axisValue(p, axis){ return axis === 'X' ? p[0] : p[1]; }
  function bandIndex(c, minC, maxC, n){
    if (!(maxC - minC > 1e-9)) return 0;
    return clamp(Math.floor((c - minC) / (maxC - minC) * n), 0, n - 1);
  }
  function bandZ(i, z1, z2, n){
    return z1 + (z2 - z1) * (n <= 1 ? 0 : i / (n - 1));
  }

  /** Точки ступенчатого профиля: на границах полос Z меняется вертикально. */
  function steppedPoints(pts, closed, axis, z1, z2, n, bbox){
    var minC = axis === 'X' ? bbox.minX : bbox.minY;
    var maxC = axis === 'X' ? bbox.maxX : bbox.maxY;
    if (!(maxC - minC > 1e-9)){
      return {pts: pts.map(function(p){ return [p[0], p[1]]; }), zs: pts.map(function(){ return z1; })};
    }
    var step = (maxC - minC) / n;
    var outPts = [], outZ = [];
    var first = pts[0];
    var firstBand = bandIndex(axisValue(first, axis), minC, maxC, n);
    outPts.push([first[0], first[1]]);
    outZ.push(bandZ(firstBand, z1, z2, n));
    var segCount = closed ? pts.length : pts.length - 1;
    for (var s = 0; s < segCount; s++){
      var a = pts[s], b = pts[(s + 1) % pts.length];
      var ca = axisValue(a, axis), cb = axisValue(b, axis);
      var ia = bandIndex(ca, minC, maxC, n), ib = bandIndex(cb, minC, maxC, n);
      var isClosing = closed && ((s + 1) % pts.length === 0);
      if (ia === ib){
        if (!isClosing){ outPts.push([b[0], b[1]]); outZ.push(bandZ(ib, z1, z2, n)); }
        continue;
      }
      var dir = ib > ia ? 1 : -1, cur = ia;
      while (cur !== ib){
        var next = cur + dir;
        var boundary = minC + (dir > 0 ? next : cur) * step;
        var tpar = clamp((boundary - ca) / (cb - ca), 0, 1);
        var bx = a[0] + (b[0] - a[0]) * tpar;
        var by = a[1] + (b[1] - a[1]) * tpar;
        outPts.push([bx, by]); outZ.push(bandZ(cur, z1, z2, n));
        outPts.push([bx, by]); outZ.push(bandZ(next, z1, z2, n));
        cur = next;
      }
      if (!isClosing){ outPts.push([b[0], b[1]]); outZ.push(bandZ(ib, z1, z2, n)); }
    }
    return {pts: outPts, zs: outZ};
  }

  /** Наклон или ступени внутри одной фигуры, с делением на проходы. */
  function cutProfilePath(path, ctx){
    var pts = path.pts, targets = [];
    var axis = ctx.profile.indexOf('X') >= 0 ? 'X' : 'Y';
    if (ctx.profile.indexOf('slope') === 0){
      var minC = axis === 'X' ? ctx.bbox.minX : ctx.bbox.minY;
      var maxC = axis === 'X' ? ctx.bbox.maxX : ctx.bbox.maxY;
      for (var i = 0; i < pts.length; i++){
        var t = (maxC - minC > 1e-9) ? clamp((axisValue(pts[i], axis) - minC) / (maxC - minC), 0, 1) : 0;
        targets.push(ctx.z1 + (ctx.z2 - ctx.z1) * t);
      }
    } else {
      var sp = steppedPoints(pts, path.closed, axis, ctx.z1, ctx.z2, ctx.steps, ctx.bbox);
      pts = sp.pts;
      targets = sp.zs;
    }
    var nP = Math.max(1, ctx.levels.length);
    for (var p = 1; p <= nP; p++){
      var f = p / nP;
      var zs = [];
      for (var k = 0; k < targets.length; k++) zs.push(targets[k] * f);
      var zStart = p === 1 ? 0 : targets[0] * (p - 1) / nP;
      cutPolylineZ(pts, zs, path.closed, path.closed ? rampLen : 0, zStart);
    }
  }

  function cutPath(path, el, ctx){
    var p = el.params || {};
    var tabCount = Math.round(numOr(p.tabs, 0));
    if (tabCount > 0 && path.closed && ctx.profile !== 'flat'){
      warnings.push('Профиль высоты: перемычки отключены для «' + elementSummary(el) + '».');
      tabCount = 0;
    }
    if (tabCount > 0 && path.closed){
      var plan = tabPlan(path, tabCount, numOr(p.tabW, 4), numOr(p.tabH, 1), ctx.absDepth);
      if (plan && plan.error){ warnings.push(plan.error); plan = null; }
      if (!plan) warnings.push('Перемычки не применены: проверьте количество, ширину и высоту (она должна быть меньше глубины реза).');
      if (plan){
        var lv = ctx.levels.slice();
        if (!lv.some(function(z){ return Math.abs(z - plan.zTab) < 1e-6; })) lv.push(plan.zTab);
        lv.sort(function(x, y){ return y - x; });
        for (var pi = 0; pi < lv.length; pi++){
          var z = lv[pi];
          var skip = Math.abs(z) > Math.abs(plan.zTab) + 1e-6;
          if (skip){
            for (var si = 0; si < plan.segments.length; si++) cutPolyline(plan.segments[si], z, false, 0, 0);
          } else {
            cutPolyline(path.pts, z, true, 0, 0);
          }
        }
        return;
      }
    }
    if (ctx.profile !== 'flat'){
      cutProfilePath(path, ctx);
      return;
    }
    if (path.circle){
      var r = path.circle.r;
      var b = polygonBBox(path.pts);
      var cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      for (var pc = 0; pc < ctx.levels.length; pc++){
        var zc = ctx.levels[pc];
        var zStart = pc === 0 ? 0 : ctx.levels[pc-1];
        var rampStart = null;
        if (rampLen > 0 && Math.abs(zc - zStart) > 1e-6) rampStart = [cx + r, cy - rampLen];
        if (rampStart){
          rapid(rampStart[0], rampStart[1], safeZ);
          line(rampStart[0], rampStart[1], zStart, o.Fz);
          line(cx + r, cy, zc, o.F);
        } else {
          rapid(cx + r, cy, safeZ);
          line(cx + r, cy, zc, o.Fz);
        }
        arc(cx - r, cy, zc, -r, 0, 'G3', o.F);
        arc(cx + r, cy, zc, r, 0, 'G3', o.F);
        retract(cx + r, cy);
      }
      return;
    }
    for (var pp = 0; pp < ctx.levels.length; pp++){
      var zp = ctx.levels[pp];
      cutPolyline(path.pts, zp, path.closed, path.closed ? rampLen : 0, pp === 0 ? 0 : ctx.levels[pp-1]);
    }
  }

  function cutDots(dots, startPos, lv){
    var list = dots.slice();
    if (o.optimize && list.length > 1) list = nearestOrder(list, startPos, function(d){ return [d.x, d.y]; });
    for (var i2 = 0; i2 < list.length; i2++){
      for (var pi = 0; pi < lv.length; pi++){
        rapid(list[i2].x, list[i2].y, safeZ);
        line(list[i2].x, list[i2].y, lv[pi], o.Fz);
        dwell(0.2);
        retract(list[i2].x, list[i2].y);
      }
    }
  }

  function pocketMoves(contour, inverse, margin, lv){
    var b = polygonBBox(contour.pts);
    var m = inverse ? (numOr(margin, toolR + 1.5)) : 0;
    var region = {x1: b.minX - m, y1: b.minY - m, x2: b.maxX + m, y2: b.maxY + m};
    var clearance = toolR + (inverse ? 0.15 : 0.02);
    var poly = contour.pts;
    var test;
    if (inverse){
      test = function(x, y){ return !pointInPolygon(x, y, poly) && !nearPoly(x, y, poly, clearance); };
    } else {
      test = function(x, y){ return pointInPolygon(x, y, poly) && !nearPoly(x, y, poly, clearance); };
    }
    var scan = rasterScan(region, o.stepover, test);
    if (!scan.length){
      warnings.push(inverse
        ? 'Обратная гравировка: зона съёма пуста — увеличьте поле вокруг или уменьшите шаг растра.'
        : 'Карман пуст: инструмент Ø' + fmt(o.toolD,1) + ' мм не помещается в контур. Уменьшите Ø или увеличьте контур.');
      return;
    }
    for (var li = 0; li < scan.length; li++){
      var ln = scan[li];
      for (var si = 0; si < ln.segs.length; si++){
        var seg = ln.segs[si];
        for (var pi = 0; pi < lv.length; pi++){
          var z = lv[pi];
          rapid(seg[0], ln.y, safeZ);
          line(seg[0], ln.y, z, o.Fz);
          line(seg[1], ln.y, z, o.F);
          retract(seg[1], ln.y);
        }
      }
    }
  }

  function textInverseMoves(placed, lv){
    var b = geomBBox(placed);
    var margin = toolR + 1.5;
    var region = {x1: b.minX - margin, y1: b.minY - margin, x2: b.maxX + margin, y2: b.maxY + margin};
    var segs = textSegments(placed);
    var clearance = toolR + 0.15;
    var scan = rasterScan(region, o.stepover, function(x, y){
      return !nearSegs(x, y, segs, clearance);
    });
    for (var li = 0; li < scan.length; li++){
      var ln = scan[li];
      for (var si = 0; si < ln.segs.length; si++){
        var seg = ln.segs[si];
        for (var pi = 0; pi < lv.length; pi++){
          var z = lv[pi];
          rapid(seg[0], ln.y, safeZ);
          line(seg[0], ln.y, z, o.Fz);
          line(seg[1], ln.y, z, o.F);
          retract(seg[1], ln.y);
        }
      }
    }
    if (!scan.length) warnings.push('Обратная гравировка текста: нечего снимать (слишком мелкий шаг или большой инструмент).');
    return segs.length;
  }

  function holesMoves(placed, el, startPos, fallbackDepth){
    var p = el.params || {};
    var holeDepth = Math.abs(numOr(p.depth, 0)) || Math.abs(numOr(fallbackDepth, totalAbs));
    var q = Math.max(0.1, Math.abs(numOr(p.peck, holeDepth)));
    var rPlane = Math.max(0, numOr(o.rPlane, 1));
    var list = placed.holes.slice();
    if (o.optimize && list.length > 1) list = nearestOrder(list, startPos, function(h){ return [h.x, h.y]; });
    for (var hi = 0; hi < list.length; hi++){
      var h = list[hi];
      rapid(h.x, h.y, safeZ);
      rapid(h.x, h.y, rPlane);
      var cur = 0, target = -holeDepth, guard = 0;
      while (cur > target + 1e-6 && guard++ < 1000){
        var next = Math.max(cur - q, target);
        line(h.x, h.y, next, o.Fz);
        if (next > target + 1e-6) rapid(h.x, h.y, rPlane);
        cur = next;
      }
      retract(h.x, h.y);
    }
    return list.length ? [list[list.length-1].x, list[list.length-1].y] : startPos;
  }

  var useTools = !!(o.useTools && Array.isArray(o.tools) && o.tools.length);
  function toolFor(el){
    if (!useTools) return null;
    var no = numOr(el.tool, 0);
    for (var ti = 0; ti < o.tools.length; ti++){
      if (Number(o.tools[ti].no) === Number(no)) return o.tools[ti];
    }
    return o.tools[0];
  }

  rapid(o.originX, o.originY, safeZ);
  var els = (scene && scene.elements) || [];
  var jobs = [];
  for (var ei = 0; ei < els.length; ei++){
    var el = els[ei];
    if (el.enabled === false) continue;
    var geom = elementGeometry(el);
    if (!geom) continue;
    var pl = el.place || {mode:'center', x:0, y:0};
    var placed = transformGeom(geom, pl, el.rot, el.mirrorX, el.mirrorY);
    var name = elementSummary(el);
    var hi = elementHeightInfo(el, depth);
    var bb = geomBBox(placed);
    var elLevels = levelsFor(hi.maxAbs);
    var ctx = {
      profile: hi.profile, z1: hi.z1, z2: hi.z2, steps: hi.steps,
      minZ: hi.minZ, maxZ: hi.maxZ, absDepth: hi.maxAbs,
      levels: elLevels, bbox: bb
    };
    var entry, exit;
    if (placed.kind === 'holes' && placed.holes.length){
      entry = [placed.holes[0].x, placed.holes[0].y];
      exit = entry.slice();
    } else if ((placed.kind === 'cut') && placed.paths.length){
      entry = pathStartPoint(placed.paths[0]);
      exit = pathEndPoint(placed.paths[0]);
    } else {
      entry = [(bb.minX + bb.maxX)/2, (bb.minY + bb.maxY)/2];
      exit = entry.slice();
    }
    jobs.push({el:el, ei:ei, geom:geom, placed:placed, name:name, entry:entry, exit:exit, tool:toolFor(el), height:hi, ctx:ctx});
  }

  function greedyJobs(list, start){
    var left = list.slice(), out = [], cur = [start[0], start[1]];
    while (left.length){
      var best = 0, bestD = Infinity;
      for (var jj = 0; jj < left.length; jj++){
        var d = Math.hypot(left[jj].entry[0]-cur[0], left[jj].entry[1]-cur[1]);
        if (d < bestD){ bestD = d; best = jj; }
      }
      var job = left.splice(best, 1)[0];
      out.push(job);
      cur = job.exit;
    }
    return out;
  }
  if (jobs.length > 1){
    if (useTools){
      var ordered = [], cur = [o.originX, o.originY];
      while (jobs.length){
        var toolRef = jobs[0].tool;
        var group = [], rest = [];
        for (var jt = 0; jt < jobs.length; jt++){
          if (jobs[jt].tool === toolRef) group.push(jobs[jt]);
          else rest.push(jobs[jt]);
        }
        if (o.optimize) group = greedyJobs(group, cur);
        for (var gg = 0; gg < group.length; gg++){
          ordered.push(group[gg]);
          cur = group[gg].exit;
        }
        jobs = rest;
      }
      jobs = ordered;
    } else if (o.optimize){
      jobs = greedyJobs(jobs, [o.originX, o.originY]);
    }
  }

  var curPos = [o.originX, o.originY];
  var lastToolNo = null, toolsUsed = [];
  for (var ji = 0; ji < jobs.length; ji++){
    var J = jobs[ji];
    var el2 = J.el, placed2 = J.placed, geom2 = J.geom;
    if (J.tool){
      var toolNo = Number(J.tool.no);
      if (lastToolNo === null || toolNo !== lastToolNo){
        if (lastToolNo !== null) moves.push({t:'toolchange', tool:J.tool});
        toolsUsed.push(J.tool);
        lastToolNo = toolNo;
        o.F = Math.max(1, numOr(J.tool.f, o.F));
        o.Fz = Math.max(1, numOr(J.tool.fz, o.Fz));
        o.toolD = Math.max(0.1, numOr(J.tool.d, o.toolD));
        toolR = Math.max(0.05, o.toolD / 2);
      }
    }
    var zRange = (Math.abs(J.height.maxZ - J.height.minZ) < 1e-6)
      ? fmt(J.height.minZ, 2)
      : fmt(J.height.minZ, 2) + '…' + fmt(J.height.maxZ, 2);
    comment((J.ei + 1) + '. ' + J.name + (el2.rot ? ' / поворот ' + fmt(el2.rot,1) + '°' : '') +
      (el2.mirrorX || el2.mirrorY ? ' / зеркало' : '') + ' / Z ' + zRange);
    var startIdx = moves.length;
    if (geom2.missing && geom2.missing.length) warnings.push('Нет глифа для символа(ов): ' + geom2.missing.join(' '));
    if (geom2.warnings && geom2.warnings.length){
      for (var w = 0; w < geom2.warnings.length; w++) warnings.push(geom2.warnings[w]);
    }
    var flatLv = J.ctx.levels;
    if (J.ctx.profile !== 'flat' && (placed2.kind === 'pocket' || placed2.kind === 'inv' || placed2.kind === 'textInv' || placed2.kind === 'holes')){
      flatLv = levelsFor(J.height.baseAbs);
      warnings.push('Профиль высоты не применяется к «' + J.name + '» — взята постоянная Z' + fmt(J.height.base, 2) + '.');
    }
    switch (placed2.kind){
      case 'holes':
        curPos = holesMoves(placed2, el2, curPos, J.height.baseAbs);
        break;
      case 'pocket':
        if (!placed2.contour){ warnings.push('Карман без контура.'); break; }
        pocketMoves(placed2.contour, false, 0, flatLv);
        curPos = J.exit;
        break;
      case 'inv':
        if (!placed2.contour){ warnings.push('Обратная гравировка без контура.'); break; }
        pocketMoves(placed2.contour, true, toolR + 1.5 + numOr(el2.params.margin, 0), flatLv);
        curPos = J.exit;
        break;
      case 'textInv':
        textInverseMoves(placed2, flatLv);
        curPos = J.exit;
        break;
      default:
        var paths = placed2.paths.slice();
        if (o.optimize && paths.length > 1) paths = nearestOrder(paths, curPos, pathStartPoint);
        for (var pi2 = 0; pi2 < paths.length; pi2++){
          cutPath(paths[pi2], el2, J.ctx);
          curPos = pathEndPoint(paths[pi2]);
        }
        if (placed2.dots && placed2.dots.length) cutDots(placed2.dots, curPos, flatLv);
        break;
    }
    if (moves.length > startIdx){
      groups.push({index: groups.length, name: J.name, from: startIdx, to: moves.length,
        zMin: J.height.minZ, zMax: J.height.maxZ, profile: J.height.profile});
    } else {
      warnings.push('Элемент «' + J.name + '» не дал траекторий.');
    }
  }
  retract(o.originX, o.originY);
  var heights = [];
  for (var hj = 0; hj < jobs.length; hj++){
    heights.push({name: jobs[hj].name, profile: jobs[hj].height.profile,
      z1: jobs[hj].height.z1, z2: jobs[hj].height.z2,
      minZ: jobs[hj].height.minZ, maxZ: jobs[hj].height.maxZ,
      short: jobs[hj].height.short});
  }
  return {moves: moves, groups: groups, warnings: warnings, levels: levels, nPasses: nPasses, ramped: rampLen, toolsUsed: toolsUsed, heights: heights};
}

/* --------------------------- 7. Оценка времени/длины */
function estimateMoves(moves, feedDefault, plungeDefault){
  var F = Math.max(1, numOr(feedDefault, 800));
  var Fz = Math.max(1, numOr(plungeDefault, 200));
  var cutLen = 0, rapidLen = 0, plungeLen = 0, dwellSec = 0;
  var cutSec = 0, plungeSec = 0, rapidSec = 0;
  var prev = null;
  for (var i = 0; i < moves.length; i++){
    var m = moves[i];
    if (m.t === 'dwell'){ dwellSec += numOr(m.p, 0); continue; }
    if (m.t === 'comment' || m.t === 'toolchange') continue;
    if (prev){
      if (m.t === 'arc'){
        var r = Math.hypot(m.i || 0, m.j || 0);
        var ccx = prev.x + (m.i || 0), ccy = prev.y + (m.j || 0);
        var aS = Math.atan2(prev.y - ccy, prev.x - ccx);
        var aE = Math.atan2(m.y - ccy, m.x - ccx);
        var sweep;
        if (m.dir === 'G3'){ sweep = aE - aS; while (sweep <= 1e-9) sweep += 2*Math.PI; }
        else { sweep = aS - aE; while (sweep <= 1e-9) sweep += 2*Math.PI; }
        var arcLen = r * sweep;
        cutLen += arcLen;
        cutSec += arcLen / Math.max(1, numOr(m.f, F)) * 60;
      } else {
        var d = Math.hypot(m.x - prev.x, m.y - prev.y, (m.z || 0) - (prev.z || 0));
        var dz = (m.z || 0) - (prev.z || 0);
        if (m.t === 'rapid'){
          rapidLen += d;
          rapidSec += d / 5000 * 60;
        } else {
          var f = Math.max(1, numOr(m.f, F));
          if (Math.abs(m.x - prev.x) < 1e-9 && Math.abs(m.y - prev.y) < 1e-9 && dz < 0){
            plungeLen += d;
            plungeSec += d / Math.max(1, numOr(m.f, Fz)) * 60;
          } else {
            cutLen += d;
            cutSec += d / f * 60;
          }
        }
      }
    }
    prev = m;
  }
  var totalSec = cutSec + plungeSec + rapidSec + dwellSec;
  return {cutLen: cutLen, rapidLen: rapidLen, plungeLen: plungeLen, dwellSec: dwellSec, totalSec: totalSec};
}

function formatTime(sec){
  if (!isFinite(sec)) return '—';
  if (sec < 60) return fmt(sec, 1) + ' с';
  var m = Math.floor(sec / 60), s = Math.round(sec - m * 60);
  if (m < 60) return m + ' мин ' + s + ' с';
  var hh = Math.floor(m / 60);
  return hh + ' ч ' + (m % 60) + ' мин';
}

/* --------------------------- 8. G-код */
var TRANSLIT = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y',
  'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
  'х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
  'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Zh','З':'Z','И':'I','Й':'Y',
  'К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F',
  'Х':'H','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Sch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya'
};
function translit(str){
  var out = '';
  for (var i = 0; i < str.length; i++){
    var ch = str[i];
    out += (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch);
  }
  return out;
}
function sanitizeComment(text, ascii){
  var t = String(text === null || text === undefined ? '' : text);
  if (ascii) t = translit(t);
  return t.replace(/[()\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function applyPostTokens(text, meta){
  if (!text) return '';
  var d = new Date();
  var pad = function(v){ return ('0' + v).slice(-2); };
  var blank = meta.blank && meta.blank.enabled ? (fmt(meta.blank.w, 2) + 'x' + fmt(meta.blank.h, 2)) : '';
  var map = {
    TITLE: meta.title || '',
    DATE: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    TIME: pad(d.getHours()) + ':' + pad(d.getMinutes()),
    TOOL: meta.toolNumber || '',
    S: meta.spindle || '',
    F: meta.feed || '',
    SAFE_Z: fmt(meta.safeZ, 3),
    BLANK: blank,
    WCS: meta.wcs || ''
  };
  return String(text).replace(/\{([A-Z_]+)\}/g, function(all, key){
    return map[key] !== undefined ? String(map[key]) : all;
  });
}

/**
 * Постпроцессор: превращает массив ходов в текст программы.
 * meta: title, controller, coolant, spindle, toolD, blank, asciiComments, returnHome,
 *       wcs, arcMode ('ij'|'r'), decimals, useM6, toolNumber, customHeader, customFooter,
 *       percent, lineNumbers, feed
 */
function emitProgram(moves, meta, options){
  var m = meta || {};
  var ctrl = m.controller || 'universal';
  var custom = (ctrl === 'custom');
  var ascii = !!m.asciiComments;
  var dec = clamp(Math.round(numOr(m.decimals, 3)), 0, 4);
  function n(v){ return fmt(v, dec); }
  var safeZ = numOr(m.safeZ, 5);
  var usePercent = custom ? !!m.percent : (ctrl === 'fanuc' || ctrl === 'linuxcnc' || ctrl === 'mach3');
  var useLineNumbers = custom ? !!m.lineNumbers : (ctrl === 'fanuc' || ctrl === 'linuxcnc');
  var L = [];
  var N = 10;
  function comment(text){
    return '(' + sanitizeComment(text, ascii) + ')';
  }
  function out(text){
    if (useLineNumbers && text !== '%' && text.charAt(0) !== '(' && text.charAt(0) !== 'O'){
      L.push('N' + N + ' ' + text);
      N += 10;
    } else {
      L.push(text);
    }
  }
  function rawLines(text){
    var lines = String(text || '').split('\n');
    for (var i = 0; i < lines.length; i++){
      var line = applyPostTokens(lines[i], m).trim();
      if (ascii) line = translit(line);
      if (line) out(line);
    }
  }
  if (usePercent) L.push('%');
  if (ctrl === 'fanuc' || ctrl === 'linuxcnc') out('O0001 (PROGRAM)');
  out(comment(m.title || 'G-CODE / UNIVERSAL'));
  var infoBits = [];
  if (m.toolD) infoBits.push('tool D' + fmt(m.toolD, 2));
  if (m.blank && m.blank.enabled) infoBits.push('blank ' + fmt(m.blank.w, 1) + 'x' + fmt(m.blank.h, 1));
  if (m.spindle) infoBits.push('S' + fmt(m.spindle, 0));
  if (infoBits.length) out(comment(infoBits.join(' | ')));
  out('G21');
  out('G90');
  out('G17');
  out('G94');
  if (/^G5[4-9]$/.test(m.wcs || '')) out(m.wcs);
  if (m.useM6 && m.toolNumber){
    out('T' + m.toolNumber + ' M6');
    out('G43 H' + m.toolNumber);
  }
  if (m.spindle) out('M3 S' + fmt(m.spindle, 0));
  if (m.coolant) out('M8');
  out('G0 Z' + n(safeZ));
  if (custom) rawLines(m.customHeader);

  var px = null, py = null, pz = null, pf = null;
  for (var i = 0; i < moves.length; i++){
    var mv = moves[i];
    if (mv.t === 'comment'){ out(comment(mv.text)); continue; }
    if (mv.t === 'dwell'){ out('G4 P' + fmt(mv.p, Math.max(2, dec))); continue; }
    if (mv.t === 'toolchange'){
      var tool = mv.tool || {};
      out(comment('T' + (tool.no || 1) + (tool.name ? ': ' + tool.name : '')));
      out('M5');
      out('G0 Z' + n(safeZ));
      out('T' + (tool.no || 1) + ' M6');
      out('G43 H' + (tool.no || 1));
      out('M3 S' + fmt(tool.s || m.spindle || 0, 0));
      pz = safeZ;
      pf = null;
      continue;
    }
    var s = '';
    if (mv.t === 'arc'){
      var arcR = Math.hypot(mv.i || 0, mv.j || 0);
      var useR = (m.arcMode === 'r') && arcR > 1e-9 && px !== null && py !== null;
      if (useR){
        var cx = px + (mv.i || 0), cy = py + (mv.j || 0);
        var aS = Math.atan2(py - cy, px - cx), aE = Math.atan2(mv.y - cy, mv.x - cx);
        var sweep;
        if (mv.dir === 'G3'){ sweep = aE - aS; while (sweep <= 1e-9) sweep += 2*Math.PI; }
        else { sweep = aS - aE; while (sweep <= 1e-9) sweep += 2*Math.PI; }
        if (Math.hypot(mv.x - px, mv.y - py) < 1e-9) useR = false;
        else {
          var rr = sweep > Math.PI + 1e-6 ? -arcR : arcR;
          s = mv.dir + ' X' + n(mv.x) + ' Y' + n(mv.y) + ' Z' + n(mv.z) + ' R' + n(rr);
        }
      }
      if (!s){
        s = mv.dir + ' X' + n(mv.x) + ' Y' + n(mv.y) + ' Z' + n(mv.z);
        s += ' I' + n(mv.i || 0) + ' J' + n(mv.j || 0);
      }
      if (pf === null || mv.f !== pf){ s += ' F' + fmt(mv.f, 0); pf = mv.f; }
      out(s);
      px = mv.x; py = mv.y; pz = mv.z;
      continue;
    }
    s = (mv.t === 'rapid') ? 'G0' : 'G1';
    var has = false;
    if (px === null || Math.abs(mv.x - px) > 1e-6){ s += ' X' + n(mv.x); has = true; }
    if (py === null || Math.abs(mv.y - py) > 1e-6){ s += ' Y' + n(mv.y); has = true; }
    if (pz === null || Math.abs(mv.z - pz) > 1e-6){ s += ' Z' + n(mv.z); has = true; }
    if (mv.t === 'line' && (pf === null || mv.f !== pf)){ s += ' F' + fmt(mv.f, 0); has = true; pf = mv.f; }
    if (!has) continue;
    out(s);
    px = mv.x; py = mv.y; pz = mv.z;
  }

  if (custom) rawLines(m.customFooter);
  out('M5');
  if (m.coolant) out('M9');
  out('G0 Z' + n(safeZ));
  if (m.returnHome !== false) out('G0 X0 Y0');
  out('M30');
  if (usePercent) L.push('%');
  return L.join('\n');
}

/* --------------------------- 8b. Раскрытие параметрических программ */
/**
 * Раскрывает простые макросы Macro B (#переменные, WHILE/DO/END)
 * в обычный G-код, чтобы предпросмотр, время и валидатор работали
 * и для параметрических программ.
 */
function expandMacros(text){
  var src = String(text === null || text === undefined ? '' : text);
  if (!/(^|\n)\s*#\d+\s*=|WHILE\s*\[/i.test(src)) return src;

  function stripComments(line){
    var out = '', depth = 0;
    for (var i = 0; i < line.length; i++){
      var ch = line.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')'){ if (depth > 0) depth--; }
      else if (depth === 0) out += ch;
    }
    return out.trim();
  }
  function readBracket(s, start){
    var depth = 0;
    for (var i = start; i < s.length; i++){
      if (s.charAt(i) === '[') depth++;
      else if (s.charAt(i) === ']'){
        depth--;
        if (depth === 0) return {body: s.slice(start + 1, i), end: i};
      }
    }
    throw new Error('Не закрыта скобка [ в строке: ' + s);
  }
  function parseWhile(line){
    var m = /^WHILE\s*\[/i.exec(line);
    if (!m) return null;
    var br = readBracket(line, m[0].length - 1);
    var dm = /^\s*DO\s*(\d+)/i.exec(line.slice(br.end + 1));
    if (!dm) throw new Error('WHILE без DO: ' + line);
    return {cond: br.body, endTag: dm[1]};
  }
  function findEnd(lines, start, limit){
    var depth = 0;
    for (var i = start + 1; i < limit; i++){
      if (/^WHILE\s*\[/i.test(lines[i])) depth++;
      else if (/^END\s*\d+/i.test(lines[i])){
        if (depth === 0) return i;
        depth--;
      }
    }
    return -1;
  }
  function expandLine(line, vars){
    var out = '';
    for (var i = 0; i < line.length;){
      if (line.charAt(i) === '['){
        var br = readBracket(line, i);
        var v = paramEval(br.body, vars).value;
        out += fmt(v, 3);
        i = br.end + 1;
      } else {
        out += line.charAt(i);
        i++;
      }
    }
    return out.replace(/#(\d+)/g, function(_, n){
      var v = vars[Number(n)];
      return v === undefined ? '0' : fmt(v, 3);
    }).trim();
  }

  var lines = src.split('\n').map(stripComments);
  var vars = {};
  var guard = 0;
  function runBlock(start, end){
    var out = [];
    var i = start;
    while (i < end){
      if (++guard > 200000) throw new Error('Слишком много итераций макроса.');
      var line = lines[i];
      if (!line){ i++; continue; }
      var wh = parseWhile(line);
      if (wh){
        var endIdx = findEnd(lines, i, end);
        if (endIdx < 0) throw new Error('Нет END для WHILE: ' + line);
        var iter = 0;
        while (iter++ < 10000 && paramEval(wh.cond, vars).value !== 0){
          out = out.concat(runBlock(i + 1, endIdx));
        }
        i = endIdx + 1;
        continue;
      }
      var asg = /^#(\d+)\s*=\s*(.+)$/.exec(line);
      if (asg){
        vars[Number(asg[1])] = paramEval(asg[2], vars).value;
        i++;
        continue;
      }
      if (/^(END|DO)\s*\d+/i.test(line)){ i++; continue; }
      if (/^(IF|GOTO|N\d+)/i.test(line)){ i++; continue; }
      var ex = expandLine(line, vars);
      if (ex) out.push(ex);
      i++;
    }
    return out;
  }
  try {
    var outLines = runBlock(0, lines.length);
    return outLines.join('\n');
  } catch (e){
    return src;
  }
}

/* --------------------------- 9. Разбор G-кода */
function parseProgram(text){
  var original = String(text || '');
  var expanded = expandMacros(original);
  var rawLines = String(expanded).split('\n');
  var moves = [];
  var st = {
    abs: true, scale: 1,
    motion: null, plane: null,
    x: 0, y: 0, z: 0, f: null,
    cycle: null, cycleParams: {},
    spindle: 0, spindleOn: false, spindleStarted: false, spindleLine: null,
    m30Line: null, m5Line: null, m2Line: null, toolChanges: [],
    feedLine: null, firstCutLine: null,
    minCutZ: 0, minCutZLine: null,
    maxPassDrop: 0, cutLevels: {},
    rapidBelowSafe: [], arcIssues: [], cycleIssues: [],
    unbalanced: [], bounds: null,
    cutCount: 0, lineCount: rawLines.length,
    hasG21: false, hasG90: false, hasG17: false,
    unknown: []
  };
  var cur = {x: 0, y: 0, z: 0};
  var bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};

  function pushMove(t, x, y, z, extra){
    var mv = {t: t, x: x, y: y, z: z, line: st._line};
    if (extra) for (var k in extra) mv[k] = extra[k];
    moves.push(mv);
    if (x < bounds.minX) bounds.minX = x;
    if (x > bounds.maxX) bounds.maxX = x;
    if (y < bounds.minY) bounds.minY = y;
    if (y > bounds.maxY) bounds.maxY = y;
  }
  function isCutMove(mv){
    return (mv.t === 'line' || mv.t === 'arc') && mv.z <= 0.0001;
  }
  function trackCut(mv){
    if (!isCutMove(mv)) return;
    st.cutCount++;
    if (st.firstCutLine === null) st.firstCutLine = mv.line;
    if (mv.z < st.minCutZ){ st.minCutZ = mv.z; st.minCutZLine = mv.line; }
    if (mv.z < -1e-6) st.cutLevels[Math.round(mv.z * 1000) / 1000] = true;
  }

  for (var li = 0; li < rawLines.length; li++){
    var raw = rawLines[li];
    st._line = li + 1;
    var noCom = raw.replace(/\([^)]*\)/g, ' ');
    var open = (raw.match(/\(/g) || []).length;
    var close = (raw.match(/\)/g) || []).length;
    if (open !== close) st.unbalanced.push(li + 1);
    var semi = noCom.indexOf(';');
    var code = (semi >= 0 ? noCom.slice(0, semi) : noCom).trim();
    if (!code || code === '%') continue;
    if (/^[Nn]\d/.test(code)) code = code.replace(/^[Nn]\d+\s*/, '');
    if (/^[Oo]\d/.test(code)) continue;
    var words = code.match(/[A-Za-z][+-]?\d*\.?\d+/g) || [];
    if (!words.length){ continue; }
    var W = {};
    var gcodes = [];
    for (var wi = 0; wi < words.length; wi++){
      var w = words[wi];
      var letter = w.charAt(0).toUpperCase();
      var val = parseFloat(w.slice(1));
      if (!isFinite(val)) continue;
      if (letter === 'G'){ gcodes.push(val); }
      else if (letter === 'M'){ W['M' + val] = true; }
      else { W[letter] = val; }
    }
    /* режимы */
    for (var gi = 0; gi < gcodes.length; gi++){
      var g = gcodes[gi];
      if (g === 20) st.scale = 25.4;
      else if (g === 21) { st.scale = 1; st.hasG21 = true; }
      else if (g === 90) { st.abs = true; st.hasG90 = true; }
      else if (g === 91) st.abs = false;
      else if (g === 17) st.hasG17 = true;
      else if (g === 0 || g === 1 || g === 2 || g === 3) st.motion = 'G' + g;
      else if (g === 80) st.cycle = null;
      else if (g >= 81 && g <= 89){
        st.cycle = 'G' + g;
        st.cycleParams = {};
        st.motion = 'G' + g;
      } else if (g === 73){ st.cycle = 'G73'; st.motion = 'G73'; }
      else if (g === 76){ st.cycle = 'G76'; st.motion = 'G76'; }
      else if (g === 4){ /* dwell */ }
    }
    if (W.M3 || W.M4){
      st.spindleOn = true;
      st.spindleStarted = true;
      st.spindleLine = st.spindleLine || li + 1;
      if (W.S) st.spindle = W.S;
    }
    if (W.M5){ st.spindleOn = false; st.m5Line = st.m5Line || li + 1; }
    if (W.M6){ st.toolChanges.push({line: li + 1, z: cur.z}); }
    if (W.M30){ st.m30Line = st.m30Line || li + 1; }
    if (W.M2 && !st.m2Line) st.m2Line = li + 1;
    if (W.S) st.spindle = W.S;
    if (W.F){ st.f = W.F; if (st.feedLine === null) st.feedLine = li + 1; }

    var scale = st.scale;
    function axis(name){ return W[name] === undefined ? null : W[name] * scale; }
    var nx = axis('X'), ny = axis('Y'), nz = axis('Z');
    var hasAxis = (nx !== null || ny !== null || nz !== null);
    var hasCycleWord = (W.R !== undefined || W.Q !== undefined || W.P !== undefined);

    if (st.cycle){
      if (W.R !== undefined || W.Q !== undefined || W.P !== undefined){
        st.cycleParams.R = W.R !== undefined ? W.R * scale : st.cycleParams.R;
        st.cycleParams.Q = W.Q !== undefined ? W.Q * scale : st.cycleParams.Q;
        st.cycleParams.P = W.P !== undefined ? W.P : st.cycleParams.P;
      }
      if (hasAxis || hasCycleWord){
        var cx = (nx !== null) ? (st.abs ? nx : cur.x + nx) : cur.x;
        var cy = (ny !== null) ? (st.abs ? ny : cur.y + ny) : cur.y;
        var cz = (nz !== null) ? (st.abs ? nz : cur.z + nz) : cur.z;
        var R = st.cycleParams.R;
        var Q = st.cycleParams.Q;
        var topZ = (R !== undefined && !isNaN(R)) ? R : 0;
        pushMove('rapid', cx, cy, topZ);
        if (st.cycle === 'G83' || st.cycle === 'G73'){
          if (Q === undefined || !(Q > 0)){
            st.cycleIssues.push({line: li + 1, text: st.cycle + ' без Q — сверление одним заходом'});
            Q = Math.abs(cz);
          }
          var guard = 0, curZ = topZ;
          while (curZ > cz + 1e-6 && guard++ < 500){
            var nextZ = Math.max(curZ - Q, cz);
            pushMove('line', cx, cy, nextZ, {f: st.f});
            trackCut(moves[moves.length - 1]);
            if (nextZ > cz + 1e-6) pushMove('rapid', cx, cy, topZ);
            curZ = nextZ;
          }
        } else if (st.cycle === 'G84'){
          pushMove('line', cx, cy, cz, {f: st.f});
          trackCut(moves[moves.length - 1]);
          pushMove('line', cx, cy, topZ, {f: st.f});
        } else {
          pushMove('line', cx, cy, cz, {f: st.f});
          trackCut(moves[moves.length - 1]);
          pushMove('rapid', cx, cy, topZ);
        }
        st.x = cx; st.y = cy; st.z = topZ;
        cur.x = cx; cur.y = cy; cur.z = topZ;
      }
      continue;
    }
    if (!hasAxis) continue;
    var tx = (nx !== null) ? (st.abs ? nx : cur.x + nx) : cur.x;
    var ty = (ny !== null) ? (st.abs ? ny : cur.y + ny) : cur.y;
    var tz = (nz !== null) ? (st.abs ? nz : cur.z + nz) : cur.z;
    var motion = st.motion;
    if (motion === 'G0'){
      pushMove('rapid', tx, ty, tz);
      if (Math.hypot(tx - cur.x, ty - cur.y) > 1e-6 && tz < -0.001) st.rapidBelowSafe.push(st._line);
    } else if (motion === 'G2' || motion === 'G3'){
      var ii = (W.I !== undefined ? W.I * scale : 0);
      var jj = (W.J !== undefined ? W.J * scale : 0);
      var rr = (W.R !== undefined ? W.R * scale : 0);
      var ci = ii, cj = jj;
      if (rr && !ii && !jj){
        var chord = Math.hypot(tx - cur.x, ty - cur.y);
        var hh = Math.sqrt(Math.max(0, rr*rr - chord*chord/4));
        var mx = (cur.x + tx)/2, my = (cur.y + ty)/2;
        var ux = -(ty - cur.y)/chord, uy = (tx - cur.x)/chord;
        var sign = ((motion === 'G3') === (rr > 0)) ? 1 : -1;
        ci = mx + ux*hh*sign - cur.x;
        cj = my + uy*hh*sign - cur.y;
      }
      if (Math.abs(ci) < 1e-9 && Math.abs(cj) < 1e-9 && !rr){
        st.arcIssues.push({line: st._line, text: motion + ' без I/J/R'});
      } else {
        var rad2 = Math.hypot(ci, cj);
        var endDist = Math.hypot(tx - (cur.x + ci), ty - (cur.y + cj));
        if (rad2 > 0.0001 && Math.abs(endDist - rad2) > Math.max(0.05, rad2 * 0.02)){
          st.arcIssues.push({line: st._line, text:'конец дуги не лежит на окружности (Δ' + fmt(Math.abs(endDist - rad2), 3) + ' мм)'});
        }
      }
      pushMove('arc', tx, ty, tz, {i: ci, j: cj, dir: motion, f: st.f});
    } else {
      pushMove('line', tx, ty, tz, {f: st.f});
      if (motion === null) st.unknown.push(st._line);
    }
    var mvLast = moves[moves.length - 1];
    if (mvLast && (mvLast.t === 'line' || mvLast.t === 'arc')){
      if (tz < cur.z - 1e-6 && cur.z < 0) st.maxPassDrop = Math.max(st.maxPassDrop, cur.z - tz);
      trackCut(mvLast);
    }
    st.x = tx; st.y = ty; st.z = tz;
    cur.x = tx; cur.y = ty; cur.z = tz;
  }
  if (isFinite(bounds.minX)) st.bounds = bounds;
  /* макс. глубина за проход: по уровням Z режущих ходов */
  var lv = [];
  for (var lk in st.cutLevels) lv.push(parseFloat(lk));
  lv.sort(function(a, b){ return b - a; });
  st.passLevels = lv;
  for (var l2 = 1; l2 < lv.length; l2++){
    var drop = lv[l2-1] - lv[l2];
    if (drop > st.maxPassDrop) st.maxPassDrop = drop;
  }
  st.moves = moves;
  st.macroExpanded = expanded !== original;
  st.lastZ = cur.z;
  st.lastX = cur.x;
  st.lastY = cur.y;
  return st;
}

function parseGcode(text){
  return parseProgram(text).moves;
}

/* --------------------------- 10. Валидатор */
function validateGcode(text, cfg){
  var c = cfg || {};
  var st = parseProgram(text);
  var items = [];
  function add(id, label, status, detail){
    items.push({id: id, label: label, status: status, detail: detail || ''});
  }
  var errors = 0, warns = 0;
  function finish(list){
    for (var i = 0; i < list.length; i++){ if (list[i].status === 'error') errors++; else if (list[i].status === 'warn') warns++; }
    return {items: list, errors: errors, warnings: warns, ok: errors === 0, parsed: st};
  }
  if (!String(text || '').trim()){
    add('empty', 'Программа не пуста', 'error', 'G-код не сгенерирован.');
    return finish(items);
  }
  var hasEnd = (st.m30Line !== null) || (st.m2Line !== null);
  add('end', 'Конец программы (M30)', hasEnd ? 'ok' : 'error',
    hasEnd ? 'M30 на строке ' + (st.m30Line || st.m2Line) : 'Нет M30/M2 — контроллер не завершит программу корректно.');
  add('spindle', 'Запуск шпинделя (M3/M4 + S)', (st.spindleStarted && st.spindle > 0) ? 'ok' : 'error',
    st.spindleStarted ? 'S' + fmt(st.spindle, 0) + ' об/мин' : 'Нет M3/M4 с оборотами до реза.');
  add('units', 'Единицы и абсолютные координаты (G21, G90)', (st.hasG21 && st.hasG90) ? 'ok' : 'warn',
    (st.hasG21 ? '' : 'нет G21; ') + (st.hasG90 ? '' : 'нет G90'));
  var feedOk = st.f && st.f > 0;
  add('feed', 'Подача задана (F > 0)', feedOk ? 'ok' : 'error',
    feedOk ? 'F' + fmt(st.f, 0) + ' мм/мин' : 'Не найдена подача F. Контроллер может остановиться.');
  var minZ = numOr(c.minZ, -5);
  var cutZ = st.minCutZ;
  var zOk = !(st.cutCount > 0 && cutZ < minZ - 1e-6);
  add('zlimit', 'Рез не ниже лимита Z (' + fmt(minZ, 2) + ' мм)', zOk ? 'ok' : 'error',
    st.cutCount ? ('мин. Z реза: ' + fmt(cutZ, 3) + ' мм' + (zOk ? '' : ' — ниже лимита на строке ' + st.minCutZLine))
                : 'режущих ходов не найдено');
  var boundsOk = true, boundsDetail = 'проверка выключена';
  if (c.blank && c.blank.enabled && c.blank.w > 0 && c.blank.h > 0){
    var b = st.bounds;
    if (b){
      var tol = 0.01;
      boundsOk = b.minX >= -tol && b.minY >= -tol && b.maxX <= c.blank.w + tol && b.maxY <= c.blank.h + tol;
      boundsDetail = 'X ' + fmt(b.minX, 2) + '…' + fmt(b.maxX, 2) + ' | Y ' + fmt(b.minY, 2) + '…' + fmt(b.maxY, 2) +
        ' при поле ' + fmt(c.blank.w, 1) + '×' + fmt(c.blank.h, 1) + ' мм';
      if (!boundsOk) boundsDetail += ' — ВЫХОД ЗА ПОЛЕ';
    } else { boundsDetail = 'координат не найдено'; }
  }
  var blankGiven = !!(c.blank && c.blank.enabled && c.blank.w > 0 && c.blank.h > 0);
  add('bounds', 'В пределах поля заготовки', boundsOk ? (blankGiven ? 'ok' : 'info') : 'error', boundsDetail);
  var safeZ = numOr(c.safeZ, 5);
  add('safez', 'Безопасная Z выше заготовки', safeZ > 0 ? 'ok' : 'warn', 'Z' + fmt(safeZ, 2) + ' мм');
  add('rapid', 'Нет быстрых ходов ниже Z0', st.rapidBelowSafe.length === 0 ? 'ok' : 'warn',
    st.rapidBelowSafe.length ? 'строки: ' + st.rapidBelowSafe.slice(0, 6).join(', ') : 'всё чисто');
  add('arcs', 'Дуги корректны (I/J или R)', st.arcIssues.length === 0 ? 'ok' : 'error',
    st.arcIssues.length ? st.arcIssues.slice(0, 3).map(function(a){ return 'стр.' + a.line + ': ' + a.text; }).join('; ') : 'проверено');
  add('m5', 'Шпиндель остановлен (M5) до M30', (st.m5Line !== null) ? 'ok' : 'warn',
    st.m5Line ? 'M5 на строке ' + st.m5Line : 'нет M5 перед концом программы');
  add('comments', 'Скобки комментариев сбалансированы', st.unbalanced.length === 0 ? 'ok' : 'error',
    st.unbalanced.length ? 'строки: ' + st.unbalanced.slice(0, 6).join(', ') : 'ок');
  var toolD = numOr(c.toolD, 0);
  var passOk = true, passDetail = 'не проверялось';
  if (toolD > 0 && st.maxPassDrop > 0){
    passOk = st.maxPassDrop <= toolD * 1.5 + 1e-6;
    passDetail = 'макс. съём за проход ' + fmt(st.maxPassDrop, 2) + ' мм при Ø' + fmt(toolD, 1) + ' мм';
    if (!passOk) passDetail += ' — глубоко для этого инструмента';
  }
  add('pass', 'Глубина за проход разумна', passOk ? 'ok' : 'warn', passDetail);

  /* быстрый ход сквозь заготовку */
  var rapidThrough = [];
  if (blankGiven){
    var rect = {x1:0, y1:0, x2:c.blank.w, y2:c.blank.h};
    var prevMove = null;
    for (var mi = 0; mi < st.moves.length; mi++){
      var mm = st.moves[mi];
      if (mm.t === 'comment' || mm.t === 'dwell') continue;
      if (prevMove && mm.t === 'rapid' &&
          Math.hypot(mm.x - prevMove.x, mm.y - prevMove.y) > 1e-6 &&
          Math.min(mm.z, prevMove.z) < -0.001 &&
          segmentIntersectsRect(prevMove.x, prevMove.y, mm.x, mm.y, rect)){
        rapidThrough.push(mm.line);
      }
      prevMove = mm;
    }
  }
  add('rapidStock', 'Быстрый ход не проходит сквозь заготовку',
    rapidThrough.length ? 'error' : 'ok',
    blankGiven ? (rapidThrough.length ? 'строки: ' + rapidThrough.slice(0, 6).join(', ') : 'проверено')
               : 'поле заготовки не задано');

  /* микросегменты */
  var tiny = 0, segs = 0, prevTiny = null;
  for (var ti = 0; ti < st.moves.length; ti++){
    var tm = st.moves[ti];
    if (tm.t === 'comment' || tm.t === 'dwell') continue;
    if (prevTiny && tm.t === 'line'){
      segs++;
      var dxy = Math.hypot(tm.x - prevTiny.x, tm.y - prevTiny.y);
      var dz = Math.abs(tm.z - prevTiny.z);
      if (Math.hypot(dxy, dz) < 0.01) tiny++;
    }
    prevTiny = tm;
  }
  add('tiny', 'Нет лишних микросегментов', tiny > 20 ? 'warn' : 'ok',
    'сегментов < 0,01 мм: ' + tiny + ' из ' + segs);

  /* смена инструмента */
  if (st.toolChanges.length){
    var badTool = st.toolChanges.filter(function(t){ return t.z < -0.001; });
    var grblTool = (c.controller === 'grbl');
    add('toolchange', 'Смена инструмента безопасна', (badTool.length || grblTool) ? 'warn' : 'ok',
      badTool.length ? 'M6 на глубине Z на строках: ' + badTool.map(function(t){ return t.line; }).slice(0, 5).join(', ')
                     : (grblTool ? 'GRBL не поддерживает M6 — замените на M0 или смените постпроцессор' : 'M6 на безопасной высоте'));
  } else {
    add('toolchange', 'Смена инструмента безопасна', 'ok', 'M6 не используется');
  }

  /* разумность режимов */
  var modeOk = st.spindle <= 30000 && (!st.f || st.f <= 30000);
  add('modes', 'Режимы в разумных пределах', modeOk ? 'ok' : 'warn',
    'S' + fmt(st.spindle, 0) + ' об/мин, F' + fmt(st.f || 0, 0) + ' мм/мин');

  var extraChecks = c.extraChecks || [];
  for (var ec = 0; ec < extraChecks.length; ec++){
    var e = extraChecks[ec] || {};
    add(e.id || ('extra' + ec), e.label || 'Проверка сцены', e.status || 'warn', e.detail || '');
  }

  var est = c.estSec;
  add('time', 'Оценка времени', 'info', (est ? formatTime(est) : '—') + ' | строк: ' + st.lineCount + ' | резов: ' + st.cutCount);
  if (st.cycleIssues.length){
    add('cycle', 'Постоянные циклы', 'warn', st.cycleIssues.slice(0, 3).map(function(x){ return 'стр.' + x.line + ': ' + x.text; }).join('; '));
  }
  var gw = c.genWarnings || [];
  for (var i = 0; i < gw.length; i++) add('gen' + i, 'Генератор', 'warn', gw[i]);
  return finish(items);
}

/* --------------------------- 11. Калькулятор дуг */
function solveArc(sx, sy, ex, ey, rIn, dir){
  var chord = distance(sx, sy, ex, ey);
  if (chord < 1e-9) return {error: 'Начало и конец совпадают.'};
  var r;
  if (rIn !== null && rIn !== undefined && isFinite(rIn) && rIn > 0){
    r = rIn;
    if (r < chord/2 - 1e-6) return {error: 'R=' + fmt(r) + ' мм слишком мал. Минимум: ' + fmt(chord/2, 3) + ' мм.'};
  } else r = chord / 2;
  var mx = (sx + ex) / 2, my = (sy + ey) / 2;
  var dx = ex - sx, dy = ey - sy;
  var hChord = Math.sqrt(Math.max(0, r*r - (chord/2)*(chord/2)));
  var ux = -dy / chord, uy = dx / chord;
  var c1x = mx + ux * hChord, c1y = my + uy * hChord;
  var c2x = mx - ux * hChord, c2y = my - uy * hChord;
  function cross(cx, cy){ return (sx-cx)*(ey-cy) - (sy-cy)*(ex-cx); }
  var cx, cy;
  if (dir === 'G3'){ if (cross(c1x, c1y) > 0){ cx = c1x; cy = c1y; } else { cx = c2x; cy = c2y; } }
  else { if (cross(c1x, c1y) < 0){ cx = c1x; cy = c1y; } else { cx = c2x; cy = c2y; } }
  var I = cx - sx, J = cy - sy;
  var aS = Math.atan2(sy - cy, sx - cx);
  var aE = Math.atan2(ey - cy, ex - cx);
  var sweep;
  if (dir === 'G3'){ sweep = aE - aS; while (sweep <= 0) sweep += 2*Math.PI; }
  else { sweep = aS - aE; while (sweep <= 0) sweep += 2*Math.PI; }
  var sweepDeg = sweep * 180 / Math.PI;
  return {
    cx: cx, cy: cy, i: I, j: J, r: r, chord: chord,
    sweepDeg: sweepDeg, arcLen: r * sweep,
    line: dir + ' X' + fmt(ex) + ' Y' + fmt(ey) + ' I' + fmt(I) + ' J' + fmt(J),
    rLine: dir + ' X' + fmt(ex) + ' Y' + fmt(ey) + ' R' + fmt(r)
  };
}

/* --------------------------- 12. Резьба / сверление / растачивание */
function materialOf(key){
  var mats = (typeof TABLES !== 'undefined' && TABLES.materials) ? TABLES.materials : {};
  return mats[key] || mats.steel || {name:'Сталь', vc:80, fz:0.008, drillVc:25, drillFz:0.018, tapVc:8};
}

/* Калькулятор режимов резания (фреза) */
function calcFeeds(inp){
  var i = inp || {};
  var mat = materialOf(i.material);
  var D = Math.max(0.1, numOr(i.d, 3));
  var z = Math.max(1, Math.round(numOr(i.z, 2)));
  var op = i.op === 'finish' ? 'finish' : 'rough';
  var Vc = numOr(i.vc, mat.vc);
  var fz = Math.max(0.005, numOr(mat.fz, 0.02) * D);
  var S = Math.round(1000 * Vc / (Math.PI * D));
  S = clamp(S, 1000, 24000);
  if (op === 'finish') S = Math.min(24000, Math.round(S * 1.2));
  var F = Math.round(S * fz * z);
  if (op === 'finish') F = Math.round(F * 0.7);
  var Fz = Math.round(F * 0.3);
  var ap = op === 'rough' ? D * 0.5 : D * 0.15;
  var ae = op === 'rough' ? D * 0.6 : D * 0.1;
  return {
    S: S, F: Math.max(1, F), Fz: Math.max(1, Fz),
    ap: ap, ae: ae, fz: fz, Vc: Vc, z: z, D: D,
    op: op, material: mat.name,
    warnings: (S >= 24000 ? ['Обороты ограничены 24 000 — проверьте шпиндель.'] : [])
  };
}
function threadOf(size){
  var arr = (typeof TABLES !== 'undefined' && TABLES.threads) ? TABLES.threads : [];
  for (var i = 0; i < arr.length; i++) if (arr[i].size === size) return arr[i];
  return null;
}
function holeGrid(g){
  var rows = Math.max(1, Math.round(numOr(g.rows, 1)));
  var cols = Math.max(1, Math.round(numOr(g.cols, 1)));
  var dx = numOr(g.dx, 10), dy = numOr(g.dy, 10);
  var x0 = numOr(g.x0, 0), y0 = numOr(g.y0, 0);
  var out = [];
  for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) out.push({x: x0 + c*dx, y: y0 + r*dy});
  return out;
}
function parseHoleList(text){
  var out = [];
  var lines = String(text || '').split('\n');
  for (var i = 0; i < lines.length; i++){
    var nums = (lines[i].match(/-?\d*\.?\d+/g) || []).map(parseFloat);
    if (nums.length >= 2) out.push({x: nums[0], y: nums[1]});
  }
  return out;
}

function calcTapping(inp){
  var i = inp || {};
  var D = Math.max(0.5, numOr(i.d, 6));
  var P = Math.max(0.05, numOr(i.p, 1));
  var mat = materialOf(i.material);
  var warnings = [];
  var autoS = Math.round(1000 * mat.tapVc / (Math.PI * D));
  autoS = clamp(autoS, 50, 3000);
  var S = i.sManual ? clamp(numOr(i.s, autoS), 10, 6000) : autoS;
  var fmode = i.fmode || 'min';
  var F = fmode === 'rev' ? P : P * S;
  var depth = -Math.abs(numOr(i.depth, 10));
  var R = numOr(i.r, 2);
  var safeZ = numOr(i.safeZ, 5);
  if (depth > -0.1) warnings.push('Глубина резьбы должна быть отрицательной и не нулевой.');
  if (R <= 0) warnings.push('Плоскость R должна быть выше заготовки (R > 0).');
  if (R <= 1) warnings.push('R < 1 мм — мало места для выхода метчика.');
  if (numOr(i.d, 6) && P > D * 0.5) warnings.push('Шаг больше половины диаметра — проверьте резьбу.');
  var th = threadOf(i.thread);
  if (th && Math.abs(th.p - P) > 1e-6) warnings.push('Шаг ' + fmt(P, 2) + ' не совпадает с табличным для ' + th.size + ' (' + fmt(th.p, 2) + ').');
  if (fmode === 'rev') warnings.push('Подача в мм/об — в программу добавлен G95, проверьте поддержку контроллером.');
  var holes = i.holes && i.holes.length ? i.holes : [{x: numOr(i.x, 0), y: numOr(i.y, 0)}];
  var Fmin = fmode === 'rev' ? F * S : F;
  var timeSec = holes.length * (2 * Math.abs(depth) / Math.max(1, Fmin) * 60 + 0.4);
  var lines = [];
  lines.push('( Резьба ' + (th ? th.size : 'D' + fmt(D,1) + 'x' + fmt(P,2)) + ' — G84 )');
  lines.push(fmode === 'rev' ? 'G95' : 'G94');
  lines.push(fmode === 'rev' ? '( подача мм/об )' : '( подача мм/мин )');
  lines.push('G0 X' + fmt(holes[0].x) + ' Y' + fmt(holes[0].y) + ' Z' + fmt(safeZ));
  lines.push('M3 S' + fmt(S, 0));
  if (i.rigid){
    lines.push('M29 S' + fmt(S, 0));
    lines.push('( жёсткая синхронизация Fanuc )');
  }
  for (var h = 0; h < holes.length; h++){
    var prefix = h === 0 ? 'G84 ' : '';
    lines.push(prefix + 'X' + fmt(holes[h].x) + ' Y' + fmt(holes[h].y) + ' Z' + fmt(depth) +
      ' R' + fmt(R) + ' F' + fmt(F, 1));
  }
  lines.push('G80');
  lines.push('G0 Z' + fmt(safeZ));
  return {
    S: S, F: F, depth: depth, R: R, holes: holes.length, fmode: fmode,
    tapDrill: Math.max(0.1, D - P), timeSec: timeSec,
    warnings: warnings, lines: lines, code: lines.join('\n')
  };
}

function calcDrilling(inp){
  var i = inp || {};
  var D = Math.max(0.2, numOr(i.d, 3));
  var depth = -Math.abs(numOr(i.depth, 10));
  var R = numOr(i.r, 2);
  var safeZ = numOr(i.safeZ, 5);
  var mat = materialOf(i.material);
  var autoS = clamp(Math.round(1000 * mat.drillVc / (Math.PI * D)), 100, 24000);
  var S = i.sManual ? clamp(numOr(i.s, autoS), 50, 24000) : autoS;
  var fRev = Math.max(0.005, mat.drillFz * D / 3);
  var autoF = Math.round(S * fRev);
  var F = i.fManual ? Math.max(1, numOr(i.f, autoF)) : autoF;
  var cycle = i.cycle || 'G83';
  var Q = Math.max(0.05, Math.abs(numOr(i.q, Math.max(0.5, D * 0.8))));
  var P = Math.max(0, numOr(i.p, 0.5));
  var warnings = [];
  if (Q >= Math.abs(depth)) warnings.push('Peck Q ≥ глубины — будет один заход (эквивалент G81).');
  if (cycle === 'G83' && Q > D * 3) warnings.push('Q больше 3Ø — стружка будет плохо выводиться.');
  if (depth > -0.1) warnings.push('Глубина должна быть отрицательной.');
  if (R <= 0) warnings.push('Плоскость R должна быть выше заготовки.');
  if (numOr(i.f, 0) > S * 0.5) warnings.push('Подача мм/мин велика для сверления — проверьте.');
  var holes = i.holes && i.holes.length ? i.holes : [{x: numOr(i.x, 0), y: numOr(i.y, 0)}];
  var pecks = Math.max(1, Math.ceil(Math.abs(depth) / Q));
  var cutLen = Math.abs(depth) * holes.length;
  var timeSec = cutLen / Math.max(1, F) * 60 + holes.length * pecks * 0.25;
  var lines = [];
  lines.push('( Сверление Ø' + fmt(D, 2) + ' — ' + cycle + ' )');
  lines.push('G0 X' + fmt(holes[0].x) + ' Y' + fmt(holes[0].y) + ' Z' + fmt(safeZ));
  lines.push('M3 S' + fmt(S, 0));
  for (var h = 0; h < holes.length; h++){
    var prefix = h === 0 ? cycle + ' ' : '';
    var line = prefix + 'X' + fmt(holes[h].x) + ' Y' + fmt(holes[h].y) + ' Z' + fmt(depth) + ' R' + fmt(R);
    if (cycle === 'G83' || cycle === 'G73') line += ' Q' + fmt(Q, 2);
    if (cycle === 'G82' || cycle === 'G89') line += ' P' + fmt(P, 2);
    line += ' F' + fmt(F, 0);
    lines.push(line);
  }
  lines.push('G80');
  lines.push('G0 Z' + fmt(safeZ));
  return {
    S: S, F: F, depth: depth, R: R, Q: Q, pecks: pecks, holes: holes.length,
    timeSec: timeSec, warnings: warnings, lines: lines, code: lines.join('\n'),
    tapDrill: Math.max(0.1, D)
  };
}

function calcBoring(inp){
  var i = inp || {};
  var D = Math.max(1, numOr(i.d, 20));
  var depth = -Math.abs(numOr(i.depth, 20));
  var R = numOr(i.r, 2);
  var safeZ = numOr(i.safeZ, 5);
  var Q = Math.max(0.01, Math.abs(numOr(i.q, 0.2)));
  var P = Math.max(0, numOr(i.p, 0.5));
  var S = clamp(numOr(i.s, 600), 50, 6000);
  var F = Math.max(0.5, numOr(i.f, Math.round(S * 0.08)));
  var warnings = [];
  if (Q <= 0) warnings.push('Смещение Q должно быть больше нуля.');
  if (R >= 0 && R < 1) warnings.push('R < 1 мм — риск задевания дна.');
  if (depth > -0.1) warnings.push('Глубина должна быть отрицательной.');
  if (P > 5) warnings.push('Пауза P > 5 — проверьте единицы (с или мс).');
  var holes = i.holes && i.holes.length ? i.holes : [{x: numOr(i.x, 0), y: numOr(i.y, 0)}];
  var timeSec = holes.length * (2 * Math.abs(depth) / Math.max(1, F) * 60 + P);
  var lines = [];
  lines.push('( Тонкое растачивание Ø' + fmt(D, 2) + ' — G76 )');
  lines.push('( Q=' + fmt(Q, 2) + ' мм — смещение резца на дне; P=' + fmt(P, 2) + ' — пауза )');
  lines.push('G0 X' + fmt(holes[0].x) + ' Y' + fmt(holes[0].y) + ' Z' + fmt(safeZ));
  lines.push('M3 S' + fmt(S, 0));
  for (var h = 0; h < holes.length; h++){
    var prefix = h === 0 ? 'G76 ' : '';
    lines.push(prefix + 'X' + fmt(holes[h].x) + ' Y' + fmt(holes[h].y) + ' Z' + fmt(depth) +
      ' R' + fmt(R) + ' Q' + fmt(Q, 2) + ' P' + fmt(P, 2) + ' F' + fmt(F, 0));
  }
  lines.push('G80');
  lines.push('G0 Z' + fmt(safeZ));
  return {S: S, F: F, depth: depth, R: R, Q: Q, P: P, holes: holes.length, timeSec: timeSec, warnings: warnings, lines: lines, code: lines.join('\n')};
}

/* --------------------------- 12a2. Наружная резьба фрезой */
/**
 * Наружная (охватывающая) резьба концевой/резьбовой фрезой.
 * Фреза обходит цилиндр снаружи по винтовой линии; за проход
 * радиальная глубина увеличивается от наружного диаметра к впадине.
 */
function calcExternalThread(inp){
  var i = inp || {};
  var D = Math.max(0.5, Math.abs(numOr(i.d, 10)));
  var P = Math.max(0.05, Math.abs(numOr(i.p, 1.5)));
  var len = Math.max(0.1, Math.abs(numOr(i.len, 20)));
  var toolD = Math.max(0.1, Math.abs(numOr(i.toolD, 3)));
  var pass = Math.max(0.02, Math.abs(numOr(i.pass, 0.1)));
  var hand = i.hand === 'left' ? 'left' : 'right';
  var S = clamp(Math.round(numOr(i.s, 6000)), 100, 30000);
  var F = Math.max(1, Math.round(numOr(i.f, 300)));
  var Fz = Math.max(1, Math.round(numOr(i.fz, 100)));
  var safeZ = numOr(i.safeZ, 5);
  var topZ = numOr(i.topZ, 0);
  var h = 0.6134 * P;
  var rMajor = D / 2;
  var rMinor = rMajor - h;
  var rStart = rMajor + toolD / 2;
  var rEnd = rMinor + toolD / 2;
  var nPass = Math.max(1, Math.min(200, Math.ceil(h / pass)));
  var dir = hand === 'left' ? 'G3' : 'G2';
  var warnings = [];

  if (rMinor <= 0.1) warnings.push('Глубина профиля ' + fmt(h, 3) + ' мм больше радиуса резьбы — проверьте диаметр и шаг.');
  if (toolD > D) warnings.push('Ø фрезы ' + fmt(toolD, 2) + ' мм больше наружного диаметра резьбы — проверьте зазоры.');
  if (len < P) warnings.push('Длина резьбы меньше шага — получится неполный виток.');
  if (pass > h) warnings.push('Съём за проход больше глубины профиля — будет один проход.');
  if (toolD < P * 0.6) warnings.push('Фреза тоньше 0,6 шага — возможен изгиб; для резьбы лучше специальная резьбовая фреза.');

  function line(x, y, z, f){
    var s = 'G1 X' + fmt(x) + ' Y' + fmt(y) + ' Z' + fmt(z);
    if (f) s += ' F' + fmt(f, 0);
    return s;
  }
  function arc(dirCode, x, y, z, ii, jj, f){
    var s = dirCode + ' X' + fmt(x) + ' Y' + fmt(y) + ' Z' + fmt(z) +
      ' I' + fmt(ii) + ' J' + fmt(jj);
    if (f) s += ' F' + fmt(f, 0);
    return s;
  }

  var lines = [];
  lines.push('( НАРУЖНАЯ РЕЗЬБА ' + fmt(D, 2) + '×' + fmt(P, 2) + ' — ФРЕЗЕРОВАНИЕ )');
  lines.push('( ' + (hand === 'left' ? 'левая' : 'правая') + ' резьба, ' + dir +
    '; профиль h=' + fmt(h, 3) + ' мм; фреза Ø' + fmt(toolD, 2) + ' мм; проходов ' + nPass + ' )');
  lines.push('( R наружный=' + fmt(rMajor, 3) + '; R впадины=' + fmt(rMinor, 3) +
    '; R траектории=' + fmt(rEnd, 3) + ' )');
  lines.push('G0 Z' + fmt(safeZ));
  lines.push('M3 S' + fmt(S, 0));

  for (var pi = 1; pi <= nPass; pi++){
    var R = rStart + (rEnd - rStart) * pi / nPass;
    lines.push('( проход ' + pi + '/' + nPass + ', R=' + fmt(R, 3) + ' )');
    lines.push('G0 X' + fmt(R) + ' Y0 Z' + fmt(safeZ));
    lines.push(line(R, 0, topZ, Fz));
    var z = topZ;
    var firstArc = true;
    var full = Math.floor(len / P + 1e-9);
    for (var rev = 0; rev < full; rev++){
      var zMid = z - P / 2;
      var zEnd = z - P;
      if (dir === 'G2'){
        lines.push(arc('G2', -R, 0, zMid, -R, 0, firstArc ? F : 0));
        lines.push(arc('G2', R, 0, zEnd, R, 0, 0));
      } else {
        lines.push(arc('G3', -R, 0, zMid, -R, 0, firstArc ? F : 0));
        lines.push(arc('G3', R, 0, zEnd, R, 0, 0));
      }
      firstArc = false;
      z = zEnd;
    }
    var rem = len - full * P;
    if (rem > 1e-6){
      var sweep = 2 * Math.PI * rem / P;
      var zEnd2 = z - rem;
      if (sweep > Math.PI + 1e-9){
        var zHalf = z - rem / 2;
        if (dir === 'G2') lines.push(arc('G2', -R, 0, zHalf, -R, 0, firstArc ? F : 0));
        else lines.push(arc('G3', -R, 0, zHalf, -R, 0, firstArc ? F : 0));
        var ey = (dir === 'G3' ? 1 : -1) * R * Math.sin(sweep);
        var ex = R * Math.cos(sweep);
        if (dir === 'G2') lines.push(arc('G2', ex, ey, zEnd2, R, 0, 0));
        else lines.push(arc('G3', ex, ey, zEnd2, R, 0, 0));
      } else {
        var ey2 = (dir === 'G3' ? 1 : -1) * R * Math.sin(sweep);
        var ex2 = R * Math.cos(sweep);
        if (dir === 'G2') lines.push(arc('G2', ex2, ey2, zEnd2, -R, 0, firstArc ? F : 0));
        else lines.push(arc('G3', ex2, ey2, zEnd2, -R, 0, firstArc ? F : 0));
      }
    }
    lines.push('G0 Z' + fmt(safeZ));
  }

  var cutLen = 0;
  for (var p2 = 1; p2 <= nPass; p2++){
    var rr = rStart + (rEnd - rStart) * p2 / nPass;
    cutLen += 2 * Math.PI * rr * (len / P);
  }
  var timeSec = cutLen / Math.max(1, F) * 60 + nPass * (2 * Math.abs(safeZ - topZ) / Math.max(1, Fz) * 60);

  return {
    D: D, P: P, len: len, h: h, toolD: toolD, pass: pass, nPass: nPass,
    rMajor: rMajor, rMinor: rMinor, rStart: rStart, rEnd: rEnd,
    hand: hand, S: S, F: F, Fz: Fz, timeSec: timeSec,
    warnings: warnings, lines: lines, code: lines.join('\n')
  };
}

/* --------------------------- 12b. Параметрическое программирование */
function paramRound(v){
  return v < 0 ? -Math.round(-v) : Math.round(v);
}
/**
 * Вычисляет выражение в синтаксисе Macro B: #100, SIN[30], SQRT[#1],
 * ATAN[#1]/[#2], MOD, EQ/NE/GT/LT/GE/LE, AND/OR/XOR.
 * Возвращает {value, missing}. Бросает Error при синтаксисе/делении на 0.
 */
function paramEval(expr, vars){
  var s = String(expr === null || expr === undefined ? '' : expr);
  var values = vars || {};
  var missing = [];
  var i = 0, tokens = [];
  function err(msg){
    throw new Error(msg + ' (символ ' + (i + 1) + ')');
  }
  while (i < s.length){
    var ch = s.charAt(i);
    if (/\s/.test(ch)){ i++; continue; }
    if (ch === '#'){
      var mv = /^#(\d+)/.exec(s.slice(i));
      if (!mv) err('После # нужен номер переменной');
      tokens.push({t:'var', v:+mv[1]});
      i += mv[0].length;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s.charAt(i + 1)))){
      var mn = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      tokens.push({t:'num', v:parseFloat(mn[0])});
      i += mn[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)){
      var mi = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
      tokens.push({t:'id', v:mi[0].toUpperCase()});
      i += mi[0].length;
      continue;
    }
    if ('+-*/()[]^'.indexOf(ch) >= 0){
      tokens.push({t:ch});
      i++;
      continue;
    }
    err('Неизвестный символ «' + ch + '»');
  }
  tokens.push({t:'eof'});
  var pos = 0;
  function peek(t){ return tokens[pos] && tokens[pos].t === t; }
  function peekId(v){ return tokens[pos] && tokens[pos].t === 'id' && tokens[pos].v === v; }
  function next(){ return tokens[pos++]; }
  function expect(t){
    if (!peek(t)) err('Ожидалось «' + t + '»');
    return next();
  }
  function deg(radians){ return radians * 180 / Math.PI; }
  function applyFunc(name, x){
    if (name === 'SIN') return Math.sin(rad(x));
    if (name === 'COS') return Math.cos(rad(x));
    if (name === 'TAN') return Math.tan(rad(x));
    if (name === 'ASIN'){
      if (x < -1 || x > 1) throw new Error('ASIN: аргумент вне [-1; 1]');
      return deg(Math.asin(x));
    }
    if (name === 'ACOS'){
      if (x < -1 || x > 1) throw new Error('ACOS: аргумент вне [-1; 1]');
      return deg(Math.acos(x));
    }
    if (name === 'ATAN') return deg(Math.atan(x));
    if (name === 'ABS') return Math.abs(x);
    if (name === 'SQRT'){
      if (x < 0) throw new Error('SQRT: отрицательный аргумент');
      return Math.sqrt(x);
    }
    if (name === 'ROUND') return paramRound(x);
    if (name === 'FIX') return Math.floor(x);
    if (name === 'FUP') return Math.ceil(x);
    if (name === 'LN'){
      if (x <= 0) throw new Error('LN: аргумент должен быть > 0');
      return Math.log(x);
    }
    if (name === 'EXP') return Math.exp(x);
    throw new Error('Неизвестная функция ' + name);
  }
  function parseExpr(){ return parseOr(); }
  function parseOr(){
    var v = parseXor();
    while (peekId('OR')){ next(); var r = parseXor(); v = (v !== 0 || r !== 0) ? 1 : 0; }
    return v;
  }
  function parseXor(){
    var v = parseAnd();
    while (peekId('XOR')){ next(); var r = parseAnd(); v = ((v !== 0) !== (r !== 0)) ? 1 : 0; }
    return v;
  }
  function parseAnd(){
    var v = parseCompare();
    while (peekId('AND')){ next(); var r = parseCompare(); v = (v !== 0 && r !== 0) ? 1 : 0; }
    return v;
  }
  function parseCompare(){
    var v = parseAdd();
    var t = tokens[pos];
    if (t && t.t === 'id' && ({EQ:1, NE:1, GT:1, LT:1, GE:1, LE:1})[t.v]){
      var op = next().v;
      var r = parseAdd();
      if (op === 'EQ') return v === r ? 1 : 0;
      if (op === 'NE') return v !== r ? 1 : 0;
      if (op === 'GT') return v > r ? 1 : 0;
      if (op === 'LT') return v < r ? 1 : 0;
      if (op === 'GE') return v >= r ? 1 : 0;
      return v <= r ? 1 : 0;
    }
    return v;
  }
  function parseAdd(){
    var v = parseMul();
    while (peek('+') || peek('-')){
      var op = next().t, r = parseMul();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseMul(){
    var v = parseUnary();
    while (peek('*') || peek('/') || peekId('MOD')){
      var op = next();
      var r = parseUnary();
      if (op.t === '*') v = v * r;
      else if (op.t === '/'){
        if (Math.abs(r) < 1e-12) throw new Error('Деление на ноль');
        v = v / r;
      } else {
        if (Math.abs(r) < 1e-12) throw new Error('MOD: деление на ноль');
        v = v % r;
      }
    }
    return v;
  }
  function parseUnary(){
    if (peek('+')){ next(); return parseUnary(); }
    if (peek('-')){ next(); return -parseUnary(); }
    return parsePower();
  }
  function parsePower(){
    var v = parsePrimary();
    if (peek('^')){
      next();
      var r = parseUnary();
      v = Math.pow(v, r);
    }
    return v;
  }
  function parsePrimary(){
    var t = tokens[pos];
    if (!t) err('Неожиданный конец выражения');
    if (t.t === 'num'){ pos++; return t.v; }
    if (t.t === 'var'){
      pos++;
      if (values[t.v] === undefined || values[t.v] === null){
        missing.push(t.v);
        return 0;
      }
      return numOr(values[t.v], 0);
    }
    if (t.t === '('){ pos++; var v = parseExpr(); expect(')'); return v; }
    if (t.t === '['){ pos++; var v2 = parseExpr(); expect(']'); return v2; }
    if (t.t === 'id'){
      pos++;
      var name = t.v;
      if (name === 'PI') return Math.PI;
      if (name === 'TRUE') return 1;
      if (name === 'FALSE') return 0;
      if (name === 'ATAN'){
        var open = tokens[pos] && tokens[pos].t;
        if (open !== '[' && open !== '(') err('ATAN требует [угол]');
        pos++;
        var y = parseExpr();
        expect(open === '[' ? ']' : ')');
        if (peek('/')){
          var save = pos;
          pos++;
          var open2 = tokens[pos] && tokens[pos].t;
          if (open2 === '[' || open2 === '('){
            pos++;
            var x = parseExpr();
            expect(open2 === '[' ? ']' : ')');
            return deg(Math.atan2(y, x));
          }
          pos = save;
        }
        return deg(Math.atan(y));
      }
      var open3 = tokens[pos] && tokens[pos].t;
      if (open3 !== '[' && open3 !== '(') err('Функция ' + name + ' требует аргумент в [ ]');
      pos++;
      var arg = parseExpr();
      expect(open3 === '[' ? ']' : ')');
      return applyFunc(name, arg);
    }
    err('Неожиданный токен');
  }
  var result = parseExpr();
  if (!peek('eof')) err('Лишние символы в выражении');
  if (!isFinite(result)) throw new Error('Результат не является числом');
  return {value: result, missing: missing};
}
function evalParamExpr(expr, vars){
  return paramEval(expr, vars).value;
}

function pvar(no, val, comment){
  var text = (typeof val === 'string') ? val : fmt(val, 3);
  return '#' + no + ' = ' + text + (comment ? '    (' + comment + ')' : '');
}
function pnum(v, dec){ return fmt(numOr(v, 0), dec === undefined ? 3 : dec); }
function parFmt(v, dec){ return fmt(numOr(v, 0), dec === undefined ? 2 : dec); }

var PARAM_MODES = {
  bolt: {
    name: 'Отверстия по окружности',
    icon: '◎',
    fields: [
      {k:'cx', label:'Центр X, мм', def:0, step:1, tip:'Центр окружности, по которой располагаются отверстия.'},
      {k:'cy', label:'Центр Y, мм', def:0, step:1, tip:'Центр окружности по Y.'},
      {k:'radius', label:'Радиус, мм', def:40, min:0.1, step:1, tip:'Радиус болтовой окружности.'},
      {k:'count', label:'Отверстий', def:6, min:1, step:1, tip:'Количество отверстий. Угловой шаг = 360 / количество.'},
      {k:'angle', label:'Начальный угол, °', def:0, step:15, tip:'Угол первого отверстия от оси X.'},
      {k:'dia', label:'Ø сверла, мм', def:5, min:0.1, step:0.1, tip:'Диаметр сверла для расчёта и подписи.'},
      {k:'depth', label:'Глубина, мм', def:-6, max:0, step:0.5, tip:'Отрицательная глубина от Z0.'},
      {k:'r', label:'Плоскость R, мм', def:2, step:0.5, tip:'Высота выхода из отверстия.'},
      {k:'q', label:'Peck Q, мм', def:2, min:0.1, step:0.5, tip:'Глубина одного захода для G83.'},
      {k:'cycle', label:'Цикл', type:'select', def:'G83', options:[['G83','G83 — с выводом'],['G81','G81 — обычное']], tip:'G83 для глубоких отверстий, G81 для неглубоких.'},
      {k:'s', label:'Обороты S', def:1500, min:50, step:50, tip:'Обороты шпинделя.'},
      {k:'f', label:'Подача F, мм/мин', def:150, min:1, step:10, tip:'Подача сверления.'}
    ],
    build: function(v){
      var cx = numOr(v.cx, 0), cy = numOr(v.cy, 0);
      var radius = Math.max(0.1, numOr(v.radius, 40));
      var count = Math.max(1, Math.round(numOr(v.count, 6)));
      var angle = numOr(v.angle, 0);
      var dia = Math.max(0.1, numOr(v.dia, 5));
      var depth = -Math.abs(numOr(v.depth, 6));
      var rp = numOr(v.r, 2);
      var q = Math.max(0.05, Math.abs(numOr(v.q, 2)));
      var cycle = v.cycle === 'G81' ? 'G81' : 'G83';
      var s = Math.max(1, Math.round(numOr(v.s, 1500)));
      var f = Math.max(1, Math.round(numOr(v.f, 150)));
      var warnings = [];
      if (count > 360) warnings.push('Больше 360 отверстий — проверьте количество.');
      if (depth > -0.01) warnings.push('Глубина должна быть отрицательной.');
      if (rp <= 0) warnings.push('Плоскость R должна быть выше заготовки.');
      if (cycle === 'G83' && q >= Math.abs(depth)) warnings.push('Q ≥ глубины — будет один заход.');
      var lines = [
        '( ПАРАМЕТРИЧЕСКИ: ОТВЕРСТИЯ ПО ОКРУЖНОСТИ )',
        pvar(100, cx, 'центр X'),
        pvar(101, cy, 'центр Y'),
        pvar(102, radius, 'радиус'),
        pvar(103, count, 'отверстий'),
        pvar(104, angle, 'начальный угол'),
        pvar(105, depth, 'глубина'),
        pvar(106, rp, 'плоскость R'),
        pvar(107, q, 'peck Q'),
        pvar(112, s, 'обороты'),
        pvar(113, f, 'подача'),
        pvar(108, 1, 'счётчик (первое уже просверлено)'),
        'G0 X[#100 + #102 * COS[#104]] Y[#101 + #102 * SIN[#104]] Z' + parFmt(v.safeZ, 2),
        'M3 S#112',
        cycle + ' Z#105 R#106' + (cycle === 'G83' ? ' Q#107' : '') + ' F#113',
        'WHILE [#108 LT #103] DO 1',
        '  #109 = #104 + 360 / #103 * #108',
        '  #110 = #100 + #102 * COS[#109]',
        '  #111 = #101 + #102 * SIN[#109]',
        '  X#110 Y#111',
        '  #108 = #108 + 1',
        'END 1',
        'G80',
        'G0 Z' + parFmt(v.safeZ, 2)
      ];
      var holes = [];
      for (var i = 0; i < count; i++){
        var a = rad(angle + 360 / count * i);
        holes.push({x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a)});
      }
      var drill = calcDrilling({d:dia, depth:depth, r:rp, q:q, cycle:cycle, holes:holes,
        s:s, f:f, sManual:true, fManual:true, safeZ:v.safeZ});
      warnings = warnings.concat(drill.warnings);
      return {snippet: lines.join('\n'), numeric: drill.lines.join('\n'),
        title:'ПАРАМЕТРИКА: ОТВЕРСТИЯ ПО ОКРУЖНОСТИ',
        summary: count + ' отв. Ø' + parFmt(dia, 1) + ' по R' + parFmt(radius, 1) +
          ' · шаг ' + parFmt(360 / count, 1) + '° · ' + cycle,
        warnings: warnings, vars: ['#100…#113']};
    }
  },
  grid: {
    name: 'Сетка отверстий',
    icon: '▦',
    fields: [
      {k:'x0', label:'X первого, мм', def:10, step:1, tip:'Координата X первого отверстия.'},
      {k:'y0', label:'Y первого, мм', def:10, step:1, tip:'Координата Y первого отверстия.'},
      {k:'cols', label:'Колонок', def:4, min:1, step:1, tip:'Количество отверстий по X.'},
      {k:'rows', label:'Рядов', def:3, min:1, step:1, tip:'Количество рядов по Y.'},
      {k:'dx', label:'Шаг по X, мм', def:20, step:1, tip:'Расстояние между отверстиями по X.'},
      {k:'dy', label:'Шаг по Y, мм', def:15, step:1, tip:'Расстояние между рядами по Y.'},
      {k:'dia', label:'Ø сверла, мм', def:5, min:0.1, step:0.1, tip:'Диаметр сверла.'},
      {k:'depth', label:'Глубина, мм', def:-6, max:0, step:0.5, tip:'Отрицательная глубина сверления.'},
      {k:'r', label:'Плоскость R, мм', def:2, step:0.5, tip:'Высота выхода из отверстия.'},
      {k:'q', label:'Peck Q, мм', def:2, min:0.1, step:0.5, tip:'Глубина одного захода.'},
      {k:'cycle', label:'Цикл', type:'select', def:'G83', options:[['G83','G83 — с выводом'],['G81','G81 — обычное']], tip:'Постоянный цикл сверления.'},
      {k:'s', label:'Обороты S', def:1500, min:50, step:50, tip:'Обороты шпинделя.'},
      {k:'f', label:'Подача F, мм/мин', def:150, min:1, step:10, tip:'Подача сверления.'}
    ],
    build: function(v){
      var x0 = numOr(v.x0, 0), y0 = numOr(v.y0, 0);
      var cols = Math.max(1, Math.round(numOr(v.cols, 4)));
      var rows = Math.max(1, Math.round(numOr(v.rows, 3)));
      var dx = numOr(v.dx, 20), dy = numOr(v.dy, 15);
      var dia = Math.max(0.1, numOr(v.dia, 5));
      var depth = -Math.abs(numOr(v.depth, 6));
      var rp = numOr(v.r, 2);
      var q = Math.max(0.05, Math.abs(numOr(v.q, 2)));
      var cycle = v.cycle === 'G81' ? 'G81' : 'G83';
      var s = Math.max(1, Math.round(numOr(v.s, 1500)));
      var f = Math.max(1, Math.round(numOr(v.f, 150)));
      var warnings = [];
      if (cols * rows > 1000) warnings.push('Больше 1000 отверстий — проверьте сетку.');
      if (depth > -0.01) warnings.push('Глубина должна быть отрицательной.');
      if (dx === 0 || dy === 0) warnings.push('Шаг по X/Y не должен быть нулевым.');
      var lines = [
        '( ПАРАМЕТРИЧЕСКИ: СЕТКА ОТВЕРСТИЙ )',
        pvar(100, x0, 'X первого'),
        pvar(101, y0, 'Y первого'),
        pvar(102, cols, 'колонок'),
        pvar(103, rows, 'рядов'),
        pvar(104, dx, 'шаг X'),
        pvar(105, dy, 'шаг Y'),
        pvar(106, depth, 'глубина'),
        pvar(107, rp, 'плоскость R'),
        pvar(108, q, 'peck Q'),
        pvar(113, s, 'обороты'),
        pvar(114, f, 'подача'),
        'G0 X#100 Y#101 Z' + parFmt(v.safeZ, 2),
        'M3 S#113',
        cycle + ' Z#106 R#107' + (cycle === 'G83' ? ' Q#108' : '') + ' F#114',
        pvar(109, 0, 'ряд'),
        pvar(110, 1, 'колонка (первая уже просверлена)'),
        'WHILE [#109 LT #103] DO 1',
        '  WHILE [#110 LT #102] DO 2',
        '    #111 = #100 + #110 * #104',
        '    #112 = #101 + #109 * #105',
        '    X#111 Y#112',
        '    #110 = #110 + 1',
        '  END 2',
        '  #110 = 0',
        '  #109 = #109 + 1',
        'END 1',
        'G80',
        'G0 Z' + parFmt(v.safeZ, 2)
      ];
      var holes = holeGrid({rows:rows, cols:cols, dx:dx, dy:dy, x0:x0, y0:y0});
      var drill = calcDrilling({d:dia, depth:depth, r:rp, q:q, cycle:cycle, holes:holes,
        s:s, f:f, sManual:true, fManual:true, safeZ:v.safeZ});
      warnings = warnings.concat(drill.warnings);
      return {snippet: lines.join('\n'), numeric: drill.lines.join('\n'),
        title:'ПАРАМЕТРИКА: СЕТКА ОТВЕРСТИЙ',
        summary: cols + '×' + rows + ' = ' + (cols * rows) + ' отв. Ø' + parFmt(dia, 1) +
          ' · шаг ' + parFmt(dx, 1) + '×' + parFmt(dy, 1) + ' · ' + cycle,
        warnings: warnings, vars: ['#100…#114']};
    }
  },
  frame: {
    name: 'Рамка по контуру',
    icon: '▭',
    fields: [
      {k:'cx', label:'Центр X, мм', def:45, step:1, tip:'Центр рамки по X.'},
      {k:'cy', label:'Центр Y, мм', def:30, step:1, tip:'Центр рамки по Y.'},
      {k:'w', label:'Ширина, мм', def:60, min:1, step:1, tip:'Наружная ширина рамки.'},
      {k:'h', label:'Высота, мм', def:40, min:1, step:1, tip:'Наружная высота рамки.'},
      {k:'depth', label:'Глубина, мм', def:-2, max:0, step:0.5, tip:'Итоговая глубина реза.'},
      {k:'pass', label:'За проход, мм', def:0.5, min:0.05, step:0.1, tip:'Съём за один проход.'},
      {k:'s', label:'Обороты S', def:12000, min:100, step:500, tip:'Обороты шпинделя.'},
      {k:'f', label:'Подача F, мм/мин', def:800, min:1, step:50, tip:'Рабочая подача.'},
      {k:'fz', label:'Врезание Fz, мм/мин', def:200, min:1, step:10, tip:'Подача вертикального врезания.'}
    ],
    build: function(v){
      var cx = numOr(v.cx, 45), cy = numOr(v.cy, 30);
      var w = Math.max(1, Math.abs(numOr(v.w, 60)));
      var h = Math.max(1, Math.abs(numOr(v.h, 40)));
      var depth = -Math.abs(numOr(v.depth, 2));
      var pass = Math.max(0.05, Math.abs(numOr(v.pass, 0.5)));
      var s = Math.max(1, Math.round(numOr(v.s, 12000)));
      var f = Math.max(1, Math.round(numOr(v.f, 800)));
      var fz = Math.max(1, Math.round(numOr(v.fz, 200)));
      var nPass = Math.max(1, Math.ceil(Math.abs(depth) / pass));
      var warnings = [];
      if (depth > -0.01) warnings.push('Глубина должна быть отрицательной.');
      var lines = [
        '( ПАРАМЕТРИЧЕСКИ: РАМКА С ПРОХОДАМИ )',
        pvar(100, cx, 'центр X'),
        pvar(101, cy, 'центр Y'),
        pvar(102, w, 'ширина'),
        pvar(103, h, 'высота'),
        pvar(104, depth, 'глубина'),
        pvar(105, pass, 'за проход'),
        pvar(106, nPass, 'проходов'),
        pvar(109, w / 2, 'полуширина'),
        pvar(110, h / 2, 'полувысота'),
        pvar(111, s, 'обороты'),
        pvar(112, f, 'подача'),
        pvar(113, fz, 'врезание'),
        'G0 X[#100 - #109] Y[#101 - #110] Z' + parFmt(v.safeZ, 2),
        'M3 S#111',
        pvar(107, 1, 'проход'),
        'WHILE [#107 LE #106] DO 1',
        '  #108 = #104 * #107 / #106',
        '  G1 Z#108 F#113',
        '  G1 X[#100 + #109] F#112',
        '  G1 Y[#101 + #110]',
        '  G1 X[#100 - #109]',
        '  G1 Y[#101 - #110]',
        '  #107 = #107 + 1',
        'END 1',
        'G0 Z' + parFmt(v.safeZ, 2)
      ];
      var num = ['( Рамка ' + parFmt(w, 1) + '×' + parFmt(h, 1) + ' — ' + nPass + ' проход(ов) )'];
      num.push('G0 X' + pnum(cx - w/2) + ' Y' + pnum(cy - h/2) + ' Z' + pnum(v.safeZ));
      num.push('M3 S' + s);
      for (var p = 1; p <= nPass; p++){
        var z = -Math.abs(depth) * p / nPass;
        num.push('G1 Z' + pnum(z) + ' F' + fz);
        num.push('G1 X' + pnum(cx + w/2) + ' F' + f);
        num.push('G1 Y' + pnum(cy + h/2));
        num.push('G1 X' + pnum(cx - w/2));
        num.push('G1 Y' + pnum(cy - h/2));
      }
      num.push('G0 Z' + pnum(v.safeZ));
      return {snippet: lines.join('\n'), numeric: num.join('\n'),
        title:'ПАРАМЕТРИКА: РАМКА',
        summary: 'Рамка ' + parFmt(w, 1) + '×' + parFmt(h, 1) + ' · ' + nPass + ' проход(ов) до Z' + parFmt(depth, 2),
        warnings: warnings, vars: ['#100…#113']};
    }
  },
  circle: {
    name: 'Окружность по точкам',
    icon: '○',
    fields: [
      {k:'cx', label:'Центр X, мм', def:50, step:1, tip:'Центр окружности по X.'},
      {k:'cy', label:'Центр Y, мм', def:50, step:1, tip:'Центр окружности по Y.'},
      {k:'radius', label:'Радиус, мм', def:25, min:0.5, step:1, tip:'Радиус траектории.'},
      {k:'segments', label:'Сегментов', def:72, min:8, step:8, tip:'Сколько прямых отрезков аппроксимируют окружность.'},
      {k:'depth', label:'Глубина, мм', def:-2, max:0, step:0.5, tip:'Итоговая глубина реза.'},
      {k:'pass', label:'За проход, мм', def:0.5, min:0.05, step:0.1, tip:'Съём за один проход.'},
      {k:'s', label:'Обороты S', def:12000, min:100, step:500, tip:'Обороты шпинделя.'},
      {k:'f', label:'Подача F, мм/мин', def:800, min:1, step:50, tip:'Рабочая подача.'},
      {k:'fz', label:'Врезание Fz, мм/мин', def:200, min:1, step:10, tip:'Подача врезания.'}
    ],
    build: function(v){
      var cx = numOr(v.cx, 50), cy = numOr(v.cy, 50);
      var radius = Math.max(0.5, Math.abs(numOr(v.radius, 25)));
      var segs = Math.round(clamp(numOr(v.segments, 72), 8, 720));
      var depth = -Math.abs(numOr(v.depth, 2));
      var pass = Math.max(0.05, Math.abs(numOr(v.pass, 0.5)));
      var s = Math.max(1, Math.round(numOr(v.s, 12000)));
      var f = Math.max(1, Math.round(numOr(v.f, 800)));
      var fz = Math.max(1, Math.round(numOr(v.fz, 200)));
      var nPass = Math.max(1, Math.ceil(Math.abs(depth) / pass));
      var warnings = [];
      if (depth > -0.01) warnings.push('Глубина должна быть отрицательной.');
      var lines = [
        '( ПАРАМЕТРИЧЕСКИ: ОКРУЖНОСТЬ ' + segs + ' СЕГМЕНТОВ )',
        pvar(100, cx, 'центр X'),
        pvar(101, cy, 'центр Y'),
        pvar(102, radius, 'радиус'),
        pvar(103, segs, 'сегментов'),
        pvar(104, depth, 'глубина'),
        pvar(105, pass, 'за проход'),
        pvar(106, nPass, 'проходов'),
        pvar(111, s, 'обороты'),
        pvar(112, f, 'подача'),
        pvar(113, fz, 'врезание'),
        'G0 X[#100 + #102] Y#101 Z' + parFmt(v.safeZ, 2),
        'M3 S#111',
        pvar(107, 1, 'проход'),
        'WHILE [#107 LE #106] DO 1',
        '  #108 = #104 * #107 / #106',
        '  G1 Z#108 F#113',
        pvar(109, 1, 'точка (старт уже на угле 0)'),
        '  WHILE [#109 LE #103] DO 2',
        '    #110 = 360 / #103 * #109',
        '    G1 X[#100 + #102 * COS[#110]] Y[#101 + #102 * SIN[#110]] F#112',
        '    #109 = #109 + 1',
        '  END 2',
        '  #107 = #107 + 1',
        'END 1',
        'G0 Z' + parFmt(v.safeZ, 2)
      ];
      var num = ['( Окружность R' + parFmt(radius, 1) + ' — ' + nPass + ' проход(ов) )'];
      num.push('G0 X' + pnum(cx + radius) + ' Y' + pnum(cy) + ' Z' + pnum(v.safeZ));
      num.push('M3 S' + s);
      for (var p = 1; p <= nPass; p++){
        var z = -Math.abs(depth) * p / nPass;
        num.push('G1 Z' + pnum(z) + ' F' + fz);
        for (var k = 1; k <= segs; k++){
          var a = rad(360 / segs * k);
          num.push('G1 X' + pnum(cx + radius * Math.cos(a)) + ' Y' + pnum(cy + radius * Math.sin(a)) + ' F' + f);
        }
      }
      num.push('G0 Z' + pnum(v.safeZ));
      return {snippet: lines.join('\n'), numeric: num.join('\n'),
        title:'ПАРАМЕТРИКА: ОКРУЖНОСТЬ',
        summary: 'R' + parFmt(radius, 1) + ' · ' + segs + ' сегментов · ' + nPass + ' проход(ов) до Z' + parFmt(depth, 2),
        warnings: warnings, vars: ['#100…#113']};
    }
  }
};

function paramModeDefaults(mode){
  var def = PARAM_MODES[mode] || PARAM_MODES.bolt;
  var out = {};
  for (var i = 0; i < def.fields.length; i++) out[def.fields[i].k] = def.fields[i].def;
  return out;
}

/**
 * Строит параметрическую и числовую версии программы.
 * opts: safeZ, controller, asciiComments, wcs, useM6, toolNumber.
 */
function buildParametric(mode, values, opts){
  var o = opts || {};
  var def = PARAM_MODES[mode];
  if (!def) return {error:'Неизвестный шаблон: ' + mode};
  var v = Object.assign({}, paramModeDefaults(mode), values || {});
  v.safeZ = numOr(o.safeZ, 5);
  var r;
  try { r = def.build(v); }
  catch (e){ return {error:e.message}; }
  var ascii = !!o.asciiComments;
  var snippet = ascii ? translit(r.snippet) : r.snippet;
  var numeric = ascii ? translit(r.numeric) : r.numeric;
  var wrapOpts = Object.assign({}, o, {safeZ:v.safeZ});
  return {
    mode: mode, def: def, values: v,
    snippet: snippet, numeric: numeric,
    code: wrapSnippet(snippet, r.title, wrapOpts),
    numericCode: wrapSnippet(numeric, r.title, wrapOpts),
    title: r.title, summary: r.summary, warnings: r.warnings || [], vars: r.vars || []
  };
}

function wrapSnippet(snippet, title, opts){
  var o = opts || {};
  var ctrl = o.controller || 'universal';
  var ascii = !!o.asciiComments;
  var usePercent = (ctrl === 'fanuc' || ctrl === 'linuxcnc' || ctrl === 'mach3');
  var lines = [];
  if (usePercent) lines.push('%');
  if (ctrl === 'fanuc' || ctrl === 'linuxcnc') lines.push('O0001 (PROGRAM)');
  lines.push('(' + sanitizeComment(title || 'SNIPPET', ascii) + ')');
  lines.push('G21');
  lines.push('G90');
  lines.push('G17');
  lines.push('G94');
  if (/^G5[4-9]$/.test(o.wcs || '')) lines.push(o.wcs);
  if (o.useM6 && o.toolNumber){
    lines.push('T' + o.toolNumber + ' M6');
    lines.push('G43 H' + o.toolNumber);
  }
  lines.push('G0 Z' + fmt(numOr(o.safeZ, 5)));
  lines.push(snippet);
  lines.push('M5');
  lines.push('G0 Z' + fmt(numOr(o.safeZ, 5)));
  if (o.returnHome !== false) lines.push('G0 X0 Y0');
  lines.push('M30');
  if (usePercent) lines.push('%');
  return lines.join('\n');
}

/* --------------------------- 13. Шаблоны сцен */
function templateScene(blankW, blankH, items){
  var els = [];
  for (var i = 0; i < items.length; i++){
    var it = items[i];
    var el = {
      id: 'el' + (i + 1),
      type: it.type,
      enabled: true,
      rot: it.rot || 0,
      tool: it.tool || 1,
      mirrorX: !!it.mirrorX,
      mirrorY: !!it.mirrorY,
      depth: (it.depth === null || it.depth === undefined || it.depth === '') ? null : numOr(it.depth, null),
      zProfile: Z_PROFILES[it.zProfile] ? it.zProfile : 'flat',
      z1: numOr(it.z1, -1),
      z2: numOr(it.z2, -3),
      zSteps: Math.round(clamp(numOr(it.zSteps, 4), 2, 64)),
      params: Object.assign(elementDefaults(it.type), it.params || {}),
      place: {mode: 'center', x: blankW/2 + (it.ox || 0), y: blankH/2 + (it.oy || 0)}
    };
    els.push(el);
  }
  return {blank: {enabled: true, w: blankW, h: blankH, thickness: 5}, elements: els};
}

function defaultScene(){
  return templateScene(80, 50, [
    {type:'rect', params:{w:66, h:38}},
    {type:'text', params:{text:'G-CODE', height:8, align:'center'}, oy: 6},
    {type:'circle', params:{d:12}, oy: -8}
  ]);
}

var SCENE_TEMPLATES = [
  {id:'frame', name:'Рамка + надпись + круг', build: defaultScene},
  {id:'hex', name:'Шестигранная табличка', build: function(){
    return templateScene(70, 60, [
      {type:'poly', params:{sides:6, d:56, rot:0}},
      {type:'text', params:{text:'МЕТАЛЛ', height:7, align:'center'}}
    ]);
  }},
  {id:'star', name:'Звезда', build: function(){
    return templateScene(60, 60, [
      {type:'star', params:{points:5, od:50, id:21, rot:0}},
      {type:'text', params:{text:'2026', height:6, align:'center'}, oy:-2}
    ]);
  }},
  {id:'spiral', name:'Спираль', build: function(){
    return templateScene(60, 60, [
      {type:'spiral', params:{r0:2, r1:26, turns:5, dir:'ccw'}}
    ]);
  }},
  {id:'sine', name:'Синусоида', build: function(){
    return templateScene(100, 40, [
      {type:'sine', params:{length:80, amp:8, periods:3}},
      {type:'rect', params:{w:92, h:30}}
    ]);
  }},
  {id:'pocket', name:'Карман по контуру + текст', build: function(){
    return templateScene(80, 50, [
      {type:'pocket', params:{profile:'rect', w:50, h:30}},
      {type:'text', params:{text:'POCKET', height:6, align:'center'}}
    ]);
  }},
  {id:'holes', name:'Плита с отверстиями', build: function(){
    return templateScene(100, 70, [
      {type:'rect', params:{w:90, h:60}},
      {type:'holes', params:{rows:3, cols:4, dx:20, dy:16, d:4, depth:-4, peck:2}},
      {type:'text', params:{text:'BASE', height:6, align:'center'}, oy:-26}
    ]);
  }},
  {id:'inverse', name:'Обратная гравировка', build: function(){
    return templateScene(70, 40, [
      {type:'inv', params:{profile:'rect', w:40, h:20, margin:3}},
      {type:'text', params:{text:'INV', height:8, align:'center', inverse:false}}
    ]);
  }},
  {id:'heights', name:'Рельеф: разные высоты', build: function(){
    return templateScene(90, 40, [
      {type:'rect', params:{w:20, h:14}, ox:-30, depth:-1},
      {type:'rect', params:{w:20, h:14}, depth:-2.5},
      {type:'star', params:{points:5, od:20, id:9, rot:0}, ox:30, zProfile:'slopeX', z1:-1, z2:-3},
      {type:'text', params:{text:'Z', height:9, align:'center'}, oy:-13, zProfile:'stepsX', z1:-0.5, z2:-1.5, zSteps:3}
    ]);
  }}
];

/* --------------------------- 14. Сборка программы из сцены */
function buildProgram(scene, options){
  var o = options || {};
  var tp = buildToolpaths(scene, o);
  var used = tp.toolsUsed || [];
  var first = used[0] || null;
  var toolNumber = first ? first.no : (o.useM6 ? numOr(o.toolNum, 1) : null);
  var useM6 = !!((first && o.useTools) || o.useM6);
  var meta = {
    title: o.title || 'G-CODE / UNIVERSAL',
    controller: o.controller || 'universal',
    coolant: !!o.coolant,
    spindle: first ? Math.max(0, numOr(first.s, 0)) : numOr(o.spindle, 12000),
    safeZ: numOr(o.safeZ, 5),
    toolD: first ? Math.max(0.1, numOr(first.d, 3)) : numOr(o.toolD, 3),
    blank: (scene && scene.blank) || {enabled:false, w:0, h:0},
    asciiComments: !!o.asciiComments,
    returnHome: o.returnHome !== false,
    wcs: o.wcs || '',
    arcMode: o.arcMode === 'r' ? 'r' : 'ij',
    decimals: clamp(Math.round(numOr(o.decimals, 3)), 0, 4),
    useM6: useM6,
    toolNumber: toolNumber,
    customHeader: o.customHeader || '',
    customFooter: o.customFooter || '',
    percent: !!o.percent,
    lineNumbers: !!o.lineNumbers,
    feed: first ? numOr(first.f, o.F) : numOr(o.F, 800)
  };
  var gcode = emitProgram(tp.moves, meta, o);
  return {
    moves: tp.moves, groups: tp.groups, warnings: tp.warnings,
    levels: tp.levels, nPasses: tp.nPasses, meta: meta,
    toolsUsed: used, heights: tp.heights || [], gcode: gcode
  };
}
