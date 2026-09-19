(function(){
'use strict';

/* ========== 常量与状态 ========== */
const TAU = Math.PI * 2, T = TAU, KMAX = 40;
const ACCENT = '#ff5d5d', TRAIL = '#7fd1ff', IDEAL = '#8396b8';

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);

const state = {
  preset:'square', lastPreset:'square', N:8, view:'oneside',
  playing:true, speed:1, t:0,
  circles:true, labels:true, trail:true, ideal:true,
  customA:new Float64Array(KMAX+1), customPhi:new Float64Array(KMAX+1)
};

let W=0, H=0, DPR=1;
let scaleC=60, scaleT=60;          // 平滑后的像素/单位
const SAMPLES = 600;                // 下方面板每帧采样点数
const buf = new Float64Array(SAMPLES+1);
const trRe = new Float64Array(321), trIm = new Float64Array(321);

/* ========== 画布尺寸 ========== */
function resize(){
  const r = cv.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(360, Math.floor(r.width));
  H = Math.max(340, Math.floor(r.height));
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  cv.style.width = W+'px'; cv.style.height = H+'px';
}
new ResizeObserver(resize).observe(cv.parentElement);
window.addEventListener('resize', resize);
resize();

/* ========== 系数：x(t) = A0 + Σ A_k cos(k t + φ_k) ========== */
function buildSpec(){
  const N = state.N;
  const A = new Float64Array(N+1), P = new Float64Array(N+1);
  const wr = new Float64Array(N+1), wi = new Float64Array(N+1);
  const p = state.preset;
  if(p === 'custom'){
    for(let k=0;k<=N;k++){ A[k]=state.customA[k]; P[k]=(k===0?0:state.customPhi[k]); }
  }else if(p === 'cos'){
    if(N>=1) A[1]=1;
  }else if(p === 'multi'){
    if(N>=1) A[1]=1;
    if(N>=2){ A[2]=0.5; P[2]=Math.PI/3; }
    if(N>=3){ A[3]=1/3; P[3]=-Math.PI/2; }
  }else if(p === 'square'){
    for(let k=1;k<=N;k++) if(k&1){ A[k]=4/(Math.PI*k); P[k]=-Math.PI/2; }
  }else if(p === 'saw'){
    for(let k=1;k<=N;k++){ A[k]=2/(Math.PI*k); P[k]=(k&1)?-Math.PI/2:Math.PI/2; }
  }else if(p === 'tri'){
    for(let k=1;k<=N;k++) if(k&1) A[k]=8/(Math.PI*Math.PI*k*k);
  }else if(p === 'comb'){
    A[0]=1/(2*Math.PI);
    for(let k=1;k<=N;k++) A[k]=1/Math.PI;
  }
  for(let k=0;k<=N;k++){ wr[k]=A[k]*Math.cos(P[k]); wi[k]=A[k]*Math.sin(P[k]); }
  let reach = A[0];
  for(let k=1;k<=N;k++) reach += A[k];
  return {N, A, P, wr, wi, reach:Math.max(reach, 0.25)};
}

/* F(t) = Σ_{k=0..N} w_k e^{jkt}，Re F(t) = x(t) */
function evalAt(sp, t){
  let re = sp.wr[0], im = 0;
  for(let k=1;k<=sp.N;k++){
    const c = Math.cos(k*t), s = Math.sin(k*t);
    re += sp.wr[k]*c - sp.wi[k]*s;
    im += sp.wr[k]*s + sp.wi[k]*c;
  }
  return {re, im};
}

/* 下方面板：等间隔采样 Re F(t)，用旋转因子递推避免大量三角函数 */
function sampleWindow(sp, t0, t1, M){
  const N = sp.N, dt = (t1-t0)/M;
  const cr = new Float64Array(N+1), ci = new Float64Array(N+1);
  const sr = new Float64Array(N+1), si = new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    cr[k]=Math.cos(k*t0); ci[k]=Math.sin(k*t0);
    const a=k*dt; sr[k]=Math.cos(a); si[k]=Math.sin(a);
  }
  for(let i=0;i<=M;i++){
    let s = sp.wr[0];
    for(let k=1;k<=N;k++){
      s += sp.wr[k]*cr[k] - sp.wi[k]*ci[k];
      const nr = cr[k]*sr[k] - ci[k]*si[k];
      ci[k] = cr[k]*si[k] + ci[k]*sr[k];
      cr[k] = nr;
    }
    buf[i]=s;
  }
}

