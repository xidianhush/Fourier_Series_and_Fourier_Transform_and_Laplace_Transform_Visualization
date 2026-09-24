#!/usr/bin/env node
/* 不耗 API 的自检：node tools/visual_qa/selftest.js [key ...]
   逐页 goto → 就绪等待（同 shot.js 规则）→ 断言：
     document.title 非空；
     四个 fsi- 可视化页与两个 ftl- 交互页的 canvas 数量 > 0；
     fsi- 可视化页 __VIZ.draw() 调用不抛异常；
     对第一个 canvas 中心执行一次 click + 一次 drag 不抛异常；
     console 错误与未捕获异常（favicon 404 之类忽略；ftl-* 两页因 CDN 失败
     产生的错误单独记为 cdn 警告而非 FAIL）。
   每页打印 [ok]/[FAIL] selftest <key> 细节；任一 FAIL 退出码 1。
   截图存 tools/visual_qa/out/selftest/<key>.png。 */
'use strict';

const path = require('path');
const { launch } = require('./cdp.js');
const { PAGES, sleep, fileUrl, waitReady } = require('./readiness.js');

const OUT_DIR = path.join(__dirname, 'out', 'selftest');

/* ftl-* 两页因 CDN（jsdelivr/cdnjs 上的 mathjs）失败产生的错误 */
const CDN_ERR_RE = /failed to load resource|net::|err_internet|err_connection|err_aborted|math\.js|mathjs|cdnjs|jsdelivr/i;

async function testOne(browser, def) {
  const problems = [];
  const cdnWarns = [];
  const notes = [];
  const page = await browser.newPage({ width: 1440, height: 900 });
  try {
    const loaded = await page.goto(fileUrl(def));
    if (!loaded) notes.push('load-timeout');
    const cdn = await waitReady(page, def);
    if (def.cdn) notes.push('cdn math=' + cdn.math);

    // 1) title 非空
    const title = await page.evalJs('document.title').catch(e => { problems.push('title eval: ' + e.message); return ''; });
    if (!title) problems.push('document.title 为空');
    else notes.push('title=' + JSON.stringify(title));

    // 2) canvas 数量（可视化页与交互页必须 >0）
    const canvases = await page.evalJs("document.querySelectorAll('canvas').length").catch(() => 0);
    notes.push('canvas=' + canvases);
    if ((def.viz || def.cdn) && !(canvases > 0)) problems.push('canvas 数量 = 0');

    // 3) fsi- 可视化页 __VIZ.draw() 不抛异常
    if (def.viz) {
      try { await page.evalJs('__VIZ.draw && __VIZ.draw()'); }
      catch (e) { problems.push('__VIZ.draw() 抛异常: ' + e.message); }
    }

    // 4) 第一个 canvas 中心 click + drag 不抛异常
    if (canvases > 0) {
      const rect = await page.evalJs(`(function(){
        var c = document.querySelector('canvas'); var r = c.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      })()`).catch(() => null);
      if (rect) {
        try { await page.click(rect.x, rect.y); } catch (e) { problems.push('click 抛异常: ' + e.message); }
        try { await page.drag(rect.x - 30, rect.y - 30, rect.x + 30, rect.y + 30); } catch (e) { problems.push('drag 抛异常: ' + e.message); }
      }
    }

    // 5) console 错误与未捕获异常
    for (const entry of page.consoleLog) {
      if (/favicon/i.test(entry.text)) continue;   // favicon 404 之类忽略
      if ((def.cdn || def.redir) && CDN_ERR_RE.test(entry.text)) { cdnWarns.push(entry.text.slice(0, 120)); continue; }
      problems.push(entry.level + ': ' + entry.text.slice(0, 160));
    }
    if (def.cdn && cdn && cdn.math === false) {
      cdnWarns.push('CDN 未就绪 math=' + cdn.math);
    }

    // 截图存档（跳转页偶发撞上导航中途的 0 宽布局，失败时等一下重试一次）
    const shotPath = path.join(OUT_DIR, def.key + '.png');
    try { await page.shot(shotPath, { fullPage: true }); }
    catch (e) {
      await sleep(800);
      await page.shot(shotPath, { fullPage: true })
        .catch(e2 => problems.push('shot 失败: ' + e2.message));
    }
  } finally {
    await page.close().catch(() => {});
  }
  return { problems, cdnWarns, notes };
}

async function main() {
  const keys = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const selected = PAGES.filter(p => keys.length === 0 || keys.includes(p.key));
  if (selected.length === 0) { console.error('unknown page keys: ' + keys.join(',')); process.exit(2); }

  const browser = await launch({ width: 1440, height: 900 });
  let fails = 0;
  try {
    for (const def of selected) {
      try {
        const { problems, cdnWarns, notes } = await testOne(browser, def);
        if (problems.length === 0) {
          console.log('[ok] selftest ' + def.key + '  ' + notes.join(' ') +
            (cdnWarns.length ? '  cdn-warn=' + cdnWarns.length + ' (' + cdnWarns[0] + ')' : ''));
        } else {
          fails++;
          console.log('[FAIL] selftest ' + def.key + '  ' + problems.join(' ; '));
        }
      } catch (e) {
        fails++;
        console.log('[FAIL] selftest ' + def.key + '  harness: ' + e.message);
      }
    }
  } finally {
    await browser.kill();
  }
  console.log(fails === 0 ? 'ALL SELFTESTS PASSED (' + selected.length + ' pages)'
    : 'SELFTEST FAILED (' + fails + '/' + selected.length + ')');
  if (fails > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
