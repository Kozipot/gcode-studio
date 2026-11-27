/* ============================================================================
   ui.js — интерфейс. Зависит от core.js и данных GLYPHS/TABLES.
   ========================================================================== */
(function(){
'use strict';

var $ = function(id){ return document.getElementById(id); };
function num(id){ var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }
function esc(s){
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
var NS = 'http://www.w3.org/2000/svg';
var PALETTE = ['#ff6b35','#4ade80','#4a90d9','#c084fc','#fbbf24','#22d3ee','#fb7185','#a3e635','#f472b6','#38bdf8','#facc15','#2dd4bf'];

/* ---------------------------------------------------------------- тултипы */
var TIPS = {
  engrMode: 'Текст — свободная надпись. Выражение — посчитать число и выгравировать его.',
  engrKind: 'Обычная гравировка режет по штрихам букв. Обратная снимает фон вокруг букв — надпись остаётся выпуклой. Для обратной нужны диаметр инструмента и шаг растра.',
  engrText: 'Латиница A–Z и кириллица А–Я, цифры, знаки . , : ; - + = / ? ! №. Enter — новая строка. Строчные буквы автоматически становятся прописными.',
  calcExpr: 'Арифметика: цифры, + - * / и скобки. Результат гравируется как число.',
  engrSize: 'Высота прописных букв в мм. Ширина символа примерно 0,7 высоты, межбуквенный интервал добавляется автоматически.',
  engrAlign: 'Что означает точка X0/Y0: левый край надписи, её центр или правый край.',
  blankEnabled: 'Включает поле заготовки: оно рисуется на превью и валидатор проверяет, что инструмент не выходит за границы.',
  blankW: 'Ширина заготовки в мм. Используется для проверки выхода за поле и отрисовки.',
  blankH: 'Высота заготовки в мм.',
  blankT: 'Толщина заготовки — справочно для расчёта лимита Z. Сам лимит задаётся в параметрах обработки.',
  templateSel: 'Готовые примеры: рамка с надписью и кругом, шестигранник, звезда, спираль, синусоида, карман, плита с отверстиями, обратная гравировка.',
  addType: 'Тип новой фигуры. Можно собрать несколько элементов: контур + текст + карман + отверстия.',
  t84Thread: 'Таблица метрических резьб: подставит номинальный диаметр, шаг и сверло под резьбу.',
  t84D: 'Номинальный диаметр резьбы. Вместе с шагом определяет подачу метчика.',
  t84P: 'Шаг резьбы в мм. Для G84 подача F = P × S (мм/мин).',
  t84Depth: 'Глубина резьбы: отрицательное значение от Z0 (поверхности). Для сквозного отверстия берите глубину с запасом.',
  t84R: 'Плоскость R — высота, с которой цикл начинает работу. Должна быть выше заготовки, обычно 2–5 мм.',
  t84Mat: 'Материал влияет на рекомендуемые обороты метчика (скорость резания).',
  t84S: 'Обороты шпинделя для метчика. Обычно 300–800 об/мин; с авто-режимом считается по материалу.',
  t84Fmode: 'мм/мин — подача F = P × S (G94). мм/об — F = P и нужна подача G95; проверьте поддержку контроллером.',
  t84Auto: 'Рассчитать обороты по скорости резания материала. Снимите галочку, чтобы задать S вручную.',
  t84Rigid: 'M29 S… — жёсткая синхронизация шпинделя и подачи (Fanuc/Haas). Включайте только если станок поддерживает.',
  t83D: 'Диаметр сверла. От него зависят рекомендуемые обороты и подача.',
  t83Depth: 'Глубина сверления: отрицательное значение от Z0.',
  t83R: 'Плоскость R — откуда начинается цикл. Выше заготовки на 2–5 мм.',
  t83Q: 'Глубина одного захода (peck) при G83. Для стали 0,5–1 Ø, для алюминия до 2 Ø, для глубоких отверстий меньше.',
  t83Cycle: 'G83 — полный вывод стружки на каждом заходе. G73 — высокоскоростной. G81 — обычное сверление. G82 — с паузой на дне.',
  t83P: 'Пауза на дне отверстия для G82/G89, в секундах.',
  t83Mat: 'Материал для автоматического расчёта оборотов и подачи.',
  t83S: 'Обороты шпинделя. В авто-режиме поле обновляется по материалу и диаметру.',
  t83F: 'Подача сверления в мм/мин. В авто-режиме считается как подача на оборот × S.',
  t83Auto: 'Автоматически рассчитать S и F по материалу и диаметру. Снимите галочку для ручного ввода.',
  t76D: 'Диаметр растачиваемого отверстия.',
  t76Depth: 'Глубина растачивания, отрицательная от Z0.',
  t76R: 'Плоскость R — начало цикла выше заготовки.',
  t76Q: 'Смещение резца на дне (положительное). Для Fanuc — радиус смещения в мм.',
  t76P: 'Пауза «выхаживания» на дне. Единицы (секунды или миллисекунды) зависят от контроллера — сверьтесь с документацией.',
  t76S: 'Обороты шпинделя при растачивании.',
  t76F: 'Подача растачивания в мм/мин. Обычно небольшая — 30–80 мм/мин.',
  tExtD: 'Наружный диаметр резьбы по вершинам профиля. Для M10 это 10 мм.',
  tExtThread: 'Выбери стандартную метрическую резьбу — диаметр и шаг подставятся автоматически.',
  tExtP: 'Шаг резьбы. Глубина профиля считается как 0,6134·P.',
  tExtLen: 'Длина нарезаемой резьбы от Z0 вниз. Программа делает винтовую интерполяцию на эту глубину.',
  tExtTool: 'Диаметр резьбовой фрезы. От него зависит радиус траектории: R = D/2 − h + Øфрезы/2.',
  tExtPass: 'Радиальный съём за один проход от наружного диаметра к впадине. Меньше — больше проходов и чище резьба.',
  tExtHand: 'Правая резьба — обход G2, левая — G3. Проверьте направление вращения шпинделя и тип фрезы.',
  tExtS: 'Обороты шпинделя для резьбовой фрезы. Для твердосплавной фрезы в алюминии обычно 5000–10000 об/мин.',
  tExtF: 'Подача винтовой интерполяции в мм/мин. Начинайте с небольшой и проверяйте нагрузку.',
  tExtFz: 'Подача вертикального врезания перед винтовой интерполяцией.',
  hRows: 'Количество рядов отверстий по Y.',
  hCols: 'Количество колонок отверстий по X.',
  hDx: 'Шаг между отверстиями по X.',
  hDy: 'Шаг между отверстиями по Y.',
  hX0: 'X первого отверстия сетки.',
  hY0: 'Y первого отверстия сетки.',
  importCode: 'Вставьте любой G-код. Он будет разобран, отрисован и проверен чек-листом (M30, лимит Z, дуги, подачи).',
  spindle: 'Обороты шпинделя S. Для гравировки 10000–18000 об/мин, для фрезеровки — по материалу и диаметру.',
  feed: 'Рабочая подача F в мм/мин.',
  plungeFeed: 'Подача вертикального врезания. Обычно 20–30 % от рабочей подачи.',
  depth: 'Итоговая глубина реза, отрицательная от Z0. Число проходов = глубина / за проход.',
  depthPass: 'Съём материала за один проход. Для гравировки можно всю глубину за раз, для фрезеровки — по 0,3–0,5 Ø.',
  safeZ: 'Высота безопасных перемещений над заготовкой. Должна быть выше струбцин и самой детали.',
  x0: 'Начало координат детали по X. Для гравировки — точка привязки надписи.',
  y0: 'Начало координат детали по Y. Для гравировки — низ первой строки.',
  toolDiam: 'Диаметр фрезы. Влияет на карман, обратную гравировку и проверку глубины за проход.',
  matType: 'Материал заготовки. От него зависит скорость резания Vc и подача на зуб.',
  matOp: 'Черновая — большой съём (ap ≈ 0,5 Ø), чистовая — меньшая глубина и выше обороты.',
  matD: 'Диаметр фрезы для расчёта оборотов и подачи.',
  matZ: 'Число зубьев фрезы. Подача F = S × fz × z.',
  stepover: 'Шаг растра при кармане и обратной гравировке — 30–50 % от диаметра фрезы.',
  ramp: 'Длина плавного входа (рампы) для замкнутых контуров. 0 — вертикальное врезание. Рампа снижает нагрузку на фрезу и риск поломки.',
  optimize: 'Сортировать элементы и пути по ближайшей точке, чтобы сократить быстрые ходы. Порядок в G-коде может отличаться от списка.',
  arrCols: 'Сколько копий элементов создать по X.',
  arrRows: 'Сколько копий элементов создать по Y.',
  arrDx: 'Шаг копий по X, мм.',
  arrDy: 'Шаг копий по Y, мм.',
  minZ: 'Ниже этого Z валидатор считает рез опасным и блокирует скачивание. Ставьте с запасом от толщины заготовки.',
  controller: 'Постпроцессор: проценты, номера строк и формат комментариев под выбранный контроллер.',
  wcs: 'Рабочая система координат G54–G59, которая будет вставлена после G90. «Не указывать» — оставить текущую на станке.',
  arcMode: 'I/J — дуга задаётся центром, R — радиусом. R удобнее для ручной правки, I/J надёжнее для полных окружностей.',
  decimals: 'Сколько знаков после запятой выводить в координатах. Для станков с дискретностью 0,001 обычно 3.',
  toolNum: 'Номер инструмента для M6 и G43 H… в шапке программы.',
  useM6: 'Добавить в шапку T… M6 и G43 H… — смену инструмента и коррекцию длины.',
  customHeader: 'Произвольные строки после настройки и безопасной Z. Поддерживаются токены {TITLE}, {DATE}, {TIME}, {TOOL}, {S}, {F}, {SAFE_Z}, {BLANK}, {WCS}.',
  customFooter: 'Произвольные строки перед M5 — например, вызов макроса или дополнительный цикл.',
  percent: 'Обрамлять программу знаком % (Fanuc/LinuxCNC/Mach3).',
  lineNumbers: 'Нумеровать строки N10, N20… Для отладки на стойках Fanuc/LinuxCNC.',
  returnHome: 'В конце программы вернуться в X0 Y0. Снимите, если возврат делает оператор.',
  useTools: 'Включить библиотеку инструментов: у каждого элемента свой T, диаметр, S и F. Перед сменой выполняется безопасный подъём и M6.',
  coolant: 'Добавить M8 в начало и M9 в конец программы (СОЖ/обдув).',
  asciiComments: 'Транслитерировать комментарии в латиницу — для контроллеров, не любящих UTF-8 (например GRBL).',
  fileName: 'Имя скачиваемого файла. Расширение .nc добавится при необходимости.',
  output: 'Итоговая программа. Её можно править вручную, проверять и скачивать — скачивание доступно, если чек-лист без ошибок.',
  arcSx: 'X начала дуги.',
  arcSy: 'Y начала дуги.',
  arcFull: 'Полный круг 360°: начальная точка одновременно является конечной. Центр задаётся полями X/Y, в G-код пойдут I/J.',
  arcCx: 'X центра полного круга. Радиус считается как расстояние от начальной точки до центра.',
  arcCy: 'Y центра полного круга. Радиус считается как расстояние от начальной точки до центра.',
  arcEx: 'X конца дуги.',
  arcEy: 'Y конца дуги.',
  arcR: 'Радиус дуги. Пусто — половина хорды, то есть полуокружность.',
  arcDir: 'G3 — против часовой стрелки, G2 — по часовой.',
  imageFile: 'PNG или JPEG. Файл читается локально в браузере и не отправляется на сервер; в проект сохраняются только настройки.',
  imageMode: '«Точками» — отдельные точки-врезания по сетке. «Строками» — растровые проходы по строкам, как на гравировальном станке.',
  imageWidth: 'Ширина картинки в миллиметрах. Высота пересчитывается по пропорциям, если включена галочка.',
  imageHeight: 'Высота картинки в миллиметрах. При сохранении пропорций меняется вместе с шириной.',
  imageAspect: 'Сохранять пропорции исходной картинки: ширина и высота пересчитываются автоматически.',
  imageRes: 'Сколько точек на миллиметр по ширине. Больше — детальнее, но длиннее G-код и дольше обработка.',
  imageLineStep: 'Расстояние между строками для режима «Строками». Меньше — чище картинка, но больше проходов.',
  imageThreshold: 'Порог яркости 0–255: пиксели темнее порога гравируются. Для светлой картинки поможет инверсия.',
  imageDither: 'Floyd–Steinberg или Atkinson распределяют ошибку яркости — лучше передают полутона точками. «Нет» — простой порог.',
  imageInvert: 'Инвертировать: гравировать светлые участки вместо тёмных.',
  imageDepth: 'Глубина Z за один проход. Обычно -0,2…-1 мм для гравировки.',
  imageFeed: 'Рабочая подача по XY для строк и точек, мм/мин.',
  imagePlunge: 'Подача вертикального врезания, мм/мин.',
  imageSafeZ: 'Безопасная высота подъёма между точками и строками, мм.',
  paramExpr: 'Выражение Macro B: #переменные, + − * / ^ MOD, функции SIN/COS/TAN/ATAN/ABS/SQRT/ROUND/FIX/FUP/LN/EXP, сравнения EQ/NE/GT/LT/GE/LE и логика AND/OR/XOR. Углы в градусах.',
  paramMode: 'Готовый параметрический шаблон: отверстия по окружности, сетка, рамка с проходами или окружность по точкам.',
  paramView: 'Параметрическая версия содержит #переменные и WHILE для Fanuc/Haas/LinuxCNC. Числовая — готовые координаты, её можно проверить и скачать. GRBL макросы не поддерживает.',
  zScale: 'Вертикальное преувеличение в 3D. 1× — реальные пропорции, 5–10× — лучше видно глубину резания. На саму программу не влияет.'
};

var tipbox = $('tipbox');
function tipTextFor(el){
  if (el.dataset.tipText) return el.dataset.tipText;
  if (el.dataset.tipFor) return TIPS[el.dataset.tipFor] || '';
  if (el.dataset.tip) return TIPS[el.dataset.tip] || el.dataset.tip;
  return '';
}
function showTip(el){
  var text = tipTextFor(el);
  if (!text) return;
  tipbox.textContent = text;
  tipbox.classList.add('show');
  var r = el.getBoundingClientRect();
  var bw = tipbox.offsetWidth, bh = tipbox.offsetHeight;
  var left = clampNum(r.left + r.width / 2 - bw / 2, 8, window.innerWidth - bw - 8);
  var top = r.top - bh - 9;
  if (top < 8) top = r.bottom + 9;
  tipbox.style.left = left + 'px';
  tipbox.style.top = top + 'px';
}
function hideTip(){ tipbox.classList.remove('show'); }
function clampNum(v, a, b){ return Math.max(a, Math.min(b, v)); }

function initTips(){
  var labels = document.querySelectorAll('label[for]');
  for (var i = 0; i < labels.length; i++){
    var label = labels[i];
    var id = label.getAttribute('for');
    if (!TIPS[id] || label.querySelector('.q')) continue;
    var icon = document.createElement('i');
    icon.className = 'q';
    icon.textContent = '?';
    icon.setAttribute('data-tip-for', id);
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('role', 'button');
    icon.setAttribute('aria-label', 'Подсказка');
    label.appendChild(icon);
  }
  document.addEventListener('mouseover', function(e){
    var t = e.target.closest('[data-tip-for],[data-tip-text],[data-tip]');
    if (t) showTip(t);
  });
  document.addEventListener('mouseout', function(e){
    var t = e.target.closest('[data-tip-for],[data-tip-text],[data-tip]');
    if (t) hideTip();
  });
  document.addEventListener('focusin', function(e){
    var t = e.target.closest('[data-tip-for],[data-tip-text],[data-tip]');
    if (t) showTip(t);
  });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
}

/* ---------------------------------------------------------------- состояние */
var state = {
  tab: 'engrave',
  scene: null,
  threadTab: 't84',
  thread: {},
  check: null,
  lastProgram: null,
  lastScene: null,
  lastWarnings: null,
  arc: null,
  importCode: null,
  programSource: null,
  manualEdit: false,
  zOpen: {},
  paramVars: [
    { no: 100, name: 'R', expr: '40' },
    { no: 101, name: 'N', expr: '6' },
    { no: 102, name: 'ANGLE', expr: '0' },
    { no: 103, name: 'DEPTH', expr: '-6' }
  ],
  paramMode: 'bolt',
  paramValues: {},
  paramView: 'param',
  paramResult: null,
  preview3d: false,
  zScale: 3,
  cam3d: { yaw: -Math.PI / 4, pitch: Math.PI / 7, zoom: 1, panX: 0, panY: 0 },
  scene3d: null,
  lastPreview: { moves: [], options: {} },
  image: null,
  imageTimer: null,
  lastImage: null,
  tools: [{no:1, name:'Фреза Ø3', d:3, flutes:2, s:12000, f:800, fz:200}]
};

/* ---------------------------------------------------------------- параметры */
var MAIN_IDS = ['engrMode','engrKind','engrText','calcExpr','engrSize','engrAlign',
  'spindle','feed','plungeFeed','depth','depthPass','safeZ','x0','y0','toolDiam','stepover','ramp',
  'minZ','controller','coolant','asciiComments','optimize',
  'wcs','arcMode','decimals','useM6','toolNum','customHeader','customFooter','percent','lineNumbers','returnHome'];

function readParams(){
  return {
    safeZ: num('safeZ'),
    F: Math.max(1, num('feed')),
    Fz: Math.max(1, num('plungeFeed')),
    depth: num('depth'),
    passDepth: num('depthPass'),
    toolD: Math.max(0.1, num('toolDiam')),
    stepover: Math.max(0.1, num('stepover')),
    originX: num('x0'),
    originY: num('y0'),
    spindle: Math.max(0, num('spindle')),
    controller: $('controller').value,
    coolant: $('coolant').checked,
    asciiComments: $('asciiComments').checked,
    optimize: $('optimize') ? $('optimize').checked : true,
    ramp: Math.max(0, num('ramp')),
    wcs: $('wcs') ? $('wcs').value : '',
    arcMode: $('arcMode') ? $('arcMode').value : 'ij',
    decimals: $('decimals') ? clampNum(Math.round(num('decimals')), 0, 4) : 3,
    useM6: $('useM6') ? $('useM6').checked : false,
    toolNum: $('toolNum') ? Math.max(1, Math.round(num('toolNum'))) : 1,
    customHeader: $('customHeader') ? $('customHeader').value : '',
    customFooter: $('customFooter') ? $('customFooter').value : '',
    percent: $('percent') ? $('percent').checked : false,
    lineNumbers: $('lineNumbers') ? $('lineNumbers').checked : false,
    returnHome: $('returnHome') ? $('returnHome').checked : true,
    useTools: $('useTools') ? $('useTools').checked : false,
    tools: state.tools,
    minZ: num('minZ')
  };
}

function safeEval(expr){
  if (!/^[\d+\-*/().\s]+$/.test(expr)) throw new Error('Только цифры и + - * / ( )');
  var r = Function('"use strict";return (' + expr + ')')();
  if (typeof r !== 'number' || !isFinite(r)) throw new Error('Ошибка вычисления');
  return r;
}
function calcText(){
  try { return fmt(safeEval($('calcExpr').value), 4); }
  catch (e) { return '0'; }
}
function currentEngrText(){
  return $('engrMode').value === 'calc' ? calcText() : ($('engrText').value || '');
}

/* ---------------------------------------------------------------- генерация */
var genTimer = null;
function scheduleGenerate(){
  if (state.tab !== 'engrave' && state.tab !== 'scene') return;
  clearTimeout(genTimer);
  genTimer = setTimeout(generate, 280);
}

function engraveScene(){
  var p = readParams();
  var text = currentEngrText();
  return {
    blank: { enabled: false, w: 0, h: 0, thickness: 0 },
    elements: [{
      type: 'text',
      enabled: true,
      rot: 0,
      params: {
        text: text,
        height: Math.max(1, num('engrSize')),
        align: $('engrAlign').value,
        inverse: $('engrKind').value === 'inverse'
      },
      place: { mode: 'abs', x: p.originX, y: p.originY }
    }]
  };
}

function syncBlank(){
  if (!state.scene) return;
  state.scene.blank = {
    enabled: $('blankEnabled').checked,
    w: Math.max(1, num('blankW')),
    h: Math.max(1, num('blankH')),
    thickness: Math.max(0.1, num('blankT'))
  };
}
function syncBlankInputs(){
  var b = state.scene.blank || {enabled:true, w:80, h:50, thickness:5};
  $('blankEnabled').checked = b.enabled !== false;
  $('blankW').value = b.w || 80;
  $('blankH').value = b.h || 50;
  $('blankT').value = b.thickness || 5;
}

/* ---------------------------------------------------------------- проект: undo + автосохранение */
var PROJECT_FIELDS = ['engrMode','engrKind','engrText','calcExpr','engrSize','engrAlign',
  'spindle','feed','plungeFeed','depth','depthPass','safeZ','x0','y0','toolDiam','stepover','ramp',
  'minZ','controller','coolant','asciiComments','optimize','arrCols','arrRows','arrDx','arrDy',
  'wcs','arcMode','decimals','useM6','toolNum','customHeader','customFooter','percent','lineNumbers',
  'returnHome','useTools',
  'imageMode','imageWidth','imageHeight','imageAspect','imageRes','imageLineStep','imageThreshold',
  'imageDither','imageInvert','imageDepth','imageFeed','imagePlunge','imageSafeZ'];
var STORAGE_KEY = 'gcodeStudio.project.v1';
var store = null;
try { store = window.localStorage; } catch (e){ store = null; }
var history = {stack: [], index: -1, applying: false};
var histTimer = null, saveTimer = null;

function normalizeScene(sc){
  if (!sc || !Array.isArray(sc.elements)) return defaultScene();
  var out = {blank: Object.assign({enabled:true, w:80, h:50, thickness:5}, sc.blank || {}), elements: []};
  for (var i = 0; i < sc.elements.length; i++){
    var e = sc.elements[i];
    if (!e || !ELEMENT_TYPES[e.type]) continue;
    out.elements.push({
      type: e.type,
      enabled: e.enabled !== false,
      rot: numOr(e.rot, 0),
      tool: e.tool !== undefined && e.tool !== null ? e.tool : 1,
      mirrorX: !!e.mirrorX,
      mirrorY: !!e.mirrorY,
      depth: (e.depth === null || e.depth === undefined || e.depth === '') ? null : numOr(e.depth, null),
      zProfile: Z_PROFILES[e.zProfile] ? e.zProfile : 'flat',
      z1: numOr(e.z1, -1),
      z2: numOr(e.z2, -3),
      zSteps: clampNum(Math.round(numOr(e.zSteps, 4)), 2, 64),
      params: Object.assign(elementDefaults(e.type), e.params || {}),
      place: Object.assign({mode:'center', x:0, y:0}, e.place || {})
    });
  }
  return out;
}

function normalizeTools(list){
  var src = (Array.isArray(list) && list.length) ? list : [{no:1, name:'Фреза Ø3', d:3, flutes:2, s:12000, f:800, fz:200}];
  var out = [], seen = {};
  for (var i = 0; i < src.length && out.length < 20; i++){
    var t = src[i] || {};
    var no = Math.max(1, Math.round(numOr(t.no, i + 1)));
    while (seen[no]) no++;
    seen[no] = true;
    out.push({
      no: no,
      name: String(t.name || ('Инструмент T' + no)),
      d: Math.max(0.1, numOr(t.d, 3)),
      flutes: Math.max(1, Math.round(numOr(t.flutes, 2))),
      s: Math.max(0, Math.round(numOr(t.s, 12000))),
      f: Math.max(1, Math.round(numOr(t.f, 800))),
      fz: Math.max(1, Math.round(numOr(t.fz, 200)))
    });
  }
  return out.length ? out : [{no:1, name:'Фреза Ø3', d:3, flutes:2, s:12000, f:800, fz:200}];
}

function normalizeParamVars(list){
  var src = Array.isArray(list) ? list : [];
  var out = [], seen = {};
  for (var i = 0; i < src.length && out.length < 40; i++){
    var v = src[i] || {};
    var no = Math.round(numOr(v.no, 100 + i));
    if (no < 1 || no > 999) no = 100 + i;
    while (seen[no]) no++;
    seen[no] = true;
    out.push({no:no, name:String(v.name || ''), expr:String(v.expr === undefined ? '0' : v.expr)});
  }
  return out.length ? out : [
    {no:100, name:'R', expr:'40'},
    {no:101, name:'N', expr:'6'},
    {no:102, name:'ANGLE', expr:'0'},
    {no:103, name:'DEPTH', expr:'-6'}
  ];
}

function captureProject(){
  var fields = {};
  PROJECT_FIELDS.forEach(function(id){
    var el = $(id);
    if (!el) return;
    fields[id] = el.type === 'checkbox' ? !!el.checked : el.value;
  });
  return {
    v: 1,
    scene: JSON.parse(JSON.stringify(state.scene)),
    fields: fields,
    tools: JSON.parse(JSON.stringify(state.tools)),
    param: {
      vars: JSON.parse(JSON.stringify(state.paramVars)),
      mode: state.paramMode,
      values: JSON.parse(JSON.stringify(state.paramValues)),
      view: state.paramView
    }
  };
}

function applyFields(fields){
  if (!fields) return;
  Object.keys(fields).forEach(function(id){
    var el = $(id);
    if (!el) return;
    var v = fields[id];
    if (el.tagName === 'SELECT') selectOption(el, v);
    else if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  });
}

function restoreProject(proj, silent){
  state.scene = normalizeScene(proj && proj.scene ? proj.scene : defaultScene());
  applyFields(proj && proj.fields);
  state.tools = normalizeTools(proj && proj.tools);
  var pp = proj && proj.param;
  if (pp){
    state.paramVars = normalizeParamVars(pp.vars);
    state.paramMode = PARAM_MODES[pp.mode] ? pp.mode : 'bolt';
    state.paramValues = (pp.values && typeof pp.values === 'object') ? pp.values : {};
    state.paramView = pp.view === 'numeric' ? 'numeric' : 'param';
  }
  syncBlankInputs();
  renderToolList();
  renderSceneList();
  renderParamUI();
  toggleCustomPost();
  toggleEngrMode();
  updateCalcResult();
  updateEngrNote();
  if (!silent && (state.tab === 'engrave' || state.tab === 'scene')) generate();
}

function setSaveStatus(text, ok){
  var el = $('saveStatus');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('saved', !!ok);
}

function saveNow(json){
  if (!store){ setSaveStatus('💾 память недоступна'); return; }
  try {
    store.setItem(STORAGE_KEY, json);
    var d = new Date();
    var t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    setSaveStatus('✓ сохранено ' + t, true);
  } catch (e){
    setSaveStatus('⚠ память недоступна');
  }
}

function scheduleSave(json){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){ saveNow(json); }, 650);
}

function updateHistoryUI(){
  if ($('undoBtn')) $('undoBtn').disabled = history.index <= 0;
  if ($('redoBtn')) $('redoBtn').disabled = history.index < 0 || history.index >= history.stack.length - 1;
}

function pushHistory(force){
  if (history.applying) return;
  var snap = JSON.stringify(captureProject());
  if (!force && history.index >= 0 && snap === history.stack[history.index]) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(snap);
  if (history.stack.length > 60) history.stack.shift();
  history.index = history.stack.length - 1;
  updateHistoryUI();
  scheduleSave(snap);
}

function scheduleHistory(){
  if (history.applying) return;
  clearTimeout(histTimer);
  histTimer = setTimeout(function(){ pushHistory(false); }, 450);
}

function undo(){
  if (history.index <= 0) return;
  history.applying = true;
  history.index--;
  try { restoreProject(JSON.parse(history.stack[history.index]), false); }
  catch (e){ console.error(e); }
  history.applying = false;
  updateHistoryUI();
  scheduleSave(history.stack[history.index]);
  showToast('Отменено');
}

function redo(){
  if (history.index < 0 || history.index >= history.stack.length - 1) return;
  history.applying = true;
  history.index++;
  try { restoreProject(JSON.parse(history.stack[history.index]), false); }
  catch (e){ console.error(e); }
  history.applying = false;
  updateHistoryUI();
  scheduleSave(history.stack[history.index]);
  showToast('Повторено');
}

function loadStoredProject(){
  if (!store) return null;
  try {
    var raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    var p = JSON.parse(raw);
    return (p && p.scene) ? p : null;
  } catch (e){ return null; }
}

function initHistory(){
  pushHistory(true);
  updateHistoryUI();
}


function generate(){
  if (state.tab === 'threads' || state.tab === 'import') return;
  if (state.tab === 'image'){ if (state.image) generateImage(); return; }
  var p = readParams();
  var scene, owner, title;
  if (state.tab === 'engrave'){
    scene = engraveScene();
    var text = currentEngrText().replace(/\n/g, ' / ');
    title = 'ГРАВИРОВКА: ' + (text.slice(0, 48) || '—');
    owner = 'гравировка';
    updateEngrNote();
  } else {
    syncBlank();
    scene = state.scene;
    var active = scene.elements.filter(function(e){ return e.enabled !== false; }).length;
    title = 'КОНСТРУКТОР: ' + active + ' эл. / ' + fmt(scene.blank.w, 1) + '×' + fmt(scene.blank.h, 1) + ' мм';
    owner = 'конструктор';
  }
  var prog = buildProgram(scene, Object.assign({}, p, { title: title }));
  state.lastProgram = prog;
  state.lastScene = scene;
  state.lastWarnings = prog.warnings;
  present(prog.gcode, {
    moves: prog.moves, groups: prog.groups, blank: scene.blank,
    holes: collectHoles(scene), warnings: prog.warnings, owner: owner,
    scene: scene, toolD: prog.meta.toolD
  });
  state.programSource = 'tab:' + state.tab;
  state.manualEdit = false;
  if (state.tab === 'scene') updateSceneNote();
}

function collectHoles(scene){
  var out = [];
  if (!scene || !scene.elements) return out;
  scene.elements.forEach(function(el){
    if (el.enabled === false || el.type !== 'holes') return;
    var g = elementGeometry(el);
    var placed = transformGeom(g, el.place || {mode:'center', x:0, y:0}, el.rot, el.mirrorX, el.mirrorY);
    (placed.holes || []).forEach(function(h){
      out.push({x:h.x, y:h.y, d:numOr(el.params.d, 3)});
    });
  });
  return out;
}

/* ---------------------------------------------------------------- вывод */
function present(code, o){
  o = o || {};
  if (o.setText !== false){
    $('output').value = code;
    $('output').scrollTop = 0;
  }
  $('outOwner').textContent = o.owner || '—';
  var p = readParams();
  var toolD = o.toolD || p.toolD;
  var moves = o.moves;
  if (!moves){ moves = parseProgram(code).moves; }
  var feed = o.feed !== undefined ? o.feed : p.F;
  var plunge = o.plunge !== undefined ? o.plunge : p.Fz;
  var safeZ = o.safeZ !== undefined ? o.safeZ : p.safeZ;
  var minZ = o.minZ !== undefined ? o.minZ : p.minZ;
  var est = estimateMoves(moves, feed, plunge);
  drawPreview(moves, { blank: o.blank, groups: o.groups, holes: o.holes });
  var extraChecks = o.scene ? sceneChecks(o.scene, { toolD: toolD, depth: p.depth, minZ: minZ }) : [];
  var res = validateGcode(code, {
    minZ: minZ,
    blank: o.blank || {enabled:false},
    safeZ: safeZ,
    toolD: toolD,
    controller: p.controller,
    estSec: est.totalSec,
    genWarnings: o.warnings || [],
    extraChecks: extraChecks
  });
  state.check = res;
  renderChecklist(res);
  renderStats(moves, est, o);
  $('download').disabled = !res.ok;
  $('download').title = res.ok ? 'Скачать G-код' : 'Сначала исправьте ошибки из чек-листа';
  return {est: est, res: res};
}

/* ---------------------------------------------------------------- ручная правка G-кода */
var manualTimer = null;
function manualCheckNow(){
  var code = $('output').value;
  var st = parseProgram(code);
  present(code, {
    moves: st.moves,
    owner: 'ручная правка',
    blank: state.lastScene ? state.lastScene.blank : {enabled:false},
    setText: false
  });
  state.programSource = 'manual';
}
function scheduleManualCheck(){
  clearTimeout(manualTimer);
  manualTimer = setTimeout(manualCheckNow, 450);
}
function regenerateCurrent(){
  if (state.tab === 'engrave' || state.tab === 'scene'){ generate(); showToast('G-код сгенерирован заново'); }
  else if (state.tab === 'threads'){ calcThread(state.threadTab); makeThreadProgram(state.threadTab, false); }
  else if (state.tab === 'import'){ importProgram(false); }
  else showToast('Откройте вкладку с генерацией кода');
}

function renderChecklist(res){
  var ok = 0, warn = 0, err = 0;
  res.items.forEach(function(it){
    if (it.status === 'ok') ok++;
    else if (it.status === 'warn') warn++;
    else if (it.status === 'error') err++;
  });
  var sum = $('checkSummary');
  sum.innerHTML = '';
  sum.innerHTML += '<span class="pill ok">✅ ' + ok + ' ок</span>';
  if (warn) sum.innerHTML += '<span class="pill warn">⚠ ' + warn + ' предупр.</span>';
  if (err) sum.innerHTML += '<span class="pill err">❌ ' + err + ' ошибк' + (err === 1 ? 'а' : (err < 5 ? 'и' : '')) + '</span>';
  if (!err && !warn) sum.innerHTML += '<span class="pill ok">код готов к экспорту</span>';
  var icons = {ok:'✅', warn:'⚠️', error:'❌', info:'ℹ️'};
  $('checklist').innerHTML = res.items.map(function(it){
    return '<div class="check ' + it.status + '">' +
      '<span class="ico">' + (icons[it.status] || '•') + '</span>' +
      '<div><div class="cl">' + esc(it.label) + '</div>' +
      (it.detail ? '<div class="cd">' + esc(it.detail) + '</div>' : '') + '</div></div>';
  }).join('');
}

function movesBBox(moves){
  var b = {minX:Infinity, minY:Infinity, minZ:Infinity, maxX:-Infinity, maxY:-Infinity, maxZ:-Infinity};
  for (var i = 0; i < moves.length; i++){
    var m = moves[i];
    if (m.t === 'comment' || m.t === 'dwell' || m.t === 'toolchange') continue;
    if (m.x < b.minX) b.minX = m.x;
    if (m.x > b.maxX) b.maxX = m.x;
    if (m.y < b.minY) b.minY = m.y;
    if (m.y > b.maxY) b.maxY = m.y;
    if (m.z < b.minZ) b.minZ = m.z;
    if (m.z > b.maxZ) b.maxZ = m.z;
    if (m.t === 'arc'){
      var cx = m.x, cy = m.y;
      var r = Math.hypot(m.i || 0, m.j || 0);
      if (cx - r < b.minX) b.minX = cx - r;
      if (cx + r > b.maxX) b.maxX = cx + r;
      if (cy - r < b.minY) b.minY = cy - r;
      if (cy + r > b.maxY) b.maxY = cy + r;
    }
  }
  if (!isFinite(b.minX)){ b.minX = b.minY = b.minZ = 0; b.maxX = b.maxY = b.maxZ = 0; }
  return b;
}

function renderStats(moves, est, o){
  var b = movesBBox(moves);
  var html = '';
  function badge(label, val){ html += '<span class="badge">' + label + ' <b>' + esc(val) + '</b></span>'; }
  badge('⏱', formatTime(est.totalSec));
  badge('📏 рез', fmt(est.cutLen, 0) + ' мм');
  badge('⬇ врезания', fmt(est.plungeLen, 0) + ' мм');
  badge('⚡ рапиды', fmt(est.rapidLen, 0) + ' мм');
  if (o && o.groups) badge('🧩 элементов', String(o.groups.length));
  badge('X', fmt(b.minX, 1) + '…' + fmt(b.maxX, 1) + ' мм');
  badge('Y', fmt(b.minY, 1) + '…' + fmt(b.maxY, 1) + ' мм');
  badge('Z', fmt(b.minZ, 2) + '…' + fmt(b.maxZ, 2));
  $('statsBox').innerHTML = html;
  $('previewInfo').textContent = 'X ' + fmt(b.minX, 1) + '…' + fmt(b.maxX, 1) +
    ' · Y ' + fmt(b.minY, 1) + '…' + fmt(b.maxY, 1) +
    ' · Z ' + fmt(b.minZ, 2) + '…' + fmt(b.maxZ, 2) + ' мм';
}

/* ---------------------------------------------------------------- превью */
function arcPoints(prev, m, n){
  var cx = prev.x + (m.i || 0), cy = prev.y + (m.j || 0);
  var r = Math.hypot(m.i || 0, m.j || 0);
  if (r < 1e-9) return [[prev.x, prev.y], [m.x, m.y]];
  var aS = Math.atan2(prev.y - cy, prev.x - cx);
  var aE = Math.atan2(m.y - cy, m.x - cx);
  var sweep;
  if (m.dir === 'G3'){ sweep = aE - aS; while (sweep <= 1e-9) sweep += 2 * Math.PI; }
  else { sweep = aS - aE; while (sweep <= 1e-9) sweep += 2 * Math.PI; }
  var sign = (m.dir === 'G3') ? 1 : -1;
  var pts = [];
  for (var i = 0; i <= n; i++){
    var a = aS + sign * sweep * i / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function drawPreview2D(moves, options){
  var o = options || {};
  var svg = $('preview');
  svg.innerHTML = '';
  moves = moves || [];
  var blank = o.blank;
  var W = 460, H = 380, pad = 24;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function acc(x, y){
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (blank && blank.enabled){ acc(0, 0); acc(blank.w, blank.h); }
  var prev = null;
  for (var i = 0; i < moves.length; i++){
    var m = moves[i];
    if (m.t === 'comment' || m.t === 'dwell' || m.t === 'toolchange') continue;
    acc(m.x, m.y);
    if (m.t === 'arc' && prev){
      var ap = arcPoints(prev, m, 8);
      for (var k = 0; k < ap.length; k++) acc(ap[k][0], ap[k][1]);
    }
    prev = m;
  }
  (o.holes || []).forEach(function(h){
    acc(h.x - h.d/2, h.y - h.d/2);
    acc(h.x + h.d/2, h.y + h.d/2);
  });
  if (!isFinite(minX)){
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('height', H);
    var tx = document.createElementNS(NS, 'text');
    tx.setAttribute('x', W/2); tx.setAttribute('y', H/2);
    tx.setAttribute('fill', '#55555f'); tx.setAttribute('font-size', '13');
    tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('font-family', 'system-ui');
    tx.textContent = 'Нет траекторий — сгенерируйте или импортируйте G-код';
    svg.appendChild(tx);
    $('legend').innerHTML = '';
    return;
  }
  var w = Math.max(maxX - minX, 0.5), h = Math.max(maxY - minY, 0.5);
  H = clampNum(Math.round((W - 2*pad) * h / w + 2*pad), 190, 380);
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('height', H);
  var sc = Math.min((W - 2*pad) / w, (H - 2*pad) / h);
  var ox = (W - w*sc) / 2 - minX*sc;
  var oy = (H - h*sc) / 2 + maxY*sc;
  function tx(x){ return x*sc + ox; }
  function ty(y){ return oy - y*sc; }
  function el(tag, attrs){
    var e = document.createElementNS(NS, tag);
    for (var key in attrs) e.setAttribute(key, attrs[key]);
    return e;
  }
  svg.appendChild(el('rect', {x:0, y:0, width:W, height:H, fill:'#0a0a0d'}));

  /* сетка */
  var span = Math.max(w, h);
  var steps = [1,2,5,10,20,25,50,100,200,500];
  var gridStep = steps[steps.length - 1];
  for (var s = 0; s < steps.length; s++){
    if (span / steps[s] <= 12){ gridStep = steps[s]; break; }
  }
  for (var gx = Math.ceil(minX / gridStep) * gridStep; gx <= maxX + 1e-9; gx += gridStep){
    svg.appendChild(el('line', {x1:tx(gx), y1:ty(minY), x2:tx(gx), y2:ty(maxY), stroke:'#1d1d24', 'stroke-width':1}));
  }
  for (var gy = Math.ceil(minY / gridStep) * gridStep; gy <= maxY + 1e-9; gy += gridStep){
    svg.appendChild(el('line', {x1:tx(minX), y1:ty(gy), x2:tx(maxX), y2:ty(gy), stroke:'#1d1d24', 'stroke-width':1}));
  }

  /* поле заготовки */
  if (blank && blank.enabled && blank.w > 0 && blank.h > 0){
    svg.appendChild(el('rect', {
      x:tx(0), y:ty(blank.h), width:blank.w*sc, height:blank.h*sc,
      fill:'rgba(74,144,217,.05)', stroke:'#4a90d9', 'stroke-width':1.4, 'stroke-dasharray':'6 4'
    }));
    var bl = el('text', {x:tx(0)+4, y:ty(blank.h)-5, fill:'#6fa7dd', 'font-size':10, 'font-family':'system-ui'});
    bl.textContent = 'поле ' + fmt(blank.w, 1) + '×' + fmt(blank.h, 1);
    svg.appendChild(bl);
  }

  /* быстрые ходы */
  if (moves.length <= 9000){
    prev = null;
    for (var r = 0; r < moves.length; r++){
      var mr = moves[r];
      if (mr.t === 'comment' || mr.t === 'dwell' || mr.t === 'toolchange') continue;
      if (prev && mr.t === 'rapid'){
        svg.appendChild(el('line', {
          x1:tx(prev.x), y1:ty(prev.y), x2:tx(mr.x), y2:ty(mr.y),
          stroke:'#34343e', 'stroke-width':0.7, 'stroke-dasharray':'2 3'
        }));
      }
      prev = mr;
    }
  }

  /* группы */
  var groupOf = null;
  if (o.groups && o.groups.length){
    groupOf = new Array(moves.length);
    for (var gi = 0; gi < o.groups.length; gi++){
      var g = o.groups[gi];
      for (var mi = g.from; mi < g.to; mi++) groupOf[mi] = gi;
    }
  }

  prev = null;
  for (var c = 0; c < moves.length; c++){
    var mc = moves[c];
    if (mc.t === 'comment' || mc.t === 'dwell' || mc.t === 'toolchange') continue;
    var color = (groupOf && groupOf[c] !== undefined) ? PALETTE[groupOf[c] % PALETTE.length] : '#ff6b35';
    if (prev){
      if (mc.t === 'line'){
        svg.appendChild(el('line', {
          x1:tx(prev.x), y1:ty(prev.y), x2:tx(mc.x), y2:ty(mc.y),
          stroke:color, 'stroke-width':1.5, 'stroke-linecap':'round'
        }));
      } else if (mc.t === 'arc'){
        var pts = arcPoints(prev, mc, 28);
        var poly = el('polyline', {
          points: pts.map(function(p){ return tx(p[0]) + ',' + ty(p[1]); }).join(' '),
          fill:'none', stroke:color, 'stroke-width':1.5, 'stroke-linecap':'round'
        });
        svg.appendChild(poly);
      }
    }
    prev = mc;
  }

  /* точки */
  (o.holes || []).forEach(function(h){
    var rr = Math.max(1.6, h.d/2*sc);
    svg.appendChild(el('circle', {cx:tx(h.x), cy:ty(h.y), r:rr, fill:'rgba(192,132,252,.18)', stroke:'#c084fc', 'stroke-width':1}));
  });

  /* начало координат */
  if (minX <= 0 && maxX >= 0 && minY <= 0 && maxY >= 0){
    svg.appendChild(el('line', {x1:tx(0)-5, y1:ty(0), x2:tx(0)+5, y2:ty(0), stroke:'#5a5a68', 'stroke-width':1}));
    svg.appendChild(el('line', {x1:tx(0), y1:ty(0)-5, x2:tx(0), y2:ty(0)+5, stroke:'#5a5a68', 'stroke-width':1}));
  }

  /* легенда */
  var legend = $('legend');
  legend.innerHTML = '';
  if (o.groups && o.groups.length){
    o.groups.forEach(function(g, idx){
      var item = document.createElement('span');
      item.innerHTML = '<i style="background:' + PALETTE[idx % PALETTE.length] + '"></i><span class="nm" title="' + esc(g.name) + '">' + esc(g.name) + '</span>';
      legend.appendChild(item);
    });
  } else {
    legend.innerHTML = '<span><i style="background:#ff6b35"></i><span class="nm">траектория</span></span>';
  }
  var zLo = Infinity, zHi = -Infinity;
  for (var zq = 0; zq < moves.length; zq++){
    var zm = moves[zq];
    if ((zm.t === 'line' || zm.t === 'arc') && zm.z < 0){
      if (zm.z < zLo) zLo = zm.z;
      if (zm.z > zHi) zHi = zm.z;
    }
  }
  if (isFinite(zLo) && zHi - zLo > 0.05){
    var zi = document.createElement('span');
    zi.innerHTML = '<i class="zbar"></i><span class="nm" title="Разные высоты внутри одной программы">Z ' +
      esc(fmt(zHi, 2)) + '…' + esc(fmt(zLo, 2)) + '</span>';
    legend.appendChild(zi);
  }
}

/* ---------------------------------------------------------------- 3D-предпросмотр */
function drawPreview(moves, options){
  state.lastPreview = { moves: moves || [], options: options || {} };
  if (state.preview3d) drawPreview3D();
  else drawPreview2D(moves, options);
}

function previewBlank(options){
  var b = options && options.blank;
  return (b && b.enabled && b.w > 0 && b.h > 0) ? b : null;
}

function build3DScene(moves, options){
  var blank = previewBlank(options);
  var b = { minX:Infinity, minY:Infinity, minZ:Infinity, maxX:-Infinity, maxY:-Infinity, maxZ:-Infinity };
  function acc(x, y, z){
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
    if (z < b.minZ) b.minZ = z;
    if (z > b.maxZ) b.maxZ = z;
  }
  var segs = [], prev = null;
  for (var i = 0; i < moves.length; i++){
    var m = moves[i];
    if (m.t === 'comment' || m.t === 'dwell' || m.t === 'toolchange') continue;
    if (m.x === undefined) continue;
    if (prev && m.t === 'arc'){
      var ap = arcPoints(prev, m, 10);
      for (var j = 1; j < ap.length; j++){
        var t0 = (j - 1) / (ap.length - 1), t1 = j / (ap.length - 1);
        var a = [ap[j-1][0], ap[j-1][1], prev.z + (m.z - prev.z) * t0];
        var c = [ap[j][0], ap[j][1], prev.z + (m.z - prev.z) * t1];
        segs.push({a:a, b:c, rapid:false, cut:true, plunge:false, z:(a[2] + c[2]) / 2,
          zLo:Math.min(a[2], c[2]), zHi:Math.max(a[2], c[2])});
        acc(a[0], a[1], a[2]); acc(c[0], c[1], c[2]);
      }
    } else if (prev && (m.t === 'line' || m.t === 'rapid')){
      var a2 = [prev.x, prev.y, prev.z], b2 = [m.x, m.y, m.z];
      var sameXY = Math.abs(a2[0] - b2[0]) < 1e-9 && Math.abs(a2[1] - b2[1]) < 1e-9;
      var plunge = sameXY && Math.abs(a2[2] - b2[2]) > 1e-9;
      segs.push({a:a2, b:b2, rapid:m.t === 'rapid', cut:(m.t !== 'rapid' && !plunge), plunge:plunge,
        z:(a2[2] + b2[2]) / 2, zLo:Math.min(a2[2], b2[2]), zHi:Math.max(a2[2], b2[2])});
      acc(a2[0], a2[1], a2[2]); acc(b2[0], b2[1], b2[2]);
    }
    prev = m;
  }
  if (blank){
    var th = Math.max(0.5, numOr(blank.thickness, 5));
    acc(0, 0, 0); acc(blank.w, 0, 0); acc(blank.w, blank.h, 0); acc(0, blank.h, 0);
    acc(0, 0, -th); acc(blank.w, 0, -th); acc(blank.w, blank.h, -th); acc(0, blank.h, -th);
  }
  (options.holes || []).forEach(function(h){
    acc(h.x, h.y, 0);
    acc(h.x + h.d/2, h.y + h.d/2, 0);
    acc(h.x - h.d/2, h.y - h.d/2, 0);
  });
  if (!isFinite(b.minX)){ b.minX = -20; b.maxX = 20; b.minY = -20; b.maxY = 20; b.minZ = -5; b.maxZ = 0; }
  var mx = Math.max(0.5, (b.maxX - b.minX) * 0.04), my = Math.max(0.5, (b.maxY - b.minY) * 0.04);
  b.minX -= mx; b.maxX += mx; b.minY -= my; b.maxY += my;
  if (segs.length > 40000) segs = segs.filter(function(_, k){ return k % 2 === 0; });
  return {segments:segs, bounds:b, blank:blank};
}

function project3D(p, view){
  var x = p[0] - view.cx, y = p[1] - view.cy, z = (p[2] - view.cz) * view.zScale;
  var cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
  var x1 = x * cy - y * sy, y1 = x * sy + y * cy;
  var cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  var y2 = y1 * cp + z * sp;
  var depth = -y1 * sp + z * cp;
  return [view.w / 2 + x1 * view.scale + view.panX, view.h / 2 - y2 * view.scale + view.panY, depth];
}

function cutColor3D(t){
  t = clampNum(t, 0, 1);
  var g = Math.round(208 + (77 - 208) * t);
  var b = Math.round(138 + (46 - 138) * t);
  return 'rgb(255,' + g + ',' + b + ')';
}

function size3DCanvas(canvas){
  var w = Math.max(300, Math.round(canvas.clientWidth || 460));
  var h = Math.max(260, Math.min(430, Math.round(w * 0.68)));
  var dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)){
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  canvas.style.height = h + 'px';
  var ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return {w:w, h:h, ctx:null};
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {w:w, h:h, ctx:ctx};
}

function draw3DLegend(scene){
  var legend = $('legend');
  if (!legend) return;
  var zMin = Infinity, zMax = -Infinity;
  scene.segments.forEach(function(s){
    if (s.cut){
      if (s.zLo < zMin) zMin = s.zLo;
      if (s.zHi > zMax) zMax = s.zHi;
    }
  });
  var ztxt = isFinite(zMin) ? ('Z ' + fmt(zMax, 2) + '…' + fmt(zMin, 2)) : 'Z —';
  legend.innerHTML =
    '<span><i class="grad3d"></i><span class="nm">рез · ' + esc(ztxt) + '</span></span>' +
    '<span><i style="background:#38bdf8"></i><span class="nm">быстрый ход</span></span>' +
    '<span><span class="nm">ЛКМ — вращать · колесо — масштаб</span></span>';
}

function drawStock3D(ctx, scene, view, project){
  var blank = scene.blank;
  if (!blank) return;
  var w = blank.w, h = blank.h, th = Math.max(0.5, numOr(blank.thickness, 5));
  var top = [[0,0,0],[w,0,0],[w,h,0],[0,h,0]].map(project);
  var bot = [[0,0,-th],[w,0,-th],[w,h,-th],[0,h,-th]].map(project);
  function poly(pts, fill, stroke, dash, lw){
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++){
      if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
      else ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
    if (fill){ ctx.fillStyle = fill; ctx.fill(); }
    if (stroke){
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  poly(bot, 'rgba(74,144,217,.03)', '#35506b', [4,4], 1);
  poly(top, 'rgba(74,144,217,.07)', '#4a90d9', [6,4], 1.2);
  ctx.strokeStyle = 'rgba(74,144,217,.35)';
  ctx.lineWidth = 1;
  for (var i = 0; i < 4; i++){
    ctx.beginPath();
    ctx.moveTo(top[i][0], top[i][1]);
    ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.stroke();
  }
}

function drawGrid3D(ctx, scene, view, project){
  var b = scene.bounds;
  var x0, y0, x1, y1, z;
  if (scene.blank){ x0 = 0; y0 = 0; x1 = scene.blank.w; y1 = scene.blank.h; z = 0; }
  else { x0 = b.minX; y0 = b.minY; x1 = b.maxX; y1 = b.maxY; z = 0; }
  var span = Math.max(x1 - x0, y1 - y0);
  var steps = [1,2,5,10,20,25,50,100,200,500];
  var step = steps[steps.length-1];
  for (var s = 0; s < steps.length; s++){ if (span / steps[s] <= 10){ step = steps[s]; break; } }
  ctx.strokeStyle = 'rgba(100,100,125,.16)';
  ctx.lineWidth = 1;
  for (var gx = Math.ceil(x0/step)*step; gx <= x1 + 1e-9; gx += step){
    var a = project([gx, y0, z]), c = project([gx, y1, z]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  }
  for (var gy = Math.ceil(y0/step)*step; gy <= y1 + 1e-9; gy += step){
    var d = project([x0, gy, z]), e = project([x1, gy, z]);
    ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
  }
}

function drawAxes3D(ctx, scene, project){
  var b = scene.bounds;
  var len = Math.max(8, Math.min(20, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.18));
  var o = project([0,0,0]);
  var axes = [
    [[len,0,0], '#ff8a65', 'X'],
    [[0,len,0], '#81c784', 'Y'],
    [[0,0,len], '#64b5f6', 'Z']
  ];
  ctx.lineWidth = 1.6;
  axes.forEach(function(ax){
    var p = project(ax[0]);
    ctx.strokeStyle = ax[1];
    ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    ctx.fillStyle = ax[1];
    ctx.font = 'bold 11px system-ui';
    ctx.fillText(ax[2], p[0] + 4, p[1] - 4);
  });
}

function drawPreview3D(){
  var canvas = $('preview3d');
  if (!canvas) return;
  var moves = (state.lastPreview && state.lastPreview.moves) || [];
  var options = (state.lastPreview && state.lastPreview.options) || {};
  var blank = previewBlank(options);
  var key = blank ? (blank.w + 'x' + blank.h + 'x' + (blank.thickness || 5)) : 'none';
  if (!state.scene3d || state.scene3d.moves !== moves || state.scene3d.blankKey !== key){
    var sc = build3DScene(moves, options);
    sc.moves = moves;
    sc.blankKey = key;
    state.scene3d = sc;
  }
  var scene = state.scene3d;
  draw3DLegend(scene);
  var sized = size3DCanvas(canvas);
  var ctx = sized.ctx, w = sized.w, h = sized.h;
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, w, h);
  if (!moves.length && !scene.blank){
    ctx.fillStyle = '#55555f';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Нет траекторий — сгенерируйте или импортируйте G-код', w/2, h/2);
    ctx.textAlign = 'left';
    return;
  }
  var b = scene.bounds;
  var cam = state.cam3d;
  var zScale = Math.max(1, numOr(state.zScale, 3));
  var dx = b.maxX - b.minX, dy = b.maxY - b.minY, dz = (b.maxZ - b.minZ) * zScale;
  var radius = Math.max(Math.hypot(dx, dy), dz) / 2 || 1;
  var scale = Math.min(w, h) / (radius * 2.7) * cam.zoom;
  var view = {
    w:w, h:h, cx:(b.minX + b.maxX)/2, cy:(b.minY + b.maxY)/2, cz:(b.minZ + b.maxZ)/2,
    yaw:cam.yaw, pitch:cam.pitch, zScale:zScale, scale:scale, panX:cam.panX, panY:cam.panY
  };
  function project(p){ return project3D(p, view); }
  drawGrid3D(ctx, scene, view, project);
  drawStock3D(ctx, scene, view, project);
  var zMin = Infinity, zMax = -Infinity;
  scene.segments.forEach(function(s){
    if (s.cut){
      if (s.zLo < zMin) zMin = s.zLo;
      if (s.zHi > zMax) zMax = s.zHi;
    }
  });
  var buckets = [], rapids = [], plunges = [];
  for (var bi = 0; bi < 16; bi++) buckets.push([]);
  scene.segments.forEach(function(s){
    var p1 = project(s.a), p2 = project(s.b);
    if (s.rapid) rapids.push([p1, p2]);
    else if (s.plunge) plunges.push([p1, p2]);
    else if (s.cut) {
      var t = (zMax - zMin > 1e-9) ? (zMax - s.z) / (zMax - zMin) : 0;
      buckets[Math.min(15, Math.max(0, Math.floor(t * 16)))].push([p1, p2]);
    }
  });
  for (var k = 0; k < 16; k++){
    if (!buckets[k].length) continue;
    ctx.strokeStyle = cutColor3D(k / 15);
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    for (var q = 0; q < buckets[k].length; q++){
      ctx.moveTo(buckets[k][q][0][0], buckets[k][q][0][1]);
      ctx.lineTo(buckets[k][q][1][0], buckets[k][q][1][1]);
    }
    ctx.stroke();
  }
  if (plunges.length){
    ctx.strokeStyle = 'rgba(150,150,170,.35)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (var pz = 0; pz < plunges.length; pz++){
      ctx.moveTo(plunges[pz][0][0], plunges[pz][0][1]);
      ctx.lineTo(plunges[pz][1][0], plunges[pz][1][1]);
    }
    ctx.stroke();
  }
  if (rapids.length){
    ctx.strokeStyle = 'rgba(56,189,248,.72)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3,3]);
    ctx.beginPath();
    for (var r = 0; r < rapids.length; r++){
      ctx.moveTo(rapids[r][0][0], rapids[r][0][1]);
      ctx.lineTo(rapids[r][1][0], rapids[r][1][1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawAxes3D(ctx, scene, project);
  ctx.fillStyle = 'rgba(160,160,180,.6)';
  ctx.font = '10px system-ui';
  ctx.fillText('3D · ЛКМ вращать · колесо масштаб · ПКМ панорама', 10, h - 10);
}

function setPreviewMode(mode){
  state.preview3d = mode === '3d';
  document.querySelectorAll('#previewMode button').forEach(function(b){
    b.classList.toggle('active', b.dataset.view === mode);
  });
  var svg = $('preview'), cv = $('preview3d');
  if (svg) svg.classList.toggle('hidden', state.preview3d);
  if (cv) cv.classList.toggle('active', state.preview3d);
  if (state.preview3d) drawPreview3D();
  else if (state.lastPreview) drawPreview2D(state.lastPreview.moves, state.lastPreview.options);
}

function resetPreview3D(){
  state.cam3d = { yaw:-Math.PI/4, pitch:Math.PI/7, zoom:1, panX:0, panY:0 };
  state.zScale = 3;
  var zs = $('zScale');
  if (zs) zs.value = '3';
  drawPreview3D();
}

function initPreview3D(){
  var cv = $('preview3d');
  if (!cv) return;
  document.querySelectorAll('#previewMode button').forEach(function(btn){
    btn.addEventListener('click', function(){ setPreviewMode(btn.dataset.view); });
  });
  var zs = $('zScale');
  if (zs) zs.addEventListener('input', function(){
    state.zScale = Math.max(1, numOr(zs.value, 3));
    if (state.preview3d) drawPreview3D();
  });
  var reset = $('viewReset');
  if (reset) reset.addEventListener('click', resetPreview3D);

  var drag = null;
  cv.addEventListener('pointerdown', function(e){
    try { if (typeof cv.setPointerCapture === 'function') cv.setPointerCapture(e.pointerId); } catch (err){}
    drag = {x:e.clientX, y:e.clientY, button:e.button, shift:e.shiftKey};
    cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointermove', function(e){
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    var pan = drag.button === 2 || drag.shift || e.shiftKey;
    if (pan){
      state.cam3d.panX += dx;
      state.cam3d.panY += dy;
    } else {
      state.cam3d.yaw += dx * 0.01;
      var pitch = state.cam3d.pitch + dy * 0.01;
      if (pitch > Math.PI) pitch -= Math.PI * 2;
      if (pitch < -Math.PI) pitch += Math.PI * 2;
      state.cam3d.pitch = pitch;
    }
    if (state.preview3d) drawPreview3D();
  });
  function endDrag(){
    drag = null;
    cv.style.cursor = 'grab';
  }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', function(){ if (!drag) cv.style.cursor = 'grab'; });
  cv.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  cv.addEventListener('wheel', function(e){
    e.preventDefault();
    state.cam3d.zoom = clampNum(state.cam3d.zoom * Math.exp(-e.deltaY * 0.001), 0.35, 4);
    if (state.preview3d) drawPreview3D();
  }, { passive:false });
  if (typeof window.addEventListener === 'function'){
    var rt = null;
    window.addEventListener('resize', function(){
      if (!state.preview3d) return;
      clearTimeout(rt);
      rt = setTimeout(drawPreview3D, 120);
    });
  }
}

/* ---------------------------------------------------------------- чек-лист скачивания */
function downloadFile(){
  var txt = $('output').value;
  if (!txt || (state.check && !state.check.ok)) return;
  var name = ($('fileName').value || 'part.nc').trim().replace(/[\\/:*?"<>|]/g, '_');
  if (!/\.[A-Za-z0-9]{1,6}$/.test(name)) name += '.nc';
  var blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  showToast('Скачано: ' + name);
}

/* ---------------------------------------------------------------- конструктор */
function uid(prefix){ return prefix + '_' + Math.random().toString(36).slice(2, 8); }

function toolInfo(no){
  var t = state.tools.filter(function(x){ return Number(x.no) === Number(no); })[0] || state.tools[0];
  return t;
}
function toolOptionsHtml(selected){
  return state.tools.map(function(t){
    return '<option value="' + t.no + '"' + (Number(selected) === Number(t.no) ? ' selected' : '') + '>' +
      'T' + t.no + ' — ' + esc(t.name) + ' (Ø' + fmt(t.d, 1) + ')</option>';
  }).join('');
}
function renderToolList(){
  var box = $('toolList');
  if (!box) return;
  if (!state.tools.length) state.tools = [{no:1, name:'Фреза Ø3', d:3, flutes:2, s:12000, f:800, fz:200}];
  box.innerHTML = state.tools.map(function(t, i){
    var tip = function(text){ return ' <i class="q" data-tip-text="' + esc(text) + '">?</i>'; };
    return '<div class="tool-card" data-tool-idx="' + i + '">' +
      '<div class="tool-head"><b>T' + t.no + '</b>' +
      '<input data-tf="name" value="' + esc(t.name) + '" aria-label="Название инструмента">' +
      '<button class="tool-del" data-tool-del="' + i + '" title="Удалить инструмент">✕</button></div>' +
      '<div class="tool-fields">' +
      '<div><label>Ø, мм' + tip('Диаметр инструмента влияет на карманы, смещение и проверки.') + '</label><input type="number" data-tf="d" value="' + esc(t.d) + '" min="0.1" step="0.1"></div>' +
      '<div><label>Зубьев' + tip('Число зубьев для расчёта подачи на зуб.') + '</label><input type="number" data-tf="flutes" value="' + esc(t.flutes) + '" min="1" step="1"></div>' +
      '<div><label>S, об/мин' + tip('Обороты шпинделя для этого инструмента.') + '</label><input type="number" data-tf="s" value="' + esc(t.s) + '" step="100"></div>' +
      '<div><label>F, мм/мин' + tip('Рабочая подача этого инструмента.') + '</label><input type="number" data-tf="f" value="' + esc(t.f) + '" step="10"></div>' +
      '<div><label>Fz, мм/мин' + tip('Подача врезания этого инструмента.') + '</label><input type="number" data-tf="fz" value="' + esc(t.fz) + '" step="10"></div>' +
      '</div></div>';
  }).join('');
}

function toggleCustomPost(){
  var isCustom = $('controller') && $('controller').value === 'custom';
  if ($('customPost')) $('customPost').style.display = isCustom ? 'block' : 'none';
  if ($('postHint')){
    $('postHint').textContent = isCustom
      ? 'Custom: шапка, подвал, %, N-строки. WCS, формат дуг и точность действуют на все контроллеры.'
      : 'WCS, формат дуг и точность действуют на все контроллеры. Шапка/подвал и N-строки — в режиме Custom.';
  }
}

function renderSceneList(){
  var box = $('sceneList');
  box.innerHTML = '';
  if (!state.scene.elements.length){
    box.innerHTML = '<div class="hint">Пока пусто. Добавьте фигуру или загрузите шаблон — например «Рамка + надпись + круг».</div>';
    return;
  }
  state.scene.elements.forEach(function(el, i){
    var t = ELEMENT_TYPES[el.type];
    var color = PALETTE[i % PALETTE.length];
    var card = document.createElement('div');
    card.className = 'scene-card' + (el.enabled === false ? ' disabled' : '');
    card.dataset.idx = i;
    var hi = elementHeightInfo(el, num('depth'));
    var zBadge = '<span class="z-badge" title="' + esc(hi.label) + '">' + esc(hi.short) + '</span>';
    var head = '<div class="scene-head">' +
      '<label class="sw"><input type="checkbox" data-act="enabled" ' + (el.enabled === false ? '' : 'checked') + '>' +
      '<span class="idx">' + (i + 1) + '</span><span class="dot" style="background:' + color + '"></span>' +
      '<span class="nm">' + esc(elementSummary(el)) + '</span>' + zBadge +
      '<i class="q" data-tip-text="Элемент включён в обработку. Снимите галочку, чтобы временно исключить его, не удаляя.">?</i></label>' +
      '<div class="scene-actions">' +
      '<button data-act="mirrorX" class="' + (el.mirrorX ? 'on' : '') + '" title="Зеркало по X">↔</button>' +
      '<button data-act="mirrorY" class="' + (el.mirrorY ? 'on' : '') + '" title="Зеркало по Y">↕</button>' +
      '<button data-act="up" title="Выше">↑</button>' +
      '<button data-act="down" title="Ниже">↓</button>' +
      '<button data-act="dup" title="Дублировать">⧉</button>' +
      '<button data-act="del" title="Удалить">✕</button>' +
      '</div></div>';
    var fields = '<div class="scene-fields">';
    if (t){
      t.fields.forEach(function(f){
        if (f.show && !f.show(el.params)) return;
        var full = f.type === 'textarea' || f.type === 'text';
        fields += '<div class="field' + (full ? ' full' : '') + '">' + fieldHtml(el, f) + '</div>';
      });
    }
    fields += '</div>';
    var pl = el.place || {mode:'center', x:0, y:0};
    var tX = '<i class="q" data-tip-text="Положение элемента по X: для привязки «центр» — центр фигуры, для «левый низ» — левый нижний угол, для «от X0/Y0» — смещение от нуля.">?</i>';
    var tY = '<i class="q" data-tip-text="Положение элемента по Y. Зависит от выбранной привязки.">?</i>';
    var tMode = '<i class="q" data-tip-text="Точка привязки: центр фигуры, левый нижний угол или смещение от координат X0/Y0.">?</i>';
    var tRot = '<i class="q" data-tip-text="Поворот элемента вокруг точки привязки в градусах. 90° — против часовой стрелки.">?</i>';
    var place = '<div class="scene-place">' +
      '<div><label>X, мм' + tX + '</label><input type="number" data-place="x" value="' + esc(fmt(pl.x, 3)) + '" step="1"></div>' +
      '<div><label>Y, мм' + tY + '</label><input type="number" data-place="y" value="' + esc(fmt(pl.y, 3)) + '" step="1"></div>' +
      '<div><label>Привязка' + tMode + '</label><select data-place="mode">' +
      '<option value="center"' + (pl.mode === 'center' ? ' selected' : '') + '>Центр</option>' +
      '<option value="corner"' + (pl.mode === 'corner' ? ' selected' : '') + '>Левый низ</option>' +
      '<option value="abs"' + (pl.mode === 'abs' ? ' selected' : '') + '>От X0/Y0</option></select></div>' +
      '<div><label>Поворот, °' + tRot + '</label><input type="number" data-place="rot" value="' + esc(fmt(el.rot || 0, 2)) + '" step="15"></div>' +
      '</div>';
    var useToolsNow = $('useTools') && $('useTools').checked;
    var tSel = el.tool || (state.tools[0] ? state.tools[0].no : 1);
    var tInfo = toolInfo(tSel);
    var toolRow = '<div class="scene-tool">' +
      '<label>Инструмент <i class="q" data-tip-text="Инструмент для этого элемента. Смена инструмента вставляется автоматически перед его обработкой.">?</i></label>' +
      '<select data-tool' + (useToolsNow ? '' : ' disabled') + '>' + toolOptionsHtml(tSel) + '</select>' +
      '<span class="tool-meta">T' + tInfo.no + ' · Ø' + fmt(tInfo.d, 1) + ' · S' + fmt(tInfo.s, 0) + ' · F' + fmt(tInfo.f, 0) + '</span>' +
      '</div>';
    var zOpts = Object.keys(Z_PROFILES).map(function(k){
      return '<option value="' + k + '"' + ((el.zProfile || 'flat') === k ? ' selected' : '') + '>' + esc(Z_PROFILES[k]) + '</option>';
    }).join('');
    var zOpen = (state.zOpen && state.zOpen[i]) ? ' open' : '';
    var zExtra = (el.zProfile && el.zProfile !== 'flat') ? '' : ' style="display:none"';
    var zDetails = '<details class="scene-z"' + zOpen + '>' +
      '<summary>Высоты Z <span class="z-mini">' + esc(hi.short) + '</span></summary>' +
      '<div class="scene-z-body">' +
      '<div class="fields">' +
      '<div class="field"><label>Своя глубина, мм <i class="q" data-tip-text="Глубина только для этой фигуры. Пусто — как в общих параметрах. Отрицательное значение идёт вниз от Z0.">?</i></label>' +
      '<input type="number" data-z="depth" value="' + esc(el.depth === null || el.depth === undefined ? '' : fmt(el.depth, 3)) + '" step="0.1" placeholder="как в программе"></div>' +
      '<div class="field"><label>Профиль высоты <i class="q" data-tip-text="Постоянная — одна глубина. Наклон — плавный переход Z по X или Y. Ступени — несколько плоских уровней внутри одной фигуры.">?</i></label>' +
      '<select data-z="profile">' + zOpts + '</select></div>' +
      '</div>' +
      '<div class="fields z-extra"' + zExtra + '>' +
      '<div class="field"><label>Z в начале, мм <i class="q" data-tip-text="Глубина в начале профиля (левая или нижняя сторона фигуры). Отрицательная.">?</i></label>' +
      '<input type="number" data-z="z1" value="' + esc(fmt(el.z1 !== undefined ? el.z1 : -1, 3)) + '" step="0.1"></div>' +
      '<div class="field"><label>Z в конце, мм <i class="q" data-tip-text="Глубина в конце профиля (правая или верхняя сторона фигуры). Отрицательная.">?</i></label>' +
      '<input type="number" data-z="z2" value="' + esc(fmt(el.z2 !== undefined ? el.z2 : -3, 3)) + '" step="0.1"></div>' +
      '<div class="field z-steps"' + ((el.zProfile || '').indexOf('steps') === 0 ? '' : ' style="display:none"') + '><label>Ступеней <i class="q" data-tip-text="Сколько плоских уровней сделать между Z в начале и Z в конце. Работает только для профиля «Ступени».">?</i></label>' +
      '<input type="number" data-z="zSteps" value="' + esc(el.zSteps !== undefined ? el.zSteps : 4) + '" min="2" max="64" step="1"></div>' +
      '</div>' +
      '<p class="hint">Профиль действует внутри одной фигуры: наклон или ступени по X/Y. Глубина элемента перекрывает общую. Перемычки с профилем несовместимы.</p>' +
      '</div></details>';
    card.innerHTML = head + fields + place + toolRow + zDetails;
    box.appendChild(card);
  });
}

function onToolField(e, isChange){
  var card = e.target.closest('.tool-card');
  if (!card) return;
  var idx = +card.dataset.toolIdx;
  var t = state.tools[idx];
  if (!t) return;
  var field = e.target.dataset.tf;
  if (!field) return;
  if (field === 'name'){
    t.name = e.target.value || ('Инструмент T' + t.no);
  } else {
    var v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    if (field === 'd') t.d = Math.max(0.1, v);
    else if (field === 'flutes') t.flutes = Math.max(1, Math.round(v));
    else if (field === 's') t.s = Math.max(0, Math.round(v));
    else if (field === 'f') t.f = Math.max(1, Math.round(v));
    else if (field === 'fz') t.fz = Math.max(1, Math.round(v));
  }
  if (isChange){
    renderSceneList();
    generate();
    pushHistory(true);
  } else {
    scheduleGenerate();
    scheduleHistory();
  }
}

function addTool(){
  var max = 0;
  state.tools.forEach(function(t){ max = Math.max(max, Number(t.no) || 0); });
  var no = max + 1;
  state.tools.push({
    no: no,
    name: 'Инструмент T' + no,
    d: Math.max(0.1, num('toolDiam')),
    flutes: 2,
    s: Math.max(0, Math.round(num('spindle'))),
    f: Math.max(1, Math.round(num('feed'))),
    fz: Math.max(1, Math.round(num('plungeFeed')))
  });
  renderToolList();
  renderSceneList();
  generate();
  pushHistory(true);
  showToast('Добавлен T' + no);
}

function deleteTool(idx){
  if (state.tools.length <= 1){ showToast('Должен остаться хотя бы один инструмент'); return; }
  var removed = state.tools[idx];
  if (!removed) return;
  state.tools.splice(idx, 1);
  var firstNo = state.tools[0].no;
  state.scene.elements.forEach(function(el){
    if (Number(el.tool) === Number(removed.no)) el.tool = firstNo;
  });
  renderToolList();
  renderSceneList();
  generate();
  pushHistory(true);
  showToast('T' + removed.no + ' удалён');
}

function fieldHtml(el, f){
  var id = uid('f');
  var val = el.params[f.k];
  var tip = f.tip ? ' <i class="q" data-tip-text="' + esc(f.tip) + '">?</i>' : '';
  var label = '<label for="' + id + '">' + esc(f.label) + tip + '</label>';
  if (f.type === 'check'){
    return '<div class="field check"><label for="' + id + '"><input type="checkbox" id="' + id + '" data-field="' + f.k + '"' +
      (val ? ' checked' : '') + '> ' + esc(f.label) + tip + '</label></div>';
  }
  if (f.type === 'select'){
    var opts = (f.options || []).map(function(pair){
      return '<option value="' + esc(pair[0]) + '"' + (String(val) === String(pair[0]) ? ' selected' : '') + '>' + esc(pair[1]) + '</option>';
    }).join('');
    return label + '<select id="' + id + '" data-field="' + f.k + '">' + opts + '</select>';
  }
  if (f.type === 'textarea'){
    return label + '<textarea id="' + id + '" data-field="' + f.k + '" style="height:60px" spellcheck="false">' + esc(val) + '</textarea>';
  }
  if (f.type === 'text'){
    return label + '<input type="text" id="' + id + '" data-field="' + f.k + '" value="' + esc(val) + '">';
  }
  return label + '<input type="number" id="' + id + '" data-field="' + f.k + '" value="' + esc(val) + '"' +
    (f.min !== undefined ? ' min="' + f.min + '"' : '') +
    (f.max !== undefined ? ' max="' + f.max + '"' : '') +
    (f.step !== undefined ? ' step="' + f.step + '"' : '') + '>';
}

function sceneElFromEvent(e){
  var card = e.target.closest('.scene-card');
  if (!card) return null;
  var el = state.scene.elements[+card.dataset.idx];
  return el ? {card:card, el:el, idx:+card.dataset.idx} : null;
}

function updateCardTitle(card, el){
  var nm = card.querySelector('.sw .nm');
  if (nm) nm.textContent = elementSummary(el);
}

function addElement(type){
  var b = state.scene.blank || {enabled:true, w:80, h:50};
  var cx = b.enabled ? b.w / 2 : 50;
  var cy = b.enabled ? b.h / 2 : 50;
  var base = num('depth');
  if (!(base < 0)) base = -1;
  state.scene.elements.push({
    type: type,
    enabled: true,
    rot: 0,
    tool: state.tools[0] ? state.tools[0].no : 1,
    depth: null,
    zProfile: 'flat',
    z1: base,
    z2: base - 1,
    zSteps: 4,
    params: elementDefaults(type),
    place: {mode:'center', x:cx, y:cy}
  });
  renderSceneList();
  generate();
  pushHistory(true);
  showToast('Добавлено: ' + (ELEMENT_TYPES[type] ? ELEMENT_TYPES[type].name : type));
}

function applyTemplate(t){
  state.scene = t.build();
  syncBlankInputs();
  renderSceneList();
  generate();
  pushHistory(true);
  showToast('Шаблон: ' + t.name);
}

function updateSceneNote(){
  var els = state.scene.elements.filter(function(e){ return e.enabled !== false; });
  var html = 'Элементов: <b>' + els.length + '</b> · поле: <b>' +
    fmt(state.scene.blank.w, 1) + '×' + fmt(state.scene.blank.h, 1) + ' мм</b>';
  var interesting = els.filter(function(e){
    return (e.depth !== null && e.depth !== undefined && e.depth !== '') || (e.zProfile && e.zProfile !== 'flat');
  });
  if (interesting.length){
    html += '<br>Высоты Z: ' + esc(interesting.slice(0, 4).map(function(e){
      return elementHeightInfo(e, num('depth')).short;
    }).join(' · ')) + (interesting.length > 4 ? ' …' : '');
  }
  if (state.lastWarnings && state.lastWarnings.length){
    html += '<br>⚠ ' + esc(state.lastWarnings.slice(0, 3).join(' · '));
  } else {
    html += '<br>Порядок обработки — сверху вниз по списку.';
  }
  var note = $('sceneNote');
  note.className = 'note' + (state.lastWarnings && state.lastWarnings.length ? ' warn' : '');
  note.innerHTML = html;
  /* бейджи высот могли зависеть от общей глубины — обновляем без перерисовки карточек */
  var cards = document.querySelectorAll('.scene-card');
  for (var ci = 0; ci < cards.length; ci++){
    var cel = state.scene.elements[ci];
    if (!cel) continue;
    var chi = elementHeightInfo(cel, num('depth'));
    var badge = cards[ci].querySelector('.z-badge');
    var mini = cards[ci].querySelector('.z-mini');
    if (badge){ badge.textContent = chi.short; badge.title = chi.label; }
    if (mini) mini.textContent = chi.short;
  }
}

/* ---------------------------------------------------------------- гравировка */
function toggleEngrMode(){
  var isCalc = $('engrMode').value === 'calc';
  $('engrTextWrap').style.display = isCalc ? 'none' : 'block';
  $('engrCalcWrap').style.display = isCalc ? 'block' : 'none';
  updateEngrNote();
}
function updateCalcResult(){
  var box = $('calcResult');
  try {
    var v = safeEval($('calcExpr').value);
    box.textContent = '= ' + fmt(v, 4);
    box.style.color = '#8fd0a8';
  } catch (e){
    box.textContent = '⚠ ' + e.message;
    box.style.color = '#ff8f8f';
  }
  updateEngrNote();
}
var _noteCache = '';
function updateEngrNote(){
  var text = currentEngrText();
  var size = Math.max(1, num('engrSize'));
  var g = buildTextGeometry(text, size, 0, 0, {align:'left'});
  var chars = text.replace(/\s/g, '').length;
  var html = 'Символов: <b>' + chars + '</b> · строк: <b>' + g.lines + '</b> · ширина ≈ <b>' + fmt(g.width, 1) + ' мм</b>';
  if (g.missing.length){
    html += '<br>⚠ Нет глифов: <b>' + esc(g.missing.join(' ')) + '</b> — эти символы будут пропущены.';
  }
  if ($('engrKind').value === 'inverse'){
    html += '<br>Обратная гравировка: инструмент Ø' + fmt(num('toolDiam'), 2) +
      ' мм, шаг растра ' + fmt(num('stepover'), 2) + ' мм.';
  }
  var note = $('engrNote');
  note.className = 'note' + (g.missing.length ? ' warn' : '');
  if (html !== _noteCache){ note.innerHTML = html; _noteCache = html; }
}

/* ---------------------------------------------------------------- резьба */
function selectOption(sel, value){
  var opts = sel.options || [];
  for (var i = 0; i < opts.length; i++){
    if (String(opts[i].value) === String(value)) opts[i].setAttribute('selected', 'selected');
    else opts[i].removeAttribute('selected');
  }
}

function fillSelect(id, items, selected){
  var sel = $(id);
  if (!sel) return;
  sel.innerHTML = items.map(function(it){
    return '<option value="' + esc(it.value) + '">' + esc(it.label) + '</option>';
  }).join('');
  if (selected !== undefined) selectOption(sel, selected);
}

function materialOptions(){
  return Object.keys(TABLES.materials).map(function(k){
    return {value:k, label:TABLES.materials[k].name};
  });
}

function initThreadUI(){
  var threads = (TABLES.threads || []).map(function(t){
    return {value:t.size, label:t.size + ' — шаг ' + fmt(t.p, 2) + ' мм'};
  });
  fillSelect('t84Thread', threads, 'M6');
  fillSelect('tExtThread', threads, 'M10');
  var mats = materialOptions();
  fillSelect('t84Mat', mats, 'aluminium');
  fillSelect('t83Mat', mats, 'steel');

  var sel = $('t84Thread');
  sel.addEventListener('change', function(){
    var t = threadOf(sel.value);
    if (!t) return;
    $('t84D').value = t.d;
    $('t84P').value = t.p;
    var info = $('t84Info');
    info.className = 'note ok';
    info.innerHTML = 'Сверло под резьбу <b>' + esc(t.size) + '</b>: Ø<b>' + fmt(t.tap, 2) +
      '</b> мм (D − P), зенковка Ø' + fmt(t.clear, 2) + ' мм.';
    calcThread('t84');
  });

  var extSel = $('tExtThread');
  if (extSel) extSel.addEventListener('change', function(){
    var t = threadOf(extSel.value);
    if (!t) return;
    $('tExtD').value = t.d;
    $('tExtP').value = t.p;
    calcThread('tExt');
  });

  ['t84Calc','t84Make','t83Calc','t83Make','t76Calc','t76Make','tExtCalc','tExtMake'].forEach(function(id){
    var btn = $(id);
    if (!btn) return;
    var isMake = /Make$/.test(id);
    var kind = id.replace(/(Calc|Make)$/, '');
    btn.addEventListener('click', function(){
      if (isMake) makeThreadProgram(kind);
      else calcThread(kind);
    });
  });
  ['t84Auto','t84Fmode','t84Rigid','t84D','t84P','t84Depth','t84R','t84Mat','t84S'].forEach(function(id){
    var el = $(id); if (el) el.addEventListener('input', function(){ calcThread('t84'); });
  });
  ['t83Auto','t83D','t83Depth','t83R','t83Q','t83Cycle','t83P','t83Mat','t83S','t83F'].forEach(function(id){
    var el = $(id); if (el) el.addEventListener('input', function(){ calcThread('t83'); });
  });
  ['t76D','t76Depth','t76R','t76Q','t76P','t76S','t76F'].forEach(function(id){
    var el = $(id); if (el) el.addEventListener('input', function(){ calcThread('t76'); });
  });
  ['tExtD','tExtP','tExtLen','tExtTool','tExtPass','tExtHand','tExtS','tExtF','tExtFz'].forEach(function(id){
    var el = $(id); if (el) el.addEventListener('input', function(){ calcThread('tExt'); });
    if (el && el.tagName === 'SELECT') el.addEventListener('change', function(){ calcThread('tExt'); });
  });
  ['hRows','hCols','hDx','hDy','hX0','hY0'].forEach(function(id){
    var el = $(id); if (el) el.addEventListener('input', function(){
      if (!state.thread.t84) calcThread('t84');
      else calcThread(state.threadTab);
    });
  });

  document.querySelectorAll('.subtab').forEach(function(btn){
    btn.addEventListener('click', function(){
      var sub = btn.dataset.sub;
      state.threadTab = sub;
      document.querySelectorAll('.subtab').forEach(function(b){ b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.subpane').forEach(function(p){ p.classList.toggle('active', p.id === 'sub-' + sub); });
      if (!state.thread[sub]) calcThread(sub);
      makeThreadProgram(sub, true);
    });
  });
}

function readHoles(){
  return holeGrid({
    rows: num('hRows'), cols: num('hCols'),
    dx: num('hDx'), dy: num('hDy'),
    x0: num('hX0'), y0: num('hY0')
  });
}

function metaBadges(pairs){
  return pairs.map(function(p){ return '<span class="tag">' + esc(p[0]) + ' <b>' + esc(p[1]) + '</b></span>'; }).join('');
}

function calcThread(kind){
  var p = readParams();
  var holes = readHoles();
  var res, outEl = $(kind + 'Out'), metaEl = $(kind + 'Meta'), infoEl = $(kind + 'Info');
  try {
    if (kind === 't84'){
      var mat = $('t84Mat').value;
      res = calcTapping({
        thread: $('t84Thread').value,
        d: num('t84D'), p: num('t84P'),
        depth: num('t84Depth'), r: num('t84R'),
        s: num('t84S'), sManual: !$('t84Auto').checked,
        fmode: $('t84Fmode').value, rigid: $('t84Rigid').checked,
        material: mat, holes: holes, safeZ: p.safeZ
      });
      $('t84S').value = Math.round(res.S);
      outEl.textContent = res.code;
      metaEl.innerHTML = metaBadges([
        ['S', fmt(res.S, 0) + ' об/мин'],
        ['F', fmt(res.F, 1) + (res.fmode === 'rev' ? ' мм/об' : ' мм/мин')],
        ['глубина', fmt(res.depth, 2) + ' мм'],
        ['сверло', 'Ø' + fmt(res.tapDrill, 2)],
        ['отверстий', res.holes],
        ['~время', formatTime(res.timeSec)]
      ]);
      infoEl.className = 'note' + (res.warnings.length ? ' warn' : ' ok');
      infoEl.innerHTML = (res.warnings.length
        ? '⚠ ' + res.warnings.map(esc).join('<br>⚠ ')
        : '✅ Параметры корректны. Сверло под резьбу: Ø' + fmt(res.tapDrill, 2) + ' мм.') +
        '<br>Проверьте жёсткость метчика и наличие реверса шпинделя.';
    } else if (kind === 't83'){
      var auto = $('t83Auto').checked;
      res = calcDrilling({
        d: num('t83D'), depth: num('t83Depth'), r: num('t83R'), q: num('t83Q'),
        cycle: $('t83Cycle').value, p: num('t83P'),
        material: $('t83Mat').value,
        s: num('t83S'), f: num('t83F'),
        sManual: !auto, fManual: !auto,
        holes: holes, safeZ: p.safeZ
      });
      $('t83S').value = Math.round(res.S);
      $('t83F').value = Math.round(res.F);
      outEl.textContent = res.code;
      metaEl.innerHTML = metaBadges([
        ['S', fmt(res.S, 0) + ' об/мин'],
        ['F', fmt(res.F, 0) + ' мм/мин'],
        ['Q', fmt(res.Q, 2) + ' мм'],
        ['заходов', res.pecks],
        ['отверстий', res.holes],
        ['~время', formatTime(res.timeSec)]
      ]);
      infoEl.className = 'note' + (res.warnings.length ? ' warn' : ' ok');
      infoEl.innerHTML = (res.warnings.length
        ? '⚠ ' + res.warnings.map(esc).join('<br>⚠ ')
        : '✅ Параметры корректны.') +
        '<br>G83 выводит стружку на каждом заходе; для глубоких отверстий уменьшайте Q.';
    } else if (kind === 'tExt'){
      res = calcExternalThread({
        d: num('tExtD'), p: num('tExtP'), len: num('tExtLen'),
        toolD: num('tExtTool'), pass: num('tExtPass'),
        hand: $('tExtHand').value, s: num('tExtS'), f: num('tExtF'), fz: num('tExtFz'),
        safeZ: p.safeZ
      });
      outEl.textContent = res.code;
      metaEl.innerHTML = metaBadges([
        ['резьба', 'Ø' + fmt(res.D, 2) + '×' + fmt(res.P, 2)],
        ['h', fmt(res.h, 3) + ' мм'],
        ['фреза', 'Ø' + fmt(res.toolD, 2)],
        ['проходов', res.nPass],
        ['S', fmt(res.S, 0) + ' об/мин'],
        ['F', fmt(res.F, 0) + ' мм/мин'],
        ['~время', formatTime(res.timeSec)]
      ]);
      infoEl.className = 'note' + (res.warnings.length ? ' warn' : ' ok');
      infoEl.innerHTML = (res.warnings.length
        ? '⚠ ' + res.warnings.map(esc).join('<br>⚠ ')
        : '✅ Параметры корректны. R траектории: ' + fmt(res.rEnd, 3) + ' мм, впадина Ø' + fmt(res.rMinor * 2, 3) + ' мм.') +
        '<br>Наружная резьба фрезой: нужна резьбовая фреза, а не обычная концевая. Проверьте направление G2/G3 и вращение шпинделя на первом проходе.';
    } else {
      res = calcBoring({
        d: num('t76D'), depth: num('t76Depth'), r: num('t76R'),
        q: num('t76Q'), p: num('t76P'), s: num('t76S'), f: num('t76F'),
        holes: holes, safeZ: p.safeZ
      });
      outEl.textContent = res.code;
      metaEl.innerHTML = metaBadges([
        ['S', fmt(res.S, 0) + ' об/мин'],
        ['F', fmt(res.F, 0) + ' мм/мин'],
        ['Q', fmt(res.Q, 2) + ' мм'],
        ['P', fmt(res.P, 2)],
        ['отверстий', res.holes],
        ['~время', formatTime(res.timeSec)]
      ]);
      infoEl.className = 'note' + (res.warnings.length ? ' warn' : ' ok');
      infoEl.innerHTML = (res.warnings.length
        ? '⚠ ' + res.warnings.map(esc).join('<br>⚠ ')
        : '✅ Параметры корректны.') +
        '<br>Единицы P зависят от контроллера — проверьте стойку.';
    }
    state.thread[kind] = res;
    if (state.programSource === 'thread:' + kind && state.tab === 'threads'){
      makeThreadProgram(kind, true);
    }
  } catch (err){
    infoEl.className = 'note err';
    infoEl.textContent = 'Ошибка: ' + err.message;
  }
}

function makeThreadProgram(kind, silent){
  var res = state.thread[kind];
  if (!res){ calcThread(kind); res = state.thread[kind]; }
  if (!res) return;
  var p = readParams();
  var title = {t84:'РЕЗЬБА G84', t83:'СВЕРЛЕНИЕ', t76:'РАСТАЧИВАНИЕ G76', tExt:'НАРУЖНАЯ РЕЗЬБА'}[kind] || 'ОПЕРАЦИЯ';
  var code = wrapSnippet(res.code, title, {safeZ:p.safeZ, controller:p.controller, asciiComments:p.asciiComments,
    wcs:p.wcs, useM6:p.useM6, toolNumber:p.toolNum});
  var st = parseProgram(code);
  present(code, {moves: st.moves, owner: title.toLowerCase(), blank: {enabled:false}, warnings: res.warnings});
  state.lastScene = null;
  state.programSource = 'thread:' + kind;
  if (!silent) showToast('Программа собрана — проверьте чек-лист');
}

/* ---------------------------------------------------------------- режимы резания */
var feedsResult = null;
function calcMaterial(){
  var res = calcFeeds({
    material: $('matType').value,
    op: $('matOp').value,
    d: num('matD'),
    z: num('matZ')
  });
  feedsResult = res;
  var out = $('matOut');
  out.className = 'note ok';
  out.innerHTML =
    '<b>' + esc(res.material) + ' · Ø' + fmt(res.D, 2) + ' мм · ' + res.z + ' зуб. · ' +
    (res.op === 'rough' ? 'черновая' : 'чистовая') + '</b><br>' +
    'S = <b>' + res.S + '</b> об/мин · F = <b>' + res.F + '</b> мм/мин · Fz = <b>' + res.Fz + '</b> мм/мин<br>' +
    'ap = ' + fmt(res.ap, 2) + ' мм · ae = ' + fmt(res.ae, 2) + ' мм · fz = ' + fmt(res.fz, 3) +
    ' мм · Vc = ' + res.Vc + ' м/мин';
}
function applyFeeds(){
  if (!feedsResult) calcMaterial();
  if (!feedsResult) return;
  $('spindle').value = feedsResult.S;
  $('feed').value = feedsResult.F;
  $('plungeFeed').value = feedsResult.Fz;
  showToast('S/F применены');
  if (state.tab === 'engrave' || state.tab === 'scene') generate();
}

/* ---------------------------------------------------------------- импорт */
function setImportInfo(kind, html){
  var el = $('importInfo');
  el.className = 'note ' + (kind || '');
  el.innerHTML = html;
}

function clearOutput(owner){
  $('output').value = '';
  $('output').placeholder = (owner && owner.indexOf('импорт') === 0)
    ? 'Вставьте G-код в поле слева и нажмите «Проверить и показать»'
    : 'Нажмите «Сгенерировать» или измените параметры';
  $('checklist').innerHTML = '';
  $('checkSummary').innerHTML = '';
  $('statsBox').innerHTML = '';
  $('previewInfo').textContent = '—';
  $('outOwner').textContent = owner || '—';
  $('download').disabled = true;
  state.check = null;
  drawPreview([]);
}

function importProgram(silent){
  var code = $('importCode').value;
  if (!code.trim()){ setImportInfo('err', '⚠ Вставьте G-код для проверки.'); return; }
  var st = parseProgram(code);
  if (!st.moves.length){ setImportInfo('err', '⚠ Не найдено движений G0/G1/G2/G3 с координатами.'); return; }
  var pr = present(code, {moves: st.moves, owner: 'импорт', blank: {enabled:false}});
  state.importCode = code;
  state.lastScene = null;
  state.programSource = 'import';
  var b = st.bounds || {minX:0, minY:0, maxX:0, maxY:0};
  var html = '✅ Разобрано движений: <b>' + st.moves.length + '</b><br>' +
    'X ' + fmt(b.minX, 2) + '…' + fmt(b.maxX, 2) + ' · Y ' + fmt(b.minY, 2) + '…' + fmt(b.maxY, 2) +
    ' · мин. Z ' + fmt(st.minCutZ, 3) + ' мм<br>' +
    '⏱ ≈ ' + formatTime(pr.est.totalSec) + ' · строк ' + st.lineCount;
  if (st.macroExpanded) html += '<br>🧩 Параметрическая программа раскрыта: #переменные и WHILE выполнены для предпросмотра.';
  if (st.cycleIssues.length) html += '<br>⚠ ' + esc(st.cycleIssues.slice(0,3).map(function(x){ return 'стр.' + x.line + ': ' + x.text; }).join('; '));
  if (st.arcIssues.length) html += '<br>❌ ' + esc(st.arcIssues.slice(0,3).map(function(x){ return 'стр.' + x.line + ': ' + x.text; }).join('; '));
  if (!silent) setImportInfo(pr.res.ok ? (pr.res.warnings ? 'warn' : 'ok') : 'err', html);
}

/* ---------------------------------------------------------------- дуги */
function syncArcFullFields(){
  var full = !!($('arcFull') && $('arcFull').checked);
  if ($('arcEx')) $('arcEx').disabled = full;
  if ($('arcEy')) $('arcEy').disabled = full;
  if ($('arcR')) $('arcR').disabled = full;
  if ($('arcCxWrap')) $('arcCxWrap').style.display = full ? '' : 'none';
  if ($('arcCyWrap')) $('arcCyWrap').style.display = full ? '' : 'none';
  ['arcExWrap','arcEyWrap','arcRWrap'].forEach(function(id){
    var el = $(id);
    if (el) el.style.display = full ? 'none' : '';
  });
  if (full){
    if ($('arcEx')) $('arcEx').value = $('arcSx').value;
    if ($('arcEy')) $('arcEy').value = $('arcSy').value;
  }
}

function updateArc(){
  syncArcFullFields();
  var full = !!($('arcFull') && $('arcFull').checked);
  var sx = num('arcSx'), sy = num('arcSy'), dir = $('arcDir').value;
  var res;
  if (full){
    res = solveFullCircle(sx, sy, num('arcCx'), num('arcCy'), dir);
  } else {
    var rIn = parseFloat($('arcR').value);
    res = solveArc(sx, sy, num('arcEx'), num('arcEy'), isFinite(rIn) ? rIn : null, dir);
  }
  state.arc = res;
  if (res.error){
    $('arcOut').textContent = '⚠ ' + res.error;
    $('arcPreview').innerHTML = '';
    if ($('arcInfo')) $('arcInfo').textContent = '—';
    return;
  }
  if ($('arcInfo')) $('arcInfo').textContent = 'R=' + fmt(res.r) + ' · ' + res.sweepDeg.toFixed(1) + '° · ' + fmt(res.arcLen) + ' мм';
  if (full){
    $('arcOut').textContent =
      'Центр: X = ' + fmt(res.cx) + ', Y = ' + fmt(res.cy) + '\n' +
      'I = ' + fmt(res.i) + '   J = ' + fmt(res.j) + '\n' +
      'R = ' + fmt(res.r) + ' мм · полный круг 360°\n' +
      'Длина круга: ' + fmt(res.arcLen) + ' мм\n\n' +
      res.line;
  } else {
    $('arcOut').textContent =
      'Центр: X = ' + fmt(res.cx) + ', Y = ' + fmt(res.cy) + '\n' +
      'I = ' + fmt(res.i) + '   J = ' + fmt(res.j) + '\n' +
      'R = ' + fmt(res.r) + ' мм · хорда ' + fmt(res.chord) + ' мм\n' +
      'Угол: ' + res.sweepDeg.toFixed(2) + '° · длина дуги ' + fmt(res.arcLen) + ' мм\n\n' +
      res.line + '\n' + res.rLine;
  }
  drawArcPreview(res);
}

function drawArcPreview(res){
  var svg = $('arcPreview');
  svg.innerHTML = '';
  var sx = num('arcSx'), sy = num('arcSy'), ex = num('arcEx'), ey = num('arcEy');
  var dir = $('arcDir').value;
  var cx = res.cx, cy = res.cy, r = res.r;
  var aS = Math.atan2(sy - cy, sx - cx);
  var sign = dir === 'G3' ? 1 : -1;
  var sweep = res.sweepDeg * Math.PI / 180;
  var pts = [[sx, sy]];
  for (var i = 0; i <= 64; i++){
    var a = aS + sign * sweep * i / 64;
    pts.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]);
  }
  var minX = Math.min(sx, ex, cx - r), maxX = Math.max(sx, ex, cx + r);
  var minY = Math.min(sy, ey, cy - r), maxY = Math.max(sy, ey, cy + r);
  var w = Math.max(maxX - minX, 0.001), h = Math.max(maxY - minY, 0.001);
  var W = 440, H = 300, pad = 42;
  var sc = Math.min((W - 2*pad) / w, (H - 2*pad) / h);
  var ox = (W - w*sc)/2 - minX*sc;
  var oy = (H - h*sc)/2 + maxY*sc;
  function tx(x){ return x*sc + ox; }
  function ty(y){ return oy - y*sc; }
  function el(tag, attrs){
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  svg.appendChild(el('rect', {x:0, y:0, width:W, height:H, fill:'#0a0a0d'}));
  svg.appendChild(el('circle', {cx:tx(cx), cy:ty(cy), r:r*sc, fill:'none', stroke:'#262630', 'stroke-width':1, 'stroke-dasharray':'3 4'}));
  if (!res.full){
    svg.appendChild(el('line', {x1:tx(sx), y1:ty(sy), x2:tx(ex), y2:ty(ey), stroke:'#5c5c68', 'stroke-width':1, 'stroke-dasharray':'5 4'}));
    svg.appendChild(el('line', {x1:tx(cx), y1:ty(cy), x2:tx(ex), y2:ty(ey), stroke:'#4a90d9', 'stroke-width':1, 'stroke-dasharray':'3 3'}));
  }
  svg.appendChild(el('line', {x1:tx(cx), y1:ty(cy), x2:tx(sx), y2:ty(sy), stroke:'#4a90d9', 'stroke-width':1, 'stroke-dasharray':'3 3'}));
  svg.appendChild(el('polyline', {
    points: pts.map(function(p){ return tx(p[0]) + ',' + ty(p[1]); }).join(' '),
    fill:'none', stroke:'#ff6b35', 'stroke-width':2.4, 'stroke-linecap':'round'
  }));
  var marks = [[sx, sy, 'S', '#4ade80'], [cx, cy, 'C', '#4a90d9']];
  if (!res.full) marks.push([ex, ey, 'E', '#ff5d5d']);
  marks.forEach(function(p){
    svg.appendChild(el('circle', {cx:tx(p[0]), cy:ty(p[1]), r:4.5, fill:p[3], stroke:'#000', 'stroke-width':1}));
    var t = el('text', {x:tx(p[0])+7, y:ty(p[1])-7, fill:p[3], 'font-size':12, 'font-family':'system-ui', 'font-weight':700});
    t.textContent = p[2];
    svg.appendChild(t);
  });
  var badge = el('text', {x:10, y:18, fill:'#8f8f9c', 'font-size':11, 'font-family':'system-ui'});
  badge.textContent = dir + ' · R=' + fmt(r) + ' · ' + res.sweepDeg.toFixed(1) + '°';
  svg.appendChild(badge);
}

function insertIntoProgram(block){
  var ta = $('output');
  var cur = ta.value;
  var p = readParams();
  if (!cur.trim()){
    ta.value = [
      'G21', 'G90', 'G17', 'G94',
      'M3 S' + fmt(p.spindle, 0),
      'G0 Z' + fmt(p.safeZ),
      block,
      'M5',
      'G0 Z' + fmt(p.safeZ),
      'G0 X0 Y0',
      'M30'
    ].join('\n') + '\n';
  } else {
    /* вставляем до финального M5, чтобы шпиндель и подача ещё действовали */
    var idx = cur.lastIndexOf('\nM5');
    if (idx < 0) idx = cur.lastIndexOf('\nM30');
    if (idx < 0) ta.value = cur + '\n' + block + '\n';
    else ta.value = cur.slice(0, idx) + '\n' + block + cur.slice(idx);
  }
  var st = parseProgram(ta.value);
  present(ta.value, {moves: st.moves, owner: 'изменено вручную', blank: state.lastScene ? state.lastScene.blank : {enabled:false}});
  state.programSource = 'manual';
  state.manualEdit = true;
  showToast('Добавлено в программу');
}

function arcInsertBlock(){
  var p = readParams();
  var depth = p.depth < 0 ? p.depth : -Math.max(0.1, Math.abs(p.depth || 1));
  return [
    'G0 Z' + fmt(p.safeZ),
    'G0 X' + fmt(num('arcSx')) + ' Y' + fmt(num('arcSy')),
    'G1 Z' + fmt(depth) + ' F' + fmt(p.Fz, 0),
    state.arc.line + ' F' + fmt(p.F, 0),
    'G0 Z' + fmt(p.safeZ)
  ].join('\n');
}

function resetArc(){
  $('arcSx').value = 10;
  $('arcSy').value = 0;
  $('arcEx').value = 0;
  $('arcEy').value = 10;
  $('arcR').value = '';
  if ($('arcFull')) $('arcFull').checked = false;
  if ($('arcCx')) $('arcCx').value = 0;
  if ($('arcCy')) $('arcCy').value = 0;
  selectOption($('arcDir'), 'G3');
  syncArcFullFields();
  updateArc();
  showToast('Параметры дуги сброшены');
}

/* ---------------------------------------------------------------- справка */
var G_REF = [
  ['G0','Быстрое позиционирование'], ['G1','Линейная интерполяция'],
  ['G2','Дуга по часовой ↻'], ['G3','Дуга против часовой ↺'],
  ['G4','Пауза (P в секундах)'], ['G17','Плоскость XY'],
  ['G18','Плоскость XZ'], ['G19','Плоскость YZ'],
  ['G20','Дюймы'], ['G21','Миллиметры'],
  ['G28','Возврат в исходную точку'], ['G40','Отмена коррекции радиуса'],
  ['G41','Коррекция радиуса слева'], ['G42','Коррекция радиуса справа'],
  ['G43','Коррекция длины инструмента'], ['G53','Машинные координаты'],
  ['G54','Рабочая система координат'], ['G61','Точный останов'],
  ['G64','Сглаживание'], ['G68','Поворот координат'],
  ['G73','Высокоскоростное сверление'], ['G76','Тонкое растачивание'],
  ['G80','Отмена постоянного цикла'], ['G81','Сверление'],
  ['G82','Сверление с паузой'], ['G83','Peck-сверление'],
  ['G84','Резьба метчиком'], ['G85','Растачивание'],
  ['G90','Абсолютные координаты'], ['G91','Инкрементальные координаты'],
  ['G94','Подача мм/мин'], ['G95','Подача мм/об'],
  ['G98','Возврат в исходную плоскость'], ['G99','Возврат в плоскость R']
];
var M_REF = [
  ['M0','Останов программы'], ['M1','Условный останов'],
  ['M2','Конец программы'], ['M3','Шпиндель CW ↻'],
  ['M4','Шпиндель CCW ↺'], ['M5','Останов шпинделя'],
  ['M6','Смена инструмента'], ['M7','Распыление (туман)'],
  ['M8','Включить СОЖ'], ['M9','Выключить СОЖ'],
  ['M19','Ориентация шпинделя'], ['M29','Жёсткая синхронизация (Fanuc)'],
  ['M30','Конец + перемотка'], ['M98','Вызов подпрограммы'],
  ['M99','Возврат из подпрограммы']
];

function refTable(rows){
  return '<table class="ref"><tr><th>Код</th><th>Описание</th></tr>' +
    rows.map(function(r){ return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') +
    '</table>';
}

/* ---------------------------------------------------------------- параметрика */
var paramTimer = null;

function paramModeValues(mode){
  var out = paramModeDefaults(mode);
  var stored = state.paramValues[mode] || {};
  Object.keys(stored).forEach(function(k){
    if (Object.prototype.hasOwnProperty.call(out, k)) out[k] = stored[k];
  });
  return out;
}

function paramVarValues(){
  var vars = {}, details = [];
  state.paramVars.forEach(function(v){
    var item = {no:v.no, name:v.name, value:NaN, text:'—', error:'', missing:[]};
    try {
      var r = paramEval(v.expr, vars);
      item.value = r.value;
      item.text = fmt(r.value, 4);
      item.missing = r.missing || [];
      if (item.missing.length) item.error = 'нет #' + item.missing.join(', #');
      if (isFinite(r.value)) vars[v.no] = r.value;
    } catch (e){
      item.error = e.message;
      item.text = '⚠';
    }
    details.push(item);
  });
  return {vars:vars, details:details};
}

function renderParamVars(){
  var box = $('paramVarList');
  if (!box) return;
  var ev = paramVarValues();
  box.innerHTML = state.paramVars.map(function(v, i){
    var d = ev.details[i] || {};
    return '<div class="pv-row" data-pv-idx="' + i + '">' +
      '<span class="pv-no">#' + v.no + '</span>' +
      '<input class="pv-name" data-pv="name" value="' + esc(v.name || '') + '" placeholder="имя" aria-label="Имя переменной #' + v.no + '" autocomplete="off">' +
      '<input class="pv-expr" data-pv="expr" value="' + esc(v.expr) + '" aria-label="Значение или выражение #' + v.no + '" autocomplete="off">' +
      '<span class="pv-val' + (d.error ? ' bad' : '') + '" title="' + esc(d.error || ('значение #' + v.no)) + '">' + esc(d.text) + '</span>' +
      '<button class="pv-del" data-pv-del="' + i + '" title="Удалить переменную">✕</button>' +
      '</div>';
  }).join('');
  state.paramVarMap = ev.vars;
  updateParamExpression();
}

function refreshParamVarValues(){
  var box = $('paramVarList');
  if (!box) return;
  var ev = paramVarValues();
  var rows = box.querySelectorAll('.pv-row');
  for (var i = 0; i < rows.length; i++){
    var d = ev.details[i] || {};
    var val = rows[i].querySelector('.pv-val');
    if (val){
      val.textContent = d.text || '—';
      val.className = 'pv-val' + (d.error ? ' bad' : '');
      val.title = d.error || ('значение #' + (state.paramVars[i] ? state.paramVars[i].no : ''));
    }
  }
  state.paramVarMap = ev.vars;
  updateParamExpression();
}

function updateParamExpression(){
  var out = $('paramExprOut');
  if (!out) return;
  var note = $('paramExprNote');
  var expr = $('paramExpr') ? $('paramExpr').value : '';
  try {
    var r = paramEval(expr, state.paramVarMap || {});
    out.textContent = '= ' + fmt(r.value, 6);
    out.className = 'param-expr-out ok';
    if (note) note.textContent = r.missing.length
      ? '⚠ Не заданы переменные: #' + r.missing.join(', #') + ' — приняты за 0.'
      : 'Выражение вычислено. Результат можно использовать в координатах и выражениях.';
  } catch (e){
    out.textContent = '⚠ ' + e.message;
    out.className = 'param-expr-out bad';
    if (note) note.textContent = 'Поддерживаются числа, #переменные, + − * / ^ MOD, SIN/COS/…, сравнения и AND/OR/XOR.';
  }
}

function renderParamFields(){
  var box = $('paramFields');
  if (!box) return;
  var def = PARAM_MODES[state.paramMode] || PARAM_MODES.bolt;
  var vals = paramModeValues(state.paramMode);
  box.innerHTML = def.fields.map(function(f){
    var tip = f.tip ? ' <i class="q" data-tip-text="' + esc(f.tip) + '">?</i>' : '';
    var val = vals[f.k];
    if (f.type === 'select'){
      var opts = (f.options || []).map(function(o){
        return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('');
      return '<div class="field"><label>' + esc(f.label) + tip + '</label><select data-pf="' + f.k + '">' + opts + '</select></div>';
    }
    return '<div class="field"><label>' + esc(f.label) + tip + '</label>' +
      '<input type="number" data-pf="' + f.k + '" value="' + esc(val) + '"' +
      (f.min !== undefined ? ' min="' + f.min + '"' : '') +
      (f.max !== undefined ? ' max="' + f.max + '"' : '') +
      (f.step !== undefined ? ' step="' + f.step + '"' : '') + '></div>';
  }).join('');
}

function readParamValues(){
  var box = $('paramFields');
  if (!box) return paramModeValues(state.paramMode);
  var vals = paramModeValues(state.paramMode);
  box.querySelectorAll('[data-pf]').forEach(function(inp){
    var k = inp.dataset.pf;
    if (inp.tagName === 'SELECT') vals[k] = inp.value;
    else {
      var n = parseFloat(inp.value);
      if (isFinite(n)) vals[k] = n;
    }
  });
  state.paramValues[state.paramMode] = vals;
  return vals;
}

function renderParamOutput(){
  var pre = $('paramOut');
  if (!pre) return;
  var res = state.paramResult;
  if (!res){
    pre.textContent = '— нажмите «Рассчитать» —';
    return;
  }
  if (res.error){
    pre.textContent = '⚠ ' + res.error;
    return;
  }
  pre.textContent = state.paramView === 'numeric' ? res.numericCode : res.code;
  var info = $('paramInfo');
  if (!info) return;
  var html = '<b>' + esc(res.summary || '') + '</b>';
  if (res.warnings && res.warnings.length) html += '<br>⚠ ' + esc(res.warnings.join(' · '));
  html += '<br><span class="dim">' + (state.paramView === 'numeric'
    ? 'Числовая версия: координаты уже посчитаны — её можно скачать и проверить чек-листом.'
    : 'Параметрическая версия: содержит #переменные и WHILE. Для Fanuc/Haas/LinuxCNC; GRBL макросы не поддерживает.') + '</span>';
  info.innerHTML = html;
  info.className = 'note' + (res.warnings && res.warnings.length ? ' warn' : ' ok');
}

function calcParam(){
  readParamValues();
  var p = readParams();
  var res = buildParametric(state.paramMode, state.paramValues[state.paramMode], {
    safeZ: p.safeZ,
    controller: p.controller,
    asciiComments: p.asciiComments,
    wcs: p.wcs,
    useM6: p.useM6,
    toolNumber: p.toolNum
  });
  state.paramResult = res;
  renderParamOutput();
}

function scheduleParamCalc(){
  clearTimeout(paramTimer);
  paramTimer = setTimeout(calcParam, 260);
}

function renderParamUI(){
  var sel = $('paramMode');
  if (sel){
    fillSelect('paramMode', Object.keys(PARAM_MODES).map(function(k){
      return {value:k, label:PARAM_MODES[k].icon + '  ' + PARAM_MODES[k].name};
    }), state.paramMode);
    selectOption(sel, state.paramMode);
  }
  if ($('paramView')) selectOption($('paramView'), state.paramView);
  renderParamVars();
  renderParamFields();
  calcParam();
}

function makeParamProgram(silent){
  if (!state.paramResult || state.paramResult.error) calcParam();
  var res = state.paramResult;
  if (!res || res.error){ if (!silent) showToast('Сначала рассчитайте программу'); return; }
  var p = readParams();
  var fresh = buildParametric(state.paramMode, state.paramValues[state.paramMode], {
    safeZ: p.safeZ, controller: p.controller, asciiComments: p.asciiComments,
    wcs: p.wcs, useM6: p.useM6, toolNumber: p.toolNum
  });
  if (fresh.error){ if (!silent) showToast(fresh.error); return; }
  var code = fresh.numericCode;
  var st = parseProgram(code);
  present(code, {moves: st.moves, owner: 'параметрика', blank: {enabled:false}, warnings: fresh.warnings});
  state.lastScene = null;
  state.programSource = 'param';
  state.manualEdit = false;
  if (!silent) showToast('Числовая версия вставлена в G-код');
}

function addParamVar(){
  var max = 99;
  state.paramVars.forEach(function(v){ max = Math.max(max, v.no); });
  state.paramVars.push({no:Math.min(999, max + 1), name:'', expr:'0'});
  renderParamVars();
  pushHistory(true);
}

function deleteParamVar(idx){
  if (state.paramVars.length <= 1){ showToast('Должна остаться хотя бы одна переменная'); return; }
  state.paramVars.splice(idx, 1);
  renderParamVars();
  pushHistory(true);
}

function onParamVarInput(e){
  var inp = e.target;
  var row = inp.closest ? inp.closest('.pv-row') : null;
  if (!row || !inp.dataset.pv) return;
  var idx = +row.dataset.pvIdx;
  var v = state.paramVars[idx];
  if (!v) return;
  if (inp.dataset.pv === 'name') v.name = inp.value;
  else v.expr = inp.value;
  refreshParamVarValues();
  scheduleHistory();
}

function onParamFieldInput(e){
  if (!e.target.dataset.pf) return;
  readParamValues();
  scheduleParamCalc();
  scheduleHistory();
}

function copyParamCode(){
  var pre = $('paramOut');
  if (!pre || !pre.textContent.trim()){ showToast('Сначала рассчитайте программу'); return; }
  var text = pre.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ showToast('Код скопирован'); }, function(){ showToast('Не удалось скопировать'); });
  } else showToast('Буфер обмена недоступен');
}

function renderReference(){
  var gEl = $('ref-gcodes'), mEl = $('ref-mcodes'), tEl = $('ref-threads-body');
  if (gEl) gEl.innerHTML = refTable(G_REF);
  if (mEl) mEl.innerHTML = refTable(M_REF);

  var th = (TABLES.threads || []).map(function(t){
    return '<tr><td>' + esc(t.size) + '</td><td>' + fmt(t.d, 2) + '</td><td>' + fmt(t.p, 2) +
      '</td><td>' + fmt(t.tap, 2) + '</td><td>' + fmt(t.clear, 2) + '</td></tr>';
  }).join('');
  var mats = Object.keys(TABLES.materials).map(function(k){
    var m = TABLES.materials[k];
    return '<tr><td>' + esc(m.name) + '</td><td>' + m.vc + '</td><td>' + m.drillVc +
      '</td><td>' + fmt(m.drillFz, 3) + '</td><td>' + m.tapVc + '</td></tr>';
  }).join('');
  if (tEl) tEl.innerHTML =
    '<h4>Метрическая резьба</h4>' +
    '<table class="ref"><tr><th>Резьба</th><th>Ø</th><th>Шаг</th><th>Сверло</th><th>Зенковка</th></tr>' + th + '</table>' +
    '<p>Сверло под резьбу: <code>d = D − P</code>. Значения ориентировочные, для точных посадок сверьтесь со стандартом.</p>' +
    '<h4>Материалы и режимы</h4>' +
    '<table class="ref"><tr><th>Материал</th><th>Vc фрезы</th><th>Vc сверла</th><th>fz сверла</th><th>Vc метчика</th></tr>' + mats + '</table>' +
    '<p>Vc — м/мин. Обороты: <code>n = 1000·Vc/(π·D)</code>. Подача сверла: <code>F = n · f</code>, ' +
    'где f — подача на оборот (0,01–0,06 мм в зависимости от материала и Ø).</p>';
}

/* ---------------------------------------------------------------- события */
function onMainInput(e){
  var id = e.target.id;
  if (id === 'engrMode') toggleEngrMode();
  if (id === 'calcExpr') updateCalcResult();
  if (id.indexOf('blank') === 0) syncBlank();
  if (id === 'controller'){
    var ctrl = e.target.value;
    $('asciiComments').checked = (ctrl === 'grbl' || ctrl === 'fanuc');
    $('ctrlHint').textContent = {
      universal: 'Нейтральный синтаксис: без %, комментарии в скобках, номера строк не добавляются.',
      grbl: 'GRBL: без %, комментарии транслитерируются в латиницу. M6 не поддерживается.',
      mach3: 'Mach3/4: проценты в начале и конце, комментарии в скобках.',
      linuxcnc: 'LinuxCNC: % и O-номер, номера строк N10…N…, комментарии в скобках.',
      fanuc: 'Fanuc/Haas: % и O-номер, номера строк, комментарии в скобках.',
      custom: 'Custom: шапка/подвал, WCS, формат дуг, M6/G43 и точность. Комментарии — в скобках.'
    }[ctrl] || '';
    toggleCustomPost();
  }
  updateEngrNote();
  scheduleGenerate();
  scheduleHistory();
  if (state.tab === 'param') scheduleParamCalc();
}

function initCommonEvents(){
  initPreview3D();
  MAIN_IDS.forEach(function(id){
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', onMainInput);
    el.addEventListener('change', onMainInput);
  });
  $('engrMode').addEventListener('change', toggleEngrMode);
  $('engrKind').addEventListener('change', updateEngrNote);

  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
  });

  $('download').addEventListener('click', downloadFile);
  $('copyBtn').addEventListener('click', function(){
    var txt = $('output').value;
    if (!txt){ showToast('Сначала сгенерируйте G-код'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){ showToast('G-код скопирован'); }, fallbackCopy);
    } else fallbackCopy();
    function fallbackCopy(){
      var ta = $('output');
      ta.removeAttribute('readonly');
      ta.select();
      try { document.execCommand('copy'); showToast('G-код скопирован'); }
      catch (e){ showToast('Не удалось скопировать'); }
      ta.setAttribute('readonly', 'readonly');
    }
  });

  $('templateApply').addEventListener('click', function(){
    var t = SCENE_TEMPLATES.filter(function(x){ return x.id === $('templateSel').value; })[0];
    if (t) applyTemplate(t);
  });
  $('addEl').addEventListener('click', function(){ addElement($('addType').value); });
  $('sceneClear').addEventListener('click', function(){
    state.scene.elements = [];
    renderSceneList();
    generate();
    pushHistory(true);
    showToast('Список очищен');
  });

  $('arrApply').addEventListener('click', function(){
    var cols = Math.max(1, Math.round(num('arrCols')));
    var rows = Math.max(1, Math.round(num('arrRows')));
    var dx = num('arrDx'), dy = num('arrDy');
    if (cols * rows > 200){ showToast('Слишком много копий — уменьшите количество'); return; }
    if (!state.scene.elements.length){ showToast('Сначала добавьте элементы'); return; }
    state.scene.elements = arrayElements(state.scene.elements, {rows:rows, cols:cols, dx:dx, dy:dy});
    renderSceneList();
    generate();
    pushHistory(true);
    showToast('Массив: ' + cols + ' × ' + rows);
  });

  document.querySelectorAll('[data-align]').forEach(function(btn){
    btn.addEventListener('click', function(){
      if (!state.scene.elements.length){ showToast('Сначала добавьте элементы'); return; }
      alignElements(state.scene.elements, btn.dataset.align, state.scene.blank);
      renderSceneList();
      generate();
      pushHistory(true);
      showToast('Выровнено');
    });
  });

  $('sceneList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'INPUT') return;
    var found = sceneElFromEvent(e);
    if (!found) return;
    var els = state.scene.elements;
    var idx = found.idx;
    var act = btn.dataset.act;
    if (act === 'mirrorX' || act === 'mirrorY'){
      if (act === 'mirrorX') els[idx].mirrorX = !els[idx].mirrorX;
      else els[idx].mirrorY = !els[idx].mirrorY;
      renderSceneList();
      generate();
      pushHistory(true);
      return;
    }
    if (act === 'up' && idx > 0){ els.splice(idx - 1, 0, els.splice(idx, 1)[0]); }
    else if (act === 'down' && idx < els.length - 1){ els.splice(idx + 1, 0, els.splice(idx, 1)[0]); }
    else if (act === 'dup'){
      var copy = JSON.parse(JSON.stringify(els[idx]));
      copy.place.x += 2; copy.place.y += 2;
      els.splice(idx + 1, 0, copy);
    }
    else if (act === 'del'){ els.splice(idx, 1); }
    renderSceneList();
    generate();
    pushHistory(true);
  });

  $('sceneList').addEventListener('change', function(e){
    var inp = e.target;
    if (inp.dataset.act === 'enabled'){
      var found = sceneElFromEvent(e);
      if (!found) return;
      found.el.enabled = inp.checked;
      found.card.classList.toggle('disabled', !inp.checked);
      generate();
      return;
    }
    onSceneFieldChange(e, true);
  });
  $('sceneList').addEventListener('input', function(e){
    if (e.target.dataset.act === 'enabled') return;
    onSceneFieldChange(e, false);
  });
  $('sceneList').addEventListener('toggle', function(e){
    var d = e.target && e.target.closest ? e.target.closest('details.scene-z') : null;
    if (!d) return;
    var card = d.closest('.scene-card');
    if (card) state.zOpen[+card.dataset.idx] = d.open;
  }, true);

  $('blankEnabled').addEventListener('change', function(){ syncBlank(); generate(); scheduleHistory(); });
  $('blankW').addEventListener('input', function(){ syncBlank(); scheduleGenerate(); scheduleHistory(); });
  $('blankH').addEventListener('input', function(){ syncBlank(); scheduleGenerate(); scheduleHistory(); });
  $('blankT').addEventListener('input', function(){ syncBlank(); scheduleGenerate(); scheduleHistory(); });

  $('importBtn').addEventListener('click', function(){ importProgram(false); });
  $('importClear').addEventListener('click', function(){
    $('importCode').value = '';
    state.importCode = null;
    state.programSource = null;
    clearOutput('импорт');
    setImportInfo('', 'Поле очищено. Вставьте G-код и нажмите «Проверить».');
  });

  $('arcSolve').addEventListener('click', updateArc);
  $('arcDir').addEventListener('change', updateArc);
  if ($('arcFull')) $('arcFull').addEventListener('change', function(){
    var full = this.checked;
    if (full){
      $('arcEx').value = $('arcSx').value;
      $('arcEy').value = $('arcSy').value;
    } else if (num('arcEx') === num('arcSx') && num('arcEy') === num('arcSy')){
      $('arcEx').value = fmt(num('arcSx') + 10);
      $('arcEy').value = $('arcSy').value;
    }
    syncArcFullFields();
    updateArc();
  });
  ['arcSx','arcSy','arcEx','arcEy','arcR','arcCx','arcCy'].forEach(function(id){
    var el = $(id);
    if (el) el.addEventListener('input', function(){
      clearTimeout(window._arcTimer);
      window._arcTimer = setTimeout(updateArc, 280);
    });
  });
  $('arcInsert').addEventListener('click', function(){
    if (!state.arc || state.arc.error){ showToast('Сначала рассчитайте дугу'); return; }
    insertIntoProgram(arcInsertBlock());
  });
  $('arcReset').addEventListener('click', resetArc);

  $('matCalc').addEventListener('click', calcMaterial);
  $('matApply').addEventListener('click', applyFeeds);
  ['matType','matOp','matD','matZ'].forEach(function(id){
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function(){ if (feedsResult) calcMaterial(); });
    el.addEventListener('change', function(){ if (feedsResult) calcMaterial(); });
  });

  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('useTools').addEventListener('change', function(){
    if (this.checked && state.tools.length === 1 && state.tools[0].name.indexOf('Фреза') === 0){
      state.tools[0].d = Math.max(0.1, num('toolDiam'));
      state.tools[0].s = Math.max(0, Math.round(num('spindle')));
      state.tools[0].f = Math.max(1, Math.round(num('feed')));
      state.tools[0].fz = Math.max(1, Math.round(num('plungeFeed')));
      renderToolList();
    }
    renderSceneList();
    generate();
    pushHistory(true);
  });
  $('addTool').addEventListener('click', addTool);
  $('toolList').addEventListener('input', function(e){ onToolField(e, false); });
  $('toolList').addEventListener('change', function(e){ onToolField(e, true); });
  $('toolList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-tool-del]');
    if (!btn) return;
    deleteTool(+btn.dataset.toolDel);
  });

  $('paramMode').addEventListener('change', function(){
    state.paramMode = PARAM_MODES[this.value] ? this.value : 'bolt';
    renderParamFields();
    calcParam();
    pushHistory(true);
  });
  $('paramView').addEventListener('change', function(){
    state.paramView = this.value === 'numeric' ? 'numeric' : 'param';
    renderParamOutput();
    scheduleHistory();
  });
  $('paramCalc').addEventListener('click', function(){ calcParam(); showToast('Параметрическая программа рассчитана'); });
  $('paramMake').addEventListener('click', makeParamProgram);
  $('paramCopy').addEventListener('click', copyParamCode);
  $('paramVarAdd').addEventListener('click', addParamVar);
  $('paramVarList').addEventListener('input', onParamVarInput);
  $('paramVarList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-pv-del]');
    if (!btn) return;
    deleteParamVar(+btn.dataset.pvDel);
  });
  $('paramFields').addEventListener('input', onParamFieldInput);
  $('paramFields').addEventListener('change', onParamFieldInput);
  $('paramExpr').addEventListener('input', function(){ updateParamExpression(); scheduleHistory(); });
  $('output').addEventListener('input', function(){
    state.manualEdit = true;
    $('outOwner').textContent = 'ручная правка';
    scheduleManualCheck();
  });
  $('validateBtn').addEventListener('click', manualCheckNow);
  $('regenBtn').addEventListener('click', regenerateCurrent);
  document.addEventListener('keydown', function(e){
    if (!(e.ctrlKey || e.metaKey)) return;
    var tag = (e.target && e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (e.key === 'z' || e.key === 'Z'){
      if (e.shiftKey) redo(); else undo();
      e.preventDefault();
    } else if (e.key === 'y' || e.key === 'Y'){
      redo();
      e.preventDefault();
    }
  });
  if (typeof window.addEventListener === 'function'){
    window.addEventListener('beforeunload', function(){
      try { if (store) store.setItem(STORAGE_KEY, JSON.stringify(captureProject())); } catch (e){}
    });
  }
}

function onSceneFieldChange(e, isChange){
  var inp = e.target;
  var found = sceneElFromEvent(e);
  if (!found) return;
  var el = found.el;
  var rerender = false;
  if (inp.hasAttribute('data-tool')){
    el.tool = parseFloat(inp.value) || 1;
    renderSceneList();
    scheduleGenerate();
    scheduleHistory();
    return;
  }
  if (inp.dataset.field){
    var key = inp.dataset.field;
    if (inp.type === 'checkbox') el.params[key] = inp.checked;
    else if (inp.tagName === 'SELECT'){ el.params[key] = inp.value; rerender = true; }
    else if (inp.type === 'number'){
      el.params[key] = parseFloat(inp.value) || 0;
      if (key === 'tabs' && isChange) rerender = true;
    }
    else el.params[key] = inp.value;
    if (!rerender) updateCardTitle(found.card, el);
  } else if (inp.dataset.z){
    var zk = inp.dataset.z;
    if (zk === 'depth'){
      var dv = parseFloat(inp.value);
      el.depth = isFinite(dv) ? dv : null;
    } else if (zk === 'profile'){
      el.zProfile = Z_PROFILES[inp.value] ? inp.value : 'flat';
      if (el.zProfile !== 'flat'){
        if (el.z1 === undefined) el.z1 = -1;
        if (el.z2 === undefined) el.z2 = -3;
      }
      rerender = true;
    } else if (zk === 'zSteps'){
      el.zSteps = clampNum(Math.round(parseFloat(inp.value) || 4), 2, 64);
    } else {
      el[zk] = parseFloat(inp.value) || 0;
      if (isChange) rerender = true;
    }
    if (zk === 'depth' && isChange) rerender = true;
    if (!rerender) updateCardTitle(found.card, el);
  } else if (inp.dataset.place){
    var k = inp.dataset.place;
    if (k === 'mode'){ el.place.mode = inp.value; }
    else if (k === 'rot'){ el.rot = parseFloat(inp.value) || 0; }
    else { el.place[k] = parseFloat(inp.value) || 0; }
    if (k === 'mode') rerender = false;
  }
  if (rerender){
    renderSceneList();
  }
  scheduleGenerate();
  scheduleHistory();
}

/* ---------------------------------------------------------------- картинка */
function readImageOptions(){
  return {
    mode: $('imageMode').value === 'lines' ? 'lines' : 'dots',
    width: num('imageWidth'),
    height: num('imageHeight'),
    res: num('imageRes'),
    lineStep: num('imageLineStep'),
    threshold: num('imageThreshold'),
    dither: $('imageDither').value,
    invert: !!($('imageInvert') && $('imageInvert').checked),
    depth: num('imageDepth'),
    feed: num('imageFeed'),
    plunge: num('imagePlunge'),
    safeZ: num('imageSafeZ')
  };
}

function updateImageModeUi(){
  var lines = $('imageMode') && $('imageMode').value === 'lines';
  if ($('imageLineStep')) $('imageLineStep').disabled = !lines;
}

function drawImageSource(){
  var cv = $('imagePreview');
  if (!cv) return;
  var empty = $('imageEmpty');
  if (!state.image){
    if (empty) empty.classList.remove('hidden');
    var ctx0 = cv.getContext ? cv.getContext('2d') : null;
    if (ctx0){ ctx0.fillStyle = '#0a0a0d'; ctx0.fillRect(0, 0, cv.width, cv.height); }
    return;
  }
  if (empty) empty.classList.add('hidden');
  var ctx = cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) return;
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, cv.width, cv.height);
  var img = state.image.canvas;
  var sc = Math.min(cv.width / img.width, cv.height / img.height);
  var w = img.width * sc, h = img.height * sc;
  ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
}

function setImageInfo(text){
  var el = $('imageInfo');
  if (el) el.textContent = text;
}

function loadImageFile(file){
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '') && !/\.(png|jpe?g|webp)$/i.test(file.name || '')){
    setImageInfo('⚠ Поддерживаются PNG, JPEG и WebP.');
    showToast('Нужен PNG или JPEG');
    return;
  }
  if (file.size > 12 * 1024 * 1024){
    setImageInfo('⚠ Файл больше 12 МБ — обработка может занять время.');
  }
  var reader = new (window.FileReader || FileReader)();
  reader.onload = function(){
    var img = new Image();
    img.onload = function(){
      var maxSide = 1200;
      var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      var cw = Math.max(1, Math.round(img.width * scale));
      var ch = Math.max(1, Math.round(img.height * scale));
      var c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      var cx = c.getContext ? c.getContext('2d') : null;
      if (!cx){
        setImageInfo('⚠ Браузер не поддерживает canvas для чтения картинки.');
        return;
      }
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, cw, ch);
      cx.drawImage(img, 0, 0, cw, ch);
      var data = cx.getImageData(0, 0, cw, ch).data;
      var gray = new Array(cw * ch);
      for (var i = 0, p = 0; i < gray.length; i++, p += 4){
        gray[i] = Math.round(0.299 * data[p] + 0.587 * data[p+1] + 0.114 * data[p+2]);
      }
      state.image = {name:file.name, w:cw, h:ch, gray:gray, canvas:c};
      if ($('imageAspect') && $('imageAspect').checked){
        var wmm = Math.max(1, num('imageWidth'));
        $('imageHeight').value = fmt(wmm * ch / cw, 1);
      }
      $('imageEmpty').classList.add('hidden');
      drawImageSource();
      $('imageNote').textContent = 'Загружено: ' + file.name + ' · ' + cw + '×' + ch + ' px. Файл не сохраняется в проект, только настройки.';
      generateImage();
    };
    img.onerror = function(){ setImageInfo('⚠ Не удалось прочитать изображение.'); };
    img.src = reader.result;
  };
  reader.onerror = function(){ setImageInfo('⚠ Ошибка чтения файла.'); };
  reader.readAsDataURL(file);
}

