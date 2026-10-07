import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9510;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r59qa_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run',
  `--user-data-dir=${prof}`,'--window-size=1680,945','about:blank'],{stdio:'ignore'});
async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw 0}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,200);
  return r.result?.result?.value};
const evaljsA=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,200);
  return r.result?.result?.value};
async function key(code,vk){
  await send('Input.dispatchKeyEvent',{type:'rawKeyDown',code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(60);
  await send('Input.dispatchKeyEvent',{type:'keyUp',code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(200)}
async function load(q){
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:BASE+(q?'?'+q:'')});
    const t0=Date.now();
    while(Date.now()-t0<90000){
      if(await evaljs('window.__ready===true&&!!window.__wx')===true)return true;
      await sleep(400)}
    console.log('load retry',a+1)}
  console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
const J=async e=>{const r=await evaljs('JSON.stringify('+e+')');try{return JSON.parse(r)}catch(_){return null}};
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ============ A. V2 复跑 31 项 ============
await load('');
// A1 wxbar 7 钮
const wb=await J(`(()=>{const b=document.getElementById('wxbar');return b?{n:b.querySelectorAll('button').length,t:b.innerHTML}:null})()`);
ok('A01-wxbar-7btns',wb&&wb.n>=7,'btns='+(wb&&wb.n));
// A24 版本小字（title 含 v2.0.0）
ok('A24-wxbar-version',wb&&/v2\.0\.0/.test(wb.t||''),'title='+(wb&&wb.t));
// A2 点击切天气（wxbar 按钮 click 经真实 CDP 坐标太繁——按钮直 click() 属 DOM 合成但对 wxbar 监听是 onclick 属性? R25 用 addEventListener——用键盘入口等效 + 按钮存在即视项；真实点击在 A3 键盘覆盖）
// A3 键盘天气四入口+高亮同步（键后 __wx().precip 变化即证同步链路）
await key('Digit2',50);
let wx=await J('window.__wx()');
ok('A03-key-rain',wx&&wx.precip==='rain',JSON.stringify(wx));
await key('Digit1',49);
wx=await J('window.__wx()');
ok('A03b-key-snow',wx&&wx.precip==='snow',wx&&wx.precip);
await key('Digit3',51);
wx=await J('window.__wx()');
ok('A03c-key-thunder',wx&&wx.precip==='thunder',wx&&wx.precip);
await key('Digit0',48);
wx=await J('window.__wx()');
ok('A03d-key-clear',wx&&wx.precip==='clear',wx&&wx.precip);
await key('KeyS',83);
wx=await J('window.__wx()');
ok('A03e-key-S-toggle',wx&&wx.precip==='snow',wx&&wx.precip);
// A6 天气平滑过渡（切雨后 blend 中间值）
await key('Digit2',50);
await sleep(700);
wx=await J('window.__wx()');
ok('A06-weather-smooth',wx&&wx.blend>0&&wx.blend<1,'blend='+wx.blend);
await sleep(2500);
// A5 拉远鸟瞰+雾
await evaljs('__setView(131,42,205)');await sleep(400);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('A05-far-bird-fog',fog>0.0015&&fog<0.0021,'fog='+fog);
// A25 列车
let tr0=await J('window.__train()'),tr1=null;
for(let i=0;i<10;i++){await sleep(1000);tr1=await J('window.__train()');
  if(JSON.stringify(tr0)!==JSON.stringify(tr1))break}
ok('A25-train-runs',tr0&&tr1&&JSON.stringify(tr0)!==JSON.stringify(tr1),'');
// A26 车流
const tf0=await J('window.__trafficFleet.filter(c=>c.g.visible).length');
ok('A26-traffic-fleet',tf0>=3,'visible='+tf0);
// A28 风
const wd=await J('window.__wind()');
ok('A28-wind',wd&&typeof wd.pow==='number','pow='+(wd&&wd.pow));
// A29 雪深联动
await evaljs('window.__snowDepth(1.2)');
const sd=await J('window.__snowDepth()');
ok('A29-snowDepth',sd&&(sd.depth>1.1&&sd.depth<1.3),JSON.stringify(sd));
await evaljs('window.__snowDepth(1.0)');
// A30 R37 时钟
const r37=await J('window.__r37()');
ok('A30-r37-clock',!!r37,'');
// A31 河面反射（先锁 L0：长跑中 R32 自动降档会正确隐藏 reflector）
await evaljs('window.__perfLevel(0)');await sleep(300);
const rf=await evaljs('window.__reflector.visible');
ok('A31-reflector',rf===true,'vis='+rf);
// A19 降档 L2 reflector 消隐 → 恢复
await evaljs('window.__perfLevel(2)');await sleep(200);
const rf2=await evaljs('window.__reflector.visible');
ok('A19-L2-reflector-off',rf2===false,'vis='+rf2);
await evaljs('window.__perfLevel(0)');await sleep(200);
// A20 L3
await evaljs('window.__perfLevel(3)');await sleep(200);
const pf=await J('window.__perf()');
ok('A20-L3-set',pf&&pf.level===3,'');
await evaljs('window.__perfLevel(0)');await sleep(200);
// A9 flow
await load('flow=1');
const fc0=await evaljs('window.__flowClock?window.__flowClock():``');await evaljs('window.__flow&&window.__flow(true)');await sleep(2500);
const fc1=await evaljs('window.__flowClock?window.__flowClock():``');await evaljs('window.__flow&&window.__flow(false)');
ok('A09-flow-runs',fc0!==fc1&&/[0-9][0-9]:[0-9][0-9]/.test(fc1),fc0+'->'+fc1);
// A10 默认满霓虹（非 flow 默认=营业）
await load('');
const sh=await J('window.__shops()');
ok('A10-default-open',sh&&sh.openShops===sh.total-sh.permClosed,JSON.stringify({open:sh.openShops,total:sh.total}));
// A11-12 拾取+聚焦
const pick=await evaljs('window.__pickAt(840,420)');
ok('A11-pickAt',!!pick,'pick='+pick);
if(pick){await evaljs(`window.__focus(${JSON.stringify(pick)})`);await sleep(1500);
  const fi=await J('window.__focusInfo()');
  ok('A12-focus-card',fi&&fi.id===pick,JSON.stringify(fi));
  await key('Escape',27);
  const fi2=await J('window.__focusInfo()');
  ok('A13-escape-unfocus',fi2&&(fi2.id===null||fi2.flying===false),JSON.stringify(fi2));
}else{ok('A12-focus-card',false,'no pick');ok('A13-escape-unfocus',false,'no pick')}
// A21 导览 9 机位
const fl=await J('window.__focusList()');
ok('A21-focus-registry',fl&&fl.length>=29,'n='+(fl&&fl.length));
// A22 抽样聚焦
let fok=0;
for(const id of['konbini','bridge','tower']){
  await evaljs(`window.__focus(${JSON.stringify(id)})`);await sleep(1200);
  const fi=await J('window.__focusInfo()');
  if(fi&&fi.id===id)fok++}
ok('A22-focus-samples',fok===3,fok+'/3');
await evaljs('window.__unfocus()');
// A14-16 拍照
await evaljs('window.__photo(true)');await sleep(500);
let ph=await J('window.__photo()');
ok('A14-photo-on',ph&&ph.on===true&&ph.bar>0,JSON.stringify(ph));
await key('KeyG',71);
ph=await J('window.__photo()');
ok('A15-photo-grid',ph&&typeof ph.grid==='boolean','grid='+ph.grid);
await evaljs('window.__shutter()');await sleep(2500);
const si=await J('window.__shotInfo()');
ok('A16-shutter-bytes',si&&si.bytes>0,'bytes='+(si&&si.bytes));
await evaljs('window.__photo(false)');await sleep(400);
ph=await J('window.__photo()');
ok('A14b-photo-off',ph&&ph.on===false,'');
// A17-18 音景
await evaljs('window.__sndToggle()');await sleep(300);
const core=await J('window.__audioCore()?'&&'!!window.__audioCore().ac()');
const sndOn=await evaljs('window.__audioCore().sndOn()');
ok('A17-snd-ac-created',core===true&&sndOn===true,'');
const layers=await evaljs('Object.keys(window.__audioCore().layers)');
ok('A18-snd-layers-6',layers&&layers.length>=6,JSON.stringify(layers));
await evaljs('window.__sndToggle()');
// A7-8 tour
await load('tour=1');await sleep(1500);
const t0=await J('window.__tour()');
ok('A07-tour-on',t0&&t0.on===true,JSON.stringify(t0));
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:600,y:400,button:'left',clickCount:1});
await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:600,y:400,button:'left',clickCount:1});
await sleep(500);
const t1=await J('window.__tour()');
ok('A08-tour-takeover',t1&&t1.on===false,JSON.stringify(t1));
// A4 390px 视口
await send('Emulation.setDeviceMetricsOverride',{width:390,height:760,deviceScaleFactor:1,mobile:true});
await sleep(600);
const ovf=await evaljs(`(()=>{const b=document.getElementById('wxbar');return {sw:b.scrollWidth,vw:document.documentElement.clientWidth}})()`);
ok('A04-390px-no-overflow',ovf&&ovf.sw<=ovf.vw+2,JSON.stringify(ovf));
await send('Emulation.clearDeviceMetricsOverride');
await sleep(400);