/* 末端轨迹：最近一个周期的 F(t) 点集 */
function sampleTrail(sp, t, M){
  const N = sp.N, dt = -T/M;
  const cr = new Float64Array(N+1), ci = new Float64Array(N+1);
  const sr = new Float64Array(N+1), si = new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    cr[k]=Math.cos(k*t); ci[k]=Math.sin(k*t);
    const a=k*dt; sr[k]=Math.cos(a); si[k]=Math.sin(a);
  }
  for(let i=0;i<=M;i++){
    let re=sp.wr[0], im=0;
    for(let k=1;k<=N;k++){
      re += sp.wr[k]*cr[k] - sp.wi[k]*ci[k];
      im += sp.wr[k]*ci[k] + sp.wi[k]*cr[k];
      const nr = cr[k]*sr[k] - ci[k]*si[k];
      ci[k] = cr[k]*si[k] + ci[k]*sr[k];
      cr[k] = nr;
    }
    trRe[i]=re; trIm[i]=im;
  }
}

function wrapPi(x){ let y=(x+Math.PI)%(TAU); if(y<0)y+=TAU; return y-Math.PI; }

/* 理想波形闭式（部分和收敛目标），无闭式返回 null */
function idealWave(name, t){
  const s = wrapPi(t);
  switch(name){
    case 'cos': return Math.cos(t);
    case 'square': { const v=Math.sin(t); return v>1e-12?1:(v<-1e-12?-1:0); }
    case 'saw': return s/Math.PI;
    case 'tri': return 1-2*Math.abs(s)/Math.PI;
    default: return null;
  }
}

/* ========== 矢量链：三种视图统一成"依次首尾相接的线段" ========== */
function chainSegments(sp, t){
  const segs = [], N = sp.N;
  if(state.view === 'oneside'){
    for(let k=0;k<=N;k++){
      const m = sp.A[k]; if(m === 0) continue;
      const ang = sp.P[k] + k*t;
      segs.push({k, m, re:m*Math.cos(ang), im:m*Math.sin(ang), tag:k===0?'DC':'k='+k});
    }
  }else if(state.view === 'double'){
    const push = k => {
      const a = Math.abs(k);
      const m = (a===0) ? sp.A[0] : sp.A[a]/2; if(m === 0) return;
      const ph = (a===0) ? 0 : (k>0 ? sp.P[a] : -sp.P[a]);
      const ang = ph + k*t;
      const tag = (a===0) ? 'DC' : 'k='+(k>0?'+':'−')+a;
      segs.push({k, m, re:m*Math.cos(ang), im:m*Math.sin(ang), tag, neg:k<0});
    };
    push(0);
    for(let k=1;k<=N;k++){ push(k); push(-k); }
  }else{
    for(let k=0;k<=N;k++){
      if(k>0 && sp.A[k] === 0) continue;
      const v = (k===0) ? sp.A[0] : sp.A[k]*Math.cos(k*t + sp.P[k]);
      segs.push({k, m:Math.abs(v), re:v, im:0, ang:(v<0?Math.PI:0), tag:k===0?'DC':'k=±'+k, real:true});
    }
  }
  return segs;
}

function hueFor(k){ return (200 + Math.abs(k)*26) % 360; }
function colorFor(k, neg){
  return 'hsl('+hueFor(k)+','+(neg?58:74)+'%,'+(neg?52:60)+'%)';
}

/* ========== 绘图小工具 ========== */
function niceStep(pxPerUnit, targetPx){
  const raw = (targetPx||62)/pxPerUnit;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const c = raw/p;
  return (c<1.5?1:c<3?2:c<7?5:10)*p;
}
function fmt(x, d){ d = (d===undefined)?3:d; if(!isFinite(x)) return '—';
  const v = Math.abs(x)<5e-4 ? 0 : x; return v.toFixed(d); }
