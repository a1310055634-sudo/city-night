import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9468;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r58_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__hanabi');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
async function key(code,key2,vk){
  await send('Input.dispatchKeyEvent',{type:'rawKeyDown',code,key:key2,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(60);
  await send('Input.dispatchKeyEvent',{type:'keyUp',code,key:key2,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(150)}
const cam=(px,py,pz,tx,ty,tz)=>`__freeze=true;__camera.children.forEach(c=>{if(c.type==='Group')c.visible=false});__camera.position.set(${px},${py},${pz});__camera.lookAt(${tx},${ty},${tz});__camera.updateMatrixWorld();__composer.render()`;
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态：钩子形态 + 稳态 0 draw =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let h=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
console.log('hanabi-default:',JSON.stringify(h));
ok('default-idle',h.on===false&&h.bursts.length===0&&h.particles===0&&h.visible===false,JSON.stringify(h));
const dd=JSON.parse(await evaljs(`(()=>{__freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  __composer.render();const a=__renderer.info.render.calls;__renderer.info.reset();
  __composer.render();const b=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();__unfreeze();
  return JSON.stringify({a,b,delta:b-a})})()`));
ok('steady-draw-0',dd.delta===0,JSON.stringify(dd));
// ===== 2 强制一组：5 发全绽 + 峰值 + 音景延迟窗（?q=0 锁级排除无头自动降档干扰）=====
await load('still=1&q=0');await evaljs('window.__hanabiLaunch()');
let full=null;
for(let i=0;i<80;i++){await sleep(500);
  full=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
  if(full.bursts.length===5&&full.bursts.every(b=>b.bloomed))break}
ok('five-bursts-all-bloomed',full&&full.bursts.length===5&&full.bursts.every(b=>b.bloomed),JSON.stringify(full&&full.bursts));
ok('boom-delay-window',full&&full.bursts.every(b=>b.boomDelay>=0.3&&b.boomDelay<=0.8),JSON.stringify(full&&full.bursts.map(b=>b.boomDelay)));
ok('peak-2000-window',full&&full.peak<=2000&&full.peak>=200,'peak='+full.peak+'（间隔 2-4s vs 花期 2.2s 重叠有限，峰值为并发上限口径）');
// ===== 3 绽放期三连拍（各机位，冻结取帧；q=0 会话）=====
// 3a 主打：桥+烟花+倒影（确定性双发取帧）
await load('still=1&q=0');
await evaljs('window.__hanabiFire("kiku",0,40)');await sleep(650);
await evaljs('window.__hanabiFire("botan",1,48)');await sleep(900);await evaljs('window.__hanabiFire("nidan",2,44)');
let mid=null;
for(let i=0;i<40;i++){await sleep(300);
  mid=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
  if(mid&&mid.particles>240)break}
await sleep(800);await evaljs(cam(78,10,36,89,17,50));await sleep(300);await shot('r58-hanabi-bridge');
await evaljs('__unfreeze()');
// 3b 双发同框（__hanabiFire 确定性双发 + draw 峰值增量当场测，池对=2）
await load('still=1&q=0');
await evaljs('window.__hanabiFire("kiku",0,40)');await sleep(650);
await evaljs('window.__hanabiFire("botan",1,48)');
let tw=null;
for(let i=0;i<40;i++){await sleep(300);
  tw=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
  if(tw.particles>230)break}
await sleep(1200);await evaljs(cam(78,10,36,89,20,48));await sleep(300);await shot('r58-twin');
{
  const d2=JSON.parse(await evaljs(`(()=>{__renderer.info.autoReset=false;__renderer.info.reset();
    __composer.render();const a=__renderer.info.render.calls;__renderer.info.reset();
    window.__hanabiRefs.forEach(g=>g.visible=false);__composer.render();const b=__renderer.info.render.calls;
    window.__hanabiRefs.forEach(g=>g.visible=true);
    __renderer.info.autoReset=true;__renderer.info.reset();
    return JSON.stringify({a,b,delta:a-b,vis:window.__hanabiRefs[0].visible,p:window.__hanabi().particles})})()`));
  ok('peak-draw-delta<=4',d2.delta>=2&&d2.delta<=4&&d2.vis===true,JSON.stringify(d2)+' (池对=2)');
}
await evaljs('__unfreeze()');
// 3c 柳垂尾（绽放后 1.9s 垂坠态）
await load('still=1&q=0');
await evaljs('window.__hanabiFire("yanagi",2,44)');
let yw=null;
for(let i=0;i<60;i++){await sleep(300);
  const raw=await evaljs('JSON.stringify(window.__hanabi())');
  yw=(raw&&typeof raw==='string')?JSON.parse(raw):null;
  if(yw&&yw.bursts.some(b=>b.type==='yanagi'&&b.bloomed))break}
await sleep(1900);
await evaljs(cam(78,10,36,89,14,46));await sleep(300);await shot('r58-willow');
await evaljs('__unfreeze()');
// ===== 5 烟花期 fps（无头参考，q=0 全池口径）=====
await load('still=1&q=0');await evaljs('window.__hanabiLaunch()');await sleep(6000);
const f1=await evaljsA('(async()=>{await new Promise(r=>requestAnimationFrame(r));let n=0;const t0=performance.now();while(performance.now()-t0<3000){await new Promise(r=>requestAnimationFrame(r));n++}return n})()');
const f2=await evaljsA('(async()=>{await new Promise(r=>requestAnimationFrame(r));let n=0;const t0=performance.now();while(performance.now()-t0<3000){await new Promise(r=>requestAnimationFrame(r));n++}return n})()');
ok('hanabi-fps>=30',Math.max(f1,f2)>=30,'fps best2='+Math.max(f1,f2));
// ===== 6 昼间无效 + 夜だけ提示条（解除锁级口径无关）=====
await load('time=day&still=1');
const dayRet=await evaljs('window.__hanabiLaunch()');
await sleep(400);
const tipTx=await evaljs('(document.getElementById("hanabiTip")||{}).textContent');
const hd=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
ok('day-invalid',dayRet===false&&hd.bursts.length===0&&hd.on===false,'ret='+dayRet+' bursts='+hd.bursts.length+' tip='+tipTx);
await evaljs('__setTarget(88,10,42);__setView(262,12,60)');await sleep(500);await shot('r58-day-invalid');
// ===== 7 W 键真实派发（夜）+ P 模式内可用 =====
await load('still=1');
await key('KeyW','w',87);await sleep(800);
h=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
ok('keyW-launches',h.on===true,'on='+h.on);
await load('still=1');await evaljs('window.__photo(true)');await sleep(500);
await key('KeyW','w',87);await sleep(800);
h=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
const ph=JSON.parse(await evaljs('JSON.stringify(window.__photo())'));
ok('photo-mode-W-works',h.on===true&&ph.on===true,'hanabi.on='+h.on+' photo.on='+ph.on);
await evaljs('window.__photo(false)');
// ===== 8 ?hanabi=1 进页 6s 自动一组 =====
await load('hanabi=1');
let auto=null;
for(let i=0;i<20;i++){await sleep(500);
  auto=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
  if(auto.on||auto.bursts.length>0)break}
ok('url-hanabi-auto',auto.on===true||auto.bursts.length>0,JSON.stringify({on:auto.on,bursts:auto.bursts.length}));
// ===== 9 夜晴+烟花（R49 起矩阵含夜晴）=====
await load('still=1&weather=clear');await evaljs('window.__hanabiLaunch()');
for(let i=0;i<60;i++){await sleep(400);
  const y=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
  if(y.particles>420)break}
await evaljs(cam(77,7,-22,89,12,34));await sleep(400);await shot('r58-clear-hanabi');
// ===== 10 L3 粒子减半 → 恢复 =====
await load('still=1');await evaljs('window.__perfLevel(3)');await sleep(300);
await evaljs('window.__hanabiLaunch()');await sleep(4500);
h=JSON.parse(await evaljs('JSON.stringify(window.__hanabi())'));
ok('L3-cap-1000',h.cap===1000&&h.peak<=1000,'cap='+h.cap+' peak='+h.peak);
await evaljs('window.__perfLevel(0)');
// ===== 11 三态矩阵 + 终检 =====
await load('still=1');await evaljs('__setTarget(88,12,40);__setView(248,14,70)');await sleep(500);await shot('r58-night-river');
await load('time=day&still=1');await evaljs('__setTarget(88,12,40);__setView(248,14,70)');await sleep(500);await shot('r58-day-river');
await load('still=1&weather=thunder');await evaljs('__setTarget(88,12,40);__setView(248,14,70)');await sleep(500);await shot('r58-thunder-river');
await load('');await sleep(2500);
err=await evaljs('window.__err.length');
ok('final-err0',err===0,'__err.length='+err);
const pass=results.filter(r=>r[1]).length;
console.log(`\nSUMMARY ${pass}/${results.length} PASS`);
ws.close();chrome.kill();
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(pass===results.length?0:1);
