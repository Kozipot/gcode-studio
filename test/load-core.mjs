import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

export function loadCore(){
  const glyphs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/glyphs.json'), 'utf8'));
  const tables = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/tables.json'), 'utf8'));
  const core = fs.readFileSync(path.join(ROOT, 'src/core.js'), 'utf8');
  const src = `(function(){
    var GLYPHS = ${JSON.stringify(glyphs)};
    var TABLES = ${JSON.stringify(tables)};
    ${core}
    return {
      buildTextGeometry, buildToolpaths, buildProgram, elementGeometry, elementDefaults,
      defaultScene, SCENE_TEMPLATES, validateGcode, parseProgram, parseGcode,
      estimateMoves, formatTime, emitProgram, calcTapping, calcDrilling, calcBoring,
      holeGrid, parseHoleList, solveArc, calcFeeds, fmt, translit, wrapSnippet,
      ELEMENT_TYPES, elementSummary, transformGeom, geomBBox, shapePoly, shapeStar,
      shapeSpiral, shapeSine, shapeRect, shapeCircle, shapeSlot, rasterScan,
      pointInPolygon, templateScene, polygonBBox, distPointToSegment, nearPoly, polygonArea, offsetPolygon, offsetPath, alignElements, arrayElements, sceneChecks, segmentIntersectsRect, numOr, clamp, materialOf, threadOf, TABLES,
      elementDepth, elementHeightInfo, Z_PROFILES, paramEval, evalParamExpr, PARAM_MODES, paramModeDefaults, buildParametric
    };
  })()`;
  const ctx = vm.createContext({ console, Math, JSON, isFinite, parseFloat, Number, String, Array, Object });
  return vm.runInContext(src, ctx, { filename: 'core.bundle.js' });
}