function roundRect(x,y,w,h,r){
  if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); }
  else { ctx.beginPath(); ctx.rect(x,y,w,h); }
}
function panelBox(r){
  roundRect(r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = '#0e1626'; ctx.fill();
  ctx.strokeStyle = '#1d2c47'; ctx.lineWidth = 1; ctx.stroke();
}
function arrow(x0,y0,x1,y1,color,width,alpha){
  const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy);
  if(len < 1.4) return;
  ctx.save();
  ctx.globalAlpha = (alpha===undefined)?1:alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = width; ctx.lineCap='round';
  const hl = Math.min(Math.max(width*3.4, 6.5), len*0.55);
  const ux=dx/len, uy=dy/len;
  ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1-ux*hl*0.85, y1-uy*hl*0.85); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x1-ux*hl-uy*hl*0.40, y1-uy*hl+ux*hl*0.40);
  ctx.lineTo(x1-ux*hl+uy*hl*0.40, y1-uy*hl-ux*hl*0.40);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function dot(x,y,r,fill,ring){
  ctx.beginPath(); ctx.arc(x,y,r,0,TAU);
  ctx.fillStyle=fill; ctx.fill();
  if(ring){ ctx.lineWidth=1.6; ctx.strokeStyle=ring; ctx.stroke(); }
}
function labelBox(txt,x,y,color,align){
  ctx.save();
  ctx.font='12px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.textAlign=align||'left'; ctx.textBaseline='middle';
  const w=ctx.measureText(txt).width;
  const bx = (align==='right') ? x-w-5 : (align==='center' ? x-w/2-5 : x-5);
  ctx.fillStyle='rgba(10,16,32,.82)';
  roundRect(bx, y-9, w+10, 18, 4); ctx.fill();
  ctx.fillStyle=color||'#e8eefc';
  ctx.fillText(txt,x,y);
  ctx.restore();
}

