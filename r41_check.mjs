import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9351;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r41_'+Date.now();
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
async function load(q){                         // 带重试加载，轮询 __ready+__cats
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:BASE+(q?'?'+q:'')});
    const t0=Date.now();
    while(Date.now()-t0<40000){
      const r=await evaljs('window.__ready===true&&!!window.__cats');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态加载与钩子断言 =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
const info=await evaljs('JSON.stringify(window.__catsInfo)');
console.log('catsInfo:',info);
const ci=JSON.parse(info);
ok('cats-5',ci.cats===5);
ok('anchors-ok-laneMin>=5',ci.anchorsOk===true&&ci.laneMin>=5,'laneMin='+ci.laneMin);
const cats=await evaljs('JSON.stringify(window.__cats())');
const cl=JSON.parse(cats);
ok('names-in-pool',['タマ','クロ','ミケ','シロ','チャ'].every(n=>cl.some(c=>c.name===n)));
ok('night-eyes<0.85',ci.eyes<=0.85&&ci.eyes>0.3,'eyes='+ci.eyes);
ok('focusList+5',(await evaljs('window.__focusList().filter(f=>f.id.indexOf("cat-")===0).length'))===5);

// ===== 2 行为观测 66s：状态切换 / 巡游位移 =====
const first=Object.fromEntries(cl.map(c=>[c.id,[c.x,c.z]]));
const states=new Set();let maxDisp=0,sawWalk=false;
for(let i=0;i<55;i++){
  const arr=JSON.parse(await evaljs('JSON.stringify(window.__cats())'));
  for(const c of arr){states.add(c.state);
    if(c.state==='walk')sawWalk=true;
    const d=Math.hypot(c.x-first[c.id][0],c.z-first[c.id][1]);if(d>maxDisp)maxDisp=d}
  await sleep(1200)}
ok('states>=2',states.size>=2,[...states].join(','));
ok('walk-observed',sawWalk);
ok('displacement>=1.5',maxDisp>=1.5,'maxDisp='+maxDisp.toFixed(2));

// ===== 3 拾取/名片（freeCam 近观 + __pickAt 直调 + __focus 弹卡）=====
const c0=JSON.parse(await evaljs('JSON.stringify(window.__cats())'))[0];
await evaljs(`__freeCam(${c0.x+1.7},0.95,${c0.z+2.2},${c0.x},0.3,${c0.z})`);
const pr=await evaljs(`(()=>{const v=new __T.Vector3(${c0.x},0.3,${c0.z}).project(__camera);
  return JSON.stringify({px:Math.round((v.x+1)/2*innerWidth),py:Math.round((1-(v.y+1)/2)*innerHeight),z:+v.z.toFixed(3)})})()`);
const pp=JSON.parse(pr);
ok('cat-on-screen',pp.z<1&&pp.px>0&&pp.px<1680,JSON.stringify(pp));
const pid=await evaljs(`__pickAt(${pp.px},${pp.py})`);
ok('pickAt-hit-cat',pid===c0.id,'pick='+pid);
await evaljs(`__focus('${c0.id}')`);
await sleep(400);
const card=await evaljs(`JSON.stringify({op:document.getElementById('focusCard').style.opacity,
  name:document.getElementById('fc-name').textContent,fi:window.__focusInfo().id})`);
const cj=JSON.parse(card);
ok('card-shows',cj.op==='1'&&cj.name===c0.name&&cj.fi===c0.id,card);
await evaljs('__unfocus()');await evaljs('__unfreeze()');await sleep(1200);

// ===== 4 draw calls 差值（远景 205m 全可见口径，冻结手动渲染）=====
await evaljs('__setView(131,42,205)');await sleep(300);
const dd=JSON.parse(await evaljs(`(()=>{const gs=[];__scene.traverse(o=>{if(o.name==='r41cat')gs.push(o)});
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  for(const g of gs)g.visible=false;__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  for(const g of gs)g.visible=true;__composer.render();
  const s=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s,diff:s-h})})()`));
ok('draw-diff<=28',dd.diff<=28,JSON.stringify(dd));
await evaljs('__unfreeze()');

// ===== 5 深雪暖点（强制 depth=1.1 → warmth → 恢复）=====
await evaljs('__snowDepth(1.1)');
let warmT=-1;
for(let i=0;i<20;i++){await sleep(2000);
  const arr=JSON.parse(await evaljs('JSON.stringify(window.__cats())'));
  if(arr.some(c=>c.state==='warmth')){warmT=(i+1)*2;break}}
ok('warmth-within-40s',warmT>0,'t='+warmT+'s');
const wc=JSON.parse(await evaljs('JSON.stringify(window.__cats())')).find(c=>c.state==='warmth');
if(wc){await evaljs(`__freeCam(${wc.x+1.6},0.9,${wc.z+2.0},${wc.x},0.28,${wc.z})`);await shot('r41-warmth');await evaljs('__unfreeze()')}
await evaljs('__snowDepth(1.0)');
let warmClr=false;
for(let i=0;i<12;i++){await sleep(2000);
  const arr=JSON.parse(await evaljs('JSON.stringify(window.__cats())'));
  if(!arr.some(c=>c.state==='warmth')){warmClr=true;break}}
ok('warmth-clears',warmClr);

// ===== 6 雷雨避雷（strike tap → hide）=====
await evaljs('__setWeather("thunder")');
let hid=null;
for(let i=0;i<45;i++){await sleep(2000);
  const st=await evaljs('window.__catsInfo.strikes');
  const arr=JSON.parse(await evaljs('JSON.stringify(window.__cats())'));
  if(st>=1&&arr.some(c=>c.state==='hide')){hid=arr.find(c=>c.state==='hide');break}}
ok('thunder-hide',!!hid,hid?('strikeN captured, '+hid.name+' hiding'):'no strike/hide in 90s');
if(hid){await evaljs(`__freeCam(${hid.x+1.6},0.9,${hid.z+2.0},${hid.x},0.28,${hid.z})`);await shot('r41-hide');await evaljs('__unfreeze()')}
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r41-night-thunder');
await evaljs('__setWeather("snow")');await sleep(800);

// ===== 7 fps（无头软渲染参考口径）=====
const fps=await evaljsA('(async()=>{await new Promise(r=>requestAnimationFrame(r));let n=0;const t0=performance.now();while(performance.now()-t0<2000){await new Promise(r=>requestAnimationFrame(r));n++}return n})()');
ok('fps>=30',fps>=30,'fps='+fps);

// ===== 8 猫近景三连（间隔 6s，姿态可能不同）=====
for(let i=0;i<3;i++){
  const cc=JSON.parse(await evaljs('JSON.stringify(window.__cats())'))[0];
  await evaljs(`__freeCam(${cc.x+1.7},0.95,${cc.z+2.2},${cc.x},0.3,${cc.z})`);
  await shot('r41-near-'+(i+1));
  await evaljs('__unfreeze()');await sleep(6000)}

// ===== 9 矩阵截图（昼雪×2 / 夜雪鸟瞰 / 远景回归）=====
await load('time=day&still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r41-day-bird');
await evaljs('__setView(131,32,22.5)');await sleep(400);await shot('r41-day-origin');
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r41-night-overview');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r41-far-regression');

// ===== 10 终检：全新加载零报错 =====
await load('');
await sleep(2500);
err=await evaljs('window.__err.length');
ok('final-err0',err===0,'__err.length='+err);

const pass=results.filter(r=>r[1]).length;
console.log(`\nSUMMARY ${pass}/${results.length} PASS`);
ws.close();chrome.kill();
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(pass===results.length?0:1);
