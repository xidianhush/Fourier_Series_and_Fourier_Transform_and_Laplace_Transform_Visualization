(function(){
'use strict';

var INF=Infinity;

var PRESETS = {
  sexp: {
    name:'单边指数', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1, sdef:0.5,
    rocLo:function(p){return -p;}, rocHi:function(p){return INF;},
    srange:function(p){return [-p-1.3,2.3];}, imr:function(p){return 4.5;},
    poles:function(p){return [[-p,0]];}, zeros:function(p){return [];},
    tail:function(p){return 6/p;},
    lobe:function(p,sig){return 2*Math.max(0.25,sig+p);},
    x:function(u,p){return u>=0?Math.exp(-p*u):0;},
    X2:function(sr,wi,p){var a=sr+p, d=a*a+wi*wi; return [a/d,-wi/d];}
  },
  dsin: {
    name:'衰减正弦', plab:'ω0', pmin:0.5, pmax:4, pstep:0.05, pdef:2, sdef:0.5,
    rocLo:function(p){return -1;}, rocHi:function(p){return INF;},
    srange:function(p){return [-2.5,2.5];}, imr:function(p){return Math.max(4.5,p+1.5);},
    poles:function(p){return [[-1,p],[-1,-p]];}, zeros:function(p){return [];},
    tail:function(p){return 6;},
    lobe:function(p,sig){return p*0.5+1.5;},
    x:function(u,p){return u>=0?Math.exp(-u)*Math.sin(p*u):0;},
    X2:function(sr,wi,p){var a=sr+1, qr=a*a-wi*wi+p*p, qi=2*a*wi, d=qr*qr+qi*qi; return [p*qr/d,-p*qi/d];}
  },
  dpole: {
    name:'双重极点', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1, sdef:0.5,
    rocLo:function(p){return -p;}, rocHi:function(p){return INF;},
    srange:function(p){return [-p-1.3,2.3];}, imr:function(p){return 4.5;},
    poles:function(p){return [[-p,0]];}, zeros:function(p){return [];},
    tail:function(p){return 8/p;},
    lobe:function(p,sig){return 2*Math.max(0.25,sig+p);},
    x:function(u,p){return u>=0?u*Math.exp(-p*u):0;},
    X2:function(sr,wi,p){var a=sr+p, q=a*a+wi*wi, d=q*q; return [(a*a-wi*wi)/d,-2*a*wi/d];}
  },
  dexp: {
    name:'双边指数', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1, sdef:0,
    rocLo:function(p){return -p;}, rocHi:function(p){return p;},
    srange:function(p){return [-p-1.3,p+1.3];}, imr:function(p){return 4.5;},
    poles:function(p){return [[-p,0],[p,0]];}, zeros:function(p){return [];},
    tail:function(p){return 6/p;},
    lobe:function(p,sig){return 2*Math.max(0.25,Math.min(p-sig,p+sig));},
    x:function(u,p){return Math.exp(-p*Math.abs(u));},
    X2:function(sr,wi,p){var re=p*p-sr*sr+wi*wi, im=2*sr*wi, d=re*re+im*im; return [2*p*re/d,2*p*im/d];}
  },
  gauss: {
    name:'高斯', plab:'s', pmin:0.3, pmax:2, pstep:0.05, pdef:1, sdef:0,
    rocLo:function(p){return -INF;}, rocHi:function(p){return INF;},
    srange:function(p){return [-3,3];}, imr:function(p){return 4.5;},
    poles:function(p){return [];}, zeros:function(p){return [];},
    tail:function(p){return 3.5*p;},
    lobe:function(p,sig){return 2;},
    x:function(u,p){return Math.exp(-u*u/(2*p*p));},
    X2:function(sr,wi,p){var K=p*Math.sqrt(2*Math.PI), m=Math.exp((sr*sr-wi*wi)/2); return [K*m*Math.cos(sr*wi),K*m*Math.sin(sr*wi)];}
  }
};

var st = {
  preset:'sexp', p:1, sig:0.5, dw:0.05, omxUnits:8, t:0, playing:true, speed:1,
  ckIdeal:true, ckEnv:true, ckRaw:false, ckLens:true, ckBrk:true,
  Ncapped:false, mask:null, hoverN:null
};

var COMP=null;   // {N,dw,re,im}  长度 2N+1，下标 n+N（权重，不含 e^{σt}）
var CURVE=null;  // {ts,re,im,NT,Xw}

function P(){ return PRESETS[st.preset]; }
function xOf(u){ return P().x(u, st.p); }
function Xof(w){ return P().X2(st.sig, w, st.p); }
function twNow(){ return P().tail(st.p); }
function trNow(){ return 2*Math.PI/st.dw; }
function xwNow(){
  var Tw=twNow(), Tr=trNow();
  var v=Tr+Tw, lo=3*Tw, hi=6*Tw;
  if(v<lo)v=lo; if(v>hi)v=hi;
  return v;
}
function rocTxt(){
  var lo=P().rocLo(st.p), hi=P().rocHi(st.p);
  return '('+(lo===-INF?'−∞':fmt(lo,2))+', '+(hi===INF?'+∞':fmt(hi,2))+')';
}

function computeComp(){
  var dw=st.dw;
  var omx=st.omxUnits*P().lobe(st.p,st.sig);
  var N=Math.floor(omx/dw); if(N>2048){N=2048; st.Ncapped=true;} else st.Ncapped=false;
  if(N<1)N=1;
  var re=new Float64Array(2*N+1), im=new Float64Array(2*N+1);
  var k=dw/(2*Math.PI);
  for(var n=-N;n<=N;n++){
    var X=P().X2(st.sig,n*dw,st.p);
    re[n+N]=X[0]*k; im[n+N]=X[1]*k;
  }
  if(!st.mask || st.mask.length!==2*N+1){ st.mask=new Uint8Array(2*N+1); st.mask.fill(1); }
  COMP={N:N,dw:dw,re:re,im:im};
}

function gExact(t){
  var N=COMP.N, dw=COMP.dw, re=COMP.re, im=COMP.im, mk=st.mask;
  var sr=0, si=0;
  for(var n=-N;n<=N;n++){
    var i=n+N; if(!mk[i]) continue;
    var c=Math.cos(n*dw*t), s=Math.sin(n*dw*t);
    sr+=re[i]*c-im[i]*s; si+=re[i]*s+im[i]*c;
  }
  return [sr,si];
}

function sExact(t){
  var g=gExact(t), e=Math.exp(st.sig*t);
  return [g[0]*e,g[1]*e];
}

function chainAt(t){
  var N=COMP.N, dw=COMP.dw, re=COMP.re, im=COMP.im, mk=st.mask;
  var M=2*N+1;
  var pts=new Float64Array(2*M);
  var x=0, y=0;
  for(var i=0;i<M;i++){
    var n=i-N;
    if(mk[i]){
      var c=Math.cos(n*dw*t), s=Math.sin(n*dw*t);
      x+=re[i]*c-im[i]*s; y+=re[i]*s+im[i]*c;
    }
    pts[2*i]=x; pts[2*i+1]=y;
  }
  var e=Math.exp(st.sig*t);
  for(i=0;i<2*M;i++) pts[i]*=e;
  return {pts:pts,M:M,end:[x*e,y*e]};
}

function computeCurve(){
  var Xw=xwNow(), NT=700;
  var ts=new Float64Array(NT), re=new Float64Array(NT), im=new Float64Array(NT);
  var N=COMP.N, dw=COMP.dw, cre=COMP.re, cim=COMP.im, mk=st.mask, sig=st.sig;
  for(var i=0;i<NT;i++){
    var t=-Xw+2*Xw*i/(NT-1);
    var sr=0, si=0;
    var pr=Math.cos(-N*dw*t), pi=Math.sin(-N*dw*t);
    var cr=Math.cos(dw*t), ci=Math.sin(dw*t);
    for(var n=-N;n<=N;n++){
      var idx=n+N;
      if(mk[idx]){ sr+=cre[idx]*pr-cim[idx]*pi; si+=cre[idx]*pi+cim[idx]*pr; }
      var nr=pr*cr-pi*ci; pi=pr*ci+pi*cr; pr=nr;
    }
    var e=Math.exp(sig*t);
    ts[i]=t; re[i]=sr*e; im[i]=si*e;
  }
  CURVE={ts:ts,re:re,im:im,NT:NT,Xw:Xw};
}

function refIntegral(om,t){
  var M=32768, h=2*om/M, sr=0, si=0;
  var e=Math.exp(st.sig*t);
  for(var m=0;m<M;m++){
    var w=-om+h*(m+0.5);
    var X=Xof(w);
    var c=Math.cos(w*t), s=Math.sin(w*t);
    sr+=X[0]*c-X[1]*s; si+=X[0]*s+X[1]*c;
  }
  return [sr*h*e/(2*Math.PI), si*h*e/(2*Math.PI)];
}

function numX(sr,wi,T,M){
  var h=2*T/M, sr0=0, si0=0;
  for(var m=0;m<M;m++){
    var u=-T+h*(m+0.5);
    var f=xOf(u);
    var er=Math.exp(-sr*u);
    var c=Math.cos(wi*u), s=Math.sin(wi*u);
    sr0+=f*er*c; si0+=-f*er*s;
  }
  return [sr0*h, si0*h];
}

/* ---------- drawing ---------- */

var cv=document.getElementById('cv');
var ctx=cv.getContext('2d');
var R={};
var lastChain=null, mainSc=1, lensFocus=null, scrubbing=false;

function fit(){
  var dpr=Math.min(window.devicePixelRatio||1,2);
  var w=cv.clientWidth|0, h=cv.clientHeight|0;
  if(w<10||h<10){w=980;h=560;}
  var W=Math.round(w*dpr), H=Math.round(h*dpr);
  if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {w:w,h:h};
}

function layout(w,h){
  var topH=Math.round(h*0.55);
  var sw=Math.round((w-42)*0.55);
  R.cplx={x:14,y:26,w:sw,h:topH-40};
  R.spec={x:14+sw+14,y:26,w:w-28-sw-14,h:topH-40};
  R.cap={x:14,y:topH-12,w:w-28,h:24};
  R.time={x:14,y:topH+18,w:w-28,h:h-topH-30};
}

function regime(){
  var Tw=twNow(), Tr=trNow(), Xw=xwNow(), dw=st.dw, lobe=P().lobe(st.p,st.sig);
  var pre='σ='+fmt(st.sig,2)+'∈ROC'+rocTxt()+'，副本权重 e^{−σkTr}：k=−1 → '+fmtG(Math.exp(st.sig*Tr))+'；';
  if(Tr<=2*Tw) return {k:0, txt:pre+' Tr = 2π/Δω = '+fmt(Tr,2)+' ≤ 2·Tw：相邻周期副本 Σₖ e^{−σkTr}f(t+kTr) 在窗内重叠混叠 —— Δω 太大，继续减小 Δω'};
  if(Tr<=Xw+Tw) return {k:1, txt:pre+' 副本已分开（Tr > 2·Tw），但轴上仍看得到一个完整周期 Tr：s(t) 还是严格周期的黎曼和；继续减小 Δω 把副本推出窗'};
  if(dw<lobe/8) return {k:2, txt:pre+' Δω 已足够小（< 主瓣/8）且副本出窗：黎曼和 ≈ Bromwich 积分 (1/2πj)∫X(s)e^{st}ds，窗内即 f(t)；链段已缩到肉眼难辨，用放大镜看，e^{σt} 让链呼吸'};
  return {k:3, txt:pre+' 副本已出窗，但 Δω='+fmt(dw,4)+' 还不够小（需 < 主瓣/8='+fmt(lobe/8,4)+'）：继续减小 Δω，黎曼和才会贴紧积分'};
}

function arrow(x1,y1,x2,y2){
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  var a=Math.atan2(y2-y1,x2-x1), L=7;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-L*Math.cos(a-0.42), y2-L*Math.sin(a-0.42));
  ctx.lineTo(x2-L*Math.cos(a+0.42), y2-L*Math.sin(a+0.42));
  ctx.closePath(); ctx.fill();
}

function drawLens(ch){
  var r=R.cplx;
  var lx=r.x+r.w-78, ly=r.y+78, LR=64;
  var fi=(lensFocus!==null)?lensFocus:COMP.N;
  if(fi<6)fi=6; if(fi>ch.M-7)fi=ch.M-7;
  if(fi<6) return;
  var fx=ch.pts[2*fi], fy=ch.pts[2*fi+1];
  var d=1e-12, i;
  for(i=fi-6;i<=fi+6;i++){
    var dd=Math.hypot(ch.pts[2*i]-fx, ch.pts[2*i+1]-fy);
    if(dd>d)d=dd;
  }
  var scl=(LR-14)/d;
  var g=scl/mainSc;
  ctx.save();
  ctx.beginPath(); ctx.arc(lx,ly,LR,0,6.2832); ctx.clip();
  ctx.fillStyle='#0b1424'; ctx.fillRect(lx-LR,ly-LR,2*LR,2*LR);
  ctx.lineWidth=1.5;
  for(i=fi-5;i<=fi+6;i++){
    var n=i-COMP.N;
    var x1=lx+(ch.pts[2*i-2]-fx)*scl, y1=ly-(ch.pts[2*i-1]-fy)*scl;
    var x2=lx+(ch.pts[2*i]-fx)*scl, y2=ly-(ch.pts[2*i+1]-fy)*scl;
    ctx.strokeStyle=colFor(bucketOf(n,COMP.N)/23); ctx.fillStyle=ctx.strokeStyle;
    arrow(x1,y1,x2,y2);
  }
  ctx.lineWidth=1;
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(lx,ly,2.5,0,6.2832); ctx.fill();
  ctx.restore();
  ctx.strokeStyle='#33507f'; ctx.beginPath(); ctx.arc(lx,ly,LR,0,6.2832); ctx.stroke();
  ctx.fillStyle='#bcd0f2'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('放大 ×'+fmtG(g), lx-LR+4, ly+LR+14);
}

function drawComplex(){
  var r=R.cplx;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  var ch=chainAt(st.t);
  var mx=1e-9, i;
  for(i=0;i<ch.M;i++){
    var ax=Math.abs(ch.pts[2*i]), ay=Math.abs(ch.pts[2*i+1]);
    if(ax>mx)mx=ax; if(ay>mx)mx=ay;
  }
  if(Math.abs(ch.end[0])>mx)mx=Math.abs(ch.end[0]);
  if(Math.abs(ch.end[1])>mx)mx=Math.abs(ch.end[1]);
  mx*=1.15;
  var cx=r.x+r.w/2, cy=r.y+r.h/2+6;
  var sc=Math.min((r.w/2-14)/mx,(r.h/2-22)/mx);
  mainSc=sc;
  function X(v){ return cx+v*sc; }
  function Y(v){ return cy-v*sc; }
  ctx.strokeStyle='#2a3b5c'; ctx.beginPath();
  ctx.moveTo(r.x+6,cy); ctx.lineTo(r.x+r.w-6,cy);
  ctx.moveTo(cx,r.y+18); ctx.lineTo(cx,r.y+r.h-8);
  ctx.stroke();
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('复平面：vₙ=X(σ+jnΔω)(Δω/2π)e^{(σ+jnΔω)t} 首尾相接（n=−N…N），端点 = s(t)；e^{σt} 让整条链呼吸', r.x+8, r.y+14);
  ctx.fillText('Re', r.x+r.w-20, cy-4);
  ctx.fillText('Im', cx+4, r.y+28);
  var N=COMP.N;
  var B=24, paths=[];
  for(i=0;i<B;i++) paths.push(null);
  for(i=1;i<ch.M;i++){
    var b=bucketOf(i-N,N);
    if(!paths[b]) paths[b]=[];
    paths[b].push(X(ch.pts[2*i-2]),Y(ch.pts[2*i-1]),X(ch.pts[2*i]),Y(ch.pts[2*i+1]));
  }
  for(i=0;i<B;i++){
    if(!paths[i]) continue;
    ctx.strokeStyle=colFor(i/23); ctx.beginPath();
    var arr=paths[i];
    for(var j=0;j<arr.length;j+=4){ ctx.moveTo(arr[j],arr[j+1]); ctx.lineTo(arr[j+2],arr[j+3]); }
    ctx.stroke();
  }
  if(st.hoverN!==null){
    var hi=st.hoverN+N;
    if(hi>=1&&hi<ch.M){
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.beginPath();
      ctx.moveTo(X(ch.pts[2*hi-2]),Y(ch.pts[2*hi-1]));
      ctx.lineTo(X(ch.pts[2*hi]),Y(ch.pts[2*hi+1]));
      ctx.stroke(); ctx.lineWidth=1;
    }
  }
  var ex=X(ch.end[0]), ey=Y(ch.end[1]);
  ctx.strokeStyle='#ff5d5d'; ctx.fillStyle='#ff5d5d'; ctx.lineWidth=2;
  if(Math.hypot(ex-cx,ey-cy)>3) arrow(cx,cy,ex,ey);
  ctx.lineWidth=1;
  ctx.fillText('s(t)', (cx+ex)/2+6, (cy+ey)/2-6);
  ctx.strokeStyle='#8fa2c4'; ctx.setLineDash([4,4]); ctx.beginPath();
  ctx.moveTo(ex,ey); ctx.lineTo(ex,cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(ex,ey,3.5,0,6.2832); ctx.fill();
  ctx.fillStyle='#e8eefc';
  ctx.fillText('Re s(t) = '+fmt(ch.end[0],4), ex+6, ey-6);
  if(st.ckLens && ch.M>=13) drawLens(ch);
  ctx.restore();
  lastChain={pts:ch.pts,M:ch.M,cx:cx,cy:cy,sc:sc};
  return ch;
}

function drawSplane(){
  var r=R.spec;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  var pr=P(), srr=pr.srange(st.p), slo=srr[0], shi=srr[1], imr=pr.imr(st.p);
  var N=COMP.N, dw=COMP.dw, k=dw/(2*Math.PI), raw=st.ckRaw;
  function SX(sre){ return r.x+r.w*(sre-slo)/(shi-slo); }
  function SY(wi){ return r.y+r.h/2-(wi/imr)*(r.h/2-20); }
  var rl=pr.rocLo(st.p), rh=pr.rocHi(st.p);
  var b0=Math.max(slo,rl===-INF?slo:rl), b1=Math.min(shi,rh===INF?shi:rh);
  if(b1>b0){
    ctx.fillStyle='rgba(120,220,150,0.10)'; ctx.fillRect(SX(b0),r.y,SX(b1)-SX(b0),r.h);
    ctx.strokeStyle='rgba(120,220,150,0.45)'; ctx.setLineDash([4,4]); ctx.beginPath();
    if(rl!==-INF){ ctx.moveTo(SX(rl),r.y); ctx.lineTo(SX(rl),r.y+r.h); }
    if(rh!==INF){ ctx.moveTo(SX(rh),r.y); ctx.lineTo(SX(rh),r.y+r.h); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle='#2a3b5c'; ctx.beginPath();
  ctx.moveTo(r.x,SY(0)); ctx.lineTo(r.x+r.w,SY(0));
  if(slo<0&&shi>0){ ctx.moveTo(SX(0),r.y+16); ctx.lineTo(SX(0),r.y+r.h-6); }
  ctx.stroke();
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('s 平面：× 极点 ○ 零点，绿带 = ROC；青竖线 Re s=σ，横谱线 = 权重（点击静音，双击恢复）', r.x+8, r.y+14);
  ctx.fillText('Re s', r.x+r.w-30, SY(0)-4);
  ctx.fillText('Im s', (slo<0&&shi>0?SX(0):r.x+4)+4, r.y+26);
  function stemMag(n){
    if(raw){ var Xr=pr.X2(st.sig,n*dw,st.p); return Math.hypot(Xr[0],Xr[1]); }
    return Math.hypot(COMP.re[n+N],COMP.im[n+N]);
  }
  function envMag(w){ var Xe=pr.X2(st.sig,w,st.p); return Math.hypot(Xe[0],Xe[1])*(raw?1:k); }
  var ymax=1e-9, n, i;
  for(n=-N;n<=N;n++){ if(Math.abs(n*dw)<=imr){ var m=stemMag(n); if(m>ymax)ymax=m; } }
  if(st.ckEnv){ for(i=0;i<=160;i++){ var ev=envMag(-imr+2*imr*i/160); if(ev>ymax)ymax=ev; } }
  ymax*=1.15;
  var xline=SX(st.sig);
  function lenOf(m){ return (m/ymax)*(r.w*0.30); }
  if(st.ckEnv){
    ctx.strokeStyle='#9aa8c0'; ctx.beginPath();
    for(i=0;i<=320;i++){ var w2=-imr+2*imr*i/320; var xx=xline+lenOf(envMag(w2)), yy=SY(w2); if(i===0)ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); }
    ctx.stroke();
  }
  ctx.strokeStyle='#7fd1ff'; ctx.beginPath(); ctx.moveTo(xline,r.y+18); ctx.lineTo(xline,r.y+r.h-6); ctx.stroke();
  ctx.fillStyle='#7fd1ff'; ctx.fillText('σ='+fmt(st.sig,2), xline+4, r.y+r.h-10);
  var B=24, paths=[], muted=[];
  for(i=0;i<B;i++) paths.push(null);
  for(n=-N;n<=N;n++){
    var w3=n*dw; if(Math.abs(w3)>imr) continue;
    var yy3=SY(w3), ll=lenOf(stemMag(n));
    if(!st.mask[n+N]){ muted.push(xline,yy3,ll); continue; }
    var bb=bucketOf(n,N);
    if(!paths[bb]) paths[bb]=[];
    paths[bb].push(xline,yy3,ll);
  }
  for(i=0;i<B;i++){
    if(!paths[i]) continue;
    ctx.strokeStyle=colFor(i/23); ctx.beginPath();
    var arr=paths[i];
    for(var j=0;j<arr.length;j+=3){ ctx.moveTo(arr[j],arr[j+1]); ctx.lineTo(arr[j]+arr[j+2],arr[j+1]); }
    ctx.stroke();
  }
  if(muted.length){
    ctx.save(); ctx.globalAlpha=0.18; ctx.strokeStyle='#9aa8c0'; ctx.beginPath();
    for(j=0;j<muted.length;j+=3){ ctx.moveTo(muted[j],muted[j+1]); ctx.lineTo(muted[j]+muted[j+2],muted[j+1]); }
    ctx.stroke(); ctx.restore();
  }
  if(st.hoverN!==null&&st.hoverN>=-N&&st.hoverN<=N&&Math.abs(st.hoverN*dw)<=imr){
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.beginPath();
    ctx.moveTo(xline,SY(st.hoverN*dw)); ctx.lineTo(xline+lenOf(stemMag(st.hoverN)),SY(st.hoverN*dw));
    ctx.stroke(); ctx.lineWidth=1;
  }
  var pl=pr.poles(st.p), zl=pr.zeros(st.p);
  ctx.strokeStyle='#ff7bd5'; ctx.lineWidth=2;
  for(i=0;i<pl.length;i++){
    var px=SX(pl[i][0]), py=SY(pl[i][1]);
    ctx.beginPath(); ctx.moveTo(px-5,py-5); ctx.lineTo(px+5,py+5); ctx.moveTo(px-5,py+5); ctx.lineTo(px+5,py-5); ctx.stroke();
  }
  ctx.lineWidth=1.5; ctx.strokeStyle='#ffffff';
  for(i=0;i<zl.length;i++){ ctx.beginPath(); ctx.arc(SX(zl[i][0]),SY(zl[i][1]),3.5,0,6.2832); ctx.stroke(); }
  ctx.lineWidth=1;
  ctx.restore();
}

function drawTime(){
  var r=R.time;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.beginPath(); ctx.rect(r.x+1,r.y+1,r.w-2,r.h-2); ctx.clip();
  var Xw=CURVE.Xw, Tw=twNow(), Tr=trNow();
  var ymax=1e-9, i;
  for(i=0;i<CURVE.NT;i++) if(Math.abs(CURVE.re[i])>ymax) ymax=Math.abs(CURVE.re[i]);
  if(st.ckIdeal){ for(i=0;i<400;i++){ var u=-Xw+2*Xw*i/399; var xv=Math.abs(xOf(u)); if(xv>ymax) ymax=xv; } }
  if(st.ckBrk){
    for(var kk=-2;kk<=2;kk++){
      if(kk===0) continue;
      var wg=Math.exp(-st.sig*kk*Tr);
      if(!isFinite(wg)||Math.abs(wg)<1e-4||Math.abs(wg)>8) continue;
      for(i=0;i<200;i++){ var ug=-Xw+2*Xw*i/199; var vg=Math.abs(wg*xOf(ug+kk*Tr)); if(vg>ymax) ymax=vg; }
    }
  }
  ymax*=1.18;
  function X(t){ return r.x+r.w*(t+Xw)/(2*Xw); }
  function Y(v){ return r.y+r.h/2-(v/ymax)*(r.h/2-24); }
  ctx.strokeStyle='#2a3b5c'; ctx.beginPath();
  ctx.moveTo(r.x,Y(0)); ctx.lineTo(r.x+r.w,Y(0)); ctx.stroke();
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('时域：彩色 = 黎曼和合成 Re s(t)（周期 Tr、副本权重 e^{−σkTr}），灰虚线 = 理想 f(t)；按住拖动刮擦 t', r.x+8, r.y+14);
  ctx.fillText('t', r.x+r.w-10, Y(0)-4);
  if(st.ckIdeal){
    ctx.strokeStyle='#7a8db0'; ctx.setLineDash([5,4]); ctx.beginPath();
    for(i=0;i<=400;i++){ var u2=-Xw+2*Xw*i/400; var y2=Y(xOf(u2)); if(i===0)ctx.moveTo(X(u2),y2); else ctx.lineTo(X(u2),y2); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  if(st.ckBrk){
    for(kk=-2;kk<=2;kk++){
      if(kk===0) continue;
      var wg2=Math.exp(-st.sig*kk*Tr);
      if(!isFinite(wg2)||Math.abs(wg2)<1e-4||Math.abs(wg2)>1e6) continue;
      ctx.strokeStyle='rgba(255,120,200,0.45)'; ctx.setLineDash([2,3]); ctx.beginPath();
      for(i=0;i<=240;i++){ var u3=-Xw+2*Xw*i/240; var y3=Y(wg2*xOf(u3+kk*Tr)); if(i===0)ctx.moveTo(X(u3),y3); else ctx.lineTo(X(u3),y3); }
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  ctx.strokeStyle='#7fd1ff'; ctx.lineWidth=2; ctx.beginPath();
  for(i=0;i<CURVE.NT;i++){ var y4=Y(CURVE.re[i]); if(i===0)ctx.moveTo(X(CURVE.ts[i]),y4); else ctx.lineTo(X(CURVE.ts[i]),y4); }
  ctx.stroke(); ctx.lineWidth=1;
  if(st.ckBrk){
    var yb=r.y+r.h-34;
    ctx.strokeStyle='#ff5d5d'; ctx.beginPath();
    ctx.moveTo(X(-Tw),yb); ctx.lineTo(X(Tw),yb);
    ctx.moveTo(X(-Tw),yb-5); ctx.lineTo(X(-Tw),yb+5);
    ctx.moveTo(X(Tw),yb-5); ctx.lineTo(X(Tw),yb+5);
    ctx.stroke();
    ctx.fillStyle='#ff5d5d'; ctx.fillText('观测窗 ±Tw='+fmt(Tw,2), X(0)-40, yb-6);
    if(Tr/2<=Xw){
      var yp=r.y+r.h-18;
      ctx.strokeStyle='#ffd479'; ctx.beginPath();
      ctx.moveTo(X(-Tr/2),yp); ctx.lineTo(X(Tr/2),yp);
      ctx.moveTo(X(-Tr/2),yp-5); ctx.lineTo(X(-Tr/2),yp+5);
      ctx.moveTo(X(Tr/2),yp-5); ctx.lineTo(X(Tr/2),yp+5);
      ctx.stroke();
      ctx.fillStyle='#ffd479'; ctx.fillText('黎曼周期 Tr='+fmt(Tr,2), X(0)-44, yp-6);
    }
  }
  var xt=X(st.t), se=sExact(st.t);
  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.beginPath();
  ctx.moveTo(xt,r.y+18); ctx.lineTo(xt,r.y+r.h-8); ctx.stroke();
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(xt,Y(se[0]),3,0,6.2832); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawCaption(){
  var r=R.cap, rg=regime();
  ctx.save();
  ctx.fillStyle='#16233c'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.fillStyle=rg.k===2?'#9fe8b4':(rg.k===0?'#ffb0b0':'#cfe0ff');
  ctx.font='12px Segoe UI, Microsoft YaHei, sans-serif';
  ctx.fillText(rg.txt, r.x+10, r.y+16);
  ctx.restore();
}

function draw(){
  var d=fit();
  layout(d.w,d.h);
  ctx.clearRect(0,0,d.w,d.h);
  var ch=drawComplex();
  drawSplane();
  drawTime();
  drawCaption();
  return ch;
}

/* ---------- controls ---------- */

function el(id){ return document.getElementById(id); }
var ePreset=el('preset'), eShape=el('shape'), eShapeLab=el('shapeLab'), eShapeVal=el('shapeval');
var eSig=el('sig'), eSigVal=el('sigval');
var eLogDw=el('logdw'), eDwVal=el('dwval'), eOmx=el('omx'), eOmxVal=el('omxval');
var ePlay=el('play'), eStep=el('step'), eSpeed=el('speed'), eSpeedVal=el('speedval');
var eTsl=el('tsl'), eTval=el('tval');
var eIdeal=el('ckIdeal'), eEnv=el('ckEnv'), eRaw=el('ckRaw'), eLens=el('ckLens'), eBrk=el('ckBrk');
var rDw=el('r_dw'), rN=el('r_N'), rMag=el('r_mag'), rSig=el('r_sig'), rEsig=el('r_esig');
var rTr=el('r_Tr'), rTw=el('r_Tw'), rErr=el('r_err'), rT=el('r_t'), rEnd=el('r_end'), rNote=el('r_capNote');

var dirty=true;

function syncShape(){
  var pr=P();
  eShapeLab.textContent=pr.plab;
  eShape.min=pr.pmin; eShape.max=pr.pmax; eShape.step=pr.pstep; eShape.value=st.p;
  eShapeVal.textContent=(+st.p).toFixed(2);
}
function syncSig(){
  var pr=P();
  var lo=pr.rocLo(st.p), hi=pr.rocHi(st.p);
  lo=(lo===-INF)?-2:lo+0.12;
  hi=(hi===INF)?1.2:hi-0.12;
  if(hi<=lo) hi=lo+0.1;
  if(st.sig<lo)st.sig=lo; if(st.sig>hi)st.sig=hi;
  eSig.min=lo; eSig.max=hi; eSig.step=0.01; eSig.value=st.sig;
  eSigVal.textContent=(+st.sig).toFixed(2);
}
function syncDw(){
  var u=Math.log(st.dw/0.02)/Math.log(100);
  eLogDw.value=Math.round(u*1000);
  eDwVal.textContent=fmt(st.dw,4);
}
function syncOmx(){ eOmxVal.textContent=st.omxUnits+' 主瓣'; }
function syncSpeed(){ eSpeed.value=st.speed; eSpeedVal.textContent=(+st.speed).toFixed(1)+'×'; }
function syncTsl(){
  var Xw=xwNow();
  eTsl.min=-Xw; eTsl.max=Xw; eTsl.step=(2*Xw)/1000;
  if(st.t<-Xw)st.t=-Xw; if(st.t>Xw)st.t=Xw;
  eTsl.value=st.t;
}

function readouts(ch){
  var N=COMP.N, dw=st.dw, n;
  rDw.textContent=fmt(dw,5)+' rad/s'+(st.Ncapped?'（N 已封顶 2048）':'');
  rN.textContent=''+(2*N+1);
  var mmax=0;
  for(n=-N;n<=N;n++){ var m=Math.hypot(COMP.re[n+N],COMP.im[n+N]); if(m>mmax)mmax=m; }
  rMag.textContent=mmax.toExponential(2);
  rSig.textContent=fmt(st.sig,2)+'，ROC '+rocTxt();
  var esig=Math.exp(st.sig*st.t);
  rEsig.textContent=(esig>=1e5||esig<1e-4)?esig.toExponential(2):fmt(esig,3);
  rTr.textContent=fmt(trNow(),2)+' s';
  rTw.textContent='±'+fmt(twNow(),2)+' s（轴 ±'+fmt(CURVE.Xw,2)+'）';
  var Tw=twNow(), e=0;
  for(var i=0;i<CURVE.NT;i++){
    var t=CURVE.ts[i]; if(Math.abs(t)>Tw) continue;
    var d=Math.abs(CURVE.re[i]-xOf(t)); if(d>e)e=d;
  }
  rErr.textContent=fmt(e,5);
  rT.textContent=fmt(st.t,3);
  rEnd.textContent=fmt(ch.end[0],4)+(ch.end[1]<0?' − j':' + j')+fmt(Math.abs(ch.end[1]),4);
  var rg=regime();
  rNote.textContent=['阶段 1/4：Δω 太大，副本重叠混叠','阶段 2/4：副本分开但仍见周期 Tr','阶段 3/4：和 ≈ Bromwich 积分','阶段 2.5/4：副本出窗但 Δω 仍偏大'][rg.k];
}

function canvasPos(e){ var rc=cv.getBoundingClientRect(); return [e.clientX-rc.left, e.clientY-rc.top]; }
function inRect(p,r){ return p[0]>=r.x&&p[0]<=r.x+r.w&&p[1]>=r.y&&p[1]<=r.y+r.h; }
function setTFromX(px){
  var Xw=CURVE?CURVE.Xw:xwNow();
  var t=((px-R.time.x)/R.time.w*2-1)*Xw;
  if(t<-Xw)t=-Xw; if(t>Xw)t=Xw;
  st.t=t; eTsl.value=t;
}

function bind(){
  ePreset.addEventListener('change',function(e){
    st.preset=e.target.value; st.p=P().pdef; st.sig=P().sdef;
    syncShape(); syncSig(); syncTsl(); dirty=true;
  });
  eShape.addEventListener('input',function(e){ st.p=parseFloat(e.target.value); eShapeVal.textContent=(+st.p).toFixed(2); syncSig(); syncTsl(); dirty=true; });
  eSig.addEventListener('input',function(e){ st.sig=parseFloat(e.target.value); eSigVal.textContent=(+st.sig).toFixed(2); dirty=true; });
  eLogDw.addEventListener('input',function(e){ var u=(+e.target.value)/1000; st.dw=0.02*Math.pow(100,u); syncDw(); syncTsl(); dirty=true; });
  eOmx.addEventListener('input',function(e){ st.omxUnits=+e.target.value; syncOmx(); dirty=true; });
  ePlay.addEventListener('click',function(){ st.playing=!st.playing; ePlay.textContent=st.playing?'⏸ 暂停':'▶ 播放'; });
  eStep.addEventListener('click',function(){
    st.playing=false; ePlay.textContent='▶ 播放';
    var Tw=twNow(); st.t+=Tw/64; if(st.t>Tw) st.t-=2*Tw;
    eTsl.value=st.t;
  });
  eSpeed.addEventListener('input',function(e){ st.speed=+e.target.value; syncSpeed(); });
  eTsl.addEventListener('input',function(e){ st.t=+e.target.value; });
  eIdeal.addEventListener('change',function(e){ st.ckIdeal=e.target.checked; });
  eEnv.addEventListener('change',function(e){ st.ckEnv=e.target.checked; });
  eRaw.addEventListener('change',function(e){ st.ckRaw=e.target.checked; });
  eLens.addEventListener('change',function(e){ st.ckLens=e.target.checked; });
  eBrk.addEventListener('change',function(e){ st.ckBrk=e.target.checked; });
  attachPointer(cv,{
  move:function(e){
    var p=canvasPos(e);
    if(inRect(p,R.spec)){
      var imr=P().imr(st.p);
      var wi=((R.spec.y+R.spec.h/2-p[1])/(R.spec.h/2-20))*imr;
      var n=Math.round(wi/st.dw);
      st.hoverN=(n>=-COMP.N&&n<=COMP.N&&Math.abs(wi)<=imr)?n:null;
    } else st.hoverN=null;
    if(inRect(p,R.cplx)&&lastChain){
      var best=-1, bd=1e18;
      for(var i=0;i<lastChain.M;i++){
        var sx=lastChain.cx+lastChain.pts[2*i]*lastChain.sc;
        var sy=lastChain.cy-lastChain.pts[2*i+1]*lastChain.sc;
        var dd=(sx-p[0])*(sx-p[0])+(sy-p[1])*(sy-p[1]);
        if(dd<bd){ bd=dd; best=i; }
      }
      lensFocus=best;
    }
    if(scrubbing) setTFromX(p[0]);
  },
  down:function(e){
    var p=canvasPos(e);
    if(inRect(p,R.time)){
      scrubbing=true; st.playing=false; ePlay.textContent='▶ 播放';
      setTFromX(p[0]); e.preventDefault();
    }
  },
  up:function(){ scrubbing=false; }
  });
  cv.addEventListener('mouseleave',function(){ st.hoverN=null; lensFocus=null; });
  cv.addEventListener('keydown',function(e){
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      st.playing=false; ePlay.textContent='▶ 播放';
      st.t=clamp(st.t+(e.key==='ArrowRight'?1:-1)*twNow()/64,-xwNow(),xwNow());
      eTsl.value=st.t; e.preventDefault();
    } else if(e.key===' '||e.key==='Spacebar'){
      ePlay.click(); e.preventDefault();
    }
  });
  cv.addEventListener('click',function(e){
    var p=canvasPos(e);
    if(inRect(p,R.spec)&&st.hoverN!==null){
      var i=st.hoverN+COMP.N;
      st.mask[i]=st.mask[i]?0:1;
      dirty=true;
    }
  });
  cv.addEventListener('dblclick',function(e){
    var p=canvasPos(e);
    if(inRect(p,R.spec)){ st.mask.fill(1); dirty=true; }
  });
  window.addEventListener('resize',function(){ dirty=true; });
}

var lastTs=0;
function kick(){
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(frame);
  else setTimeout(function(){ frame(performance.now()); },16);
}
function frame(tsms){
  kick();
  if(document.hidden) return;
  var dt=lastTs?Math.min(0.05,(tsms-lastTs)/1000):0;
  lastTs=tsms;
  if(st.playing){
    var Tw=twNow();
    st.t+=dt*st.speed*(2*Tw/8);
    if(st.t>Tw) st.t=-Tw+(st.t-Tw);
    if(st.t<-Tw) st.t=Tw+(st.t+Tw);
    eTsl.value=st.t;
  }
  eTval.textContent=fmt(st.t,3);
  if(dirty){ computeComp(); computeCurve(); dirty=false; }
  var ch=draw();
  readouts(ch);
}

function init(){
  st.preset='sexp'; st.p=P().pdef; st.sig=P().sdef; st.dw=0.05; st.omxUnits=8; st.t=0; st.speed=1;
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  st.playing=!rm;
  syncShape(); syncSig(); syncDw(); syncOmx(); syncSpeed(); syncTsl();
  ePlay.textContent=st.playing?'⏸ 暂停':'▶ 播放';
  bind();
  computeComp(); computeCurve(); dirty=false;
  readouts(draw());
  kick();
}

function apply(o){
  if(o.preset!==undefined){ st.preset=o.preset; }
  if(o.p!==undefined){ st.p=o.p; }
  if(o.sig!==undefined){ st.sig=o.sig; }
  if(o.dw!==undefined){ st.dw=o.dw; }
  if(o.omxUnits!==undefined){ st.omxUnits=o.omxUnits; }
  if(o.t!==undefined){ st.t=o.t; }
  syncShape(); syncSig(); syncOmx(); syncTsl();
  computeComp(); computeCurve(); dirty=false;
}

init();

globalThis.__LIT={
  PRESETS:PRESETS, st:st,
  comp:function(){return COMP;}, curve:function(){return CURVE;},
  computeComp:computeComp, computeCurve:computeCurve,
  chainAt:chainAt, sExact:sExact, gExact:gExact, xOf:xOf, Xof:Xof,
  refIntegral:refIntegral, numX:numX,
  xwNow:xwNow, apply:apply, regime:regime, draw:draw
};

globalThis.__VIZ={st:st,draw:draw,apply:apply};
})();