/* ========== 上方面板：复平面 ========== */
function drawComplex(sp, r, tip, sc){
  panelBox(r);
  const cx = r.x + r.w*0.5, cy = r.y + r.h*0.5;
  const PX = v => cx + v*sc, PY = v => cy - v*sc;

  ctx.save();
  roundRect(r.x, r.y, r.w, r.h, 10); ctx.clip();

  // 网格
  const step = niceStep(sc, 58);
  const lim = Math.max(r.w, r.h)/sc;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,155,215,.10)';
  ctx.beginPath();
  for(let v=step; v<=lim; v+=step){
    ctx.moveTo(PX(v), r.y); ctx.lineTo(PX(v), r.y+r.h);
    ctx.moveTo(PX(-v), r.y); ctx.lineTo(PX(-v), r.y+r.h);
    ctx.moveTo(r.x, PY(v)); ctx.lineTo(r.x+r.w, PY(v));
    ctx.moveTo(r.x, PY(-v)); ctx.lineTo(r.x+r.w, PY(-v));
  }
  ctx.stroke();

  // 单位圆
  if(sc*1 < Math.min(r.w,r.h)){
    ctx.save(); ctx.setLineDash([4,5]); ctx.strokeStyle='rgba(160,190,240,.28)';
    ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(cx,cy,sc,0,TAU); ctx.stroke(); ctx.restore();
    ctx.fillStyle='rgba(160,190,240,.5)'; ctx.font='11px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText('|1|', cx+sc*0.71+3, cy-sc*0.71-13);
  }

  // 坐标轴
  ctx.strokeStyle='rgba(180,205,245,.55)'; ctx.lineWidth=1.3;
  ctx.beginPath();
  ctx.moveTo(r.x+8, cy); ctx.lineTo(r.x+r.w-10, cy);
  ctx.moveTo(cx, r.y+r.h-8); ctx.lineTo(cx, r.y+10);
  ctx.stroke();
  arrow(r.x+r.w-24, cy, r.x+r.w-10, cy, 'rgba(180,205,245,.75)', 1.3);
  arrow(cx, r.y+24, cx, r.y+10, 'rgba(180,205,245,.75)', 1.3);
  ctx.fillStyle='rgba(200,220,250,.85)'; ctx.font='italic 13px Georgia,serif';
  ctx.textAlign='right'; ctx.textBaseline='bottom'; ctx.fillText('Re', r.x+r.w-14, cy-6);
  ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText('Im', cx+7, r.y+10);
  // 轴刻度数字
  ctx.font='10px sans-serif'; ctx.fillStyle='rgba(143,162,196,.85)';
  ctx.textAlign='center'; ctx.textBaseline='top';
  for(let v=step; v<=lim; v+=step){
    if(PX(v) < r.x+r.w-16) ctx.fillText(fmt(v, step<1?1:0), PX(v), cy+4);
    if(PX(-v) > r.x+12) ctx.fillText(fmt(-v, step<1?1:0), PX(-v), cy+4);
  }

  // 末端轨迹（最近一个周期的 F(t) 轨迹）
  if(state.trail){
    ctx.beginPath();
    for(let i=0;i<trRe.length;i++){
      const X=PX(trRe[i]), Y=PY(state.view==='oneside'?trIm[i]:0);
      i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);
    }
    ctx.strokeStyle=TRAIL; ctx.globalAlpha=.30; ctx.lineWidth=1.7; ctx.stroke();
    ctx.globalAlpha=1;
  }

  // 矢量链
  const segs = chainSegments(sp, state.t);
  let tx=0, ty=0;
  for(const s of segs){
    const X0=PX(tx), Y0=PY(ty), hx=tx+s.re, hy=ty+s.im;
    const X1=PX(hx), Y1=PY(hy);
    const col = colorFor(s.k, s.neg);
    if(state.circles && s.m*sc > 3 && state.view!=='pair'){
      ctx.save(); ctx.setLineDash([3,4]); ctx.globalAlpha=.30;
      ctx.strokeStyle=col; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(X0,Y0,s.m*sc,0,TAU); ctx.stroke(); ctx.restore();
    }
    arrow(X0,Y0,X1,Y1,col,Math.max(1.3,Math.min(4.2,1.3+2.8*Math.sqrt(s.m/sp.reach))), s.neg?0.75:1);
    if(state.labels && s.m*sc > 9){
      const mx=(X0+X1)/2, my=(Y0+Y1)/2;
      const dx=X1-X0, dy=Y1-Y0, L=Math.hypot(dx,dy)||1;
      const ox=-dy/L*10, oy=dx/L*10;
      ctx.save(); ctx.font='10px sans-serif'; ctx.fillStyle=col;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(s.tag, mx+ox, my+oy); ctx.restore();
    }
    tx=hx; ty=hy;
  }

  // pair 视图：淡画 ±k 两支旋转矢量，说明水平矢量的来历
  if(state.view==='pair' && state.circles && sp.N<=12){
    let px=0;
    ctx.save(); ctx.setLineDash([2,3]); ctx.lineWidth=1;
    for(let k=0;k<=sp.N;k++){
      if(sp.A[k]===0) continue;
      if(k>0){
        const m=sp.A[k]/2;
        for(const sg of [1,-1]){
          const ang=sg*sp.P[k]+k*state.t;
          arrow(PX(px),PY(0),PX(px+m*Math.cos(ang)),PY(m*Math.sin(ang)),
                colorFor(k,sg<0),1,0.30);
        }
        px += sp.A[k]*Math.cos(k*state.t+sp.P[k]);
      }
    }
    ctx.restore();
  }

  // 合成向量 + 末端
  const TX=PX(tip.re), TY=PY(tip.im), RX=PX(tip.re), RY=PY(0);
  arrow(PX(0),PY(0),TX,TY,'#f2f6ff',3.0,0.95);
  // 投影：向 Re 轴作垂线
  ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle=ACCENT; ctx.globalAlpha=.85;
  ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(TX,TY); ctx.lineTo(RX,RY); ctx.stroke(); ctx.restore();
  dot(RX,RY,5,ACCENT,'#0e1626');
  dot(TX,TY,4.6,'#fff',ACCENT);
  labelBox('Re F(t) = '+fmt(tip.re), RX+(tip.re>=0?10:-10), RY+16, ACCENT, tip.re>=0?'left':'right');

  ctx.restore();

  // 面板标题
  ctx.save();
  ctx.font='600 13px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle='#cfe0ff'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('复平面 · 谐波关系复指数基矢量的加权叠加', r.x+12, r.y+9);
  ctx.font='11.5px "Segoe UI","Microsoft YaHei",sans-serif'; ctx.fillStyle='#8fa2c4';
  const sub = state.view==='oneside' ? '单边链 k=0…N：末端旋转 + 伸缩，向 Re 轴的垂足即 x(t)'
            : state.view==='double'  ? '双边链 k=−N…N：c₋ₖ=cₖ* 使虚部两两抵消，末端恒落在 Re 轴上'
            : '共轭成对：±k 合成实谐波 Aₖcos(kω₀t+φₖ)，全部沿 Re 轴伸缩';
  ctx.fillText(sub, r.x+12, r.y+27);
  ctx.restore();
}