function scheduleImageGenerate(){
  if (state.tab !== 'image' || !state.image) return;
  clearTimeout(state.imageTimer);
  state.imageTimer = setTimeout(generateImage, 380);
}

function generateImage(){
  if (!state.image){ setImageInfo('— загрузите PNG/JPEG —'); return; }
  var o = readImageOptions();
  var res = imageToMoves(state.image.gray, state.image.w, state.image.h, o);
  var p = readParams();
  var meta = {
    title: 'КАРТИНКА: ' + state.image.name,
    controller: p.controller,
    spindle: p.spindle,
    safeZ: o.safeZ,
    toolD: p.toolD,
    blank: res.blank,
    asciiComments: p.asciiComments,
    coolant: p.coolant,
    decimals: p.decimals,
    arcMode: p.arcMode,
    wcs: p.wcs,
    useM6: p.useM6,
    toolNumber: p.toolNum,
    percent: p.percent,
    lineNumbers: p.lineNumbers,
    customHeader: p.customHeader,
    customFooter: p.customFooter,
    returnHome: p.returnHome
  };
  var gcode = emitProgram(res.moves, meta, {});
  state.lastProgram = {gcode:gcode, moves:res.moves, warnings:res.warnings, meta:meta};
  state.lastWarnings = res.warnings;
  state.lastImage = res;
  var out = present(gcode, {
    moves: res.moves, blank: res.blank, owner: 'картинка', warnings: res.warnings,
    toolD: p.toolD, feed: o.feed, plunge: o.plunge, safeZ: o.safeZ,
    minZ: Math.min(0, o.depth) - 0.01
  });
  state.programSource = 'tab:image';
  state.manualEdit = false;
  var what = res.mode === 'dots' ? (res.dots + ' точек') : (res.runs + ' строк');
  setImageInfo(
    'Готово: ' + what + ' · сетка ' + res.gridW + '×' + res.gridH +
    ' · ' + fmt(res.width, 1) + '×' + fmt(res.height, 1) + ' мм' +
    ' · ' + formatTime(out.est.totalSec) +
    (res.warnings.length ? '\n⚠ ' + res.warnings.join('\n⚠ ') : '')
  );
}

