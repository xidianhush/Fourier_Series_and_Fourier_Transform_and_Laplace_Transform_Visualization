(function(){
'use strict';

var INF=Infinity;

var PRESETS = {
  sexp: {
    name:'one-sided exp', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1, sdef:0.5,
    rocLo:function(p){return -p;}, rocHi:function(p){return INF;},
    srange:function(p){return [-p-1.3,2.3];}, imr:function(p){return 4.5;},
    poles:function(p){return [[-p,0]];}, zeros:function(p){return [];},
    tail:function(p){return 6/p;},
    lobe:function(p,sig){return 2*Math.max(0.25,sig+p);},
    x:function(u,p){return u>=0?Math.exp(-p*u):0;},
    X2:function(sr,wi,p){var a=sr+p, d=a*a+wi*wi; return [a/d,-wi/d];}
  },
  dsin: {
    name:'damped sine', plab:'ω0', pmin:0.5, pmax:4, pstep:0.05, pdef:2, sdef:0.5,
    rocLo:function(p){return -1;}, rocHi:function(p){return INF;},
    srange:function(p){return [-2.5,2.5];}, imr:function(p){return Math.max(4.5,p+1.5);},
    poles:function(p){return [[-1,p],[-1,-p]];}, zeros:function(p){return [];},
    tail:function(p){return 6;},
    lobe:function(p,sig){return p*0.5+1.5;},
    x:function(u,p){return u>=0?Math.exp(-u)*Math.sin(p*u):0;},
    X2:function(sr,wi,p){var a=sr+1, qr=a*a-wi*wi+p*p, qi=2*a*wi, d=qr*qr+qi*qi; return [p*qr/d,-p*qi/d];}
  },
  dpole: {
    name:'double pole', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1, sdef:0.5,
    rocLo:function(p){return -p;}, rocHi:function(p){return INF;},
    srange:function(p){return [-p-1.3,2.3];}, imr:function(p){return 4.5;},
    poles:function(p){return [[-p,0]];}, zeros:function(p){return [];},
    tail:function(p){return 8/p;},
    lobe:function(p,sig){return 2*Math.max(0.25,sig+p);},
    x:function(u,p){return u>=0?u*Math.exp(-p*u):0;},
    X2:function(sr,wi,p){var a=sr+p, q=a*a+wi*wi, d=q*q; return [(a*a-wi*wi)/d,-2*a*wi/d];}
  },
  dexp: {
    name:'two-sided exp', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1, sdef:0,
    rocLo:function(p){return -p;}, rocHi:function(p){return p;},
    srange:function(p){return [-p-1.3,p+1.3];}, imr:function(p){return 4.5;},
    poles:function(p){return [[-p,0],[p,0]];}, zeros:function(p){return [];},
    tail:function(p){return 6/p;},
    lobe:function(p,sig){return 2*Math.max(0.25,Math.min(p-sig,p+sig));},
    x:function(u,p){return Math.exp(-p*Math.abs(u));},
    X2:function(sr,wi,p){var re=p*p-sr*sr+wi*wi, im=2*sr*wi, d=re*re+im*im; return [2*p*re/d,2*p*im/d];}
  },
  gauss: {
    name:'Gaussian', plab:'s', pmin:0.3, pmax:2, pstep:0.05, pdef:1, sdef:0,
    rocLo:function(p){return -INF;}, rocHi:function(p){return INF;},
    srange:function(p){return [-3,3];}, imr:function(p){return 4.5;},
    poles:function(p){return [];}, zeros:function(p){return [];},
    tail:function(p){return 3.5*p;},
    lobe:function(p,sig){return 2;},
    x:function(u,p){return Math.exp(-u*u/(2*p*p));},
    X2:function(sr,wi,p){var K=p*Math.sqrt(2*Math.PI), m=Math.exp((sr*sr-wi*wi)/2); return [K*m*Math.cos(sr*wi),K*m*Math.sin(sr*wi)];}
  },
  /* 自定义信号：字段都是"读 CUS"的桩，X 由数值求积填（见文件后半段的自定义信号一节） */
  custom: {
    name:'custom f(t)', plab:'a', pmin:0.2, pmax:4, pstep:0.05, pdef:1, sdef:0.5,
    rocLo:function(){return CUS.rocLo;}, rocHi:function(){return CUS.rocHi;},
    srange:function(){var lo=CUS.rocLo, hi=CUS.rocHi; return [lo===-INF?-3:lo-1.3, hi===INF?2.3:hi+1.3];},
    imr:function(){return CUS.imr;},
    poles:function(){return [];}, zeros:function(){return [];},
    tail:function(){return CUS.tail;},
    lobe:function(){return CUS.lobe;},
    x:function(u){return cusF(u);},
    X2:function(sr,wi){return cusQuad(sr,wi);}
  }
};

var st = {
  preset:'sexp', p:1, w0:2, sig:0.5, dw:0.05, omxUnits:8, t:0, playing:true, speed:1, winMul:1,
  ckIdeal:true, ckEnv:true, ckRaw:false, ckLens:true, ckBrk:true, freezeScale:true,
  Ncapped:false, mask:null, hoverN:null
};

var COMP=null;   // {N,dw,re,im}  长度 2N+1，下标 n+N（权重，不含 e^{σt}）
var CURVE=null;  // {ts,re,im,NT,Xw}

function P(){ return PRESETS[st.preset]; }
function xOf(u){ return P().x(u, st.p); }
function Xof(w){ return P().X2(st.sig, w, st.p); }
/* 观测窗 = k × 预设的"尾巴时间"（信号衰减到可忽略的时间）。它是本页自造的量：
   方括号、误差读数、时域纵轴定标、横轴宽度 Xw 与播放回绕范围都由它决定。 */
function twNow(){ return st.winMul*P().tail(st.p); }
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
  if(isCus()){ cusBuild(); cusSpectrum(); }        /* 自定义信号：先解析/探针/估主频，再定 Ωmax */
  var omx=st.omxUnits*P().lobe(st.p,st.sig);
  var N=Math.floor(omx/dw); if(N>2048){N=2048; st.Ncapped=true;} else st.Ncapped=false;
  if(N<1)N=1;
  /* 自定义信号：采样预算支撑不了那么高的 ω 时，砍掉高端的谱线（否则那些权重是混叠垃圾） */
  if(isCus()&&CUS.wLim>0){ var nm=Math.floor(CUS.wLim/dw); if(nm<1)nm=1; if(N>nm){ N=nm; st.Ncapped=true; } }
  var re=new Float64Array(2*N+1), im=new Float64Array(2*N+1);
  var k=dw/(2*Math.PI);
  if(isCus()){
    cusWeights(N,dw,k);
    for(var nc=-N;nc<=N;nc++){ re[nc+N]=CUS.Xre[nc+N]*k; im[nc+N]=CUS.Xim[nc+N]*k; }
  } else {
    for(var n=-N;n<=N;n++){
      var X=P().X2(st.sig,n*dw,st.p);
      re[n+N]=X[0]*k; im[n+N]=X[1]*k;
    }
  }
  if(!st.mask || st.mask.length!==2*N+1){ st.mask=new Uint8Array(2*N+1); st.mask.fill(1); }
  COMP={N:N,dw:dw,re:re,im:im};
  computeScale();                                  /* 复平面量程（冻结在观测窗内）随之刷新 */
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

/* ---------- 自定义信号（B 路线）：任意 f(t)，X(σ+jω) 由数值求积得到 ----------
   assets/expr.js 把 f(t) 文本编译成数值函数；这里负责三件事：
     ① cusBuild()    粗探针 f(t)（±60 s、1201 点）→ 建立时间/观测窗 Tw、左右对数斜率（→ ROC 估计）
     ② cusSpectrum() 粗扫 |X(σ+jω)|（0…min(60, 采样能支撑的 wLim)）→ 主频 peak（定取景半宽 imr、
                     Ωmax 兜底项），并记下 wLim 供 computeComp 回头砍 N
     ③ cusWeights()  加权跨度内的均匀网格上中点求积 → 权重表 X(σ+jnΔω)、灰幕布 |X(σ+jω)|、原始 |X|
   X 用双边定义 ∫f(t)e^{-st}dt（因果信号自己在表达式里乘 u(t)）。自定义信号没有闭式解，
   所以 ROC 只作数值估计、极点/零点不画；加权跨度在 ±60 s 处截断时给出提示。
   numX() 被 cusQuad() 复用（Xof → refIntegral 走它），它每次重算积分，只适合偶发调用。 */

var CUS_TP=60;                                  // 粗探针半宽（s）

var CUS={
  src:'exp(-a*t)*sin(w0*t)*u(t)', f:null, err:'', hint:'', warn:'',
  sigA:'', sigB:'', sigC:'', rocSig:'',          // 三级缓存签名（探针 / 频谱 / 权重表）
  tail:6, tailFull:INF, rocLo:-1, rocHi:INF, lobe:1, imr:4.5, peak:0, wLim:0,
  pt:null, pv:null, mx:1,                       // 粗探针
  t0:0, h:0.1, M:0, v:null,                     // 求积网格（v 已含 e^{-σt}）
  Xre:null, Xim:null, rawMag:null, env:null
};

function cusEnv(){ return {a:st.p, w0:st.w0}; }
function cusF(u){ return CUS.f?CUS.f(u,cusEnv()):0; }
function isCus(){ return st.preset==='custom'; }

/* ① 解析 + 粗探针：建立时间 → 观测窗 Tw；左右对数斜率 → ROC 估计 */
function cusBuild(){
  var key=CUS.src+'|'+st.p+'|'+st.w0;
  if(CUS.sigA===key&&CUS.pt) return;
  CUS.sigA=key; CUS.hint=''; CUS.warn='';
  var r=parseExpr(CUS.src);
  if(!r.ok){ CUS.err=r.err; return; }            /* 解析失败：保留上一个能用的 f，只报错 */
  CUS.err=''; CUS.f=r.at;
  if(!r.used.t) CUS.hint='no t in the expression: f(t) is constant';
  var NP=1201, i, mx=0, bad=0, env=cusEnv();
  var tt=new Float64Array(NP), vv=new Float64Array(NP);
  for(i=0;i<NP;i++){
    var t=-CUS_TP+2*CUS_TP*i/(NP-1); tt[i]=t;
    var y=CUS.f(t,env);
    if(!isFinite(y)){ bad++; y=0; }
    vv[i]=y; var a=Math.abs(y); if(a>mx)mx=a;
  }
  CUS.pt=tt; CUS.pv=vv; CUS.mx=mx;
  if(bad>NP/50) CUS.hint=(CUS.hint?CUS.hint+'; ':'')+'about '+Math.round(100*bad/NP)+'% of the values are not finite (expression undefined for some t)';
  if(!(mx>0)||!isFinite(mx)){
    CUS.tail=6; CUS.tailFull=INF; CUS.rocLo=-1; CUS.rocHi=INF; CUS.peak=0; CUS.lobe=1; CUS.imr=4.5;
    CUS.hint=(CUS.hint?CUS.hint+'; ':'')+'expression is identically 0 (or only takes non-finite values)';
    cusRocSync();
    return;
  }
  /* 建立时间：|f| 掉到峰值 2.5e-3（= e^{-6}，与预设 6/p、dsin 6、gauss 3.5p 同一口径）之外的左右边界 */
  var eps=2.5e-3*mx, hi=-1, lo=-1;
  for(i=NP-1;i>=0;i--){ if(Math.abs(vv[i])>eps){ hi=i; break; } }
  for(i=0;i<NP;i++){ if(Math.abs(vv[i])>eps){ lo=i; break; } }
  if(hi>=0&&hi<NP-4&&lo>3){
    CUS.tailFull=Math.max(Math.abs(tt[lo]),tt[hi]);
    CUS.tail=clamp(CUS.tailFull,0.5,CUS_TP);
  } else {
    CUS.tail=6; CUS.tailFull=INF;
    CUS.hint=(CUS.hint?CUS.hint+'; ':'')+'signal has not decayed within ±'+CUS_TP+' s to 2.5e-3 of peak (e^{−6}, same threshold as presets) — the Laplace transform may not exist; window set to ±6 s';
  }
  /* 包络：滑动窗（±3 s）取 |f| 的极大，免得振荡信号的过零点把拟合带歪 */
  var WIN=30, ev=new Float64Array(NP);
  for(i=0;i<NP;i++){
    var am=0, j0=i-WIN<0?0:i-WIN, j1=i+WIN>NP-1?NP-1:i+WIN;
    for(var j=j0;j<=j1;j++){ var aa=Math.abs(vv[j]); if(aa>am)am=aa; }
    ev[i]=am;
  }
  /* 对数斜率与弯曲度（最小二乘）：斜率在 |f|∈[1e-4,1e-2]×峰值 的衰减段上取，
     弯曲度在更宽的 [1e-4,1e-1]×峰值 段上做二次拟合。弯曲度显著为负 = 超指数衰减
     （高斯那样），不构成对 σ 的约束 → 判成 ∓∞。 */
  function bandFit(side,bandLo,bandHi,quad){
    var lo2=bandLo*mx, hi2=(bandHi===INF?INF:bandHi*mx);
    var n=0,sx=0,sy=0,sxx=0,sxy=0,sxxx=0,sxxxx=0,sxxy=0,i2;
    for(i2=0;i2<NP;i2++){
      if(side*tt[i2]<=0) continue;
      var a2=ev[i2];
      if(!(a2>lo2&&a2<hi2)) continue;
      var x=tt[i2], yy=Math.log(a2), x2=x*x;
      n++; sx+=x; sy+=yy; sxx+=x2; sxy+=x*yy;
      if(quad){ sxxx+=x2*x; sxxxx+=x2*x2; sxxy+=x2*yy; }
    }
    if(n<8) return null;
    if(!quad){ var d=n*sxx-sx*sx; if(!(Math.abs(d)>1e-9)) return null; return (n*sxy-sx*sy)/d; }
    var A=[[n,sx,sxx],[sx,sxx,sxxx],[sxx,sxxx,sxxxx]], b=[sy,sxy,sxxy];
    var det=A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
    if(!(Math.abs(det)>1e-12)) return null;
    var detC=A[0][0]*(A[1][1]*b[2]-b[1]*A[2][1])-A[0][1]*(A[1][0]*b[2]-b[1]*A[2][0])+b[0]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
    return detC/det;
  }
  function slopeOf(side){
    var far=bandFit(side,1e-4,1e-2,false);
    if(far===null) far=bandFit(side,1e-9,INF,false);
    if(far===null) return null;
    var c=bandFit(side,1e-4,1e-1,true);
    if(c!==null&&c<-0.1) return null;               /* 超指数衰减：不约束 σ */
    return far;
  }
  var negMax=0;
  for(i=0;i<NP;i++) if(tt[i]<0&&Math.abs(vv[i])>negMax) negMax=Math.abs(vv[i]);
  var causal=negMax<=1e-6*mx;
  var gR=slopeOf(1), gL=causal?null:slopeOf(-1);
  CUS.rocLo=(gR===null||!(gR>-25))?-INF:gR;
  CUS.rocHi=causal?INF:((gL===null||!(gL<25))?INF:gL);
  cusRocSync();
}

/* ROC 估计变了就把 σ 重新夹进新区间（cusBuild 结束时调；syncSig 读的就是 CUS.rocLo/rocHi） */
function cusRocSync(){
  var sig=CUS.rocLo+'|'+CUS.rocHi;
  if(CUS.rocSig===sig) return;
  CUS.rocSig=sig;
  if(typeof syncSig==='function') syncSig();
}

/* 加权跨度内的均匀网格：v[m]=f(t_m)e^{-σt_m}，t_m=t0+(m+0.5)h */
function cusGrid(Mmax,wMax,sr){
  var pt=CUS.pt, pv=CUS.pv;
  if(!pt) return null;
  var NP=pt.length, i, wm=0;
  var w=new Float64Array(NP);
  for(i=0;i<NP;i++){ w[i]=Math.abs(pv[i])*Math.exp(-sr*pt[i]); if(w[i]>wm)wm=w[i]; }
  if(!(wm>0)||!isFinite(wm)) return null;
  var eps=1e-6*wm, iLo=0, iHi=NP-1;
  for(i=0;i<NP;i++){ if(w[i]>eps){ iLo=i; break; } }
  for(i=NP-1;i>=0;i--){ if(w[i]>eps){ iHi=i; break; } }
  var t0=pt[iLo], t1=pt[iHi], span=t1-t0;
  if(!(span>1e-6)) return null;
  var hMax=(wMax>1)?0.25/wMax:0.05;             /* 相位步进 ≤0.25 rad：中点法在拐点(|t|之类)处只剩它了 */
  var M=Math.ceil(span/hMax); if(M<512)M=512; if(M>Mmax)M=Mmax;
  var h=span/M, v=new Float64Array(M), nbad=0;
  for(i=0;i<M;i++){
    var t=t0+(i+0.5)*h, fv=cusF(t)*Math.exp(-sr*t);
    if(!isFinite(fv)){ nbad++; fv=0; }
    v[i]=fv;
  }
  if(nbad>M/50) return null;
  /* edge：跨度被 ±CUS_TP 的探针边界切断时，边界处残留的加权幅度（相对峰值）→ 截断误差提示 */
  var edge=0;
  if(iLo<=0) edge=Math.max(edge,w[0]);
  if(iHi>=NP-1) edge=Math.max(edge,w[NP-1]);
  return {t0:t0,h:h,M:M,v:v,span:span,edge:edge/(wm||1),wm:wm,wLim:0.5/h};
}

/* 网格上的单个频点求和（不含 h）：Σ_m v[m]e^{-jωt_m}（初始相位取 e^{-jωt₁}，步进 e^{-jωh}） */
function cusSum(g,w){
  var M=g.M, v=g.v, m;
  var ph=w*(g.t0+0.5*g.h);
  var pr=Math.cos(ph), pi=-Math.sin(ph);
  var cr=Math.cos(-w*g.h), ci=Math.sin(-w*g.h);
  var ar=0, ai=0;
  for(m=0;m<M;m++){
    var vm=v[m]; ar+=vm*pr; ai+=vm*pi;
    var nr=pr*cr-pi*ci; pi=pr*ci+pi*cr; pr=nr;
  }
  return [ar,ai];
}

/* ② 粗扫 |X| 找主频：定取景半宽 imr（4.5…60）与 Ωmax 的兜底项，并记下采样能支撑的最高频率 wLim */
function cusSpectrum(){
  var key=CUS.sigA+'|'+st.sig;
  if(CUS.sigB===key) return;
  CUS.sigB=key;
  var g=cusGrid(4096,260,st.sig), best=0, bestm=-1, i;
  var wTop=g?Math.min(60,g.wLim):60;
  CUS.wLim=g?g.wLim:0;
  if(g){
    for(i=0;i<=150;i++){
      var w=wTop*i/150, s=cusSum(g,w), m=Math.hypot(s[0],s[1])*g.h;
      if(m>bestm){ bestm=m; best=w; }
    }
    if(!(bestm>0)) best=0;
  }
  CUS.peak=best;
  CUS.imr=clamp(1.5*best+1.5,4.5,60);
  /* 主瓣估计沿用预设的手工口径 lobe=2(σ+1/尾巴)，再按主频兜一层底（保证 Ωmax≥1.5·peak） */
  CUS.lobe=Math.max(0.4, 2*Math.max(st.sig,0)+(isFinite(CUS.tailFull)?12/CUS.tailFull:0), 1.5*best/8);
}

/* ③ 权重表 X(σ+jnΔω) + 灰幕布 |X(σ+jω)|（±imr 上 201 点） */
function cusWeights(N,dw,kk){
  var M2=2*N+1, key=CUS.sigA+'|'+st.sig+'|'+dw+'|'+N;
  if(CUS.sigC===key&&CUS.Xre&&CUS.Xre.length===M2) return;
  CUS.sigC=key;
  var g=cusGrid(4096,N*dw,st.sig);
  if(!g){
    CUS.Xre=new Float64Array(M2); CUS.Xim=new Float64Array(M2); CUS.rawMag=new Float64Array(M2); CUS.env=null;
    CUS.warn='cannot compute numeric X (weighted span is empty, or the signal is non-finite over the sampled range)';
    return;
  }
  CUS.t0=g.t0; CUS.h=g.h; CUS.M=g.M; CUS.v=g.v;
  var Xre=new Float64Array(M2), Xim=new Float64Array(M2), raw=new Float64Array(M2), n, i, s;
  for(n=-N;n<=N;n++){
    s=cusSum(g,n*dw);
    Xre[n+N]=s[0]*g.h; Xim[n+N]=s[1]*g.h;
    raw[n+N]=Math.hypot(s[0],s[1])*g.h;         /* 原始 |X(σ+jnΔω)|（不含 Δω/2π） */
  }
  CUS.Xre=Xre; CUS.Xim=Xim; CUS.rawMag=raw;
  var NE=200, env=new Float64Array(NE+1), imr=P().imr(st.p);
  for(i=0;i<=NE;i++){ s=cusSum(g,-imr+2*imr*i/NE); env[i]=Math.hypot(s[0],s[1])*g.h; }
  CUS.env=env;
  var wr=[];
  if(g.edge>1e-3) wr.push('sampling interval truncated at ±'+CUS_TP+' s (weighted signal still '+(100*g.edge).toFixed(2)+'% of peak there); numeric X is rough — is σ too close to the ROC boundary?');
  if(g.M>=4096&&N*dw>g.wLim) wr.push('with Δω this fine the sample count is capped at 4096 (h·ωmax too large); numeric X loses accuracy at high ω');
  CUS.warn=wr.join('; ');
}

/* 任意 (σ,ω) 的数值 X：走 numX()，只给 Xof/refIntegral 这类偶发调用用 */
function cusQuad(sr,wi){
  var T=CUS_TP, pt=CUS.pt, pv=CUS.pv, i;
  if(pt){
    var wm=0, w=new Float64Array(pt.length);
    for(i=0;i<pt.length;i++){ w[i]=Math.abs(pv[i])*Math.exp(-sr*pt[i]); if(w[i]>wm)wm=w[i]; }
    if(wm>0&&isFinite(wm)){
      var eps=1e-6*wm, iLo=0, iHi=pt.length-1;
      for(i=0;i<pt.length;i++){ if(w[i]>eps){ iLo=i; break; } }
      for(i=pt.length-1;i>=0;i--){ if(w[i]>eps){ iHi=i; break; } }
      T=clamp(Math.max(Math.abs(pt[iLo]),pt[iHi]),0.5,CUS_TP);
    }
  }
  return numX(sr,wi,T,4096);
}

/* ---------- drawing ---------- */

var cv=document.getElementById('cv');
var ctx=cv.getContext('2d');
var R={};
var lastChain=null, mainSc=1, mainMx=1, lensFocus=null, scrubbing=false;

/* 复平面的量程：冻结在"观测窗 ±Tw 内整条链伸得最远的那个幅度"上，播放/拖动 t 时不重算。
   为什么不像原来那样每帧按当前链取最大：那样量程会跟着链一起缩，任何时刻链都刚好铺满面板，
   于是 Re s(t)=0.96 与 0.03 画出来差不多长、跨帧根本没法比大小（2026-09 修）。
   冻结之后链会随 e^{σt} 明显胀缩、端点大小可直接对比；窗外（|t|>Tw）的链超出量程就被剪掉。
   取消「量程冻结」（st.freezeScale=false）就退回每帧自适应：链永远铺满面板，但大小不可比。
   mainMx<=0 表示"未冻结"（自适应）。 */
function chainExtentOf(ch){
  var mx=1e-9, i;
  for(i=0;i<ch.M;i++){
    var ax=Math.abs(ch.pts[2*i]), ay=Math.abs(ch.pts[2*i+1]);
    if(ax>mx)mx=ax; if(ay>mx)mx=ay;
  }
  return mx;
}
function chainExtent(t){ return chainExtentOf(chainAt(t)); }
function computeScale(){
  if(!st.freezeScale){ mainMx=0; return; }
  var Tw=twNow(), K=20, i, m=1e-9;   /* 21 个采样点、必含 t=0：K 取偶数才能采到中点；
                                         K=9（10 点）会正好跳过中点，窗内最大幅度被低估、t≈0 时链冲出面板（2026-09 修） */
  for(i=0;i<=K;i++){ var e=chainExtent(-Tw+2*Tw*i/K); if(e>m)m=e; }
  if(!(m>0)||!isFinite(m)) m=1;
  mainMx=m*1.15;
}
/* 比例尺上的"整数"刻度：1/2/5×10ⁿ 里最接近且不小于 v 的那个 */
function niceScaleNum(v){
  if(!(v>0)||!isFinite(v)) return 1;
  var e=Math.floor(Math.log(v)/Math.LN10), m=v/Math.pow(10,e);
  var n=m<=1?1:(m<=2?2:(m<=5?5:10));
  return n*Math.pow(10,e);
}

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
  var pre='σ='+fmt(st.sig,2)+'∈ROC'+rocTxt()+', replica weights e^{−σkTr}: k=−1 → '+fmtG(Math.exp(st.sig*Tr))+'; ';
  if(Tr<=2*Tw) return {k:0, txt:pre+' Tr = 2π/Δω = '+fmt(Tr,2)+' ≤ 2·Tw: adjacent periodic replicas Σₖ e^{−σkTr}f(t+kTr) overlap and alias inside the window — Δω too large, reduce Δω further'};
  if(Tr<=Xw+Tw) return {k:1, txt:pre+' replicas separated (Tr > 2·Tw), but one full period Tr is still on the axis: s(t) remains a strictly periodic Riemann sum; reduce Δω to push replicas out of the window'};
  if(dw<lobe/8) return {k:2, txt:pre+' Δω small enough (< lobe/8) and replicas out of the window: Riemann sum ≈ Bromwich integral (1/2πj)∫X(s)e^{st}ds, window shows f(t); chain segments now too small to see — use the lens; e^{σt} makes the chain breathe'};
  return {k:3, txt:pre+' replicas out of the window, but Δω='+fmt(dw,4)+' not small enough (need < lobe/8='+fmt(lobe/8,4)+'): reduce Δω further so the Riemann sum hugs the integral'};
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
    ctx.strokeStyle=colFor(phaseBucket(n)/23); ctx.fillStyle=ctx.strokeStyle;   /* 与 3D 栅栏同色：颜色 = 相位 */
    arrow(x1,y1,x2,y2);
  }
  ctx.lineWidth=1;
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(lx,ly,2.5,0,6.2832); ctx.fill();
  ctx.restore();
  ctx.strokeStyle='#33507f'; ctx.beginPath(); ctx.arc(lx,ly,LR,0,6.2832); ctx.stroke();
  ctx.fillStyle='#bcd0f2'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('zoom ×'+fmtG(g), lx-LR+4, ly+LR+14);
}

