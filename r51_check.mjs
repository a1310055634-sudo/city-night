import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9399;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r51_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run',
  `--user-data-dir=${prof}`,'--window-size=1680,945','about:blank'],{stdio:'ignore'});
async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw 0}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,300);
  return r.result?.result?.value};
const evaljsA=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,300);
  return r.result?.result?.value};
async function shot(name){
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(DIR+'/'+name+'.png',Buffer.from(s.result.data,'base64'));
  console.log('shot '+name)}
async function load(q){
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:BASE+(q?'?'+q:'')});
    const t0=Date.now();
    while(Date.now()-t0<40000){
      const r=await evaljs('window.__ready===true&&!!window.__snowMorph');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态 =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
await evaljs('__unfreeze()');await sleep(1200);
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())'));
console.log('morph:',JSON.stringify(y));
ok('hook-fields',y.mode!==undefined&&y.sizeK>0&&y.fall!==undefined);
// ===== 2 强制弱风 → 鹅毛 =====
await evaljs('__wind(0.1)');
let fl=false,flMorph=0;
for(let i=0;i<8;i++){await sleep(400);
  y=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())'));
  flMorph=y.morph;if(y.mode==='fluffy'&&y.morph>=0.9){fl=true;break}}
ok('wind0.1-fluffy',fl,'morph='+flMorph);
// ===== 3 鹅毛降速：snowT 速率 ≈0.6（2s 采样）=====
let st0=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())')).snowT;
await sleep(2000);
let st1=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())')).snowT;
const rateF=(st1-st0)/2;
ok('fluffy-speed-0.6',rateF>0.45&&rateF<0.75,'rate='+rateF.toFixed(2));
// ===== 4 鹅毛近景连拍 =====
await evaljs('__freeze=true;__camera.position.set(3,2.4,10);__camera.lookAt(0,1.4,-18);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r51-fluffy-close');await evaljs('__unfreeze()');
// ===== 5 强制强风 → 细雪 =====
await evaljs('__wind(1.0)');
let fi=false;
for(let i=0;i<8;i++){await sleep(400);
  y=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())'));
  if(y.mode==='fine'&&y.morph<=0.1){fi=true;break}}
ok('wind1.0-fine',fi,'morph='+y.morph);
// ===== 6 细雪加速：snowT 速率 ≈1.3 =====
st0=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())')).snowT;
await sleep(2000);
st1=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())')).snowT;
const rateN=(st1-st0)/2;
ok('fine-speed-1.3',rateN>1.1&&rateN<1.5,'rate='+rateN.toFixed(2));
// ===== 7 滞回：wp=0.5 保持当前档（6s 采样形变 ≤0.3）=====
await evaljs('__wind(0.5)');
const hMorph=y.morph;
let mMax=hMorph,mMin=hMorph;
for(let i=0;i<6;i++){await sleep(1000);
  y=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())'));
  mMax=Math.max(mMax,y.morph);mMin=Math.min(mMin,y.morph)}
ok('hysteresis-hold',mMax-mMin<=0.3,'drift='+(mMax-mMin).toFixed(2)+' morph='+y.morph);
// ===== 8 近景连拍（细雪）+ 鸟瞰 =====
await evaljs('__freeze=true;__camera.position.set(3,2.4,10);__camera.lookAt(0,1.4,-18);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r51-fine-close');await evaljs('__unfreeze()');
await evaljs('__wind(null)');await sleep(500);
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r51-bird');
// ===== 9 尺寸连续性（切换无跳变）=====
await evaljs('__wind(0.1)');await sleep(2000);
let kMax=0,kPrev=null;
for(let i=0;i<10;i++){await sleep(300);
  y=JSON.parse(await evaljs('JSON.stringify(window.__snowMorph())'));
  if(kPrev!==null)kMax=Math.max(kMax,Math.abs(y.sizeK-kPrev));
  kPrev=y.sizeK;
  if(y.sizeK>=2.15)break}
ok('size-lerp-smooth',kMax<=0.12&&kPrev>=2.1,'maxStep='+kMax.toFixed(3)+' sizeK='+kPrev);
await evaljs('__wind(null)');
// ===== 10 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r51-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r51-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r51-far-regression');
await load('still=1');await evaljs('__unfreeze()');await sleep(1500);
const fps=await evaljsA('(async()=>{await new Promise(r=>requestAnimationFrame(r));let n=0;const t0=performance.now();while(performance.now()-t0<2000){await new Promise(r=>requestAnimationFrame(r));n++}return n})()');
ok('fps>=30',fps>=30,'fps='+fps);
await load('');
await sleep(2500);
err=await evaljs('window.__err.length');
ok('final-err0',err===0,'__err.length='+err);
const pass=results.filter(r=>r[1]).length;
console.log(`\nSUMMARY ${pass}/${results.length} PASS`);
ws.close();chrome.kill();
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(pass===results.length?0:1);