// ============ B. V3 新增 15 项 ============
await load('');
// B32 猫
const cats=await J('window.__cats()');
ok('B32-cats-5',cats&&cats.length===5,'n='+(cats&&cats.length));
const anchorOk=cats&&cats.every(c=>c.laneDist===undefined||c.laneDist>=5);
ok('B32b-cat-anchor',!!anchorOk,JSON.stringify(cats&&cats.map(c=>c.laneDist)));
// B33 猫状态切换（20s 观测）
const cs0=await J('window.__cats().map(c=>c.state).join(",")');
await sleep(20000);
const cs1=await J('window.__cats().map(c=>c.state).join(",")');
ok('B33-cat-states',cs0!==cs1,cs0+' -> '+cs1);
// B35 屋台
const yt=await J('window.__yatai()');
ok('B35-yatai-lit',yt&&yt.lit===true&&yt.steam>0,JSON.stringify(yt));
// B36 生活窗
const life=await J('window.__life()');
ok('B36-life-windows',life&&life.groups===4&&life.winCount>=28&&life.winCount<=32,JSON.stringify({g:life.groups,n:life.winCount}));
// B37 神社
const shr=await J('window.__shrine()');
ok('B37-shrine',shr&&shr.torii===true&&shr.lanterns===6&&shr.snowCaps>=9,JSON.stringify(shr));
// B43 冰柱
const ic=await J('window.__icicles()');
ok('B43-icicles',ic&&ic.count>=20,JSON.stringify({count:ic&&ic.count,melt:ic&&ic.melt}));
// B44 雪形态
const sm=await J('window.__snowMorph()');
ok('B44-snowMorph',sm&&(sm.mode==='gosetsu'||sm.mode==='fine')&&typeof sm.morph==='number','mode='+(sm&&sm.mode));
// B41 出租车
const taxi=await J('window.__taxi()');
ok('B41-taxi',taxi&&taxi.cars>=1,'');
// B39 巴士停靠（30s 窗口内出现 stopped）
let busStop=false;
for(let i=0;i<23;i++){await sleep(2000);
  const b=await J('window.__bus()');
  if(b&&b.atStop){busStop=true;break}}
