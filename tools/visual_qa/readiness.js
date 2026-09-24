/* 页面清单 + 就绪等待规则，供 shot.js / selftest.js / agent.js 共用。
   逻辑从 shot.js 原样抽出，行为不变：三档等待（ftl- 交互页等 CDN、fsi- 可视化页等 __VIZ、
   其余等 500ms，redir 跳转页等 1500ms 让 meta refresh 跳完），超时也继续、由调用方判读。 */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PAGES = [
  { key: 'root',          rel: 'index.html' },
  { key: 'redir-fourier', rel: 'fourier_transform.html', redir: true },
  { key: 'redir-laplace', rel: 'laplace_transform.html', redir: true },
  { key: 'ftl-index',     rel: 'ft_laplace/index.html' },
  { key: 'ftl-fourier',   rel: 'ft_laplace/fourier_transform.html', cdn: true },
  { key: 'ftl-laplace',   rel: 'ft_laplace/laplace_transform.html', cdn: true },
  { key: 'fsi-index',     rel: 'fs_inv_ft_inv_laplace/index.html' },
  { key: 'fsi-fsls',      rel: 'fs_inv_ft_inv_laplace/Fourier_series_linear_superposition.html', viz: true },
  { key: 'fsi-bridge',    rel: 'fs_inv_ft_inv_laplace/From_Fourier_series_to_Fourier_transform.html', viz: true },
  { key: 'fsi-ift',       rel: 'fs_inv_ft_inv_laplace/Fourier_inverse_transform_synthesis.html', viz: true },
  { key: 'fsi-laplace',   rel: 'fs_inv_ft_inv_laplace/Laplace_inverse_transform_synthesis.html', viz: true },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fileUrl(def) { return pathToFileURL(path.join(REPO_ROOT, def.rel)).href; }

/* 就绪等待（超时也继续）。ftl- 页返回 {math} 就绪状态（KaTeX 已被页内 tex.js 取代，
   不再有 .katex 节点可等），其余返回 null。 */
async function waitReady(page, def) {
  const cdn = { math: null };
  if (def.cdn) {
    await page.waitFor("typeof math!=='undefined'", 15000);
    await page.waitFor("var b=document.getElementById('btnGenerate'); b && !b.disabled", 10000);
    cdn.math = await page.evalJs("typeof math!=='undefined'").catch(() => false);
    await sleep(800);   // 等首帧 canvas 画完
    return cdn;
  }
  if (def.viz) {
    await page.waitFor("document.readyState==='complete' && !!globalThis.__VIZ", 10000);
    await page.evalJs('__VIZ.draw && __VIZ.draw()').catch(() => {});
    await sleep(500);
    return null;
  }
  if (def.redir) {
    // meta refresh 跳转页：等 URL 真的变了且新文档就绪，再补一段布局时间；
    // 固定睡 1500ms 会偶发撞上跳转中途的 0 宽布局（截图报 0 width）
    const from = fileUrl(def);
    await page.waitFor('location.href !== ' + JSON.stringify(from), 5000);
    await page.waitFor('document.readyState==="complete"', 5000);
    await sleep(800);
    return null;
  }
  await sleep(500);
  return null;
}

module.exports = { REPO_ROOT, PAGES, sleep, fileUrl, waitReady };