/* ========== 下方面板：Re(F(t)) ~ t ========== */
function drawTime(sp, r, cur, sc){
  panelBox(r);
  const xL = r.x+52, xR = r.x+r.w-16;
  const yZ = r.y + r.h*0.5 + 6;
  const tWin = 2*T;
  const t1 = state.t, t0 = t1 - tWin;
  const X = tt => xL + (tt-t0)/tWin*(xR-xL);
  const Y = v => yZ - v*sc;

  ctx.save();
  roundRect(r.x, r.y, r.w, r.h, 10); ctx.clip();

  // 幅度网格
  const astep = niceStep(sc, 44);
  const amax = (r.h*0.5-6)/sc;
  ctx.lineWidth=1; ctx.font='10px sans-serif';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  for(let v=0; v<=amax+1e-9; v+=astep){
    for(const sgn of (v===0?[1]:[1,-1])){
      const val=v*sgn, y=Y(val);
      if(y<r.y+4||y>r.y+r.h-4) continue;
      ctx.strokeStyle = v===0 ? 'rgba(180,205,245,.45)' : 'rgba(120,155,215,.12)';
      ctx.beginPath(); ctx.moveTo(xL,y); ctx.lineTo(xR,y); ctx.stroke();
      ctx.fillStyle='rgba(143,162,196,.9)';
      ctx.fillText(fmt(val, astep<1?1:0), xL-6, y);
    }
  }
  // 时间刻度（以 T 为单位）
  const tstep = T/2;
  ctx.textAlign='center'; ctx.textBaseline='top';
  for(let m=Math.ceil(t0/tstep); m*tstep<=t1+1e-9; m++){
    const tau=m*tstep, x=X(tau);
    if(x<xL-1||x>xR+1) continue;
    ctx.strokeStyle='rgba(120,155,215,.12)';
    ctx.beginPath(); ctx.moveTo(x,r.y+8); ctx.lineTo(x,r.y+r.h-8); ctx.stroke();
    const rel=(tau-t1)/T;
    ctx.fillStyle='rgba(143,162,196,.9)';
    ctx.fillText((Math.abs(rel)<1e-9?'0':fmt(rel,2))+'T', x, r.y+r.h-19);
  }
  ctx.strokeStyle='rgba(180,205,245,.45)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(xR,r.y+8); ctx.lineTo(xR,r.y+r.h-8); ctx.stroke();

  // 理想波形（buf 已由 draw() 采样好）
  const M = SAMPLES;
  if(state.ideal){
    let has=false;
    ctx.beginPath();
    for(let i=0;i<=M;i++){
      const v = idealWave(state.preset, t0 + (t1-t0)*i/M);
      if(v===null) break;
      has=true;
      const x=xL+(xR-xL)*i/M, y=Y(v);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    if(has){
      ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle=IDEAL; ctx.globalAlpha=.75;
      ctx.lineWidth=1.4; ctx.stroke(); ctx.restore();
    }
  }

  // Re(F(t)) 曲线
  ctx.beginPath();
  for(let i=0;i<=M;i++){
    const x=xL+(xR-xL)*i/M, y=Y(buf[i]);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.strokeStyle=ACCENT; ctx.lineWidth=2.1; ctx.lineJoin='round'; ctx.stroke();

  // 幅度导引 + 当前点
  const yc = Y(cur);
  ctx.save(); ctx.setLineDash([4,5]); ctx.strokeStyle=ACCENT; ctx.globalAlpha=.35;
  ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(xL,yc); ctx.lineTo(xR,yc); ctx.stroke(); ctx.restore();
  dot(xR,yc,5,'#fff',ACCENT);
  labelBox('x(t) = Re F(t) = '+fmt(cur), xR-8, Math.min(Math.max(yc-16,r.y+16),r.y+r.h-22), ACCENT, 'right');

  ctx.restore();

  ctx.save();
  ctx.font='600 13px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle='#cfe0ff'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('Re(F(t)) 随 t 变化 —— 复平面合成向量在 Re 轴上的投影', r.x+12, r.y+9);
  ctx.font='11.5px "Segoe UI","Microsoft YaHei",sans-serif'; ctx.fillStyle='#8fa2c4';
  ctx.fillText('窗口宽 2T，右端为当前时刻 t，曲线向左流动'+(state.ideal&&idealWave(state.preset,0)!==null?'；灰虚线 = 理想波形（对比 Gibbs 现象）':''), r.x+12, r.y+27);
  ctx.restore();
}

/* ========== 主绘制 ========== */
function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);

  const sp = buildSpec();
  const tip = evalAt(sp, state.t);
  if(state.view !== 'oneside') tip.im = 0;   // 双边/成对视图：虚部两两抵消，F(t) 恒为实数
  sampleTrail(sp, state.t, trRe.length-1);
  sampleWindow(sp, state.t - 2*T, state.t, SAMPLES);

  const pad=12;
  const timeH = Math.max(150, Math.min(300, Math.round(H*0.33)));
  const topH = H - timeH - pad*3;
  const rTop = {x:pad, y:pad, w:W-pad*2, h:topH};
  const rTime = {x:pad, y:pad*2+topH, w:W-pad*2, h:timeH};

  // 目标比例尺（平滑过渡，改 N 时不跳变）
  const availC = Math.min(rTop.w*0.46, rTop.h*0.44);
  const tgtC = availC/sp.reach;
  scaleC += (tgtC-scaleC)*0.16;
  const halfT = rTime.h*0.5-14;
  let mx=1e-6;
  for(let i=0;i<=SAMPLES;i++) mx=Math.max(mx,Math.abs(buf[i]));
  const idealPeak = idealPeakOf(state.preset);
  mx = Math.max(mx, idealPeak);
  const tgtT = Math.min(scaleC, halfT/mx);
  scaleT += (tgtT-scaleT)*0.16;

  drawComplex(sp, rTop, tip, scaleC);
  drawTime(sp, rTime, tip.re, scaleT);
  updateReadout(tip);
}
function idealPeakOf(name){
  switch(name){ case 'cos': case 'square': case 'saw': case 'tri': return 1.02; default: return 0; }
}

