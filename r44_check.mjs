import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9367;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r44_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__shrine');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态：钩子读数 =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__shrine())'));
console.log('shrine:',JSON.stringify(y));
ok('shrine-parts',y.torii===true&&y.lanterns===6&&y.honden===true&&y.pines===9);
ok('snowcaps>=9',y.snowCaps>=9,'snowCaps='+y.snowCaps);
ok('night-lit-glow',y.lit===true&&y.glow>=0.9,'glow='+y.glow);
ok('prior-hooks-intact',
  await evaljs('!!window.__cats')===true &&
  await evaljs('!!window.__yatai')===true &&
  await evaljs('!!window.__life')===true);

// ===== 2 参道纵深主打 + 近景 =====
await evaljs('__freeze=true;__camera.position.set(64,1.9,-46.5);__camera.lookAt(64,2.0,-66);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r44-sando');await evaljs('__unfreeze()');
await evaljs('__freeze=true;__camera.position.set(65.8,2.6,-63.5);__camera.lookAt(64,2.3,-68.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r44-honden');await evaljs('__unfreeze()');
await evaljs('__freeze=true;__camera.position.set(66.4,2.0,-59.5);__camera.lookAt(63,1.5,-62.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r44-lanterns');await evaljs('__unfreeze()');
await evaljs('__freeze=true;__camera.position.set(50,2.4,-66);__camera.lookAt(56,1.8,-66.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r44-pines');await evaljs('__unfreeze()');
// ===== 3 火苗闪烁（30s 窗口）=====
let fl=false;const fs0=Date.now();
while(Date.now()-fs0<30000){await sleep(1000);
  if(JSON.parse(await evaljs('JSON.stringify(window.__shrine())')).flick===true){fl=true;break}}
ok('flicker-within-30s',fl);
// ===== 4 昼间灯灭 =====
await load('time=day&still=1');
y=JSON.parse(await evaljs('JSON.stringify(window.__shrine())'));
ok('day-lights-off',y.lit===false&&y.glow<=0.12,'glow='+y.glow);
await evaljs('__freeze=true;__camera.position.set(0,1.7,-50.8);__camera.lookAt(0,2.4,-68.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r44-day');await evaljs('__unfreeze()');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r44-day-bird');
// ===== 5 draw 差值（?q=2 远景 205m）=====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const g=__scene.getObjectByName('r44shrine');
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  g.visible=false;__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  g.visible=true;__composer.render();
  const s=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s,diff:s-h})})()`));
ok('draw-diff<=20',dd.diff<=20,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 6 夜景矩阵 + 远景回归 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r44-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r44-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r44-far-regression');
// ===== 7 fps + 终检 =====
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
