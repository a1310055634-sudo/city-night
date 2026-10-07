import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9375;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r46_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__bus');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态加载 =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
await evaljs('__unfreeze()');await sleep(1200);
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__bus())'));
console.log('bus:',JSON.stringify(y));
ok('bus-hooks',y.state!==undefined&&y.snow===true);
// ===== 2 首站停靠（初始 x=-42 东行，-28 站在前 14m）=====
let sawApproach=false,stoppedAt=-1,stopIdx=-1;
const st0=Date.now();
while(Date.now()-st0<30000){await sleep(200);
  y=JSON.parse(await evaljs('JSON.stringify(window.__bus())'));
  if(y.state==='approach')sawApproach=true;
  if(y.atStop){stoppedAt=Date.now()-st0;stopIdx=y.stopIdx;break}}
ok('first-stop-within-30s',stoppedAt>=0,'t='+stoppedAt+'ms stopIdx='+stopIdx);
ok('approach-phase-seen',sawApproach);
// ===== 3 门时序 200ms 采样 =====
let sawMidDoor=false,maxDoor=0,dwellMs=-1;
for(let i=0;i<48;i++){await sleep(200);
  y=JSON.parse(await evaljs('JSON.stringify(window.__bus())'));
  maxDoor=Math.max(maxDoor,y.door);
  if(y.door>0.2&&y.door<0.95)sawMidDoor=true;
  if(!y.atStop&&stoppedAt>=0){dwellMs=Date.now()-st0-stoppedAt;break}}
ok('door-open-sequence',sawMidDoor&&maxDoor>=0.99,'maxDoor='+maxDoor.toFixed(2));
ok('dwell-6s±2s',dwellMs>5000&&dwellMs<8500,'dwell='+dwellMs+'ms');
// ===== 4 确定性会车：__busMeet 巴士挪到活车前方 15m → R21 跟车 → 间距 ≥6m =====
let meet=null,minGap=1e9;const m0=Date.now();
while(!meet&&Date.now()-m0<8000){meet=await evaljs('window.__busMeet()');if(!meet)await sleep(700)}
ok('meet-arranged',!!meet,meet?('edge '+meet):'no horizontal car');
if(meet){let carGap=null;const g0=Date.now();
  while(Date.now()-g0<8000){await sleep(300);
    const r=JSON.parse(await evaljs(`(()=>{const b=window.__bus();
      let gap=null;for(const c of window.__traffic()){const dx=c.x-b.x;
        if(dx<-1.5&&dx>-16&&Math.abs(c.z-b.z)<1.9)gap=Math.max(gap||-99,-dx)}
      return JSON.stringify({gap:gap===null?null:+gap.toFixed(2)})})()`));
    if(r.gap!==null)carGap=r.gap===null?null:r.gap;
    if(carGap!==null&&carGap<14)break}
  for(let i=0;i<6;i++){await sleep(330);
    const r=JSON.parse(await evaljs(`(()=>{const b=window.__bus();let gap=null;
      for(const c of window.__traffic()){const dx=c.x-b.x;
        if(dx<-1.5&&dx>-16&&Math.abs(c.z-b.z)<1.9)gap=Math.max(gap||-99,-dx)}
      return JSON.stringify({gap:gap===null?null:+gap.toFixed(2)})})()`));
    if(r.gap!==null)carGap=Math.min(carGap,r.gap)}
  minGap=carGap===null?1e9:carGap;
  await evaljs(`__freeze=true;__camera.position.set(${64+12},3,${-64-6});__camera.lookAt(${64+14},1.2,${-64-2});__camera.updateMatrixWorld();__composer.render()`);
  await sleep(200);await shot('r46-meet');await evaljs('__unfreeze()')}
ok('queue-gap>=6',minGap>=5.8&&minGap<1e8,'minGap='+(minGap<1e8?minGap.toFixed(2):'none')+'m');
// ===== 5 车道居中（计样本）+ 转弯捕获 =====
let laneMax=0,laneN=0,sawTurn=false;const c0=Date.now();
while(Date.now()-c0<30000){await sleep(400);
  y=JSON.parse(await evaljs('JSON.stringify(window.__bus())'));
  if(y.corridor&&y.state!=='turn'){laneN++;laneMax=Math.max(laneMax,y.laneDev)}
  if(y.state==='turn')sawTurn=true;
  if(sawTurn&&laneN>5)break}
if(laneN===0){await evaljs('window.__busCorridor()');
  const c1=Date.now();
  while(Date.now()-c1<15000){await sleep(400);
    y=JSON.parse(await evaljs('JSON.stringify(window.__bus())'));
    if(y.corridor&&y.state!=='turn'){laneN++;laneMax=Math.max(laneMax,y.laneDev)}}}
  ok('lane-center-0.15',laneN>0&&laneMax<=0.15,'samples='+laneN+' laneMax='+laneMax.toFixed(3));
ok('bezier-turn-seen',sawTurn);
// ===== 6 夜间行驶截图 =====
await evaljs(`(()=>{const b=__scene.getObjectByName('r46bus');
  __freeze=true;__camera.position.set(b.position.x-11,3.2,b.position.z+7);
  __camera.lookAt(b.position.x,1.6,b.position.z);__camera.updateMatrixWorld();__composer.render()})()`);
await sleep(200);await shot('r46-night-run');await evaljs('__unfreeze()');
// ===== 7 昼间路线牌灭 =====
await load('time=day&still=1');
y=JSON.parse(await evaljs('JSON.stringify(window.__bus())'));
ok('day-sign-dim',y.signGlow<=0.16,'signGlow='+y.signGlow);
await evaljs('__freeze=true;__camera.position.set(64,2.6,8);__camera.lookAt(62,1.6,13.5);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r46-day');await evaljs('__unfreeze()');
// ===== 8 draw 差值 =====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const g=__scene.getObjectByName('r46bus');
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  g.visible=false;__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  g.visible=true;__composer.render();
  const s=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s,diff:s-h})})()`));
ok('draw-diff<=8',dd.diff<=8,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 9 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r46-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r46-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r46-far-regression');
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
