import fs from 'node:fs';
import path from 'node:path';
import { loadCore } from '../test/load-core.mjs';

const C = loadCore();
const ROOT = path.resolve(import.meta.dirname, '..');
const out = { figures: [] };

function pushFig(name, op){
  out.figures.push({ name, ...op });
}
function textFig(name, text, size){
  const g = C.buildTextGeometry(text, size, 0, 0, { align: 'left' });
  pushFig(name, {
    polylines: g.segs.map(s => [[s.x1, s.y1], [s.x2, s.y2]]),
    dots: g.dots.map(d => [d.x, d.y]),
    bbox: [g.minX, g.minY, g.maxX, g.maxY],
    missing: g.missing
  });
}
function movesFig(name, moves, extra){
  const cuts = [], rapids = [], holes = [];
  let cur = null;
  const sampleArc = (a, b, m) => {
    const cx = a[0] + (m.i || 0), cy = a[1] + (m.j || 0);
    const r = Math.hypot(m.i || 0, m.j || 0);
    let aS = Math.atan2(a[1] - cy, a[0] - cx);
    let aE = Math.atan2(b[1] - cy, b[0] - cx);
    let sweep;
    if (m.dir === 'G3') { sweep = aE - aS; while (sweep <= 1e-9) sweep += 2 * Math.PI; }
    else { sweep = aS - aE; while (sweep <= 1e-9) sweep += 2 * Math.PI; }
    const n = 48, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = aS + sweep * (m.dir === 'G3' ? 1 : -1) * i / n;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    return pts;
  };
  for (const m of moves) {
    if (m.t === 'comment' || m.t === 'dwell') continue;
    const pt = [m.x, m.y];
    if (cur) {
      if (m.t === 'rapid') rapids.push([cur, pt]);
      else if (m.t === 'line') cuts.push([cur, pt]);
      else if (m.t === 'arc') cuts.push(sampleArc(cur, pt, m));
    }
    cur = pt;
  }
  pushFig(name, { polylines: cuts, rapids, dots: holes, ...(extra || {}) });
}

/* --- глифы --- */
textFig('glyphs-cyrillic',
  'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ\nабвгдеёжзийклмнопрстуфхцчшщъыьэюя\nПривет, мир! Ёжик ЙОД №2026', 10);
textFig('glyphs-latin',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 .,:-+=/?!', 10);
textFig('glyphs-extra', 'ЁЖИК ЙОД ДЦШЩЪЫЬ №5', 18);

/* --- фигуры --- */
const shapes = {
  'shape-poly6': { type: 'poly', params: { sides: 6, d: 50, rot: 0 } },
  'shape-star': { type: 'star', params: { points: 5, od: 50, id: 21, rot: 0 } },
  'shape-spiral': { type: 'spiral', params: { r0: 2, r1: 25, turns: 4.5, dir: 'ccw' } },
  'shape-sine': { type: 'sine', params: { length: 80, amp: 8, periods: 3 } },
  'shape-slot': { type: 'slot', params: { len: 40, d: 8 } },
  'shape-rect': { type: 'rect', params: { w: 60, h: 40 } },
  'shape-circle': { type: 'circle', params: { d: 40 } }
};
for (const [name, el] of Object.entries(shapes)) {
  const g = C.elementGeometry(el);
  pushFig(name, {
    polylines: g.paths.map(p => p.pts.concat(p.closed ? [p.pts[0]] : [])),
    dots: (g.dots || []).map(d => [d.x, d.y])
  });
}

/* --- сцены --- */
function sceneFig(name, scene, opts) {
  const prog = C.buildProgram(scene, opts);
  movesFig(name, prog.moves, { blank: scene.blank, warnings: prog.warnings, groups: prog.groups });
  return prog;
}

const opts = { safeZ: 5, F: 800, Fz: 200, depth: -1, passDepth: 0.5, toolD: 3, stepover: 1.2, spindle: 12000, controller: 'universal' };
sceneFig('scene-default', C.defaultScene(), opts);

const pocketScene = C.templateScene(60, 40, [
  { type: 'pocket', params: { profile: 'rect', w: 40, h: 24 } }
]);
sceneFig('scene-pocket', pocketScene, opts);

const circPocket = C.templateScene(60, 40, [
  { type: 'pocket', params: { profile: 'circle', d: 30 } }
]);
sceneFig('scene-pocket-circle', circPocket, opts);

const invScene = C.templateScene(70, 40, [
  { type: 'inv', params: { profile: 'rect', w: 40, h: 20, margin: 3 } }
]);
sceneFig('scene-inverse', invScene, opts);

const textInv = C.templateScene(70, 40, [
  { type: 'text', params: { text: 'INV', height: 10, align: 'center', inverse: true } }
]);
sceneFig('scene-text-inverse', textInv, { ...opts, toolD: 2, stepover: 0.8 });

const holesScene = C.templateScene(90, 60, [
  { type: 'rect', params: { w: 80, h: 50 } },
  { type: 'holes', params: { rows: 3, cols: 4, dx: 20, dy: 16, d: 4, depth: -6, peck: 2 } }
]);
sceneFig('scene-holes', holesScene, opts);

/* все шаблоны */
for (const t of C.SCENE_TEMPLATES) {
  const sc = t.build();
  const prog = C.buildProgram(sc, { ...opts, toolD: 3, stepover: 1.5 });
  movesFig('template-' + t.id, prog.moves, { blank: sc.blank, warnings: prog.warnings });
}

fs.writeFileSync(path.join(ROOT, 'preview/geom.json'), JSON.stringify(out, null, 1));
console.log('figures:', out.figures.map(f => f.name).join(', '));
console.log('bytes:', fs.statSync(path.join(ROOT, 'preview/geom.json')).size);
