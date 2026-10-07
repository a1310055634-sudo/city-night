// R60 收官成品图拍摄脚本：final3-1..8
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9351;                       // R60 专用高位端口（避开 9345 扫描器与 9227 aDrive）
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_final3_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run','--window-size=1680,945','about:blank'],{stdio:'ignore'});

async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw new Error('no chrome')}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,300);
  return r.result?.result?.value};
async function shot(name){
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(DIR+'/'+name+'.png',Buffer.from(s.result.data,'base64'));
  console.log('  -> '+name+'  ('+Math.round(s.result.data.length*0.75/1024)+'KB)')}

// 等待内部 30ms 轮询确认（DOM/微任务后同步读会假红）
async function until(expr,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(150)}return false}

async function load(q){
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:`${URL0}?${q}`});
    if(await until('window.__ready===true',45000))return true;
    console.log('  load retry '+(a+1))}
  return false}

const errs=[];let count=0;
async function grab(tag,name){await shot(name);count++;
  const e=await evaljs('window.__err.length');
  if(e!==0)errs.push(tag+':err='+e);
  console.log('  '+tag+' __err='+e)}

// ── 1. 银河主打（晴夜鸟瞰，看不到地面细节，只看星带压城）
console.log('=== final3-1 银河 ===');
if(await load('time=night&weather=clear&q=0&still=1')){
  await evaljs('__setView(131,58,86)');await sleep(900);
  await grab('galaxy','final3-1-galaxy');
} else errs.push('galaxy:LOAD_FAIL');

// ── 2. 烟花桥（绽放帧 + 河面倒影）
console.log('=== final3-2 烟花桥 ===');
if(await load('time=night&q=0&still=1')){
  await evaljs('__setView(276,15,48)');await sleep(500);
  await evaljs('window.__hanabiFire("kiku",0,42);window.__hanabiFire("botan",1,50)');
  await until('(window.__hanabi&&__hanabi().bursts.filter(b=>b&&b.bloomed).length)>=2',6000);
  await sleep(220);await shot('final3-2-hanabi-bridge');count++;
  // 河面低机位看倒影
  await evaljs('__freeze=true;__camera.position.set(86,2.6,24);__camera.lookAt(90,18,48);__camera.updateMatrixWorld();__composer.render()');
  await sleep(400);
  await evaljs('window.__hanabiFire("yanagi",2,46)');
  await until('(window.__hanabi&&__hanabi().bursts.filter(b=>b&&b.bloomed).length)>=3',6000);
  await sleep(200);await shot('final3-3-hanabi-river');count++;
  await evaljs('__unfreeze()');
  const e=await evaljs('window.__err.length');
  if(e!==0)errs.push('hanabi:err='+e);
  console.log('  hanabi __err='+e);
} else errs.push('hanabi:LOAD_FAIL');

// ── 3. 神社雪灯参道（黄昏，雪灯亮起错落）
console.log('=== final3-4 神社参道 ===');
if(await load('time=dusk&q=0&still=1')){
  await evaljs('__setView(64,12,26)');await sleep(900);
  await grab('shrine','final3-4-shrine-lanterns');
} else errs.push('shrine:LOAD_FAIL');

// ── 4. 打烊后的便利店街（flow 23:30 街道全闭卷帘落下）
console.log('=== final3-5 打烊街 ===');
if(await load('time=night&flow=1&q=0&still=1')){
  await evaljs('window.__setGameHour(23.6)');await sleep(1200);
  const closed=await evaljs('(window.__shops?__shops.closed:"?")');
  console.log('  shops closed = '+closed);
  await evaljs('__setView(131,10,26)');await sleep(900);
  await grab('closed-street','final3-5-closed-street');
} else errs.push('closed:LOAD_FAIL');

// ── 5. 晨间猫（黎明，猫开始走街）
console.log('=== final3-6 晨猫 ===');
if(await load('time=dawn&q=0&still=1')){
  const ci=await evaljs('JSON.stringify(window.__catsInfo||{})');
  console.log('  cats = '+String(ci).slice(0,260));
  await evaljs('__setView(131,7,15)');await sleep(1000);
  await grab('morning-cat','final3-6-morning-cat');
} else errs.push('cat:LOAD_FAIL');

// ── 6. 冰柱檐（晴昼融化态）
console.log('=== final3-7 冰柱檐 ===');
if(await load('time=day&weather=clear&q=0&still=1')){
  await evaljs('window.__icicles&&window.__icicles(0.85)');
  await sleep(700);
  const m=await evaljs('(window.__icicles?window.__icicles().melt:-1)');
  console.log('  melt = '+m);
  await evaljs('__setView(131,9,19)');await sleep(900);
  await grab('icicle','final3-7-icicle-eaves');
} else errs.push('icicle:LOAD_FAIL');

// ── 7. 橱窗窥视（便利店内部可见，夜间暖光）
console.log('=== final3-8 橱窗 ===');
if(await load('time=night&q=0&still=1')){
  await evaljs('__setView(131,4,9.5)');await sleep(1000);
  await grab('interior','final3-8-convenience-window');
} else errs.push('interior:LOAD_FAIL');

// ── 8. 黄昏全貌（V3 状态下的城市全貌）
console.log('=== final3-9 黄昏全貌 ===');
if(await load('time=dusk&weather=clear&q=0&still=1')){
  await evaljs('__setView(131,42,205)');await sleep(1000);
  await grab('dusk-bird','final3-9-dusk-birdseye');
} else errs.push('dusk:LOAD_FAIL');

// 版本三处一致性断言
console.log('=== version ===');
if(await load('time=night&q=0&still=1')){
  const ver=await evaljs('(document.querySelector("#wx-ver")||{}).textContent');
  console.log('  wx-ver = '+ver);
  if(ver!=='v3.0.0')errs.push('version:wxbar='+ver);
} else errs.push('version:LOAD_FAIL');

console.log(`\ntotal: ${count} screenshots  errs: ${errs.length?errs.join(';'):'none'}`);
ws.close();chrome.kill();
await sleep(600);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(errs.length?1:0);