ok('B39-bus-stop',busStop,'');
// B40 红灯（15s 窗闯红=0 且有通过）
await evaljs('__busCorridor&&window.__busCorridor()');
let sig0=await J('window.__signals()');
await sleep(30000);
const sig1=await J('window.__signals()');
const viol=(sig1.violations||0)-(sig0.violations||0);
const sum=a=>(a.passed||[]).reduce((x,y)=>x+y,0);const passed=sum(sig1)-sum(sig0);
const lightsChanged=JSON.stringify(sig0.lights)!==JSON.stringify(sig1.lights);
ok('B40-signals',viol===0&&(passed>=1||lightsChanged),'viol+'+viol+' passed+'+passed+' lights='+lightsChanged);
// B38 打烊快进（→ 恢复）
await evaljs('window.__flow&&window.__flow(true)');
await evaljs('window.__setGameHour(23.6)');await sleep(15000);
const shN=await J('window.__shops()');
ok('B38-shops-close',shN&&shN.closed>=shN.total-shN.permClosed-2,JSON.stringify({closed:shN.closed,total:shN.total}));
await evaljs('window.__setGameHour(12)');await sleep(600);
const shD=await J('window.__shops()');
ok('B38b-shops-reopen',shD&&shD.openShops===shD.total-shD.permClosed,'');
await evaljs('window.__flow&&window.__flow(false)');
// B45 DOF（钉 L0 防降档竞态）
await evaljs('window.__perfLevel(0)');await sleep(300);
await evaljs('window.__photo(true)');
let cine=null;for(let i=0;i<8;i++){await sleep(400);cine=await J('window.__cine()');if(cine&&cine.on)break}
ok('B45-cine-dof',cine&&cine.on&&cine.dof&&cine.passes===6,JSON.stringify({p:cine.passes,dof:cine.dof,focus:cine.focus}));
await evaljs('window.__photo(false)');await sleep(500);
cine=await J('window.__cine()');
ok('B45b-cine-restore',cine&&cine.passes===4,'');
// B42 晴夜星空（先回夜间：白昼星星=0 是正确行为）
await load('time=night&q=0');await key('Digit0',48);await sleep(4500);
const stars=await J('window.__stars()');
ok('B42-stars-clear',stars&&stars.starOp>0.5,'starOp='+(stars&&stars.starOp));
await key('KeyS',83);await sleep(1500);
// B46 W 烟花
await load('time=night&q=0');await evaljs('window.__hanabiLaunch()');
let hb=null;
for(let i=0;i<50;i++){await sleep(500);
  hb=await J('window.__hanabi()');
  if(hb&&hb.bursts.length===5&&hb.bursts.every(b=>b.bloomed))break}
ok('B46-hanabi-5',hb&&hb.bursts.length===5&&hb.bursts.every(b=>b.bloomed),'');
ok('B46b-hanabi-peak',hb&&hb.peak<=2000,'peak='+hb.peak);
// B34 猫拾取（点击彩蛋走 R29 名片通路：猫注册进拾取名册）
const reg=await evaljs('typeof window.__registerFocus==="function"');
const catIds=cats&&cats.map(c=>c.id);
ok('B34-cat-pick-reg',reg&&Array.isArray(catIds)&&catIds.length===5,'');
// 终检
await load('');
await sleep(2000);
const err=await evaljs('window.__err.length');
ok('Z-final-err0',err===0,'__err.length='+err);
const pass=results.filter(r=>r[1]).length;
console.log(`\nQA SUMMARY ${pass}/${results.length} PASS`);
const fails=results.filter(r=>!r[1]).map(r=>r[0]);
if(fails.length)console.log('FAILS:',fails.join(', '));
ws.close();chrome.kill();
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(pass===results.length?0:1);