function clearImage(){
  state.image = null;
  state.lastImage = null;
  if ($('imageFile')) $('imageFile').value = '';
  drawImageSource();
  $('imageNote').textContent = 'Загрузите картинку. Файл обрабатывается локально в браузере и не сохраняется в проект — сохраняются только настройки.';
  setImageInfo('— загрузите PNG/JPEG —');
  clearOutput('картинка');
}

function initImageUI(){
  var file = $('imageFile');
  if (file) file.addEventListener('change', function(){ if (this.files && this.files[0]) loadImageFile(this.files[0]); });
  if ($('imageMode')) $('imageMode').addEventListener('change', function(){
    updateImageModeUi();
    scheduleImageGenerate();
    scheduleHistory();
  });
  ['imageWidth','imageHeight'].forEach(function(id){
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function(){
      if ($('imageAspect') && $('imageAspect').checked && state.image){
        if (id === 'imageWidth'){
          $('imageHeight').value = fmt(Math.max(1, num('imageWidth')) * state.image.h / state.image.w, 1);
        } else {
          $('imageWidth').value = fmt(Math.max(1, num('imageHeight')) * state.image.w / state.image.h, 1);
        }
      }
      scheduleImageGenerate();
      scheduleHistory();
    });
  });
  ['imageRes','imageLineStep','imageThreshold','imageDepth','imageFeed','imagePlunge','imageSafeZ'].forEach(function(id){
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function(){ scheduleImageGenerate(); scheduleHistory(); });
    el.addEventListener('change', function(){ scheduleImageGenerate(); scheduleHistory(); });
  });
  ['imageDither','imageInvert','imageAspect'].forEach(function(id){
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function(){
      if (id === 'imageAspect' && el.checked && state.image){
        $('imageHeight').value = fmt(Math.max(1, num('imageWidth')) * state.image.h / state.image.w, 1);
      }
      scheduleImageGenerate(); scheduleHistory();
    });
    el.addEventListener('change', function(){ scheduleImageGenerate(); scheduleHistory(); });
  });
  if ($('imageGenerate')) $('imageGenerate').addEventListener('click', generateImage);
  if ($('imageClear')) $('imageClear').addEventListener('click', clearImage);
  updateImageModeUi();
  drawImageSource();
}

