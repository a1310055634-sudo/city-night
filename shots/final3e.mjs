// R60 补拍四（终轮）：三张按坐标精确重拍
// 教训入册：①相机扎楼内=黑块（R28 以来反复在册）②霓虹区招牌属 R06 建筑不参与 R45 打烊
// ③河 x82-100 需从东岸 x>100 往西看 ④银河塔楼泛光刺眼需避开西北角
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9361;
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_f3e_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run','--window-size=1680,945','about:blank'],{stdio:'ignore'});
async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw new Error('no chrome')}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,240);
  return r.result?.result?.value};
async function shot(name){const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(DIR+'/'+name+'.png',Buffer.from(s.result.data,'base64'));
  console.log('  -> '+name)}
async function until(expr,ms=9000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(200)}return false}
async function load(q){for(let a=0;a<3;a++){await send('Page.navigate',{url:`${URL0}?${q}`});
  if(await until('window.__ready===true',45000))return true;console.log('  retry '+(a+1))}return false}
const liveCam=`window.__liveCam=(px,py,pz,tx,ty,tz)=>{window.__lc={p:[px,py,pz],t:[tx,ty,tz]};
  if(!window.__lcHooked){window.__lcHooked=true;
    (function loop(){if(window.__lc){const L=window.__lc;
      __camera.position.set(L.p[0],L.p[1],L.p[2]);__camera.lookAt(L.t[0],L.t[1],L.t[2]);
      __controls.target.set(L.t[0],L.t[1],L.t[2]);__camera.updateMatrixWorld();}
    requestAnimationFrame(loop)})()}};`;

// ═══ ① 河上烟花：河 x82-100（18m 宽）、桥 z16、烟花 x86-89 z34-50
// 从东岸 x≈112 往西看：河面横向铺开、桥在左(z16)、烟花在河上方远处
console.log('=== A. 河+桥+烟花（东岸往西）===');
if(await load('time=night&q=0&still=1')){
  await evaljs(liveCam);
  const cands=[
    ['W1',116,7,20, 86,16,30],    // 河西南向，桥在左前、烟花在河上
    ['W2',124,10,34, 86,18,42],
    ['W3',110,5,10, 86,14,28],
    ['W4',130,13,44, 87,20,44],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(600);
    await evaljs('window.__hanabiFire("kiku",0,40);window.__hanabiFire("botan",1,48)');
    const ok=await until('(window.__hanabi&&__hanabi().bursts.filter(b=>b&&b.bloomed).length)>=2',7000);
    await sleep(850);await shot('f3try3-'+tag);
    console.log('     '+tag+' bloom='+ok);
    await sleep(5200);
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('A FAIL');

// ═══ ② 打烊商店街：主街 z=16 沿线（非霓虹区），路面上方看两侧店招
console.log('=== B. 打烊商店街 ===');
if(await load('time=night&flow=1&q=0&still=1')){
  await evaljs(liveCam);
  await evaljs('window.__setGameHour(23.7)');
  const ok=await until('(window.__shops&&__shops().closed)>=28',40000);
  const st=await evaljs('JSON.stringify(__shops())');
  console.log('  级联='+ok+' '+String(st).slice(0,140));
  const cands=[
    ['X1',-40,4.5,20, -20,3,16],   // 主街 z16 路面高度，沿街看店招
    ['X2',-20,3.5,23, 0,2.5,16],
    ['X3',-30,6,26, -14,3,16],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(800);await shot('f3try3-'+tag);
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('B FAIL');

// ═══ ③ 银河：从东南低机位望西北天空（避开西北角塔楼泛光），城市剪影压底
console.log('=== C. 银河 ===');
if(await load('time=night&weather=clear&q=0&still=1')){
  await evaljs(liveCam);
  const cands=[
    ['Y1',40,3,10, -20,48,-70],    // 望向西北天（塔楼在 -32,-64 远处但低机位使其贴近地平）
    ['Y2',20,2,20, -40,44,-50],
    ['Y3',60,4,-10, -10,50,-80],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(900);await shot('f3try3-'+tag);
  }
  console.log('  starOp='+await evaljs('(__stars&&__stars().starOp)'));
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('C FAIL');

ws.close();chrome.kill();await sleep(500);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);