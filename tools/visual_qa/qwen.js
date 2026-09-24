/* DashScope 兼容模式（OpenAI 风格）视觉模型客户端，零 npm 依赖。
   const { chat, parseAction } = require('./qwen.js');
   const text = await chat({ model, messages, maxTokens, timeoutMs });   // → content 字符串
   图片消息：{role:'user', content:[{type:'text', text}, {type:'image_url', image_url:{url:'data:image/png;base64,...'}}]}
   模型优先级：调用方传入 > 环境变量 QWEN_MODEL > 默认 'qwen3-vl-flash'。
   鉴权：环境变量 DASHSCOPE_API_KEY。
   传输层用 https.request 且 family:4：本机实测 dashscope 解析出的 IPv6 不可达，
   而 undici(fetch) 显式 verbatim 不走 dns.setDefaultResultOrder，直连超时。 */
'use strict';

const https = require('https');

const ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_MODEL = 'qwen3-vl-flash';

function resolveModel(model) {
  return model || process.env.QWEN_MODEL || DEFAULT_MODEL;
}

function postOnce(body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const req = https.request(ENDPOINT, {
      method: 'POST',
      family: 4,
      timeout: timeoutMs,
      headers: {
        'Authorization': 'Bearer ' + process.env.DASHSCOPE_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error('DashScope HTTP ' + res.statusCode + ': ' + text.slice(0, 300));
          err.status = res.statusCode;
          reject(err);
          return;
        }
        try { resolve(JSON.parse(text)); }
        catch (e) { reject(new Error('DashScope 响应不是 JSON: ' + e.message)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => {
      if (e && e.message === 'timeout') reject(new Error('DashScope 请求超时（' + timeoutMs / 1000 + 's）'));
      else reject(new Error('DashScope 网络错误: ' + e.message));
    });
    req.write(payload);
    req.end();
  });
}

/* chat({model, messages, maxTokens=600, timeoutMs=60000}) → content 字符串。
   429/5xx 退避重试一次。 */
async function chat(opts) {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error('请设置 DASHSCOPE_API_KEY 环境变量（DashScope 控制台获取，形如 sk-...）');
  }
  const body = {
    model: resolveModel(opts.model),
    messages: opts.messages,
    max_tokens: opts.maxTokens || 600,
  };
  const timeoutMs = opts.timeoutMs || 60000;
  try {
    const data = await postOnce(body, timeoutMs);
    return extractContent(data);
  } catch (e) {
    if (e.status === 429 || (e.status >= 500 && e.status < 600)) {
      await new Promise(r => setTimeout(r, 2000));   // 退避后重试一次
      const data = await postOnce(body, timeoutMs);
      return extractContent(data);
    }
    throw e;
  }
}

function extractContent(data) {
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  const content = msg && msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {   // 个别模型把 content 拆成段
    return content.map(c => (c && (c.text || c.content)) || '').join('');
  }
  throw new Error('DashScope 响应缺少 choices[0].message.content');
}

const ACTIONS = ['click', 'type', 'key', 'scroll', 'drag', 'find', 'select', 'back', 'done'];

/* parseAction(text)：剥离 ```json 围栏、花括号配对提取第一个完整 JSON 对象、
   校验 action ∈ click/type/key/scroll/drag/done。返回 {ok:true, action} 或 {ok:false, err}。 */
function parseAction(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, err: 'empty response' };
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  if (start < 0) return { ok: false, err: 'no JSON object found' };
  // 花括号配对，跳过字符串字面量里的括号
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return { ok: false, err: 'unbalanced braces' };
  let obj;
  try { obj = JSON.parse(s.slice(start, end + 1)); }
  catch (e) { return { ok: false, err: 'JSON.parse: ' + e.message }; }
  if (!obj || typeof obj.action !== 'string') return { ok: false, err: 'missing "action" field' };
  if (!ACTIONS.includes(obj.action)) return { ok: false, err: 'unknown action: ' + obj.action };
  return { ok: true, action: obj };
}

module.exports = { chat, parseAction, ENDPOINT, DEFAULT_MODEL, resolveModel };
