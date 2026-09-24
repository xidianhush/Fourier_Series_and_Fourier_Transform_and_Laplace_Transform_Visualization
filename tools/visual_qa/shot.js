#!/usr/bin/env node
/* 批量截图工具：node tools/visual_qa/shot.js [key ...] [--narrow] [--out DIR]
   缺省截全部页面；缺省 out = tools/visual_qa/out/shots。
   每页一个子目录 <out>/<key>/：full.png（整页）、slice-NN.png（≤1200px 高、重叠 100px 切片）、
   seg-NN-<safeName>.png（语义分段）、manifest.json。
   --narrow：viewport 800×900，只截 full.png + slice-NN.png，落在 <out>/<key>/narrow/。
   页面之间复用同一个 chrome 实例（每页新开 target、用完 close）；单页总超时 90s。 */
'use strict';

const fs = require('fs');
const path = require('path');
const { launch } = require('./cdp.js');
const { PAGES, sleep, fileUrl, waitReady } = require('./readiness.js');

const VQA_DIR = __dirname;

const SLICE_MAX_H = 1200;
const SLICE_OVERLAP = 100;
const PAGE_TIMEOUT_MS = 90000;

/* 收集语义分段矩形（页面坐标），过滤 + 去包含 + 封顶 40。
   可见性判定除了 display/visibility，还把矩形与「祖先 overflow 裁剪框」和「文档范围」求交：
   内层滚动容器（如侧栏 overflow-y:auto）里被剪掉的部分 captureBeyondViewport 也截不到，
   只求交后的可见区域，可见面积 <40% 的整段丢弃，避免截出全黑空图。 */
async function collectSegments(page) {
  const raw = await page.evalJs(`(function(){
    var sel = 'header, main, aside, footer, section, article, .card, .canvas-box, .input-panel, .anim-controls, .stage, .panel, .sidebar';
    var docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    var docH = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    var out = [];
    document.querySelectorAll(sel).forEach(function(el){
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var r = el.getBoundingClientRect();
      var x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (var p = el.parentElement; p; p = p.parentElement) {
        var ps = getComputedStyle(p);
        if (ps.overflowX !== 'visible' || ps.overflowY !== 'visible') {
          var pr = p.getBoundingClientRect();
          if (pr.left > x0) x0 = pr.left;
          if (pr.top > y0) y0 = pr.top;
          if (pr.right < x1) x1 = pr.right;
          if (pr.bottom < y1) y1 = pr.bottom;
        }
      }
      var sx0 = Math.max(x0 + window.scrollX, 0), sy0 = Math.max(y0 + window.scrollY, 0);
      var sx1 = Math.min(x1 + window.scrollX, docW), sy1 = Math.min(y1 + window.scrollY, docH);
      var w = sx1 - sx0, h = sy1 - sy0;
      if (w <= 0 || h <= 0) return;
      if (w * h < r.width * r.height * 0.4) return;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string') ? el.className.trim().split(/\\s+/)[0] : '',
        x: sx0, y: sy0, w: w, h: h,
      });
    });
    return out;
  })()`).catch(() => []);
  if (!Array.isArray(raw)) return [];
  const ok = raw.filter(r => r.w >= 200 && r.h >= 60 && r.h <= 1500);
  const byArea = [...ok].sort((a, b) => (b.w * b.h) - (a.w * a.h));
  const kept = [];
  const contains = (a, b) => b.x >= a.x - 1 && b.y >= a.y - 1 &&
    b.x + b.w <= a.x + a.w + 1 && b.y + b.h <= a.y + a.h + 1;
  for (const r of byArea) {
    if (kept.some(k => contains(k, r))) continue;   // 完全包含于已保留矩形内的丢弃
    kept.push(r);
    if (kept.length >= 40) break;
  }
  kept.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return kept;
}

function safeName(seg) {
  const base = (seg.cls || seg.tag || 'el').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'el';
  return base.slice(0, 40);
}

