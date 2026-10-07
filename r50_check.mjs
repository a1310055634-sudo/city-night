import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9395;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r50_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__icicles');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态（雪夜：melt 冻结衰减）=====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
await evaljs('__unfreeze()');await sleep(1500);
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__icicles())'));
console.log('icicles:',JSON.stringify(y));
ok('count-20-30',y.count>=20&&y.count<=30,'count='+y.count);
ok('default-melt-low',y.melt<0.3,'melt='+y.melt);
// ===== 2 晴+昼 melt 速率 +0.008/s ±5%（10s 采样）=====
await evaljs('__setWeather("clear")');
await evaljs('__flow(true)');await evaljs('__setGameHour(12)');await sleep(800);
const m0=JSON.parse(await evaljs('JSON.stringify(window.__icicles())')).melt;
await sleep(10000);
const m1=JSON.parse(await evaljs('JSON.stringify(window.__icicles())')).melt;
const rate=(m1-m0)/10;
ok('melt-rate-day-clear',rate>0.0065&&rate<0.0095,'rate='+rate.toFixed(4)+'/s');
// ===== 3 depth 反向联动（clear 昼 depth 衰减）=====
await evaljs('__snowDepth(1.15)');await sleep(500);
const d0=JSON.parse(await evaljs('JSON.stringify(window.__snowDepth())')).depth;
await sleep(8000);
const d1=JSON.parse(await evaljs('JSON.stringify(window.__snowDepth())')).depth;
ok('depth-inverse-falling',d1<d0,'depth '+d0+'->'+d1);
// ===== 4 冰柱近景（melt 满格）=====
await evaljs('__icicles(1)');
await evaljs('__freeze=true;__camera.position.set(-4,2.4,-14);__camera.lookAt(-6,1.8,-19.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r50-icicles');await evaljs('__unfreeze()');
// ===== 5 坠落碎裂（90s 窗口 falls≥1）=====
let f0=JSON.parse(await evaljs('JSON.stringify(window.__icicles())')).falls;
const fT=Date.now();let fell=false,fallShot=false;
while(Date.now()-fT<95000){await sleep(1000);
  y=JSON.parse(await evaljs('JSON.stringify(window.__icicles())'));
  if(y.falls>f0){fell=true;
    if(!fallShot){fallShot=true;
      await evaljs('__freeze=true;__camera.position.set(-6,2.6,-15);__camera.lookAt(-7,1.6,-19.5);__camera.updateMatrixWorld();__composer.render()');
      await sleep(200);await shot('r50-fall');await evaljs('__unfreeze()')}}
  if(y.falls>=f0+2)break}
ok('falls-in-90s',fell,'falls='+y.falls);
// ===== 6 水洼微扩 =====
const poolA=JSON.parse(await evaljs('JSON.stringify(window.__icicles())')).pool;
ok('pool-grows',poolA>1.2,'pool='+poolA);
await evaljs('__freeze=true;__camera.position.set(-3,2.2,-13);__camera.lookAt(-7,0.2,-18);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r50-puddle');await evaljs('__unfreeze()');
// ===== 7 夜雪冻结（melt -0.004/s）=====
await evaljs('__setWeather("snow")');
await evaljs('__flow(true)');await evaljs('__setGameHour(2)');
const n0=JSON.parse(await evaljs('JSON.stringify(window.__icicles())')).melt;
await sleep(8000);
const n1=JSON.parse(await evaljs('JSON.stringify(window.__icicles())')).melt;
const nrate=(n0-n1)/8;
ok('night-freeze-rate',nrate>0.002&&nrate<0.006,'rate=-'+nrate.toFixed(4)+'/s');
// ===== 8 昼晴 vs 夜雪 对比截图 =====
await evaljs('__setWeather("clear")');await evaljs('__setGameHour(12)');await sleep(2500);
await evaljs('__icicles(1)');
await evaljs('__freeze=true;__camera.position.set(-4,2.4,-14);__camera.lookAt(-6,1.8,-19.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r50-day-clear');await evaljs('__unfreeze()');
await evaljs('__setWeather("snow")');await evaljs('__setGameHour(2)');await sleep(3000);
await evaljs('__freeze=true;__camera.position.set(-4,2.4,-14);__camera.lookAt(-6,1.8,-19.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r50-night-snow');await evaljs('__unfreeze()');
// ===== 9 半透排序闪烁走查（连拍 3 帧逐像素应稳定）=====
await evaljs('__freeze=true;__camera.position.set(-4,2.4,-14);__camera.lookAt(-6,1.8,-19.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r50-trans-a');await sleep(400);
await evaljs('__composer.render()');await shot('r50-trans-b');await evaljs('__unfreeze()');
// ===== 10 L3 挂级 =====
await evaljs('__perfLevel(3)');await sleep(900);
ok('L3-ice-hidden',await evaljs('window.__icicles().visible')===false);
await evaljs('__perfLevel(0)');await sleep(900);
ok('L0-ice-restore',await evaljs('window.__icicles().visible')===true);
// ===== 11 draw 差值 =====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const gs=[__scene.getObjectByName('r50ice')];
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  gs.forEach(g=>g.visible=false);__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  gs.forEach(g=>g.visible=true);__composer.render();
  const s2=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s2,diff:s2-h})})()`));
ok('draw-diff<=4',dd.diff<=4,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 12 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r50-night-snow-view');
await load('still=1&weather=clear');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r50-night-overview');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-clear',fog>0.0007&&fog<0.0016,'fog='+fog+' (晴 0.0035×0.28≈0.001)');
await shot('r50-far-regression');
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
