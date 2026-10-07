import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9387;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r49_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__stars');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态（雪夜回归基线）=====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
await evaljs('__unfreeze()');await sleep(1500);
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__stars())'));
console.log('stars-default:',JSON.stringify(y));
ok('default-snow-no-stars',y.clearE===0&&y.starOp===0&&y.env==='snow');
await evaljs('__setView(131,30,205)');
const fog0=await evaljs('+__scene.fog.density.toFixed(5)');
ok('snow-far-fog-0.00182',fog0>0.0015&&fog0<0.0021,'fog='+fog0);
// ===== 2 三入口：0 键（eval setWeather）=====
await evaljs('__setWeather("clear")');
let ce=-1;
for(let i=0;i<15;i++){await sleep(300);
  y=JSON.parse(await evaljs('JSON.stringify(window.__stars())'));
  if(y.clearE>=0.9){ce=y.clearE;break}}
ok('clearE-rise',ce>=0.85,'clearE='+ce);
ok('night-stars-visible',y.starOp>0.5,'starOp='+y.starOp);
ok('env-swapped-clear',y.env==='clear'&&await evaljs('__scene.environment===window.__envClear')===true);
ok('snowfall-residual<5pct',y.snowFall<0.05,'snowFall='+y.snowFall);
ok('wxbar-clear-on',await evaljs('document.querySelector("#wxbar [data-w=clear]").classList.contains("on")')===true);
// ===== 3 晴夜雾/背景/月光 =====
await evaljs('__setView(131,32,22.5)');await sleep(300);
const fogC=await evaljs('+__scene.fog.density.toFixed(5)');
ok('clear-fog-0.0035',fogC>0.0024&&fogC<0.0046,'fog='+fogC);
ok('clear-bg-dark',await evaljs('+__scene.background.r.toFixed(2)')<0.08);
ok('moon-boost-1.3x',y.moonBoost>=1.28,'boost='+y.moonBoost);
// ===== 4 银河主打 + 星点无炸裂 =====
await evaljs('__freeze=true;__camera.position.set(40,10,-40);__camera.lookAt(-200,280,-150);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r49-galaxy');await evaljs('__unfreeze()');
// ===== 5 流星 =====
await evaljs('window.__stars().forceMeteor()');
let met=false;
for(let i=0;i<8;i++){await sleep(200);
  y=JSON.parse(await evaljs('JSON.stringify(window.__stars())'));
  if(y.meteorActive){met=true;
    await evaljs('__freeze=true;__camera.position.set(-40,20,-60);__camera.lookAt(0,240,0);__camera.updateMatrixWorld();__composer.render()');
    await sleep(120);await shot('r49-meteor');await evaljs('__unfreeze()');break}}
ok('force-meteor',met);
// ===== 6 晴夜街景（月光雪面）=====
await evaljs('__freeze=true;__camera.position.set(3,2.4,10);__camera.lookAt(0,1.0,-24);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r49-clear-street');await evaljs('__unfreeze()');
// ===== 7 L3 挂级 =====
await evaljs('__perfLevel(3)');await sleep(900);
ok('L3-stars-hidden',await evaljs('window.__stars().starVisible')===false);
await evaljs('__perfLevel(0)');await sleep(1600);
ok('L0-stars-restore',await evaljs('window.__stars().starVisible')===true);
// ===== 8 昼晴：星不可见 =====
await load('time=day&weather=clear&still=1');
await sleep(1500);y=JSON.parse(await evaljs('JSON.stringify(window.__stars())'));
ok('day-clear-no-stars',y.starOp<=0.05&&y.precip==='clear','starOp='+y.starOp+' precip='+y.precip);
await evaljs('__freeze=true;__camera.position.set(3,2.4,10);__camera.lookAt(0,1.0,-24);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r49-clear-day');await evaljs('__unfreeze()');
// ===== 9 URL 入口同效（本段已隐式验证 load 参数）+ 矩阵 =====
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r49-night-thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r49-night-overview');
// ===== 10 wxbar 7 钮 + 390px 不溢出 =====
await load('still=1');
ok('wxbar-7-buttons',await evaljs('document.querySelectorAll("#wxbar button").length')===7);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await sleep(600);
const wb=JSON.parse(await evaljs(`(()=>{const b=document.getElementById('wxbar').getBoundingClientRect();
  return JSON.stringify({w:+b.width.toFixed(0),l:+b.left.toFixed(0),r:+b.right.toFixed(0)})})()`));
ok('wxbar-390-no-overflow',wb.w<=392&&wb.l>=-2&&wb.r<=392,JSON.stringify(wb));
await send('Emulation.clearDeviceMetricsOverride');
await sleep(400);
// ===== 11 雪夜回归 + fps + 终检 =====
await evaljs('__setView(131,30,205)');await sleep(400);
const fog1=await evaljs('+__scene.fog.density.toFixed(5)');
ok('snow-regression-fog',fog1>0.0015&&fog1<0.0021,'fog='+fog1);
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
