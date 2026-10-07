import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9409;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r53_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__facade');
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
let y=JSON.parse(await evaljs('JSON.stringify(window.__facade())'));
console.log('facade:',JSON.stringify({clothes:y.clothes,plates:y.plates,buildings:y.buildings}));
ok('clothes-40-56',y.clothes>=40&&y.clothes<=56,'clothes='+y.clothes);
ok('plates-18',y.plates===18,'plates='+y.plates);
ok('buildings-18',y.buildings===18,'buildings='+y.buildings);
// ===== 2 衣物矩阵有限性（无 NaN=无穿模位）=====
const noNaN=await evaljs(`(()=>{const im=__scene.getObjectByName('r53cloth');
  const m4=new __T.Matrix4();let ok2=true;
  for(let i=0;i<im.count;i++){im.getMatrixAt(i,m4);
    const e=m4.elements;if(!isFinite(e[12])||!isFinite(e[13])||!isFinite(e[14]))ok2=false}
  return ok2})()`);
ok('cloth-matrix-finite',noNaN===true);
// ===== 3 风摆连拍 ×3（实位机位）=====
const s0=y.sample[0];
const aim=`__freeze=true;__camera.position.set(${s0.x+Math.sin(s0.ry)*7+2.5},2.9,${s0.z+Math.cos(s0.ry)*7+1.5});__camera.lookAt(${s0.x},2.1,${s0.z});__camera.updateMatrixWorld();__composer.render()`;
await evaljs(aim);await sleep(200);await shot('r53-cloth-1');await evaljs('__unfreeze()');
await sleep(700);
await evaljs(aim);await sleep(200);await shot('r53-cloth-2');await evaljs('__unfreeze()');
await sleep(700);
await evaljs(aim);await sleep(200);await shot('r53-cloth-3');await evaljs('__unfreeze()');
// ===== 4 门牌灯昼灭/夜亮（实位机位）=====
const pl=y.plate;
const plateCam=`__freeze=true;__camera.position.set(${pl.x+Math.sin(0)*5+1.5},2.6,${pl.z+Math.cos(0)*5+1});__camera.lookAt(${pl.x},1.9,${pl.z});__camera.updateMatrixWorld();__composer.render()`;
await load('time=day&still=1');
const dim=JSON.parse(await evaljs(`(()=>{const im=__scene.getObjectByName('r53plate');
  return JSON.stringify({c:+im.material.color.r.toFixed(2)})})()`));
ok('plate-day-dim',dim.c<0.35,'color.r='+dim.c);
await evaljs(plateCam);await sleep(250);await shot('r53-plate-day');await evaljs('__unfreeze()');
// ===== 5 夜间门牌灯亮 + 衣物夜摆 =====
await load('still=1&still=1');
const lit=await evaljs('+__scene.getObjectByName("r53plate").material.color.r.toFixed(2)');
ok('plate-night-lit',lit>0.9,'color.r='+lit);
await evaljs(aim);await sleep(250);await shot('r53-cloth-night');await evaljs('__unfreeze()');
// ===== 6 draw 差值 =====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const gs=[__scene.getObjectByName('r53cloth'),__scene.getObjectByName('r53plate')];
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  gs.forEach(g=>g.visible=false);__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  gs.forEach(g=>g.visible=true);__composer.render();
  const s2=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s2,diff:s2-h})})()`));
ok('draw-diff<=36',dd.diff<=36,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 7 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r53-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r53-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r53-far-regression');
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
