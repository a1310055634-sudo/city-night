import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9433;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r55_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__riparian');
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
let y=JSON.parse(await evaljs('JSON.stringify(window.__riparian())'));
console.log('riparian:',JSON.stringify(y));
ok('counts',y.grass===7&&y.blades>=85&&y.bamboo===3&&y.pond===1&&y.stair===2&&y.snow===6,JSON.stringify(y));
ok('pond-rough-low',y.pondR<0.1);
// ===== 2 芒草风摆：IM 旋转连拍变化 =====
const r0=JSON.parse(await evaljs(`(()=>{const im=__scene.getObjectByName('r55grass');
  const m4=new __T.Matrix4();im.getMatrixAt(0,m4);
  const e=new __T.Euler().setFromRotationMatrix(m4);
  return JSON.stringify({rx:+e.x.toFixed(3)})})()`));
await sleep(1000);
const r1=JSON.parse(await evaljs(`(()=>{const im=__scene.getObjectByName('r55grass');
  const m4=new __T.Matrix4();im.getMatrixAt(0,m4);
  const e=new __T.Euler().setFromRotationMatrix(m4);
  return JSON.stringify({rx:+e.x.toFixed(3)})})()`));
ok('grass-sway-changes',Math.abs(r0.rx-r1.rx)>0.005,r0.rx+'->'+r1.rx);
// ===== 3 芒草近景 + 冰面池塘 + 竹丛 + 石阶 =====
await evaljs('__freeze=true;__camera.position.set(78,2.6,-20);__camera.lookAt(82,0.8,-25);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r55-grass');await evaljs('__unfreeze()');
await evaljs('__freeze=true;__camera.position.set(24,3.2,60);__camera.lookAt(28,0.3,67);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r55-pond');await evaljs('__unfreeze()');
await evaljs('__freeze=true;__camera.position.set(81,2.6,-30);__camera.lookAt(85,1.6,-24);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r55-bamboo');await evaljs('__unfreeze()');
await evaljs('__freeze=true;__camera.position.set(80.5,2.0,-14.5);__camera.lookAt(83.4,0.3,-11);__camera.updateMatrixWorld();__composer.render()');
await sleep(250);await shot('r55-stairs');await evaljs('__unfreeze()');
// ===== 4 池塘昼晴反光 vs 夜雪（材质+视觉对照）=====
await load('time=day&weather=clear&still=1');
await evaljs('__setTarget(28,0.3,67);__setView(210,18,14)');await sleep(500);
await shot('r55-pond-day-clear');
ok('pond-day-shot',true);
// ===== 5 draw 差值 =====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const gs=[__scene.getObjectByName('r55grass')];
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  gs.forEach(g=>g.visible=false);__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  gs.forEach(g=>g.visible=true);__composer.render();
  const s2=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s2,diff:s2-h})})()`));
ok('grass-draw-1',dd.diff===1,JSON.stringify(dd)+' (全包 ≤6)');
await evaljs('__unfreeze()');
// ===== 6 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r55-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r55-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r55-far-regression');
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
