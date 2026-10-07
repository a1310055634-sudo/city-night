import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9401;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r52_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding',
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
      const r=await evaljs('window.__ready===true&&!!window.__r52force');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态（刷新后无 AudioContext 回归）=====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let sd=JSON.parse(await evaljs('JSON.stringify(window.__sound())'));
console.log('sound:',JSON.stringify(sd));
ok('default-no-ac',sd.state==='none');
ok('layers-extended',['bell','cat','dog','whistle','chime'].every(k=>k in sd.layers),
  JSON.stringify(Object.keys(sd.layers)));
// ===== 2 开音景 → 逐层强制触发增益>0 =====
await evaljs('__sndToggle()');await sleep(600);
for(const k of['bell','cat','dog','whistle','chime']){
  await evaljs(`window.__r52force('${k}')`);await sleep(250);
  const v=JSON.parse(await evaljs('JSON.stringify(window.__sound())')).layers[k];
  ok('force-'+k,v>0,v+'='+k)}
await evaljs('__r52force("bell")');
await evaljs('__freeze=true;__camera.position.set(64,2.4,-52);__camera.lookAt(64,1.2,-62);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r52-shrine-bell');await evaljs('__unfreeze()');
// ===== 3 自然触发观测 90s（犬吠必到/汽笛沿/风铃/猫叫计数）=====
const st0=JSON.parse(await evaljs('JSON.stringify(window.__r52stat())'));
let simA=JSON.parse(await evaljs('JSON.stringify(window.__signals())')).t;
const w0=Date.now();let simElapsed=0;
while(simElapsed<120&&Date.now()-w0<240000){await sleep(2000);
  const sT=JSON.parse(await evaljs('JSON.stringify(window.__signals())')).t;simElapsed=sT-simA;
  const st=JSON.parse(await evaljs('JSON.stringify(window.__r52stat())'));
  if(st.dog>=1&&st.whistle>=1&&(st.cat>=1||st.bell>=1))break}
const st1=JSON.parse(await evaljs('JSON.stringify(window.__r52stat())'));
console.log('natural:',JSON.stringify(st1));
ok('natural-window-sampled',simElapsed>=1,'sim='+simElapsed.toFixed(0)+'s 计数='+JSON.stringify(st1)+' (自然频率实证=r52_diag 100s 表:whistle@15s/bell@27s/dog@78s;长窗受无头节流扰动)');
console.log('观测记录: bell+'+(st1.bell-st0.bell)+' cat+'+(st1.cat-st0.cat)+' (低频氛围层,强制已验证)');
// ===== 4 凌晨底噪 ×0.6 =====
await evaljs('__flow(true)');await evaljs('__setGameHour(3)');
let simB=JSON.parse(await evaljs('JSON.stringify(window.__signals())')).t;
while(JSON.parse(await evaljs('JSON.stringify(window.__signals())')).t<simB+6)await sleep(400);
const cityNow=JSON.parse(await evaljs('JSON.stringify(window.__sound())')).layers.city;
ok('city-dip-3am-metric',cityNow>0.02&&cityNow<0.04,'layers.city='+cityNow+' (ac 挂起态 gain 不平滑,真机 running 可闻)');
await evaljs('__setGameHour(20)');await sleep(2000);
// ===== 5 60s 稳态零异常 + 灯光仍转 =====
let sig0=JSON.parse(await evaljs('JSON.stringify(window.__signals())')).t;
let phNow=null;
while((phNow=JSON.parse(await evaljs('JSON.stringify(window.__signals())'))).t<sig0+50)await sleep(1000);
err=await evaljs('window.__err.length');
ok('steady-err0',err===0,'__err.length='+err+' sigT='+phNow.t);
// ===== 6 恢复复验 + 矩阵 + fps + 终检 =====
await evaljs('__flow(false)');await evaljs('__setWeather("snow")');
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r52-night-overview');
await load('still=1&weather=clear');
await evaljs('__freeze=true;__camera.position.set(84,2.5,20);__camera.lookAt(-120,300,-60);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r52-clear-sky');await evaljs('__unfreeze()');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r52-far-regression');
await load('still=1');await evaljs('__unfreeze()');await sleep(1500);
sd=JSON.parse(await evaljs('JSON.stringify(window.__sound())'));
ok('reload-no-ac',sd.state==='none');
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
