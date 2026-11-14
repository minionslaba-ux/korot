// Картинки «Лесной почты» для Студии Пикабу Игр: снимает кадры прямо из игры и собирает
// icon-1024x1024.png (без текста), cover-1920x1080.jpg (с названием, без интерфейса), screen-1…5-1280x720.jpg (игра на телефоне + подпись).
// Зверята крупно — из promo/pikabu/src (рендер 512 px). Запуск: node tools/promo_pikabu.js
const {chromium,devices}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'promo','pikabu'),shots=path.join(out,'src');
const T={'.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.json':'application/json'};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})}).listen(8804);
const U='http://127.0.0.1:8804/';
(async()=>{const b=await chromium.launch();
  // ---- кадры из игры (телефон 390×844, x3)
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await ctx.addInitScript(()=>{const s=JSON.parse(localStorage.getItem('lesnaya-pochta-v1')||'null');if(!s)localStorage.setItem('lesnaya-pochta-v1',JSON.stringify({stars:Array(350).fill(0).map((_,i)=>i<230?3:0),introSeen:true,starterOffered:true,coins:3150,musicOff:true,sfxOff:true,chests:11}))});
  const g=await ctx.newPage();await g.goto(U+'pochta/');await g.waitForFunction('window.BOOTED');
  await g.evaluate(()=>{P.built=ITEMS.filter(i=>!i.v||i.v===1).map(i=>i.id);P.view='p';save();renderHome()});await g.waitForTimeout(3000);
  const snap=async n=>{await g.evaluate(()=>document.querySelectorAll('.legalbar,.toast').forEach(e=>e.remove()));await g.screenshot({path:path.join(shots,n+'.png'),clip:{x:0,y:0,width:390,height:780}})};
  await snap('g-home');
  await g.evaluate(()=>{P.view='v';save();renderHome()});await g.waitForTimeout(2500);await snap('g-village');
  await g.evaluate(()=>{P.view='p';save();renderHome()});
  const lvl=async(i,setup)=>{await g.evaluate(([i,s])=>{try{closeOv()}catch(e){}if(s)P.winStreak=8;startLevel(i)},[i,!!setup]);await g.waitForTimeout(3800);await g.evaluate(()=>{try{closeOv()}catch(e){}});await g.waitForTimeout(1500)};
  await lvl(152);await snap('g-level1');
  await lvl(+(process.env.LV2||281),true);await snap('g-level2');
  await lvl(118);await g.evaluate(()=>{moves=11;score=48210;win()});await g.waitForTimeout(2600);await snap('g-win');
  await ctx.close();
  // ---- сборка картинок
  const p=await b.newPage();await p.goto(U+'pochta/nope.html');
  const css=`@font-face{font-family:B;src:url(${U}pochta/assets/fonts/BalsamiqSans-700-cyrillic.woff2);unicode-range:U+0400-045F}@font-face{font-family:B;src:url(${U}pochta/assets/fonts/BalsamiqSans-700-latin.woff2);unicode-range:U+0000-00FF,U+2000-206F}
    @font-face{font-family:N;src:url(${U}pochta/assets/fonts/Nunito-400-cyrillic.woff2);unicode-range:U+0400-045F}@font-face{font-family:N;src:url(${U}pochta/assets/fonts/Nunito-400-latin.woff2);unicode-range:U+0000-00FF,U+2000-206F}
    *{margin:0;box-sizing:border-box}body{overflow:hidden;position:relative;font-family:N}
    .bg{position:absolute;inset:-40px;background:url(${U}pochta/assets/scene/base.jpg) center/cover;filter:blur(6px) saturate(1.2)}
    .title{font-family:B;color:#fff;-webkit-text-stroke:var(--st,14px) #1f5fae;paint-order:stroke fill;text-shadow:0 8px 0 #1f5fae,0 18px 40px #0009;line-height:1}
    .env{position:absolute;background:#fff;border-radius:22%;box-shadow:0 10px 0 #c9d6ea,0 18px 30px #0006;display:grid;place-items:center}
    .env svg{width:70%;height:70%}
    .phone{position:absolute;border-radius:46px;padding:12px;background:linear-gradient(145deg,#2c4677,#13254a);box-shadow:0 30px 60px #000a,inset 0 0 0 3px #ffffff25}
    .phone img{display:block;width:100%;border-radius:36px}
    .gem{position:absolute;filter:drop-shadow(0 8px 8px #0006)}`;
  const env=`<svg viewBox="0 0 100 100" fill="none" stroke="#e5484d" stroke-width="9" stroke-linejoin="round"><rect x="12" y="24" width="76" height="54" rx="8"/><path d="M14 28l36 28 36-28"/></svg>`;
  const pet=n=>`file://${shots}/pet-${n}.png`;const img=(f)=>'data:image/png;base64,'+fs.readFileSync(path.join(shots,f)).toString('base64');
  const gem=(set,i)=>`${U}pochta/assets/tiles/${set}/g${i}.png`;
  const render=async(w,h,html,file,type)=>{await p.setViewportSize({width:w,height:h});await p.setContent(`<style>${css}body{width:${w}px;height:${h}px}</style>${html}`);
    await p.evaluate(async()=>{await document.fonts.load('80px B','Лесная почта');await document.fonts.load('40px N','Три в ряд');await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})))});
    await p.waitForTimeout(150);await p.screenshot({path:path.join(out,file),type,...(type==='jpeg'?{quality:88}:{})})};
  const petsB64={};for(const n of ['bunny','fox','deer','hog','bee','cat','penguin','chick','beaver','panda'])petsB64[n]='data:image/png;base64,'+fs.readFileSync(path.join(shots,'pet-'+n+'.png')).toString('base64');
  // иконка
  await render(1024,1024,`<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,#8fd8ff,#3f8fe0 55%,#1f4fa8)"></div>
    <div style="position:absolute;left:-10%;right:-10%;bottom:-36%;height:62%;border-radius:50%;background:radial-gradient(ellipse at 50% 20%,#9be26a,#4fa63a 70%)"></div>
    <div style="position:absolute;left:50%;top:50%;width:720px;height:720px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff6b0aa,#fff6b000 65%)"></div>
    <img src="${petsB64.bunny}" style="position:absolute;left:162px;top:150px;width:700px;filter:drop-shadow(0 30px 30px #0007)">
    <div class="env" style="left:640px;top:150px;width:250px;height:250px;transform:rotate(14deg)">${env}</div>
    <img class="gem" src="${gem('summer',0)}" style="left:70px;top:720px;width:170px;transform:rotate(-12deg)">
    <img class="gem" src="${gem('summer',2)}" style="left:800px;top:740px;width:160px;transform:rotate(10deg)">`,'icon-1024x1024.png','png');
  // обложка
  const row=['fox','deer','hog','bee','cat','penguin','chick','beaver'];
  await render(1920,1080,`<div class="bg"></div><div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 70% at 50% 45%,#0d1b3320,#0d1b33aa 75%),linear-gradient(#0d1b3300 50%,#0d1b33d0)"></div>
    <div style="position:absolute;left:50%;top:40%;width:900px;height:900px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#ffe58a66,#ffe58a00 60%)"></div>
    <img src="${petsB64.bunny}" style="position:absolute;left:760px;top:40px;width:400px;filter:drop-shadow(0 24px 24px #0008)">
    <div class="env" style="left:1080px;top:70px;width:150px;height:150px;transform:rotate(14deg)">${env}</div>
    <div class="title" style="position:absolute;left:0;right:0;top:470px;text-align:center;font-size:190px;--st:20px">Лесная почта</div>
    <div style="position:absolute;left:0;right:0;top:700px;text-align:center;color:#fff;font:700 54px B;text-shadow:0 4px 12px #000b">Уютная головоломка «три в ряд»</div>
    <div style="position:absolute;left:0;right:0;bottom:40px;display:flex;justify-content:center;gap:26px">${row.map(n=>`<img src="${petsB64[n]}" style="width:170px;filter:drop-shadow(0 12px 12px #0008)">`).join('')}</div>
    ${[0,1,2,3,4].map(i=>`<img class="gem" src="${gem('summer',i)}" style="left:${[120,250,1520,1700,90][i]}px;top:${[180,400,160,480,800][i]}px;width:${[150,110,140,120,100][i]}px;transform:rotate(${[-14,10,12,-8,6][i]}deg)">`).join('')}`,'cover-1920x1080.jpg','jpeg');
  // скриншоты
  const S=[['g-level1','Собирай три в ряд','Доставляй письма лесным жителям: у каждого письма своя цель и свои ходы.'],
    ['g-home','Отстрой лесную почту','За звёзды чини почту, а жители, которым ты помог, переезжают к тебе.'],
    ['g-level2','35 видов препятствий','Паутина, лианы, сугробы, ульи, кроты, ветер и порталы — в каждой главе что-то новое.'],
    ['g-village','Деревня и звёздный холм','49 построек: после почты — целая деревня и звёздный холм.'],
    ['g-win','350 писем и турнир недели','Сундуки, звания, 28 достижений, открытки друзьям и турнир с призами.']];
  for(let k=0;k<S.length;k++){const [f,h,t]=S[k];const left=k%2===0;const px=left?150:820;
    await render(1280,720,`<div class="bg"></div><div style="position:absolute;inset:0;background:linear-gradient(${left?90:270}deg,#0d1b3355 0%,#0d1b33d8 55%)"></div>
      <div class="phone" style="left:${px}px;top:48px;width:312px"><img src="${img(f+'.png')}"></div>
      <div style="position:absolute;${left?'left:560px;right:60px':'left:70px;right:560px'};top:190px;color:#fff">
        <div class="title" style="font-size:66px;--st:10px;text-shadow:0 5px 0 #1f5fae,0 12px 30px #0009">${h}</div>
        <div style="margin-top:26px;font-size:32px;line-height:1.35;text-shadow:0 2px 10px #000c">${t}</div>
        <img src="${petsB64[['fox','beaver','hog','deer','bee'][k]]}" style="width:150px;margin-top:26px;filter:drop-shadow(0 10px 10px #0008)">
      </div>`,`screen-${k+1}-1280x720.jpg`,'jpeg')}
  await b.close();srv.close();console.log('готово:',fs.readdirSync(out).filter(f=>/\.(png|jpg)$/.test(f)).join(', '))})();
