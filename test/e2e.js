// SimPass uçtan uca test: gerçek Electron penceresinde kurulum, kilit, yedek, taşıma vb. adımlarını dener.
// Linux'ta: xvfb-run -a npx electron --no-sandbox test/e2e.js
const {app,dialog,clipboard,nativeTheme}=require('electron');
const path=require('path'),fs=require('fs'),os=require('os');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'simpass-'));
app.setPath('userData',tmp);
let nextSave=null,nextOpen=null;
dialog.showSaveDialog=async()=>({canceled:!nextSave,filePath:nextSave});
dialog.showOpenDialog=async()=>({canceled:!nextOpen,filePaths:nextOpen?[nextOpen]:[]});
require('../src/main.js');
const {BrowserWindow}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[],errs=[];
const log=(k,v)=>{out.push(k+': '+v);console.log('TEST',k+':',v)};
app.whenReady().then(async()=>{
 await sleep(500);const w=BrowserWindow.getAllWindows()[0];
 w.webContents.on('console-message',(e,lvl,msg)=>{if(lvl>=2)errs.push(msg)});
 w.webContents.on('render-process-gone',(e,d)=>errs.push('GONE '+d.reason));
 const ev=c=>w.webContents.executeJavaScript(c);
 const until=async(c,t=15000)=>{const s=Date.now();while(Date.now()-s<t){if(await ev(c))return true;await sleep(150)}return false};
 const shot=async n=>{await sleep(400);const img=await w.webContents.capturePage();fs.writeFileSync(path.join(process.env.SHOTS||os.tmpdir(),'simpass-'+n+'.png'),img.toPNG())};
 const fillPw=(i,v)=>ev(`(()=>{const e=document.querySelectorAll('input[type=password]')[${i}];e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
 const vault=path.join(tmp,'kasa-verileri.vault');
 try{
  await until('document.readyState=="complete"&&!!document.querySelector(".card h1")');
  log('başlık',await ev('document.querySelector(".card h1").textContent'));
  log('kurulum ekranı (2 parola alanı)',await ev('document.querySelectorAll("input[type=password]").length==2'));
  await shot('01-kurulum');
  // kısa parola reddedilir
  await fillPw(0,'kisa');await fillPw(1,'kisa');await ev('document.querySelector("input[type=checkbox]").click();document.querySelector("button.p.w").click()');await sleep(300);
  log('kısa parola hatası',await ev('document.querySelector(".err").textContent'));
  const PW='Test-Ana-Parola-2026!';
  await fillPw(0,PW);await fillPw(1,PW);await ev('document.querySelector("button.p.w").click()');
  log('kurulum sonrası liste açıldı',await until('!!document.querySelector("#list")'));
  log('kasa dosyası oluştu',fs.existsSync(vault));
  // örnek kayıtlar
  await ev(`(()=>{const now=Date.now(),old=now-400*864e5;const mk=(t,n,p,f,u)=>({id:crypto.randomUUID(),t,url:'https://'+t.toLowerCase()+'.com',n,p,nt:'',f:f?1:0,u:u||now});
   items.push(mk('Netflix','ayse@mail.com','123456',1),mk('Spotify','ayse@mail.com','123456',0),mk('Banka','ayse','k7#Qv9!zLp2@xRt8Wm',1),mk('GitHub','ayse-dev','tomato55apple',0),mk('Amazon','ayse@mail.com','Xk3$pL9#mQ2vR7!n',0,old),mk('Forum','ayse','Password123!',0),mk('Steam','ayse','qwerty',0),mk('Mail','ayse@mail.com','Zr8&wN4*tK1@yH6^',1));render();persist()})()`);
  await sleep(800);
  const raw=fs.readFileSync(vault,'utf8');
  log('dosyada düz metin yok',!/Netflix|ayse|123456|tomato/.test(raw));
  log('dosya biçimi',Object.keys(JSON.parse(raw)).join(','));
  await shot('02-liste');
  // kilitle ve yanlış parola
  await ev('lock()');await until('document.querySelectorAll("input[type=password]").length==1');
  await fillPw(0,'yanlis-parola-123');await ev('document.querySelector("button.p.w").click()');await until('document.querySelector(".err").textContent.length>0');
  log('yanlış parola',await ev('document.querySelector(".err").textContent'));
  await shot('03-kilit');
  await fillPw(0,PW);await ev('document.querySelector("button.p.w").click()');
  log('doğru parola ile açıldı',await until('!!document.querySelector("#list .item")'));
  log('kayıt sayısı (8 bekleniyor)',await ev('document.querySelectorAll("#list .item").length'));
  log('favori kartlar (3)',await ev('document.querySelectorAll("#list .item.fav").length'));
  log('nokta sayısı',await ev('document.querySelectorAll("#list .dt").length'));
  log('"false"/"0" artığı yok',!(await ev('/(^|\\s)(false|0)(\\s|$)/.test([...document.querySelectorAll("#list .item .meta b")].map(b=>b.textContent).join(" "))')));
  await ev('setFav(true)');log('favoriler filtresi (3)',await ev('document.querySelectorAll("#list .item").length'));await shot('04-favoriler');await ev('setFav(false)');
  await ev('audit()');await sleep(300);log('şifre kontrolü satırı',await ev('document.querySelectorAll(".alist .arow").length'));await shot('05-sifre-kontrol');
  await ev('document.querySelector(".ov").remove()');
  await ev('settings()');await sleep(300);await shot('06-ayarlar');await ev('document.querySelector(".ov").remove()');
  await ev('editor(items[0])');await sleep(300);await shot('07-duzenle');await ev('document.querySelector(".ov").remove()');
  // koyu tema
  nativeTheme.themeSource='dark';await sleep(500);await shot('08-koyu');await ev('lock()');await sleep(400);await shot('09-koyu-kilit');nativeTheme.themeSource='light';
  await fillPw(0,PW);await ev('document.querySelector("button.p.w").click()');await until('!!document.querySelector("#list .item")');
  // IPC: kopyala, kaydet, taşı, aç
  await ev('simpass.copy("gizli-parola-xyz")');log('pano',(await clipboard.readText())==='gizli-parola-xyz');
  nextSave=path.join(tmp,'yedek.json');log('yedek kaydı',JSON.stringify(await ev('simpass.save("yedek.json",JSON.stringify({a:1}))')));log('yedek dosyası',fs.existsSync(nextSave));
  const moved=path.join(tmp,'altklasor','tasinan.vault');nextSave=moved;
  const mv=await ev('simpass.move()');log('taşıma',JSON.stringify(mv));log('eski dosya silindi',!fs.existsSync(vault));log('yeni dosya var',fs.existsSync(moved));
  log('info yeni yol',(await ev('simpass.info()')).path===moved);
  await ev('persist()');await sleep(500);log('taşıdıktan sonra yazma yeni dosyaya',fs.statSync(moved).size>100&&!fs.existsSync(vault));
  await ev('lock()');await until('document.querySelectorAll("input[type=password]").length==1');await fillPw(0,PW);await ev('document.querySelector("button.p.w").click()');
  log('taşınan dosyadan açıldı',await until('!!document.querySelector("#list .item")'));
  // başka dosya aç (choose)
  const copy2=path.join(tmp,'kopya.vault');fs.copyFileSync(moved,copy2);nextOpen=copy2;
  log('choose',JSON.stringify(await ev('simpass.choose("open")')));
  nextOpen=path.join(tmp,'yedek.json');
  let bad='';try{await ev('simpass.choose("open")')}catch(e){bad=e.message}log('geçersiz dosya reddi',bad);
  // ağ engeli
  log('ağ isteği engelli',await ev('fetch("https://example.com").then(()=>false,()=>true)'));
  // bozuk dosya
  fs.writeFileSync(copy2,'{bozuk');let rd='';try{await ev('simpass.read()')}catch(e){rd=e.message}log('bozuk dosya hatası',rd);
  // silme
  await ev('simpass.remove()');log('silme',!fs.existsSync(copy2));
 }catch(e){log('HATA',e.stack||e.message)}
 log('konsol hataları',errs.length?errs.join(' | '):'yok');
 const fail=out.filter(l=>/: false$/.test(l)||l.startsWith('HATA'));console.log(fail.length?'BAŞARISIZ: '+fail.join(' | '):'TÜM TESTLER GEÇTİ');
 app.exit(fail.length?1:0);
});