function drawComplex(){
  var r=R.cplx;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.beginPath(); ctx.rect(r.x+1,r.y+1,r.w-2,r.h-2); ctx.clip();
  var ch=chainAt(st.t);
  var mx=mainMx>0?mainMx:chainExtentOf(ch)*1.15, i;   /* 冻结：量程固定；未冻结：退回每帧自适应 */
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
  ctx.fillText('Complex plane: vₙ=X(σ+jnΔω)(Δω/2π)e^{(σ+jnΔω)t} tip-to-tail (n=−N…N), endpoint = s(t); '+
    'color = phase arg X (same colors as the 3D fence)'+(st.freezeScale?'; range frozen to window ±Tw (scale bar at lower left)':'; range auto-fits each frame'), r.x+8, r.y+14);
  ctx.fillText('Re', r.x+r.w-20, cy-4);
  ctx.fillText('Im', cx+4, r.y+28);
  var N=COMP.N;
  /* 链段按**相位**配色（`phaseBucket`），与右上 3D 栅栏、以及傅里叶反变换页的频谱/链完全同色：
     悬停某根柱子时链上对应段白色加粗，颜色本来也能对上。原来这里用 `bucketOf`（分量序号）配色，
     和栅栏的颜色对不上（2026-09 按用户要求统一）。 */
  var B=24, paths=[], chainB=new Int16Array(ch.M);
  for(i=0;i<B;i++) paths.push(null);
  for(i=0;i<ch.M;i++){
    var nseg=i-N, b=phaseBucket(nseg);         /* 第 i 段 = 分量 v_{i−N}：i=0 那段从原点出发（原先从 i=1 起画，漏了 v_{−N}） */
    chainB[nseg+COMP.N]=b;
    var x1=(i===0?cx:X(ch.pts[2*i-2])), y1=(i===0?cy:Y(ch.pts[2*i-1]));
    if(!paths[b]) paths[b]=[];
    paths[b].push(x1,y1,X(ch.pts[2*i]),Y(ch.pts[2*i+1]));
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
  var eLen=Math.hypot(ex-cx,ey-cy), eStub=false;
  ctx.strokeStyle='#ff5d5d'; ctx.fillStyle='#ff5d5d'; ctx.lineWidth=2;
  if(eLen>3){
    arrow(cx,cy,ex,ey);
  } else if(eLen>1e-3){
    /* 端点太短：按真实方向画一支虚线"示意箭头"（固定 12px），并标注它不是实长 */
    var ux=(ex-cx)/eLen, uy=(ey-cy)/eLen, SL=12;
    ctx.save();
    ctx.globalAlpha=0.55; ctx.setLineDash([3,3]);
    arrow(cx,cy,cx+ux*SL,cy+uy*SL);
    ctx.restore();
    eStub=true;
    ctx.fillStyle='#ffb0b0';
    ctx.fillText('≈0 (symbolic arrow, magnified '+fmtG(SL/eLen)+'×)', cx+ux*SL+6, cy+uy*SL+14);
  } else {
    ctx.fillStyle='#ffb0b0';
    ctx.fillText('≈0 (|s(t)| too small to draw a direction)', cx+8, cy+14);
  }
  ctx.lineWidth=1;
  ctx.strokeStyle='#8fa2c4'; ctx.setLineDash([4,4]); ctx.beginPath();
  ctx.moveTo(ex,ey); ctx.lineTo(ex,cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(ex,ey,3.5,0,6.2832); ctx.fill();
  ctx.fillStyle='#e8eefc'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('Re s(t) = '+fmt(ch.end[0],4), ex+6, ey-6);
  if(eLen>20) ctx.fillText('s(t)', (cx+ex)/2+6, (cy+ey)/2-6);   /* 端点贴近原点时这行会和上一行叠在一起，就不画了 */
  /* 比例尺：把量程的一段按实长画出来并标数值，任何 t 下都能读绝对值 */
  var barV=niceScaleNum(66/sc), barL=barV*sc;
  if(barL>r.w*0.34){ barV=niceScaleNum(barL/2/sc); barL=barV*sc; }
  var bx=r.x+14, by=r.y+r.h-16;
  ctx.strokeStyle='#8fa2c4'; ctx.fillStyle='#8fa2c4'; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(bx,by); ctx.lineTo(bx+barL,by);
  ctx.moveTo(bx,by-4); ctx.lineTo(bx,by+4);
  ctx.moveTo(bx+barL,by-4); ctx.lineTo(bx+barL,by+4);
  ctx.stroke();
  var barTxt=(barV>=1)?fmtG(barV):(barV>=0.01?barV.toFixed(3):barV.toExponential(2));  /* fmtG 对 <0.1 会退化成 0.0，这里补足有效数字 */
  ctx.fillText('|s| = '+barTxt+' (scale)', bx+barL+7, by+4);
  if(st.ckLens && ch.M>=13) drawLens(ch);
  ctx.restore();
  lastChain={pts:ch.pts,M:ch.M,cx:cx,cy:cy,sc:sc,endPx:eLen,stub:eStub,buckets:chainB};
  return ch;
}

/* 右上：三维 s 平面。水平面 = s 平面（σ=Re s 轴、ω=Im s 轴），
   柱高 = 权重 |X(σ+jnΔω)|·Δω/2π，颜色 = 相位 arg X(σ+jnΔω)（与傅里叶页的 3D 栅栏同款）。 */

var lastV3=null, lastBars=null;
var rotDrag=false, rotLast=null, rotMoved=false;

function phaseFrac(n){
  var i=n+COMP.N;
  var m=Math.hypot(COMP.re[i],COMP.im[i]);
  if(m<1e-12) return 0.5;
  return (Math.atan2(COMP.im[i],COMP.re[i])+Math.PI)/(2*Math.PI);
}
function phaseBucket(n){ var b=Math.floor(24*phaseFrac(n)); if(b<0)b=0; if(b>23)b=23; return b; }

function proj3(w,sg,h){
  var V=lastV3; if(!V) return null;
  var cY=Math.cos(V.yaw), sY=Math.sin(V.yaw), sp=Math.sin(V.pitch), cp=Math.cos(V.pitch);
  var ux=(sg-V.sc)/V.sh, vy=w/V.imr, wz=h/V.ymax;
  var x1=ux*cY-vy*sY, y1=ux*sY+vy*cY;
  return [V.cx+V.Ax*x1, V.cy+V.Ay*y1*sp-V.Az*wz*cp];
}

function barDist(px,py,x1,y1,x2,y2){
  var dx=x2-x1, dy=y2-y1, LL=dx*dx+dy*dy;
  var tx=LL>1e-9?((px-x1)*dx+(py-y1)*dy)/LL:0;
  if(tx<0)tx=0; if(tx>1)tx=1;
  return Math.hypot(x1+tx*dx-px, y1+tx*dy-py);
}

function pickBar(px,py){
  var B=lastBars; if(!B) return null;
  var best=null, bd=9;
  for(var i=0;i<B.length;i+=4){
    if(B[i]!==B[i]) continue;
    var d=barDist(px,py,B[i],B[i+1],B[i+2],B[i+3]);
    if(d<bd){ bd=d; best=i/4-COMP.N; }
  }
  return best;
}

function drawSplane3d(){
  var r=R.spec;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  var pr=P(), srr=pr.srange(st.p), slo=srr[0], shi=srr[1], imr=pr.imr(st.p);
  var N=COMP.N, dw=COMP.dw, k=dw/(2*Math.PI), raw=st.ckRaw;
  function barMag(n){
    if(raw){
      if(isCus()&&CUS.rawMag) return CUS.rawMag[n+N];
      var Xr=pr.X2(st.sig,n*dw,st.p); return Math.hypot(Xr[0],Xr[1]);
    }
    return Math.hypot(COMP.re[n+N],COMP.im[n+N]);
  }
  function envMag(w){
    if(isCus()&&CUS.env){                          /* 自定义信号：灰幕布来自 cusWeights() 缓存好的 201 点 */
      var ie=Math.round((w+imr)/(2*imr)*200); if(ie<0)ie=0; if(ie>200)ie=200;
      return CUS.env[ie]*(raw?1:k);
    }
    var Xe=pr.X2(st.sig,w,st.p); return Math.hypot(Xe[0],Xe[1])*(raw?1:k);
  }
  var ymax=1e-9, n, i;
  for(n=-N;n<=N;n++){ if(Math.abs(n*dw)<=imr){ var m=barMag(n); if(m>ymax)ymax=m; } }
  if(st.ckEnv){ for(i=0;i<=200;i++){ var ev=envMag(-imr+2*imr*i/200); if(ev>ymax)ymax=ev; } }
  ymax*=1.15;
  var Ax=Math.min(r.w*0.33,r.h*0.62), Ay=Ax*0.55, Az=r.h*0.40;
  lastV3={imr:imr,sc:(slo+shi)/2,sh:(shi-slo)/2,ymax:ymax,Ax:Ax,Ay:Ay,Az:Az,
          cx:r.x+r.w/2,cy:r.y+r.h*0.72,yaw:st.yaw,pitch:st.pitch};
  var pj=proj3;
  var f1=pj(-imr,slo,0), f2=pj(-imr,shi,0), f3=pj(imr,shi,0), f4=pj(imr,slo,0);
  ctx.strokeStyle='#22314d'; ctx.beginPath();
  ctx.moveTo(f1[0],f1[1]); ctx.lineTo(f2[0],f2[1]); ctx.lineTo(f3[0],f3[1]); ctx.lineTo(f4[0],f4[1]);
  ctx.closePath(); ctx.stroke();
  var rl=pr.rocLo(st.p), rh=pr.rocHi(st.p);
  var b0=Math.max(slo,rl===-INF?slo:rl), b1=Math.min(shi,rh===INF?shi:rh);
  if(b1>b0){
    var q1=pj(-imr,b0,0), q2=pj(imr,b0,0), q3=pj(imr,b1,0), q4=pj(-imr,b1,0);
    ctx.fillStyle='rgba(120,220,150,0.10)'; ctx.beginPath();
    ctx.moveTo(q1[0],q1[1]); ctx.lineTo(q2[0],q2[1]); ctx.lineTo(q3[0],q3[1]); ctx.lineTo(q4[0],q4[1]);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(120,220,150,0.45)'; ctx.setLineDash([4,4]); ctx.beginPath();
    if(rl!==-INF){ ctx.moveTo(q1[0],q1[1]); ctx.lineTo(q2[0],q2[1]); }
    if(rh!==INF){ ctx.moveTo(q4[0],q4[1]); ctx.lineTo(q3[0],q3[1]); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  var a1=pj(-imr,0,0), a2=pj(imr,0,0), e1=pj(0,slo,0), e2=pj(0,shi,0);
  ctx.strokeStyle='#2a3b5c'; ctx.beginPath();
  ctx.moveTo(a1[0],a1[1]); ctx.lineTo(a2[0],a2[1]);
  ctx.moveTo(e1[0],e1[1]); ctx.lineTo(e2[0],e2[1]);
  ctx.stroke();
  var h1=pj(-imr,slo,0), h2=pj(-imr,slo,ymax);
  ctx.beginPath(); ctx.moveTo(h1[0],h1[1]); ctx.lineTo(h2[0],h2[1]); ctx.stroke();
  var c1=pj(-imr,st.sig,0), c2=pj(imr,st.sig,0);
  ctx.strokeStyle='#7fd1ff'; ctx.lineWidth=2; ctx.beginPath();
  ctx.moveTo(c1[0],c1[1]); ctx.lineTo(c2[0],c2[1]); ctx.stroke(); ctx.lineWidth=1;
  if(st.ckEnv){
    var M=200, gp=[], tp=[];
    for(i=0;i<=M;i++){ var w2=-imr+2*imr*i/M; gp.push(pj(w2,st.sig,0)); tp.push(pj(w2,st.sig,envMag(w2))); }
    ctx.fillStyle='rgba(154,168,192,0.10)'; ctx.beginPath();
    ctx.moveTo(gp[0][0],gp[0][1]);
    for(i=1;i<=M;i++) ctx.lineTo(gp[i][0],gp[i][1]);
    for(i=M;i>=0;i--) ctx.lineTo(tp[i][0],tp[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#9aa8c0'; ctx.beginPath();
    ctx.moveTo(tp[0][0],tp[0][1]);
    for(i=1;i<=M;i++) ctx.lineTo(tp[i][0],tp[i][1]);
    ctx.stroke();
  }
  var B=24, M2=2*N+1, paths=[], muted=[];
  for(i=0;i<B;i++) paths.push(null);
  if(!lastBars||lastBars.length!==4*M2) lastBars=new Float64Array(4*M2);
  for(i=0;i<4*M2;i++) lastBars[i]=NaN;
  for(n=-N;n<=N;n++){
    var w3=n*dw; if(Math.abs(w3)>imr) continue;
    var p0=pj(w3,st.sig,0), p1=pj(w3,st.sig,barMag(n)), bi=4*(n+N);
    lastBars[bi]=p0[0]; lastBars[bi+1]=p0[1]; lastBars[bi+2]=p1[0]; lastBars[bi+3]=p1[1];
    if(!st.mask[n+N]){ muted.push(p0[0],p0[1],p1[0],p1[1]); continue; }
    var bb=phaseBucket(n);
    if(!paths[bb]) paths[bb]=[];
    paths[bb].push(p0[0],p0[1],p1[0],p1[1]);
  }
  for(i=0;i<B;i++){
    if(!paths[i]) continue;
    ctx.strokeStyle=colFor(i/23); ctx.beginPath();
    var arr=paths[i];
    for(var j=0;j<arr.length;j+=4){ ctx.moveTo(arr[j],arr[j+1]); ctx.lineTo(arr[j+2],arr[j+3]); }
    ctx.stroke();
  }
  if(muted.length){
    ctx.save(); ctx.globalAlpha=0.18; ctx.strokeStyle='#9aa8c0'; ctx.beginPath();
    for(j=0;j<muted.length;j+=4){ ctx.moveTo(muted[j],muted[j+1]); ctx.lineTo(muted[j+2],muted[j+3]); }
    ctx.stroke(); ctx.restore();
  }
  if(st.hoverN!==null&&st.hoverN>=-N&&st.hoverN<=N&&Math.abs(st.hoverN*dw)<=imr){
    var g0=pj(st.hoverN*dw,st.sig,0), g1=pj(st.hoverN*dw,st.sig,barMag(st.hoverN));
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.beginPath();
    ctx.moveTo(g0[0],g0[1]); ctx.lineTo(g1[0],g1[1]); ctx.stroke(); ctx.lineWidth=1;
  }
  var pl=pr.poles(st.p), zl=pr.zeros(st.p);
  ctx.strokeStyle='rgba(255,123,213,0.45)'; ctx.beginPath();
  for(i=0;i<pl.length;i++){
    var k1=pj(pl[i][1],pl[i][0],0), k2=pj(pl[i][1],pl[i][0],ymax*0.12);
    ctx.moveTo(k1[0],k1[1]); ctx.lineTo(k2[0],k2[1]);
  }
  ctx.stroke();
  ctx.strokeStyle='#ff7bd5'; ctx.lineWidth=2;
  for(i=0;i<pl.length;i++){
    var pp=pj(pl[i][1],pl[i][0],ymax*0.12);
    ctx.beginPath(); ctx.moveTo(pp[0]-5,pp[1]-5); ctx.lineTo(pp[0]+5,pp[1]+5);
    ctx.moveTo(pp[0]-5,pp[1]+5); ctx.lineTo(pp[0]+5,pp[1]-5); ctx.stroke();
  }
  ctx.lineWidth=1.5; ctx.strokeStyle='#ffffff';
  for(i=0;i<zl.length;i++){
    var zp=pj(zl[i][1],zl[i][0],ymax*0.12);
    ctx.beginPath(); ctx.arc(zp[0],zp[1],3.5,0,6.2832); ctx.stroke();
  }
  ctx.lineWidth=1;
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('3D s-plane fence: bar height = weight |X(σ+jnΔω)|·Δω/2π, color = phase arg X', r.x+8, r.y+14);
  var l2=isCus()
    ? 'floor = s-plane: σ = Re s, ω = Im s; green band = ROC (numeric estimate for custom f), cyan line = integration path Re s = σ (poles/zeros need closed forms, not drawn for custom f)'
    : 'floor = s-plane: σ = Re s, ω = Im s; green band = ROC, × poles, ○ zeros, cyan line = integration path Re s = σ';
  ctx.fillText(l2, r.x+8, r.y+28);
  ctx.fillText('drag to rotate; hover a bar → bold its chain segment, click a bar → mute it, double-click → unmute all', r.x+8, r.y+42);
  ctx.fillText('ω', a2[0]+6, a2[1]+4);
  ctx.fillText('σ', e2[0]+6, e2[1]+4);
  ctx.fillText('|W|', h2[0]-6, h2[1]-8);
  ctx.fillStyle='#7fd1ff'; ctx.fillText('σ='+fmt(st.sig,2), c1[0]+6, c1[1]-6);
  ctx.restore();
}

function drawTime(){
  var r=R.time;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.beginPath(); ctx.rect(r.x+1,r.y+1,r.w-2,r.h-2); ctx.clip();
  var Xw=CURVE.Xw, Tw=twNow(), Tr=trNow();
  /* 纵轴只按观测窗 ±Tw 定标：窗外的 Re s(t) 由 Ω 截断误差主导，σ≠0 时被 e^{σt} 放大到 1e4 量级，
     纳入定标会把窗内（f(t) 真正成立处）整体压成一条直线。 */
  var ymax=1e-9, i;
  for(i=0;i<CURVE.NT;i++){ var tv=CURVE.ts[i]; if(tv<-Tw||tv>Tw) continue; var av=Math.abs(CURVE.re[i]); if(av>ymax) ymax=av; }
  if(st.ckIdeal){ for(i=0;i<400;i++){ var u=-Tw+2*Tw*i/399; var xv=Math.abs(xOf(u)); if(xv>ymax) ymax=xv; } }
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
  var x0=X(0), vstep=niceScaleNum(ymax/3.4);
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('Time domain: solid = in-window Riemann-sum Re s(t) (period Tr, replica weights e^{−σkTr}); faint parts outside = Ω-truncation error amplified by e^{σt} (y-axis scaled inside the window); gray dashed = ideal f(t); drag to scrub t', r.x+8, r.y+14);
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
  function strokeCurve(){
    ctx.beginPath();
    for(var j=0;j<CURVE.NT;j++){ var yj=Y(CURVE.re[j]); if(j===0)ctx.moveTo(X(CURVE.ts[j]),yj); else ctx.lineTo(X(CURVE.ts[j]),yj); }
    ctx.stroke();
  }
  var xa=X(-Tw), xb=X(Tw);
  ctx.strokeStyle='#7fd1ff'; ctx.lineWidth=2;
  /* 窗外段淡画：纵轴已按窗内定标，窗外那截截断误差画出界，不淡画会糊成一条色带 */
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x,r.y,xa-r.x,r.h); ctx.rect(xb,r.y,r.x+r.w-xb,r.h); ctx.clip();
  ctx.globalAlpha=0.18; strokeCurve(); ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(xa,r.y,xb-xa,r.h); ctx.clip();
  strokeCurve(); ctx.restore();
  ctx.lineWidth=1;
  /* 纵坐标轴画在时间原点 t=0 上（同时就是"幅值轴"）：刻度取 1/2/5×10ⁿ 的整数倍，标出绝对值。
     刻度数字放在轴左侧（t<0 那半边，因果信号那里基本是空的）。**必须画在曲线之后**：
     因果信号在 t=0 处是跳变，灰虚线/青实线会在这一列画出一条近乎垂直的线，先画就被盖住了。 */
  ctx.strokeStyle='#3d5680'; ctx.beginPath();
  ctx.moveTo(x0+0.5,r.y+18); ctx.lineTo(x0+0.5,r.y+r.h-8); ctx.stroke();
  for(var k6=-6;k6<=6;k6++){
    if(k6===0) continue;
    var vv6=k6*vstep; if(Math.abs(vv6)>ymax*1.02) continue;
    var yy6=Y(vv6);
    ctx.beginPath(); ctx.moveTo(x0-5.5,yy6+0.5); ctx.lineTo(x0+0.5,yy6+0.5); ctx.stroke();
    ctx.textAlign='right'; ctx.fillText(fmtG(vv6), x0-7, yy6+3.5); ctx.textAlign='left';
  }
  ctx.textAlign='right'; ctx.fillText('0', x0-7, Y(0)+3.5); ctx.textAlign='left';
  ctx.fillText('amplitude Re s(t)', x0-70, r.y+30);
  ctx.fillStyle='#7fb3e8';
  ctx.fillText('t = 0 (time origin)', x0+6, r.y+30);
  ctx.fillStyle='#8fa2c4';
  if(st.ckBrk){
    var yb=r.y+r.h-34;
    ctx.strokeStyle='#ff5d5d'; ctx.beginPath();
    ctx.moveTo(X(-Tw),yb); ctx.lineTo(X(Tw),yb);
    ctx.moveTo(X(-Tw),yb-5); ctx.lineTo(X(-Tw),yb+5);
    ctx.moveTo(X(Tw),yb-5); ctx.lineTo(X(Tw),yb+5);
    ctx.stroke();
    ctx.fillStyle='#ff5d5d'; ctx.fillText('window ±Tw='+fmt(Tw,2), X(0)-40, yb-6);
    if(Tr/2<=Xw){
      var yp=r.y+r.h-18;
      ctx.strokeStyle='#ffd479'; ctx.beginPath();
      ctx.moveTo(X(-Tr/2),yp); ctx.lineTo(X(Tr/2),yp);
      ctx.moveTo(X(-Tr/2),yp-5); ctx.lineTo(X(-Tr/2),yp+5);
      ctx.moveTo(X(Tr/2),yp-5); ctx.lineTo(X(Tr/2),yp+5);
      ctx.stroke();
      ctx.fillStyle='#ffd479'; ctx.fillText('Riemann period Tr='+fmt(Tr,2), X(0)-44, yp-6);
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
  drawSplane3d();
  drawTime();
  drawCaption();
  return ch;
}

/* ---------- controls ---------- */

function el(id){ return document.getElementById(id); }
var ePreset=el('preset'), eShape=el('shape'), eShapeLab=el('shapeLab'), eShapeVal=el('shapeval');
var eSig=el('sig'), eSigVal=el('sigval');
var eLogDw=el('logdw'), eDwVal=el('dwval'), eOmx=el('omx'), eOmxVal=el('omxval');
var eWinMul=el('winmul'), eWinMulVal=el('winmulval'), eWinAuto=el('winauto');
var eFex=el('fexpr'), eFexErr=el('fexerr'), eFexRow=el('frow'), eW0=el('w0'), eW0Val=el('w0val'), eW0Row=el('w0row');
var ePlay=el('play'), eStep=el('step'), eSpeed=el('speed'), eSpeedVal=el('speedval');
var eTsl=el('tsl'), eTval=el('tval');
var eIdeal=el('ckIdeal'), eEnv=el('ckEnv'), eRaw=el('ckRaw'), eLens=el('ckLens'), eBrk=el('ckBrk'), eFreeze=el('ckFreeze');
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
function syncOmx(){ eOmxVal.textContent=st.omxUnits+' lobes'; }
function syncWin(){
  eWinMul.value=st.winMul;
  eWinMulVal.textContent=(+st.winMul).toFixed(2)+'×';
}
function syncChecks(){ eFreeze.checked=st.freezeScale; }
function syncSpeed(){ eSpeed.value=st.speed; eSpeedVal.textContent=(+st.speed).toFixed(1)+'×'; }
function syncTsl(){
  var Xw=xwNow();
  eTsl.min=-Xw; eTsl.max=Xw; eTsl.step=(2*Xw)/1000;
  if(st.t<-Xw)st.t=-Xw; if(st.t>Xw)st.t=Xw;
  eTsl.value=st.t;
}
function syncW0(){ eW0.min=0.5; eW0.max=8; eW0.step=0.05; eW0.value=st.w0; eW0Val.textContent=(+st.w0).toFixed(2); }
function syncCustomUI(){
  var c=isCus();
  eFexRow.style.display=c?'flex':'none';
  eW0Row.style.display=c?'flex':'none';
  if(c){ eFex.value=CUS.src; syncW0(); }
  fexShow();
}
/* 输入框里的文本改了就重新解析（走 dirty → cusBuild）。空输入忽略，保留原表达式 */
function fexApply(){
  var v=eFex.value.trim();
  if(!v||v===CUS.src){ fexShow(); return; }
  CUS.src=v; CUS.sigA=''; CUS.sigB=''; CUS.sigC='';
  CUS.err=''; CUS.hint='';
  dirty=true;
  fexShow();
}
var fexLast='';
function fexShow(){
  if(!eFexErr) return;
  var msg=CUS.err||[CUS.hint,CUS.warn].filter(Boolean).join('; ');
  if(msg===fexLast) return;
  fexLast=msg;
  eFexErr.textContent=msg? (CUS.err?'✗ ':'· ')+msg : '';
  eFexErr.className=CUS.err?'note bad':'note';
  eFexErr.style.display=msg?'block':'none';
}

function readouts(ch){
  var N=COMP.N, dw=st.dw, n;
  rDw.textContent=fmt(dw,5)+' rad/s'+(st.Ncapped?' (N capped at 2048)':'');
  rN.textContent=''+(2*N+1);
  var mmax=0;
  for(n=-N;n<=N;n++){ var m=Math.hypot(COMP.re[n+N],COMP.im[n+N]); if(m>mmax)mmax=m; }
  rMag.textContent=mmax.toExponential(2);
  rSig.textContent=fmt(st.sig,2)+', ROC '+rocTxt()+(isCus()?' (numeric estimate)':'');
  var esig=Math.exp(st.sig*st.t);
  rEsig.textContent=(esig>=1e5||esig<1e-4)?esig.toExponential(2):fmt(esig,3);
  rTr.textContent=fmt(trNow(),2)+' s';
  rTw.textContent='±'+fmt(twNow(),2)+' s (axis ±'+fmt(CURVE.Xw,2)+')';
  var Tw=twNow(), e=0;
  for(var i=0;i<CURVE.NT;i++){
    var t=CURVE.ts[i]; if(Math.abs(t)>Tw) continue;
    var d=Math.abs(CURVE.re[i]-xOf(t)); if(d>e)e=d;
  }
  rErr.textContent=fmt(e,5);
  rT.textContent=fmt(st.t,3);
  rEnd.textContent=fmt(ch.end[0],4)+(ch.end[1]<0?' − j':' + j')+fmt(Math.abs(ch.end[1]),4);
  var rg=regime();
  var stage=['Stage 1/4: Δω too large, replicas overlap and alias','Stage 2/4: replicas separated but period Tr still visible','Stage 3/4: sum ≈ Bromwich integral','Stage 2.5/4: replicas out of window but Δω still too big'][rg.k];
  var cw=isCus()?[CUS.hint,CUS.warn].filter(Boolean).join('; '):'';
  rNote.textContent=stage+(cw?' · '+cw:'');
  if(isCus()) fexShow();
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
    syncShape(); syncSig(); syncCustomUI(); syncTsl(); dirty=true;
  });
  eShape.addEventListener('input',function(e){ st.p=parseFloat(e.target.value); eShapeVal.textContent=(+st.p).toFixed(2); syncSig(); syncTsl(); dirty=true; });
  eW0.addEventListener('input',function(e){ st.w0=parseFloat(e.target.value); eW0Val.textContent=(+st.w0).toFixed(2); dirty=true; });
  eFex.addEventListener('change',fexApply);
  eFex.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); fexApply(); } });
  var fexTimer=0;
  eFex.addEventListener('input',function(){ if(fexTimer) clearTimeout(fexTimer); fexTimer=setTimeout(fexApply,600); });
  eSig.addEventListener('input',function(e){ st.sig=parseFloat(e.target.value); eSigVal.textContent=(+st.sig).toFixed(2); dirty=true; });
  eLogDw.addEventListener('input',function(e){ var u=(+e.target.value)/1000; st.dw=0.02*Math.pow(100,u); syncDw(); syncTsl(); dirty=true; });
  eOmx.addEventListener('input',function(e){ st.omxUnits=+e.target.value; syncOmx(); dirty=true; });
  eWinMul.addEventListener('input',function(e){ st.winMul=parseFloat(e.target.value); syncWin(); syncTsl(); dirty=true; });
  eWinAuto.addEventListener('click',function(){ st.winMul=1; syncWin(); syncTsl(); dirty=true; });
  ePlay.addEventListener('click',function(){ st.playing=!st.playing; ePlay.textContent=st.playing?'⏸ Pause':'▶ Play'; });
  eStep.addEventListener('click',function(){
    st.playing=false; ePlay.textContent='▶ Play';
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
  eFreeze.addEventListener('change',function(e){ st.freezeScale=e.target.checked; dirty=true; });
  attachPointer(cv,{
  move:function(e){
    var p=canvasPos(e);
    if(inRect(p,R.spec)){
      if(rotDrag&&rotLast){
        var dx=p[0]-rotLast[0], dy=p[1]-rotLast[1];
        if(!rotMoved&&Math.abs(dx)+Math.abs(dy)<3) return;
        rotMoved=true;
        st.yaw=clamp(st.yaw+dx*0.008,-1.55,1.55);
        st.pitch=clamp(st.pitch+dy*0.008,0.06,1.45);
        rotLast=p;
        return;
      }
      st.hoverN=pickBar(p[0],p[1]);
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
    if(inRect(p,R.spec)){
      rotDrag=true; rotMoved=false; rotLast=p; e.preventDefault(); return;
    }
    if(inRect(p,R.time)){
      scrubbing=true; st.playing=false; ePlay.textContent='▶ Play';
      setTFromX(p[0]); e.preventDefault();
    }
  },
  up:function(){ scrubbing=false; rotDrag=false; rotLast=null; }
  });
  cv.addEventListener('mouseleave',function(){ st.hoverN=null; lensFocus=null; rotDrag=false; rotLast=null; });
  cv.addEventListener('keydown',function(e){
    if(e.shiftKey&&/^Arrow(Left|Right|Up|Down)$/.test(e.key)){
      st.yaw=clamp(st.yaw+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*0.08,-1.55,1.55);
      st.pitch=clamp(st.pitch+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)*0.08,0.06,1.45);
      e.preventDefault(); return;
    }
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      st.playing=false; ePlay.textContent='▶ Play';
      st.t=clamp(st.t+(e.key==='ArrowRight'?1:-1)*twNow()/64,-xwNow(),xwNow());
      eTsl.value=st.t; e.preventDefault();
    } else if(e.key===' '||e.key==='Spacebar'){
      ePlay.click(); e.preventDefault();
    }
  });
  cv.addEventListener('click',function(e){
    var p=canvasPos(e);
    if(inRect(p,R.spec)&&!rotMoved){
      var n=pickBar(p[0],p[1]);
      if(n!==null){ var i=n+COMP.N; st.mask[i]=st.mask[i]?0:1; dirty=true; }
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
  st.winMul=1; st.yaw=0.55; st.pitch=0.34;
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  st.playing=!rm;
  syncShape(); syncSig(); syncDw(); syncOmx(); syncWin(); syncSpeed(); syncTsl(); syncCustomUI(); syncChecks();
  ePlay.textContent=st.playing?'⏸ Pause':'▶ Play';
  bind();
  computeComp(); computeCurve(); dirty=false;
  readouts(draw());
  kick();
}

function apply(o){
  if(o.preset!==undefined){ st.preset=o.preset; }
  if(o.p!==undefined){ st.p=o.p; }
  if(o.w0!==undefined){ st.w0=o.w0; }
  if(o.fstr!==undefined){ CUS.src=o.fstr; CUS.sigA=''; CUS.sigB=''; CUS.sigC=''; CUS.err=''; }
  if(o.sig!==undefined){ st.sig=o.sig; }
  if(o.dw!==undefined){ st.dw=o.dw; }
  if(o.omxUnits!==undefined){ st.omxUnits=o.omxUnits; }
  if(o.winMul!==undefined){ st.winMul=o.winMul; }
  if(o.freezeScale!==undefined){ st.freezeScale=o.freezeScale; }
  if(o.t!==undefined){ st.t=o.t; }
  if(o.yaw!==undefined){ st.yaw=o.yaw; }
  if(o.pitch!==undefined){ st.pitch=o.pitch; }
  syncShape(); syncSig(); syncOmx(); syncWin(); syncTsl(); syncCustomUI(); syncChecks();
  computeComp(); computeCurve(); dirty=false;
}

init();

globalThis.__LIT={
  PRESETS:PRESETS, st:st, cus:function(){return CUS;},
  comp:function(){return COMP;}, curve:function(){return CURVE;},
  computeComp:computeComp, computeCurve:computeCurve,
  chainAt:chainAt, sExact:sExact, gExact:gExact, xOf:xOf, Xof:Xof,
  refIntegral:refIntegral, numX:numX, cusQuad:cusQuad, cusWeights:cusWeights,
  twNow:twNow, trNow:trNow, chainExtent:chainExtent, mxRef:function(){return mainMx;},
  drawSc:function(){return lastChain?lastChain.sc:0;},
  chainBuckets:function(){return lastChain?lastChain.buckets:null;},
  arrowInfo:function(){return lastChain?{px:lastChain.endPx,stub:lastChain.stub}:null;},
  xwNow:xwNow, apply:apply, regime:regime, draw:draw,
  phaseFrac:phaseFrac, phaseBucket:phaseBucket, proj3:proj3, pickBar:pickBar,
  view3:function(){return lastV3;}, rects:function(){return R;}
};

globalThis.__VIZ={st:st,draw:draw,apply:apply};
})();
