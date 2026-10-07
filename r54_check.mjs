import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9425;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r54_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__furniture');
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
let y=JSON.parse(await evaljs('JSON.stringify(window.__furniture())'));
console.log('furniture:',JSON.stringify(y));
ok('counts',y.signs===4&&y.aed===2&&y.kiosk===1&&y.vendTotal===10&&y.brands===10&&y.vents===2,JSON.stringify(y));
// ===== 2 品牌 Canvas 哈希唯一 =====
const uniq=await evaljs('new Set(window.__r54hashes).size');
ok('brand-hashes-unique',uniq===10,'uniq='+uniq+'/10');
// ===== 3 排汽微汽动画 =====
const v0=JSON.parse(await evaljs('JSON.stringify(window.__furniture())')).ventY;
await sleep(1500);
const v1=JSON.parse(await evaljs('JSON.stringify(window.__furniture())')).ventY;
ok('vent-animates',Math.abs(v1-v0)>0.05,v0+'->'+v1);
// ===== 4 路名牌特写 =====
await evaljs('__freeze=true;__camera.position.set(-19.5,2.2,3);__camera.lookAt(-21,2.1,5);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r54-sign');await evaljs('__unfreeze()');
// ===== 5 贩卖机品牌墙特写（(19.3,-7.5) 近拍）=====
await evaljs('__freeze=true;__camera.position.set(21,1.8,-4.5);__camera.lookAt(19.3,1.2,-7.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r54-vending-brand');await evaljs('__unfreeze()');
// ===== 6 报刊亭特写 + AED =====
await evaljs('__freeze=true;__camera.position.set(35.5,2.2,-52.5);__camera.lookAt(37.5,1.4,-55.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r54-kiosk');await evaljs('__unfreeze()');
await evaljs('__freeze=true;__camera.position.set(-3.2,1.8,4.8);__camera.lookAt(-4.8,1.35,2.6);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r54-aed');await evaljs('__unfreeze()');
// ===== 7 AED/内灯 昼灭 =====
await load('time=day&still=1');
// ===== 8 draw 差值 =====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const gs=[__scene.getObjectByName('r54sign'),__scene.getObjectByName('r54aed'),
  __scene.getObjectByName('r54kiosk'),__scene.getObjectByName('r54brand'),__scene.getObjectByName('r54body')];
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  gs.forEach(g=>{if(g)g.visible=false});__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  gs.forEach(g=>{if(g)g.visible=true});__composer.render();
  const s2=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s2,diff:s2-h})})()`));
ok('draw-diff<=14',dd.diff<=14,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 9 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r54-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r54-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r54-far-regression');
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
