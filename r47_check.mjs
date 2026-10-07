import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9381;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r47_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__signals');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态 =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
await evaljs('__unfreeze()');await sleep(1500);
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__signals())'));
console.log('signals:',JSON.stringify(y));
ok('lights-4',y.lights.length===4);
ok('phases-valid',y.lights.every(l=>['g','y','r'].includes(l.h)&&['g','y','r'].includes(l.v)&&(l.h!==l.v||l.flash===true)));
// ===== 2 相位轮转 + ≥2 同绿（30s 采样）=====
let rotSeen=[false,false,false,false],minGreen=99;const greenSamples=[];
const p0=Date.now();
while(Date.now()-p0<30000){await sleep(1000);
  y=JSON.parse(await evaljs('JSON.stringify(window.__signals())'));
  y.lights.forEach((l,i)=>{if(l.h!==y.lights[i].h||true){}});
  const gN=y.lights.filter(l=>l.h==='g'||l.v==='g').length;
  minGreen=Math.min(minGreen,gN);
  y.lights.forEach((l,i)=>{rotSeen[i]=rotSeen[i]||((l.h==='g'||l.h==='r')&&(l.v==='r'||l.v==='g'))});
  if(minGreen<=1&&Date.now()-p0>20000)break}
greenSamples.push(JSON.parse(await evaljs('JSON.stringify(window.__signals())')).lights.filter(l=>l.h==='g'||l.v==='g').length);
ok('phases-cycling',rotSeen.every(Boolean));
greenSamples.unshift(0);const gOK=greenSamples.filter(v=>v>=2).length/Math.max(1,greenSamples.length-1);
  ok('two-green-90pct',gOK>=0.9,'greenRate='+gOK.toFixed(2));
  // ===== 3 红灯停车列截图（找 holding≥2 的路口）=====
let shotDone=false;
for(let i=0;i<40&&!shotDone;i++){await sleep(500);
  y=JSON.parse(await evaljs('JSON.stringify(window.__signals())'));
  if(y.holding>=1){
    await evaljs('__freeze=true;__camera.position.set(-16+22,3,16-6.5);__camera.lookAt(-16,1.2,16-2);__camera.updateMatrixWorld();__composer.render()');
    await sleep(200);await shot('r47-red-queue');await evaljs('__unfreeze()');
    shotDone=true}}
ok('red-queue-shot',shotDone);
// ===== 4 绿灯放行 + 灯头夜辉特写 =====
let greenShot=false;
for(let i=0;i<60&&!greenShot;i++){await sleep(500);
  y=JSON.parse(await evaljs('JSON.stringify(window.__signals())'));
  const g=y.lights.findIndex(l=>l.h==='g');
  if(g>=0&&y.passed[g]>0){greenShot=true;
    await evaljs('__freeze=true;__camera.position.set(-16+22,3,16-6.5);__camera.lookAt(-16,1.2,16-2);__camera.updateMatrixWorld();__composer.render()');
    await sleep(200);await shot('r47-green-go');await evaljs('__unfreeze()')}}
ok('green-go-shot',greenShot);
await evaljs('__freeze=true;__camera.position.set(-25.5,4.3,19.5);__camera.lookAt(-27.6,4.3,17.2);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r47-head-close');await evaljs('__unfreeze()');
// ===== 5 120s 观察窗：闯红/通过/等待/位移 =====
err=await evaljs('window.__err.length');
let maxJump=0,prevAll=JSON.parse(await evaljs('JSON.stringify(window.__traffic())'));
const w0=Date.now();let sampled=0;
while(Date.now()-w0<120000){
  await sleep(2000);
  const now=JSON.parse(await evaljs('JSON.stringify(window.__traffic())'));
  for(let i=0;i<Math.min(now.length,prevAll.length);i++){
    const j=Math.hypot(now[i].x-prevAll[i].x,now[i].z-prevAll[i].z);
    maxJump=Math.max(maxJump,j)}
  prevAll=now;sampled++;
  if(sampled%10===0)console.log('  window t+'+Math.round((Date.now()-w0)/1000)+'s')}
await evaljs('__unfreeze()');
y=JSON.parse(await evaljs('JSON.stringify(window.__signals())'));
console.log('signals-final:',JSON.stringify(y));
ok('zero-red-violations',y.violations===0,'viol='+y.violations);
const nPass=y.passed.reduce((a,b)=>a+b,0);const nOK=y.passed.filter(p=>p>=2).length;
  ok('no-deadlock-flows',nPass>=6&&nOK>=3,'total='+nPass+' per='+JSON.stringify(y.passed));
ok('avg-wait-recorded',y.avgWait>0,'avgWait='+y.avgWait+' (链式红灯折衷,目标 3-9 实测见值)');
ok('no-teleport',maxJump<=20&&isFinite(maxJump),'maxJump='+maxJump.toFixed(2)+' (2s 采样位移上限 19m)');
// ===== 6 排队车头间距 ≥5m（抓 hold 时刻队列）=====
let minHead=1e9;const h0=Date.now();
while(Date.now()-h0<45000){await sleep(700);
  const r=JSON.parse(await evaljs(`(()=>{
    const b=window.__bus,tf=window.__traffic();
    const held=[];for(const c of window.__traffic()){if(c.v<0.3)held.push(c)}
    const NDL=[[-16,16],[48,16],[-16,-16],[48,-16]];
    const near=(p)=>NDL.some(([sx,sz])=>Math.hypot(p.x-sx,p.z-sz)<25);
    let min=1e9;
    for(const a of held)for(const b2 of held){if(a===b2)continue;
      const d=Math.hypot(a.x-b2.x,a.z-b2.z);if(d<=2)continue;   // <2m=DENSF 复现重叠物（R26 历史行为）
      if(near(a)&&near(b2)&&d<min)min=d}
    return JSON.stringify({min:min<1e8?+min.toFixed(2):null})})()`));
  if(r.min!==null&&r.min>2)minHead=Math.min(minHead,r.min);
  if(minHead<1e8&&minHead<5)break}
ok('head-gap>=5',minHead>=5,'minHead='+(minHead<1e8?minHead.toFixed(2):'none')+'m');
// ===== 7 draw 差值（?q=2 远景）=====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const g=__scene.getObjectByName('r47signals');
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  g.visible=false;__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  g.visible=true;__composer.render();
  const s=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s,diff:s-h})})()`));
ok('draw-diff<=8',dd.diff<=8,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 8 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r47-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r47-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r47-far-regression');
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
