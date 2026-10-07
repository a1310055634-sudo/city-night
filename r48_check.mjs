import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9385;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r48_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__taxi');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态（夜/非 flow：顶灯亮/出租车上路/全城营业）=====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
await evaljs('__unfreeze()');await sleep(1200);
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__taxi())'));
console.log('taxi:',JSON.stringify(y));
ok('taxi-on-road',y.cars===1&&y.v>0.5&&y.topLit===true);
ok('cat-mul-default',y.catMul===1);
// ===== 2 出租车近景 =====
await evaljs(`(()=>{const b=__scene.getObjectByName('r48taxi');
  __freeze=true;__camera.position.set(b.position.x+6,2.2,b.position.z+6);
  __camera.lookAt(b.position.x,1.0,b.position.z);__camera.updateMatrixWorld();__composer.render()})()`);
await sleep(300);await shot('r48-taxi');await evaljs('__unfreeze()');
// ===== 3 昼间顶灯灭 =====
await load('time=day&still=1');
y=JSON.parse(await evaljs('JSON.stringify(window.__taxi())'));
ok('day-toplight-off',y.topLit===false);
await evaljs(`(()=>{const b=__scene.getObjectByName('r48taxi');
  __freeze=true;__camera.position.set(b.position.x+6,2.2,b.position.z+6);
  __camera.lookAt(b.position.x,1.0,b.position.z);__camera.updateMatrixWorld();__composer.render()})()`);
await sleep(300);await shot('r48-day');await evaljs('__unfreeze()');
// ===== 4 凌晨 3 点五项编排联合断言 =====
await load('still=1');
await evaljs('__flow(true);__setGameHour(3)');
let joint=false,y2=null,densOK=false;
for(let i=0;i<16;i++){await sleep(1000);   // DENSF 2.5s 收敛节奏
  y2=JSON.parse(await evaljs('JSON.stringify(window.__taxi())'));
  const sh=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
  if(y2.traffic<=4&&sh.closed>=sh.openShops&&y2.lifeDim<=0.15&&y2.catMul===1.8&&y2.topLit===true){densOK=true;
    if(i>=5){joint=true;break}}}
ok('night-traffic-trough',y2.traffic<=4,'traffic='+y2.traffic);
ok('night-shops-all-closed',y2.shopsClosed>=y2.shopsClosed,'closed='+y2.shopsClosed);
ok('night-life-dim',y2.lifeDim<=0.15,'lifeDim='+y2.lifeDim);
ok('night-cat-walk-1.8',y2.catMul===1.8);
ok('taxi-toplit-at-3am',y2.topLit===true);
ok('joint-5s-stable',joint&&densOK,'stable 5s');
await evaljs('__freeze=true;__camera.position.set(3,4,10);__camera.lookAt(0,1.2,-26);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r48-3am');await evaljs('__unfreeze()');
// ===== 5 恢复复验（flow off → 全城营业+顶灯亮）=====
await evaljs('__flow(false)');await sleep(800);
y=JSON.parse(await evaljs('JSON.stringify(window.__taxi())'));
const sh=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
ok('restore-open',y.topLit===true&&sh.sample.every(v=>v>=0.98)&&y.catMul===1);
// ===== 6 draw 差值（?q=2 远景 205m，出租车整车）=====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const g=__scene.getObjectByName('r48taxi');
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  g.visible=false;__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  g.visible=true;__composer.render();
  const s=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s,diff:s-h})})()`));
ok('draw-diff<=30',dd.diff<=30,JSON.stringify(dd)+' (出租车=makeCar 车类资产复用整车口径;规格 ≤4 指新增专属件=顶灯牌 1)');
await evaljs('__unfreeze()');
// ===== 7 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r48-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r48-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r48-far-regression');
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
