import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9357;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r42_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__yatai');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};
const CAM=`__freeCam(-3.4,1.9,14.8,-7.6,1.25,8.4)`;   // 屋台东南侧高机位：暖帘+灯笼+蒸汽同框

// ===== 1 默认态：钩子读数（夜/雪/非 flow=全亮）=====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__yatai())'));
console.log('yatai:',JSON.stringify(y));
ok('lit-open-default',y.lit===true&&y.curtain>0.95&&y.steam>0.95);
ok('snowcap-registered',y.caps===true);
ok('lantern-night-glow',y.glow>=0.9,'glow='+y.glow);
// ===== 2 蒸汽随风漂移（8s 窗口 driftX 摆幅）=====
let dmin=1e9,dmax=-1e9;
for(let i=0;i<16;i++){const d=await evaljs('window.__yatai().driftX');
  dmin=Math.min(dmin,d);dmax=Math.max(dmax,d);await sleep(500)}
ok('steam-wind-drift',(dmax-dmin)>=0.1,'range='+(dmax-dmin).toFixed(3));
// ===== 3 夜屋台主打图 =====
await evaljs(CAM);await sleep(400);await shot('r42-night-main');await evaljs('__unfreeze()');
// ===== 4 昼间：灯笼昼灭 + 截图 =====
await load('time=day&still=1');
y=JSON.parse(await evaljs('JSON.stringify(window.__yatai())'));
ok('lantern-day-dim',y.glow<=0.15,'glow='+y.glow);
await evaljs(CAM);await sleep(400);await shot('r42-day-yatai');await evaljs('__unfreeze()');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r42-day-bird');
// ===== 5 flow 收摊/复开三件套 =====
await load('still=1');
await evaljs('__flow(true);__setGameHour(3)');
let closed=false;
for(let i=0;i<8;i++){await sleep(500);
  y=JSON.parse(await evaljs('JSON.stringify(window.__yatai())'));
  if(y.lit===false&&y.curtain<=0.2&&y.steam<=0.2){closed=true;break}}
ok('flow-3am-closed-triple',closed,JSON.stringify(y));
await evaljs(CAM);await sleep(400);await shot('r42-closed');await evaljs('__unfreeze()');
await evaljs('__setGameHour(20)');
let reopened=false;
for(let i=0;i<8;i++){await sleep(500);
  y=JSON.parse(await evaljs('JSON.stringify(window.__yatai())'));
  if(y.lit===true&&y.curtain>=0.8){reopened=true;break}}
ok('flow-8pm-reopen',reopened,'curtain='+y.curtain);
await evaljs('__flow(false)');await sleep(800);
y=JSON.parse(await evaljs('JSON.stringify(window.__yatai())'));
ok('non-flow-stays-open',y.lit===true,'lit='+y.lit);
// ===== 6 draw 差值（?q=2 远景 205m 全可见口径，含蒸汽 Sprite）=====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const gs=[];__scene.traverse(o=>{
    if(o.name==='r42yatai'||o.name==='r42steam')gs.push(o)});
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  for(const g of gs)g.visible=false;__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  for(const g of gs)g.visible=true;__composer.render();
  const s=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s,diff:s-h})})()`));
ok('draw-diff<=20',dd.diff<=20,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 7 矩阵：夜雷 + 远景回归 =====
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r42-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r42-far-regression');
// ===== 8 fps + 终检 =====
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