/* ---------------------------------------------------------------- вкладки */
function switchTab(tab){
  state.tab = tab;
  document.querySelectorAll('.tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === tab); });
  document.querySelectorAll('.tabpane').forEach(function(p){ p.classList.toggle('active', p.id === 'tab-' + tab); });
  var common = (tab === 'engrave' || tab === 'scene');
  var showCommon = common || tab === 'param';
  $('commonParams').style.display = showCommon ? 'block' : 'none';
  $('commonSep').style.display = showCommon ? 'block' : 'none';
  $('extraTools').style.display = (tab === 'arc' || tab === 'ref' || tab === 'param' || tab === 'image') ? 'none' : 'block';
  $('layout').classList.toggle('wide', tab === 'ref');
  if (tab === 'arc' || tab === 'ref' || tab === 'param' || tab === 'image'){
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (common) generate();
  else if (tab === 'image'){
    updateImageModeUi();
    if (state.image) generateImage();
    else {
      setImageInfo('— загрузите PNG/JPEG —');
      drawImageSource();
    }
  } else if (tab === 'threads'){
    if (!state.thread[state.threadTab]) calcThread(state.threadTab);
    makeThreadProgram(state.threadTab, true);
  } else if (tab === 'import'){
    if (state.importCode) importProgram(true);
    else clearOutput('импорт — вставьте код');
  } else if (tab === 'arc'){
    updateArc();
  } else if (tab === 'param'){
    renderParamUI();
    makeParamProgram(true);
  }
}

/* ---------------------------------------------------------------- старт */
function showToast(msg){
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(function(){ t.classList.remove('show'); }, 1900);
}

function init(){
  fillSelect('templateSel', SCENE_TEMPLATES.map(function(t){ return {value:t.id, label:t.name}; }), 'frame');
  var addItems = [];
  Object.keys(ELEMENT_TYPES).forEach(function(k){
    addItems.push({value:k, label:ELEMENT_TYPES[k].icon + '  ' + ELEMENT_TYPES[k].name});
  });
  fillSelect('addType', addItems, 'text');
  fillSelect('matType', materialOptions(), 'aluminium');

  renderReference();
  initThreadUI();
  initImageUI();

  state.scene = defaultScene();
  syncBlankInputs();
  var saved = loadStoredProject();
  if (saved){
    try { restoreProject(saved, true); } catch (e){ console.error(e); }
  }
  syncBlankInputs();
  renderToolList();
  renderSceneList();
  renderParamUI();

  initTips();
  initCommonEvents();

  updateCalcResult();
  updateArc();
  calcThread('t84');
  calcThread('t83');
  calcThread('t76');
  calcThread('tExt');
  calcMaterial();
  toggleCustomPost();
  switchTab('engrave');
  initHistory();
  if (saved) showToast('Проект восстановлен');
  else setSaveStatus('💾 автосохранение');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
