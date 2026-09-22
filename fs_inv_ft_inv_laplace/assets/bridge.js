(function(){
'use strict';

var PRESETS = {
  rect: {
    name:'Rect pulse', plab:'τ', pmin:0.5, pmax:4, pstep:0.05, pdef:2,
    sup:function(p){return p/2;}, lobe:function(p){return 2*Math.PI/p;}, tail:function(p){return p/2;},
    area:function(p){return p;},
    x:function(u,p){return Math.abs(u)<p/2?1:0;},
    x1:function(u,p){return 0;},
    X:function(w,p){ if(Math.abs(w)<1e-12) return [p,0]; var s=2*Math.sin(w*p/2)/w; return [s,0]; },
    breaks:function(p){return [-p/2,p/2];}
  },
  tri: {
    name:'Tri pulse', plab:'τ', pmin:0.5, pmax:4, pstep:0.05, pdef:2,
    sup:function(p){return p;}, lobe:function(p){return 2*Math.PI/p;}, tail:function(p){return p;},
    area:function(p){return p;},
    x:function(u,p){var a=Math.abs(u); return a<p?1-a/p:0;},
    x1:function(u,p){var a=Math.abs(u); return (a<p&&a>0)?-(u>0?1:-1)/p:0;},
    X:function(w,p){ if(Math.abs(w)<1e-12) return [p,0]; var s=Math.sin(w*p/2)/(w*p/2); return [p*s*s,0]; },
    breaks:function(p){return [-p,0,p];}
  },
  gauss: {
    name:'Gauss pulse', plab:'s', pmin:0.3, pmax:2, pstep:0.05, pdef:1,
    sup:function(p){return 3*p;}, lobe:function(p){return 1/p;}, tail:function(p){return 6*p;},
    area:function(p){return p*Math.sqrt(2*Math.PI);},
    x:function(u,p){return Math.exp(-u*u/(2*p*p));},
    x1:function(u,p){return -u/(p*p)*Math.exp(-u*u/(2*p*p));},
    X:function(w,p){return [p*Math.sqrt(2*Math.PI)*Math.exp(-p*p*w*w/2),0];},
    breaks:function(p){return [];}
  },
  dexp: {
    name:'Two-sided exp', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1,
    sup:function(p){return 4/p;}, lobe:function(p){return p;}, tail:function(p){return 16/p;},
    area:function(p){return 2/p;},
    x:function(u,p){return Math.exp(-p*Math.abs(u));},
    x1:function(u,p){return u===0?0:-p*(u>0?1:-1)*Math.exp(-p*Math.abs(u));},
    X:function(w,p){return [2*p/(p*p+w*w),0];},
    breaks:function(p){return [0];}
  },
  sexp: {
    name:'One-sided exp', plab:'a', pmin:0.5, pmax:4, pstep:0.05, pdef:1,
    sup:function(p){return 4/p;}, lobe:function(p){return p;}, tail:function(p){return 40/p;},
    area:function(p){return 1/p;},
    x:function(u,p){return u>=0?Math.exp(-p*u):0;},
    x1:function(u,p){return u>0?-p*Math.exp(-p*u):0;},
    X:function(w,p){var d=p*p+w*w; return [p/d,-w/d];},
    breaks:function(p){return [0];}
  }
};

var st = {
  preset:'rect', p:2, T:10, omxUnits:8, t:0, playing:true,
  ckEnv:true, ckRaw:false, ckBrk:true, ckIdeal:true,
  autoT:null, Ncapped:false
};

var FN = null;   // {N,w0,re,im,T}
var TS = null;   // {ts,v,W,NT}

function P(){ return PRESETS[st.preset]; }
function xOf(u){ return P().x(u, st.p); }
function Xof(w){ return P().X(w, st.p); }
function supNow(){ return P().sup(st.p); }
function Tmin(){ return 1.2*supNow(); }
function Tmax(){ return 100*supNow(); }

function xT(t){
  var pr=P(), T=st.T;
  var K=Math.ceil((pr.tail(st.p)+T/2)/T);
  var s=0;
  for(var k=-K;k<=K;k++){ s+=pr.x(t-k*T, st.p); }
  return s;
}

function xT1(t){
  var pr=P(), T=st.T;
  var K=Math.ceil((pr.tail(st.p)+T/2)/T);
  var s=0;
  for(var k=-K;k<=K;k++){ s+=pr.x1(t-k*T, st.p); }
  return s;
}

function computeFn(){
  var pr=P(), T=st.T, w0=2*Math.PI/T, half=T/2;
  var omx=st.omxUnits*pr.lobe(st.p);
  var N=Math.floor(omx/w0); if(N>1500){N=1500; st.Ncapped=true;} else st.Ncapped=false;
  if(N<1) N=1;
  var K=Math.ceil((pr.tail(st.p)+half)/T);
  var bs=[-half,half];
  var brk=pr.breaks(st.p);
  for(var bi=0;bi<brk.length;bi++){
    for(var k=-K;k<=K;k++){
      var q=brk[bi]+k*T;
      if(q>-half+1e-12 && q<half-1e-12) bs.push(q);
    }
  }
  bs.sort(function(a,b){return a-b;});
  var EPS=1e-9;
  var pieces=[];
  for(var i=0;i+1<bs.length;i++){
    var a=bs[i], b=bs[i+1];
    if(b-a<1e-12) continue;
    var mid=(a+b)/2;
    var e0=Math.abs(xT(a+EPS)), e1=Math.abs(xT(mid)), e2=Math.abs(xT(b-EPS));
    if(Math.max(e0,e1,e2)<1e-12) continue;
    pieces.push({a:a,b:b,len:b-a,Va:xT(a+EPS),A:xT1(a+EPS),Vb:xT(b-EPS),B:xT1(b-EPS)});
  }
  var Ltot=0; for(i=0;i<pieces.length;i++) Ltot+=pieces[i].len;
  if(Ltot<=0){ FN={N:N,w0:w0,re:new Float64Array(N+1),im:new Float64Array(N+1),T:T}; return; }
  var cmax=N*w0, Mtot=0;
  for(i=0;i<pieces.length;i++){
    var pc=pieces[i];
    pc.M=Math.max(16, Math.min(16384, Math.ceil(pc.len*cmax/0.06)));
    Mtot+=pc.M;
  }
  if(Mtot>131072){ var shrink=131072/Mtot; Mtot=0;
    for(i=0;i<pieces.length;i++){ pieces[i].M=Math.max(16, Math.floor(pieces[i].M*shrink)); Mtot+=pieces[i].M; } }
  for(i=0;i<pieces.length;i++){
    pc=pieces[i];
    pc.h=pc.len/pc.M;
    pc.xv=new Float64Array(pc.M);
    for(var m=0;m<pc.M;m++) pc.xv[m]=xT(pc.a+pc.h*(m+0.5));
  }
  var re=new Float64Array(N+1), im=new Float64Array(N+1);
  for(var n=0;n<=N;n++){
    var c=n*w0;
    for(var pi2=0;pi2<pieces.length;pi2++){
      var q2=pieces[pi2];
      var sr=0, si=0;
      var w=-c*q2.h;
      var wr=Math.cos(w), wi=Math.sin(w);
      var p0=-c*(q2.a+q2.h/2);
      var prr=Math.cos(p0), pii=Math.sin(p0);
      var xv=q2.xv, M=q2.M;
      for(m=0;m<M;m++){
        var v=xv[m];
        sr+=v*prr; si+=v*pii;
        var nr=prr*wr-pii*wi; pii=prr*wi+pii*wr; prr=nr;
      }
      var ka=(q2.h*q2.h/24);
      var ta=-c*q2.a, tb=-c*q2.b;
      var car=Math.cos(ta), sai=Math.sin(ta), cbr=Math.cos(tb), sbi=Math.sin(tb);
      var gar=q2.A*car+c*q2.Va*sai, gai=q2.A*sai-c*q2.Va*car;
      var gbr=q2.B*cbr+c*q2.Vb*sbi, gbi=q2.B*sbi-c*q2.Vb*cbr;
      var kk=1/T;
      re[n]+=(sr*q2.h+ka*(gbr-gar))*kk; im[n]+=(si*q2.h+ka*(gbi-gai))*kk;
    }
  }
  FN={N:N,w0:w0,re:re,im:im,T:T};
}

function computeTime(){
  var W=4*supNow(), NT=700;
  var ts=new Float64Array(NT), v=new Float64Array(NT);
  var N=FN.N, w0=FN.w0, re=FN.re, im=FN.im;
  for(var i=0;i<NT;i++){
    var t=-W+2*W*i/(NT-1);
    var s=re[0];
    var cr=Math.cos(w0*t), ci=Math.sin(w0*t);
    var pr=cr, pi=ci;
    for(var n=1;n<=N;n++){
      s+=2*(re[n]*pr-im[n]*pi);
      var nr=pr*cr-pi*ci; pi=pr*ci+pi*cr; pr=nr;
    }
    ts[i]=t; v[i]=s;
  }
  TS={ts:ts,v:v,W:W,NT:NT};
}

function sTexact(t){
  var N=FN.N, w0=FN.w0, re=FN.re, im=FN.im;
  var s=re[0];
  for(var n=1;n<=N;n++){
    var c=Math.cos(n*w0*t), si=Math.sin(n*w0*t);
    s+=2*(re[n]*c-im[n]*si);
  }
  return s;
}

function chainAt(t){
  var N=FN.N, w0=FN.w0, re=FN.re, im=FN.im;
  var M=2*N+1;
  var pts=new Float64Array(2*M);
  var pr=Math.cos(-N*w0*t), pi=Math.sin(-N*w0*t);
  var cr=Math.cos(w0*t), ci=Math.sin(w0*t);
  var x=0, y=0;
  for(var i=0;i<M;i++){
    var n=i-N, ai=n<0?-n:n;
    var a=re[ai], b=n<0?-im[ai]:im[ai];
    x+=a*pr-b*pi; y+=a*pi+b*pr;
    pts[2*i]=x; pts[2*i+1]=y;
    var nr=pr*cr-pi*ci; pi=pr*ci+pi*cr; pr=nr;
  }
  return {pts:pts,M:M,end:[x,y]};
}

function refIntegral(om,t){
  var M=32768, h=2*om/M, sr=0, si=0;
  for(var m=0;m<M;m++){
    var w=-om+h*(m+0.5);
    var X=Xof(w);
    var c=Math.cos(w*t), s=Math.sin(w*t);
    sr+=X[0]*c-X[1]*s; si+=X[0]*s+X[1]*c;
  }
  return [sr*h/(2*Math.PI), si*h/(2*Math.PI)];
}

/* ---------- drawing ---------- */

var cv=document.getElementById('cv');
var ctx=cv.getContext('2d');
var R={};

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
  var topH=Math.round(h*0.40);
  R.time={x:14,y:26,w:w-28,h:topH-40};
  R.cap={x:14,y:topH-12,w:w-28,h:24};
  var by=topH+18, bh=h-by-12;
  var sw=Math.round((w-42)*0.54);
  R.spec={x:14,y:by,w:sw,h:bh};
  R.chain={x:14+sw+14,y:by,w:w-28-sw-14,h:bh};
}

function regime(){
  var sup=supNow(), T=st.T, w0=2*Math.PI/T, lobe=P().lobe(st.p);
  if(T<2.5*sup) return {k:0, txt:'T < 2.5×support: periodic replicas overlap — x_T(t) is periodic and aliased; spectral lines sparse and tall, F_n·T still far from the envelope'};
  if(T<12*sup)  return {k:1, txt:'Replicas separate: only one x(t) remains in the window, but x_T is still periodic; Δω='+fmt(w0,4)+' still visible to the eye, F_n·T approaching the envelope |X(jω)|'};
  if(w0<lobe/8) return {k:2, txt:'Replicas out of window and Δω too small to see: Riemann sum Σ[F_n·T](Δω/2π)e^{jnω₀t} ≈ (1/2π)∫X(jω)e^{jωt}dω — inside the window it is the aperiodic x(t)'};
  return {k:3, txt:'Replicas out of window, but Δω='+fmt(w0,4)+' not small enough yet (need < lobe/8): keep increasing T for the discrete sum to hug the integral'};
}

function drawTime(){
  var r=R.time;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  var W=TS.W, T=st.T;
  var ymax=1;
  var i;
  for(i=0;i<TS.NT;i++) if(Math.abs(TS.v[i])>ymax) ymax=Math.abs(TS.v[i]);
  if(st.ckIdeal){ for(i=0;i<400;i++){ var u=-W+2*W*i/399; var xv=Math.abs(xOf(u)); if(xv>ymax) ymax=xv; } }
  ymax*=1.18;
  function X(t){ return r.x+r.w*(t+W)/(2*W); }
  function Y(v){ return r.y+r.h/2-(v/ymax)*(r.h/2-6); }
  ctx.strokeStyle='#2a3b5c'; ctx.beginPath();
  ctx.moveTo(r.x,Y(0)); ctx.lineTo(r.x+r.w,Y(0)); ctx.stroke();
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('Time domain: colored = periodic-extension synthesis s_T(t), gray dashed = ideal aperiodic x(t)', r.x+8, r.y+14);
  ctx.fillText('t', r.x+r.w-10, Y(0)-4);
  if(st.ckIdeal){
    ctx.strokeStyle='#7a8db0'; ctx.setLineDash([5,4]); ctx.beginPath();
    for(i=0;i<=400;i++){ var u2=-W+2*W*i/400; var y2=Y(xOf(u2)); if(i===0)ctx.moveTo(X(u2),y2); else ctx.lineTo(X(u2),y2); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle='#7fd1ff'; ctx.lineWidth=2; ctx.beginPath();
  for(i=0;i<TS.NT;i++){ var y3=Y(TS.v[i]); if(i===0)ctx.moveTo(X(TS.ts[i]),y3); else ctx.lineTo(X(TS.ts[i]),y3); }
  ctx.stroke(); ctx.lineWidth=1;
  if(st.ckBrk && T/2<=W){
    var yb=r.y+24;
    ctx.strokeStyle='#ff5d5d'; ctx.beginPath();
    ctx.moveTo(X(-T/2),yb); ctx.lineTo(X(T/2),yb);
    ctx.moveTo(X(-T/2),yb-5); ctx.lineTo(X(-T/2),yb+5);
    ctx.moveTo(X(T/2),yb-5); ctx.lineTo(X(T/2),yb+5);
    ctx.stroke();
    ctx.fillStyle='#ff5d5d'; ctx.fillText('T = '+fmt(T,2), (X(-T/2)+X(T/2))/2-24, yb-6);
  }
  ctx.restore();
}

function drawSpec(){
  var r=R.spec;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  var omx=st.omxUnits*P().lobe(st.p), om=omx*1.12;
  var N=FN.N, w0=FN.w0, T=st.T;
  var scale=st.ckRaw?1:T;
  var ymax=1e-9, i, n;
  for(n=-N;n<=N;n++){ var hgt=Math.hypot(FN.re[Math.abs(n)],FN.im[Math.abs(n)])*(n<0?1:1)*scale; if(hgt>ymax)ymax=hgt; }
  if(st.ckEnv){ for(i=0;i<=200;i++){ var w=-om+2*om*i/200; var e=Math.hypot(Xof(w)[0],Xof(w)[1])/ (st.ckRaw?T:1); if(e>ymax)ymax=e; } }
  ymax*=1.15;
  function X(w){ return r.x+r.w*(w+om)/(2*om); }
  function Y(v){ return r.y+r.h-16-(v/ymax)*(r.h-34); }
  var y0=Y(0);
  ctx.strokeStyle='#2a3b5c'; ctx.beginPath(); ctx.moveTo(r.x,y0); ctx.lineTo(r.x+r.w,y0); ctx.stroke();
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('Spectrum: lines |F_n|'+(st.ckRaw?'':'·T')+' (colored by |n|)'+(st.ckEnv?', gray envelope |X(jω)|'+(st.ckRaw?'/T':''):''), r.x+8, r.y+14);
  ctx.fillText('ω', r.x+r.w-10, y0-4);
  if(st.ckEnv){
    ctx.strokeStyle=st.ckRaw?'#5b6a86':'#9aa8c0'; ctx.beginPath();
    for(i=0;i<=400;i++){ var w2=-om+2*om*i/400; var e2=Math.hypot(Xof(w2)[0],Xof(w2)[1])/(st.ckRaw?T:1); var yy=Y(e2); if(i===0)ctx.moveTo(X(w2),yy); else ctx.lineTo(X(w2),yy); }
    ctx.stroke();
  }
  var B=24, paths=[];
  for(i=0;i<B;i++) paths.push(null);
  for(n=-N;n<=N;n++){
    var mag=Math.hypot(FN.re[Math.abs(n)],FN.im[Math.abs(n)])*scale;
    var b=bucketOf(n,N);
    if(!paths[b]) paths[b]=[];
    paths[b].push(X(n*w0), y0, Y(mag));
  }
  for(i=0;i<B;i++){
    if(!paths[i]) continue;
    ctx.strokeStyle=colFor(i/23); ctx.beginPath();
    var arr=paths[i];
    for(var j=0;j<arr.length;j+=3){ ctx.moveTo(arr[j],arr[j+1]); ctx.lineTo(arr[j],arr[j+2]); }
    ctx.stroke();
  }
  ctx.restore();
}

function drawChain(){
  var r=R.chain;
  ctx.save();
  ctx.fillStyle='#0e1626'; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle='#22314d'; ctx.strokeRect(r.x,r.y,r.w,r.h);
  var ch=chainAt(st.t);
  var mx=1e-9, i;
  for(i=0;i<ch.M;i++){ var ax=Math.abs(ch.pts[2*i]), ay=Math.abs(ch.pts[2*i+1]); if(ax>mx)mx=ax; if(ay>mx)mx=ay; }
  mx*=1.15;
  var cx=r.x+r.w/2, cy=r.y+r.h/2+6;
  var sc=Math.min((r.w/2-14)/mx,(r.h/2-22)/mx);
  function X(v){ return cx+v*sc; }
  function Y(v){ return cy-v*sc; }
  ctx.strokeStyle='#2a3b5c'; ctx.beginPath();
  ctx.moveTo(r.x+6,cy); ctx.lineTo(r.x+r.w-6,cy);
  ctx.moveTo(cx,r.y+18); ctx.lineTo(cx,r.y+r.h-8);
  ctx.stroke();
  ctx.fillStyle='#8fa2c4'; ctx.font='11px Segoe UI, sans-serif';
  ctx.fillText('Complex plane: v_n=F_n·e^{jnω₀t} joined head-to-tail (n=−N…N), endpoint = s_T(t)', r.x+8, r.y+14);
  ctx.fillText('Re', r.x+r.w-20, cy-4);
  ctx.fillText('Im', cx+4, r.y+28);
  var N=FN.N;
  var B=24, paths=[];
  for(i=0;i<B;i++) paths.push(null);
  for(i=1;i<ch.M;i++){
    var n=i-N;
    var b=bucketOf(n,N);
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
  var ex=X(ch.end[0]), ey=Y(ch.end[1]);
  ctx.strokeStyle='#8fa2c4'; ctx.setLineDash([4,4]); ctx.beginPath();
  ctx.moveTo(ex,ey); ctx.lineTo(ex,cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(ex,ey,3.5,0,6.2832); ctx.fill();
  ctx.fillStyle='#e8eefc';
  ctx.fillText('Re endpoint = '+fmt(ch.end[0],4), ex+6, ey-6);
  ctx.restore();
  return ch;
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
  drawTime();
  drawSpec();
  var ch=drawChain();
  drawCaption();
  return ch;
}

/* ---------- controls ---------- */

function el(id){ return document.getElementById(id); }
var ePreset=el('preset'), eShape=el('shape'), eShapeLab=el('shapeLab'), eShapeVal=el('shapeval');
var eLogT=el('logT'), eTval=el('Tval'), eAuto=el('autoT'), eOmx=el('omx'), eOmxVal=el('omxval');
var ePlay=el('play'), eStep=el('step'), eTsl=el('tsl'), eTval=el('tval');
var eEnv=el('ckEnv'), eRaw=el('ckRaw'), eBrk=el('ckBrk'), eIdeal=el('ckIdeal');
var rT=el('r_T'), rW=el('r_w0'), rN=el('r_N'), rF0=el('r_F0'), rF0T=el('r_F0T'), rErr=el('r_err'), rNote=el('r_capNote');

var dirty=true;

function syncShape(){
  var pr=P();
  eShapeLab.textContent=pr.plab;
  eShape.min=pr.pmin; eShape.max=pr.pmax; eShape.step=pr.pstep; eShape.value=st.p;
  eShapeVal.textContent=(+st.p).toFixed(2);
}
function syncT(){
  var a=Tmin(), b=Tmax();
  if(st.T<a) st.T=a; if(st.T>b) st.T=b;
  var u=Math.log(st.T/a)/Math.log(b/a);
  eLogT.value=Math.round(u*1000);
  eTval.textContent=fmt(st.T,2);
  eTsl.max=st.T; eTsl.step=st.T/1000;
  if(st.t>st.T) st.t=st.t%st.T;
}
function syncOmx(){ eOmxVal.textContent=st.omxUnits+' lobes'; }

function readouts(ch){
  var w0=2*Math.PI/st.T;
  rT.textContent=fmt(st.T,3)+' s'+(st.Ncapped?' (N capped at 1500)':'');
  rW.textContent=fmt(w0,5)+' rad/s';
  rN.textContent=''+(2*FN.N+1);
  rF0.textContent=fmt(FN.re[0],6);
  var X0=Xof(0);
  rF0T.textContent=fmt(FN.re[0]*st.T,5)+'  vs  '+fmt(X0[0],5);
  if(ch){
    var d=Math.hypot(ch.end[0]-xOf(st.t), ch.end[1]);
    rErr.textContent=fmt(d,6);
  }
  var rg=regime();
  rNote.textContent=['Stage 1/3: periodic and aliased','Stage 2/3: periodic, replicas separate','Stage 3/3: sum ≈ integral (aperiodic limit)','Stage 2.5/3: replicas out of window but Δω still too big'][rg.k];
}

function bind(){
  ePreset.addEventListener('change',function(e){ st.preset=e.target.value; st.p=P().pdef; syncShape(); syncT(); dirty=true; });
  eShape.addEventListener('input',function(e){ st.p=parseFloat(e.target.value); eShapeVal.textContent=(+st.p).toFixed(2); syncT(); dirty=true; });
  eLogT.addEventListener('input',function(e){ var u=(+e.target.value)/1000; st.T=Tmin()*Math.pow(Tmax()/Tmin(),u); st.autoT=null; eAuto.textContent='Auto-increase T (full sweep in 8 s)'; syncT(); dirty=true; });
  eAuto.addEventListener('click',function(){ st.autoT={start:null}; eAuto.textContent='Sweeping… (click slider to interrupt)'; });
  eOmx.addEventListener('input',function(e){ st.omxUnits=+e.target.value; syncOmx(); dirty=true; });
  ePlay.addEventListener('click',function(){ st.playing=!st.playing; ePlay.textContent=st.playing?'⏸ Pause':'▶ Play'; });
  eStep.addEventListener('click',function(){ st.playing=false; ePlay.textContent='▶ Play'; st.t=(st.t+st.T/128)%st.T; eTsl.value=st.t; });
  eTsl.addEventListener('input',function(e){ st.t=+e.target.value; });
  eEnv.addEventListener('change',function(e){ st.ckEnv=e.target.checked; });
  eRaw.addEventListener('change',function(e){ st.ckRaw=e.target.checked; });
  eBrk.addEventListener('change',function(e){ st.ckBrk=e.target.checked; });
  eIdeal.addEventListener('change',function(e){ st.ckIdeal=e.target.checked; });
  cv.addEventListener('keydown',function(e){
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      st.playing=false; ePlay.textContent='▶ Play';
      st.t=clamp(st.t+(e.key==='ArrowRight'?1:-1)*st.T/64,0,st.T);
      eTsl.value=st.t; e.preventDefault();
    } else if(e.key===' '||e.key==='Spacebar'){
      ePlay.click(); e.preventDefault();
    }
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
  if(st.autoT){
    if(st.autoT.start===null) st.autoT.start=tsms;
    var u=(tsms-st.autoT.start)/8000;
    if(u>=1){ st.T=Tmax(); st.autoT=null; eAuto.textContent='Auto-increase T (full sweep in 8 s)'; }
    else st.T=Tmin()*Math.pow(Tmax()/Tmin(),u);
    syncT(); dirty=true;
  }
  if(st.playing){ st.t=(st.t+dt)%st.T; eTsl.value=st.t; }
  eTval.textContent=fmt(st.t,3);
  if(dirty){ computeFn(); computeTime(); dirty=false; }
  var ch=draw();
  readouts(ch);
}

function init(){
  st.preset='rect'; st.p=P().pdef; st.T=20*supNow(); st.t=0;
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  st.playing=!rm;
  syncShape(); syncT(); syncOmx();
  ePlay.textContent=st.playing?'⏸ Pause':'▶ Play';
  bind();
  computeFn(); computeTime(); dirty=false;
  readouts(draw());
  kick();
}

function apply(o){
  if(o.preset!==undefined){ st.preset=o.preset; }
  if(o.p!==undefined){ st.p=o.p; }
  if(o.T!==undefined){ st.T=o.T; }
  if(o.omxUnits!==undefined){ st.omxUnits=o.omxUnits; }
  if(o.t!==undefined){ st.t=o.t; }
  syncShape(); syncT(); syncOmx();
  computeFn(); computeTime(); dirty=false;
}

init();

globalThis.__FT={
  PRESETS:PRESETS, st:st,
  fn:function(){return FN;}, ts:function(){return TS;},
  computeFn:computeFn, computeTime:computeTime, chainAt:chainAt,
  sTexact:sTexact, xT:xT, xOf:xOf, Xof:Xof, refIntegral:refIntegral,
  supNow:supNow, apply:apply, regime:regime, draw:draw
};

globalThis.__VIZ={st:st,draw:draw,apply:apply};
})();