/* ========== 数值读出 ========== */
function updateReadout(tip){
  $('r_t').textContent = fmt(state.t)+' s';
  $('r_wt').textContent = fmt(state.t)+' rad = '+fmt(state.t/T)+' T';
  $('r_re').textContent = fmt(tip.re);
  $('r_im').textContent = fmt(tip.im);
  $('r_abs').textContent = fmt(Math.hypot(tip.re,tip.im));
  $('r_arg').textContent = fmt(Math.atan2(tip.im,tip.re)*180/Math.PI,1)+'°';
}

/* ========== 自定义系数编辑器 ========== */
function buildEditor(){
  const body = $('edBody');
  body.innerHTML = '';
  for(let k=0;k<=state.N;k++){
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="kk">'+k+'</td>'+
      '<td><input type="number" min="0" step="0.01" value="'+(+state.customA[k]).toFixed(3)+'" data-k="'+k+'" data-f="A"></td>'+
      '<td>'+(k===0
        ? '<span class="dim">0（实）</span>'
        : '<input type="range" min="-1" max="1" step="0.01" value="'+(state.customPhi[k]/Math.PI).toFixed(3)+'" data-k="'+k+'" data-f="P" style="width:88px">')+'</td>'+
      '<td class="out" data-out="'+k+'"></td>';
    body.appendChild(tr);
  }
  updateEditorOuts();
}
function updateEditorOuts(){
  for(let k=0;k<=state.N;k++){
    const cell = $('edBody').querySelector('[data-out="'+k+'"]');
    if(!cell) continue;
    const A = state.customA[k], P = (k===0?0:state.customPhi[k]);
    const c = (k===0?A:A/2);
    cell.textContent = fmt(c*Math.cos(P))+' '+(c*Math.sin(P)<0?'−':'+')+' j'+fmt(Math.abs(c*Math.sin(P)));
  }
}
function toCustom(){
  if(state.preset !== 'custom'){
    state.preset = 'custom';
    $('preset').value = 'custom';
  }
}
$('edBody').addEventListener('input', e => {
  const el = e.target;
  const k = el.dataset.k; if(k === undefined) return;
  const idx = +k;
  if(el.dataset.f === 'A'){
    let v = parseFloat(el.value); if(isNaN(v)) v = 0;
    state.customA[idx] = Math.max(0, v);
  }else{
    state.customPhi[idx] = parseFloat(el.value)*Math.PI;
  }
  toCustom();
  updateEditorOuts();
});
$('loadPreset').addEventListener('click', () => {
  if(state.preset === 'custom') state.preset = state.lastPreset;
  const sp = buildSpec();
  state.customA.fill(0); state.customPhi.fill(0);
  for(let k=0;k<=sp.N;k++){ state.customA[k]=sp.A[k]; state.customPhi[k]=sp.P[k]; }
  state.lastPreset = state.preset;
  toCustom();
  buildEditor();
});
$('clearCust').addEventListener('click', () => {
  state.customA.fill(0); state.customPhi.fill(0);
  toCustom(); buildEditor();
});