async function pageSize(page) {
  const s = await page.evalJs(`({
    w: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0),
    h: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
  })`).catch(() => null);
  return s && s.h > 0 ? { width: s.w, height: s.h } : { width: 1440, height: 900 };
}

async function shotOne(browser, def, outRoot, narrow) {
  const viewport = narrow ? { width: 800, height: 900 } : { width: 1440, height: 900 };
  const dir = narrow ? path.join(outRoot, def.key, 'narrow') : path.join(outRoot, def.key);
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  const page = await browser.newPage(viewport);
  try {
    const url = fileUrl(def);
    console.log('[shot] ' + def.key + (narrow ? ' (narrow)' : '') + ' goto ' + def.rel);
    const loaded = await page.goto(url);
    if (!loaded) console.log('[shot] ' + def.key + ' WARN load event timeout, shooting anyway');
    const cdn = await waitReady(page, def);
    if (def.cdn) console.log('[shot] ' + def.key + ' cdn math=' + cdn.math + ' katex=' + cdn.katex);
    const finalUrl = await page.url().catch(() => url);
    const size = await pageSize(page);

    // full.png（整页）
    await page.shot(path.join(dir, 'full.png'), { fullPage: true });
    files.push('full.png');

    // slice-NN.png：高度 ≤1200、重叠 100px 均匀切片，覆盖整页无遗漏
    const step = SLICE_MAX_H - SLICE_OVERLAP;
    const n = Math.max(1, Math.ceil((size.height - SLICE_OVERLAP) / step));
    for (let i = 0; i < n; i++) {
      const y = Math.min(i * step, Math.max(0, size.height - SLICE_MAX_H));
      const h = Math.min(SLICE_MAX_H, size.height - y);
      const name = 'slice-' + String(i).padStart(2, '0') + '.png';
      await page.shot(path.join(dir, name), { clip: { x: 0, y, width: size.width, height: h } });
      files.push(name);
    }
    console.log('[shot] ' + def.key + ' full + ' + n + ' slice(s), page ' + size.width + 'x' + size.height);

    // seg-NN-<safeName>.png：语义分段（narrow 模式跳过）
    const segments = [];
    if (!narrow) {
      const rects = await collectSegments(page);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const name = 'seg-' + String(i).padStart(2, '0') + '-' + safeName(r) + '.png';
        await page.shot(path.join(dir, name), { clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
        files.push(name);
        segments.push({ file: name, rect: { x: r.x, y: r.y, width: r.w, height: r.h } });
      }
      console.log('[shot] ' + def.key + ' ' + segments.length + ' segment(s)');
    }

    const manifest = {
      key: def.key,
      url,
      finalUrl,
      viewport,
      pageSize: size,
      cdn: def.cdn ? cdn : null,
      files,
      segments,
      consoleErrors: page.consoleLog,
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const narrow = args.includes('--narrow');
  const outIdx = args.indexOf('--out');
  const outRoot = outIdx >= 0 && args[outIdx + 1]
    ? path.resolve(process.cwd(), args[outIdx + 1])
    : path.join(VQA_DIR, 'out', 'shots');
  const keys = args.filter((a, i) => !a.startsWith('-') && (outIdx < 0 || i !== outIdx + 1));
  const selected = PAGES.filter(p => keys.length === 0 || keys.includes(p.key));
  if (selected.length === 0) { console.error('unknown page keys: ' + keys.join(',')); process.exit(2); }

  const browser = await launch({ width: 1440, height: 900 });
  let failed = 0;
  try {
    for (const def of selected) {
      try {
        await Promise.race([
          shotOne(browser, def, outRoot, narrow),
          sleep(PAGE_TIMEOUT_MS).then(() => { throw new Error('page timeout ' + PAGE_TIMEOUT_MS / 1000 + 's'); }),
        ]);
      } catch (e) {
        failed++;
        console.log('[shot] ' + def.key + ' ERROR ' + e.message);
      }
    }
  } finally {
    await browser.kill();
  }
  console.log('[shot] done: ' + (selected.length - failed) + '/' + selected.length + ' ok, out=' + outRoot);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