/* ========== 控件绑定 ========== */
function updateNnote(){
  const N = state.N;
  const cnt = state.view==='double' ? (2*N+1) : (N+1);
  $('Nval').textContent = N;
  $('Nnote').textContent = 'N = '+N+'：'+
    (state.view==='double'
      ? 'k = −'+N+'…'+N+'，共 '+cnt+' 支复指数基信号'
      : state.view==='pair'
        ? 'k = 0…'+N+'，共 '+cnt+' 支实谐波（含直流）'
        : 'k = 0…'+N+'，共 '+cnt+' 支旋转基矢量（含直流）');
}
$('preset').addEventListener('change', e => {
  const v = e.target.value;
  if(v === 'custom'){
    let allZero = true;
    for(let k=0;k<=state.N;k++) if(state.customA[k]!==0){ allZero=false; break; }
    if(allZero){
      const sp0 = buildSpec();
      for(let k=0;k<=sp0.N;k++){ state.customA[k]=sp0.A[k]; state.customPhi[k]=sp0.P[k]; }
      buildEditor();
    }
  }else{
    state.lastPreset = v;
  }
  state.preset = v;
});
$('N').addEventListener('input', e => {
  state.N = +e.target.value;
  buildEditor(); updateNnote();
});
document.querySelectorAll('input[name=view]').forEach(el => {
  el.addEventListener('change', e => { state.view = e.target.value; updateNnote(); });
});
$('play').addEventListener('click', () => {
  state.playing = !state.playing;
  $('play').textContent = state.playing ? '⏸ 暂停' : '▶ 播放';
});
$('reset').addEventListener('click', () => { state.t = 0; });
$('step').addEventListener('click', () => { state.playing=false; $('play').textContent='▶ 播放'; state.t += T/64; });
$('speed').addEventListener('input', e => {
  state.speed = +e.target.value;
  $('speedval').textContent = state.speed.toFixed(1)+'×';
});
const cbind = [['cCircles','circles'],['cLabels','labels'],['cTrail','trail'],['cIdeal','ideal']];
cbind.forEach(([id,key]) => { $(id).addEventListener('change', e => { state[key]=e.target.checked; }); });
window.addEventListener('keydown', e => {
  if(e.code==='Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){
    e.preventDefault(); $('play').click();
  }
});
/* 画布自身的键盘操作：←/→ 暂停并单步 ±T/64（可见时间窗 2T 的 1/64），空格播放/暂停。
   空格在这里 stopPropagation，避免与上面的全局空格处理重复触发（两次点击等于没点）。 */
cv.addEventListener('keydown', e => {
  if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
    state.playing = false; $('play').textContent = '▶ 播放';
    state.t = clamp(state.t + (e.key==='ArrowRight'?1:-1)*T/64, 0, 1e5);
    e.preventDefault();
  }else if(e.key === ' ' || e.key === 'Spacebar'){
    $('play').click(); e.stopPropagation(); e.preventDefault();
  }
});

/* ========== 主循环 ========== */
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden) return;
  const dt = Math.min((now-last)/1000, 0.05);
  last = now;
  if(state.playing){
    state.t += dt*state.speed;
    if(state.t > 1e5) state.t -= Math.floor(state.t/T)*T;
  }
  draw();
}

/* 初始化 */
$('preset').value = state.preset;
buildEditor();
updateNnote();
scaleC = scaleT = Math.min(W,H)/8;
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
state.playing = !reduced;
$('play').textContent = state.playing ? '⏸ 暂停' : '▶ 播放';
requestAnimationFrame(frame);

/* ========== 外部句柄 ========== */
function apply(o){
  if(o.preset !== undefined){ state.preset = o.preset; $('preset').value = o.preset; }
  if(o.N !== undefined){ state.N = o.N; $('N').value = o.N; buildEditor(); }
  if(o.view !== undefined){
    state.view = o.view;
    const r = document.querySelector('input[name=view][value="'+o.view+'"]');
    if(r) r.checked = true;
  }
  if(o.t !== undefined) state.t = o.t;
  updateNnote();
  draw();
}

globalThis.__VIZ = {st:state, draw:draw, apply:apply};

})();
