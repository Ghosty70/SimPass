
const $=s=>document.querySelector(s),enc=new TextEncoder(),dec=new TextDecoder();
const b64=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function h(t,a,...c){const e=document.createElement(t);for(const k in a||{}){const v=a[k];if(k=='class')e.className=v;else if(k=='html')e.innerHTML=v;else if(k=='value'||k=='checked'||k=='disabled')e[k]=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!=null&&v!==false)e.setAttribute(k,v)}c.flat().forEach(x=>x!=null&&x!==false&&x!==0&&e.append(x));return e}
const root=$('#app');
let key,salt,items=[],idleT,cbT,tT,hiddenAt=0,syncEl,cntEl,allN,favN,segAll,segFav,favOnly=false,notice='',vinfo={},lastSaved=0;
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),2800)}
function show(n){root.replaceChildren(n)}
const tick=()=>new Promise(r=>setTimeout(r,40));
async function dl(name,data){try{const r=await simpass.save(name,data);r&&r.saved&&toast('Kaydedildi')}catch(e){toast('Kaydedilemedi: '+e.message)}}
let hl=0;document.addEventListener('pointermove',e=>{if(hl)return;const t=e.target,x=e.clientX,y=e.clientY;hl=requestAnimationFrame(()=>{hl=0;const g=t.closest&&t.closest('.glass:not(.nohl)');if(g){const r=g.getBoundingClientRect();g.style.setProperty('--mx',(x-r.left)+'px');g.style.setProperty('--my',(y-r.top)+'px')}})},{passive:true});

/* ---- depolama: Windows'ta kasa dosyası (ana süreç yazar) ---- */
const S={async read(){return await simpass.read()},async write(d){await simpass.write(d)}};

/* ---- şifreleme ---- */
async function derive(pw,s){const m=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:s,iterations:600000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function seal(){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(items)));return{v:1,salt:b64(salt),iv:b64(iv),ct:b64(ct),saved:Date.now()}}
async function open(d,k){return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(d.iv)},k||key,unb64(d.ct))))}
function merge(a,b){const m=new Map();[...a,...b].forEach(x=>{const o=m.get(x.id);if(!o||(x.u||0)>(o.u||0))m.set(x.id,x)});const cut=Date.now()-30*864e5;return[...m.values()].filter(x=>!x.del||x.u>cut)}
let chain=Promise.resolve();
function persist(){return chain=chain.then(async()=>{if(!key)return;try{const cur=await S.read();
 if(cur&&cur.saved!==lastSaved){try{items=merge(await open(cur),items)}catch{throw new Error('kasa dosyası başka anahtarla değişmiş')}}
 const d=await seal();await S.write(d);lastSaved=d.saved;setSync(true);render()}catch(e){setSync(false,e.message)}})}
async function refresh(){if(!key)return;try{const d=await S.read();if(d&&d.saved!==lastSaved){items=merge(await open(d),items);lastSaved=d.saved;render()}}catch{}}
function setSync(ok,m){if(!syncEl)return;syncEl.textContent=ok?'● Kaydedildi':'● Kaydedilemedi: '+(m||'');syncEl.style.color=ok?'var(--ok)':'var(--bad)';syncEl.style.display='inline'}

/* ---- giriş ---- */
async function init(){try{vinfo=await simpass.info();authView(vinfo.exists?'unlock':'setup')}catch(e){show(h('div',{class:'glass card center'},h('h2',{},'Başlatılamadı'),h('p',{class:'m'},e.message)))}}
const STR=[['Çok zayıf','#b91c1c',10],['Zayıf','#dc2626',25],['Orta','#b45309',50],['Güçlü','#15803d',75],['Çok güçlü','#166534',100]];
const COMMON=['password','parola','sifre','şifre','qwerty','123456','12345678','abc123','admin','letmein','welcome','iloveyou','istanbul','ankara','galatasaray','fenerbahce','besiktas','trabzonspor','sevgilim','canim'];
const SEQ=/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|asdf|zxcv|1111|0000)/i;
function bits(p){if(!p)return 0;let c=0;/[a-z]/.test(p)&&(c+=26);/[A-Z]/.test(p)&&(c+=26);/\d/.test(p)&&(c+=10);/[^A-Za-z0-9]/.test(p)&&(c+=32);let b=p.length*Math.log2(c||1);const lp=p.toLowerCase();
 if(COMMON.includes(lp))return 0;if(COMMON.some(w=>lp.includes(w)))b*=.45;if(SEQ.test(p))b*=.7;if(new Set(p).size<=p.length/3)b*=.5;return b}
function strength(p){const b=bits(p);return b<28?0:b<40?1:b<60?2:b<80?3:4}
function meter(){const i=h('i'),b=h('div',{class:'bar'},i),l=h('div',{class:'m'});return{el:[b,l],set(p){const s=STR[strength(p)];i.style.width=p?s[2]+'%':'0';i.style.background=s[1];l.textContent=p?'Güç: '+s[0]:''}}}
const head=(t,sub)=>[h('div',{class:'lens',html:LOCK}),h('h1',{class:'t'},t),h('p',{class:'m t',style:'margin-bottom:16px'},sub)];
async function chooseOpen(){try{const r=await simpass.choose('open');if(r&&r.path){vinfo=await simpass.info();authView(vinfo.exists?'unlock':'setup')}}catch(e){toast('Dosya açılamadı: '+e.message)}}
function authView(mode){
 const setup=mode=='setup';
 const pw=h('input',{type:'password',placeholder:'Ana parola',autocomplete:setup?'new-password':'current-password'}),pw2=h('input',{type:'password',placeholder:'Ana parolayı tekrar yazın',autocomplete:'new-password'}),
 chk=h('input',{type:'checkbox'}),er=h('div',{class:'err'}),m=meter(),btn=h('button',{class:'p w'},setup?'Kasayı oluştur':'Kilidi aç');
 pw.addEventListener('input',()=>setup&&m.set(pw.value));
 async function go(){er.textContent='';
  if(setup){if(pw.value.length<12)return er.textContent='Ana parola en az 12 karakter olmalı.';if(pw.value!==pw2.value)return er.textContent='Parolalar eşleşmiyor.';if(!chk.checked)return er.textContent='Lütfen uyarıyı onaylayın.'}
  else if(!pw.value)return;
  btn.disabled=true;const lbl=btn.textContent;btn.textContent='Anahtar türetiliyor…';await tick();
  try{if(setup){salt=crypto.getRandomValues(new Uint8Array(16));key=await derive(pw.value,salt);items=[];const d=await seal();await S.write(d);lastSaved=d.saved}
   else{let d;try{d=await S.read()}catch(e){throw new Error('Dosya okunamadı: '+e.message)}
    if(!d)throw new Error('Kasa dosyası bulunamadı. Aşağıdan başka bir dosya seçin.');salt=unb64(d.salt);const k=await derive(pw.value,salt);try{items=await open(d,k);key=k;lastSaved=d.saved}catch{throw new Error('Ana parola yanlış.')}}
   start()}catch(e){key=null;er.textContent=e.message;btn.disabled=false;btn.textContent=lbl}}
 btn.onclick=go;[pw,pw2].forEach(i=>i.addEventListener('keydown',e=>e.key=='Enter'&&go()));
 show(h('div',{class:'glass card center'},head('SimPass',setup?'Ana parolanızı belirleyin.':'Kilidi açmak için ana parolanızı girin.'),
  notice&&h('p',{class:'m',style:'color:var(--ok)'},notice),
  setup&&h('p',{class:'m'},'Parolalarınız bu bilgisayarda, ana parolanızla şifrelenerek saklanır. İnternete hiçbir şey gönderilmez.'),
  pw,setup&&m.el,setup&&pw2,setup&&h('label',{class:'c'},chk,h('span',{},'Ana parolamı unutursam kasamın kurtarılamayacağını anlıyorum.')),er,btn,
  h('div',{class:'row sp',style:'margin-top:12px'},h('span',{class:'m',style:'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'},setup?'':'Dosya: '+(vinfo.name||'')),
   h('button',{class:'link',onclick:chooseOpen},setup?'Mevcut kasa dosyam var':'Başka kasa dosyası'))));
 notice='';pw.focus()}

/* ---- ana ekran ---- */
function start(){buildApp();idle();render();setSync(true)}
function lock(){clearTimeout(idleT);key=null;items=[];syncEl=null;document.querySelectorAll('.ov').forEach(e=>e.remove());simpass.info().then(i=>{vinfo=i;authView(i.exists?'unlock':'setup')}).catch(()=>authView('unlock'))}
function idle(){clearTimeout(idleT);if(key)idleT=setTimeout(()=>{notice='Hareketsizlik nedeniyle kilitlendi.';lock()},5*60e3)}
['pointerdown','keydown','scroll'].forEach(e=>addEventListener(e,idle,{passive:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(key){if(hiddenAt&&Date.now()-hiddenAt>120e3)lock();else refresh()}});
function setFav(v){favOnly=v;segAll.classList.toggle('on',!v);segFav.classList.toggle('on',v);render()}
function buildApp(){allN=h('span',{class:'n'},'0');favN=h('span',{class:'n'},'0');favOnly=false;
 segAll=h('button',{class:'on',onclick:()=>setFav(false)},'Tümü',allN);segFav=h('button',{class:'gold',onclick:()=>setFav(true)},'★ Favoriler',favN);syncEl=h('span',{class:'dot'});cntEl=h('div',{class:'m',style:'margin:0'});
 show(h('div',{},h('div',{class:'top glass'},h('div',{style:'flex:1;min-width:0'},h('h1',{},'SimPass'),cntEl),syncEl,h('button',{class:'s',onclick:settings,'aria-label':'Ayarlar'},'Ayarlar'),h('button',{class:'s',onclick:lock},'Kilitle')),h('div',{id:'warn'}),
  h('div',{class:'row',style:'margin-bottom:12px'},h('input',{id:'q',type:'search',placeholder:'Ara…',style:'margin:0',oninput:render}),h('button',{class:'p',style:'white-space:nowrap',onclick:()=>editor()},'+ Ekle')),h('div',{class:'seg'},segAll,segFav),h('div',{id:'list'})))}
function backupWarn(){}
function render(){const L=$('#list');if(!L||!key)return;backupWarn();const q=$('#q').value.trim().toLowerCase(),live=items.filter(x=>!x.del);cntEl&&(cntEl.textContent=live.length+' kayıt');const nf=live.filter(x=>x.f).length;allN&&(allN.textContent=live.length);favN&&(favN.textContent=nf);
 const cnt=new Map();live.forEach(x=>x.p&&cnt.set(x.p,(cnt.get(x.p)||0)+1));
 const DOT=['#b91c1c','#ef4444','#facc15','#22c55e','#15803d'];
 const dotsOf=x=>{const d=h('div',{class:'dots'});if(x.p){const lv=strength(x.p),n=cnt.get(x.p);
  const mk=(c,tip)=>h('span',{class:'dt',style:'background:'+c,'data-tip':tip,tabindex:'0',role:'img','aria-label':tip,onclick:e=>e.stopPropagation()});
  d.append(mk(DOT[lv],'Parola gücü: '+STR[lv][0]));if(n>1)d.append(mk('#f97316','Tekrar kullanılıyor · '+n+' kayıtta aynı'))}return d};
 const l=live.filter(x=>(!favOnly||x.f)&&(!q||[x.t,x.url,x.n,x.nt].join(' ').toLowerCase().includes(q))).sort((a,b)=>(b.f|0)-(a.f|0)||(a.t||'').localeCompare(b.t||'','tr'));
 if(!l.length)return L.replaceChildren(h('div',{class:'empty'},favOnly&&live.length&&!nf?[h('b',{},'Henüz favori kaydınız yok'),h('span',{class:'m'},'Bir kaydı düzenlerken “Favori” kutusunu işaretleyin.'),h('button',{onclick:()=>setFav(false)},'Tüm kayıtları göster')]:live.length?'Sonuç bulunamadı.':[h('b',{},'Kasanız henüz boş'),h('button',{class:'p',onclick:()=>editor()},'İlk parolanı ekle'),h('span',{class:'m'},'Chrome, Google veya Proton’dan geliyorsanız Ayarlar’dan CSV dosyanızı içe aktarabilirsiniz.')]));
 L.replaceChildren(...l.map(x=>{return h('div',{class:'item'+(x.f?' fav':''),onclick:()=>editor(x)},dotsOf(x),h('div',{class:'av'},(x.t||'?')[0].toUpperCase()),
  h('div',{class:'meta'},h('b',{},x.f?h('span',{class:'star'},'★ '):null,x.t||x.url),h('span',{},x.n||x.url||'')),
  h('div',{class:'acts'},x.n&&h('button',{class:'s',onclick:e=>{e.stopPropagation();copy(x.n,'Kullanıcı adı')}},'Kullanıcı'),h('button',{class:'s',onclick:e=>{e.stopPropagation();copy(x.p,'Parola')}},'Parola')))}))}
async function copy(t,l){try{await simpass.copy(t);toast(l+' kopyalandı (30 sn sonra panodan silinir)')}catch(e){toast('Kopyalanamadı')}}

/* ---- modal / onay ---- */
function modal(...c){const o=h('div',{class:'ov'},h('div',{class:'glass card nohl'},...c));o.addEventListener('mousedown',e=>{if(e.target==o)o.remove()});document.body.append(o);return o}
function ask(msg,okText){return new Promise(r=>{const o=modal(h('p',{style:'margin-top:0'},msg),h('div',{class:'row sp'},h('button',{onclick:()=>{o.remove();r(false)}},'Vazgeç'),h('button',{class:'p',onclick:()=>{o.remove();r(true)}},okText||'Evet')))})}

/* ---- parola üretici ---- */
function gen(len,sym){const L='abcdefghijkmnopqrstuvwxyz',U='ABCDEFGHJKLMNPQRSTUVWXYZ',D='23456789',S2='!@#$%^&*-_=+?',sets=[L,U,D].concat(sym?[S2]:[]),all=sets.join('');
 const r=n=>{const a=new Uint32Array(1),lim=Math.floor(2**32/n)*n;do crypto.getRandomValues(a);while(a[0]>=lim);return a[0]%n};
 const o=sets.map(s=>s[r(s.length)]);while(o.length<len)o.push(all[r(all.length)]);for(let i=o.length-1;i>0;i--){const j=r(i+1);[o[i],o[j]]=[o[j],o[i]]}return o.join('')}

/* ---- kayıt düzenleyici ---- */
function editor(x){const nw=!x;x=x?{...x}:{id:crypto.randomUUID(),t:'',url:'',n:'',p:'',nt:'',f:0};
 const f=(l,k,o={})=>{const i=h(o.area?'textarea':'input',{value:x[k]||'',placeholder:o.ph||'',type:o.type||'text',autocomplete:'off',rows:o.area?3:null,autocapitalize:'off',spellcheck:'false'});i.addEventListener('input',()=>x[k]=i.value);return[h('label',{},l),i]};
 const fT=f('Başlık','t',{ph:'ör. Netflix'}),fU=f('Web sitesi','url',{ph:'https://…'}),fN=f('Kullanıcı adı / e-posta','n'),fP=f('Parola','p',{type:'password'}),fNt=f('Notlar','nt',{area:1});
 const pi=fP[1],m=meter(),len=h('input',{type:'number',value:20,min:8,max:64,style:'width:72px'}),sy=h('input',{type:'checkbox',checked:true}),er=h('div',{class:'err'});
 pi.addEventListener('input',()=>m.set(pi.value));m.set(x.p);
 const o=modal(h('h2',{},nw?'Yeni kayıt':'Kaydı düzenle'),fT,fU,fN,fP,m.el,
  h('div',{class:'row',style:'margin:6px 0 12px;flex-wrap:wrap'},h('button',{class:'s',onclick:()=>pi.type=pi.type=='password'?'text':'password'},'Göster/Gizle'),h('button',{class:'s',onclick:()=>{pi.value=gen(Math.min(64,Math.max(8,+len.value||20)),sy.checked);x.p=pi.value;pi.type='text';m.set(pi.value)}},'Güçlü parola üret'),len,h('label',{class:'c',style:'margin:0'},sy,'Sembol')),
  fNt,h('label',{class:'c'},h('input',{type:'checkbox',checked:!!x.f,onchange:e=>x.f=e.target.checked?1:0}),'Favori'),er,
  h('div',{class:'row sp'},nw?h('span'):h('button',{class:'d',onclick:async()=>{if(await ask('Bu kayıt silinecek.','Sil')){const i=items.findIndex(z=>z.id==x.id);items[i]={id:x.id,del:true,u:Date.now()};o.remove();render();persist()}}},'Sil'),
   h('div',{class:'row'},h('button',{onclick:()=>o.remove()},'İptal'),h('button',{class:'p',onclick:()=>{if(!x.t.trim()&&!x.url.trim())return er.textContent='Başlık veya web sitesi girin.';
    if(!x.t.trim())try{x.t=new URL(/^https?:/.test(x.url)?x.url:'https://'+x.url).hostname.replace(/^www\./,'')}catch{x.t=x.url}
    x.u=Date.now();const i=items.findIndex(z=>z.id==x.id);i<0?items.push(x):items[i]=x;o.remove();render();persist()}},'Kaydet'))));
 fT[1].focus()}

/* ---- yedek / CSV / ayarlar ---- */
async function backup(){const d=await S.read();if(!d)return;await dl('simpass-yedek-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(d))}
async function restore(file){try{const d=JSON.parse(await file.text());if(!(d&&d.v==1&&d.salt&&d.iv&&d.ct))throw 0;
 if(!await ask('Mevcut kasanın yerine bu yedek konacak. Yedeğin ana parolası ile kilidi açacaksınız.','Geri yükle'))return;
 await S.write(d);notice='Yedek yüklendi. Yedeğin ana parolasını girin.';lock()}catch{toast('Geçerli bir SimPass yedeği değil')}}
function csvParse(t){const r=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}else if(c=='"')q=true;else if(c==','){row.push(f);f=''}else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;row.push(f);f='';if(row.some(v=>v))r.push(row);row=[]}else f+=c}row.push(f);if(row.some(v=>v))r.push(row);return r}
const csvq=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
function importCsv(file){const rd=new FileReader();rd.onload=()=>{const rows=csvParse(String(rd.result).replace(/^\uFEFF/,''));if(rows.length<2)return toast('Dosya boş veya geçersiz');
 const hd=rows[0].map(s=>s.trim().toLowerCase()),g=(r,...ns)=>{for(const n of ns){const i=hd.indexOf(n);if(i>=0&&r[i])return r[i]}return''};let add=0;
 rows.slice(1).forEach(r=>{const p=g(r,'password','login_password');if(!p)return;const url=g(r,'url','login_uri','website'),n=g(r,'username','login_username','email','login');
  if(items.some(z=>!z.del&&z.url==url&&z.n==n&&z.p==p))return;let t=g(r,'name','title');if(!t)try{t=new URL(url).hostname.replace(/^www\./,'')}catch{t=url||'İsimsiz'}
  items.push({id:crypto.randomUUID(),t,url,n,p,nt:g(r,'note','notes','extra'),f:0,u:Date.now()});add++});
 render();persist();toast(add+' kayıt içe aktarıldı. CSV dosyasını şimdi silin!')};rd.readAsText(file)}
function changeMaster(){const cur=h('input',{type:'password',placeholder:'Mevcut ana parola',autocomplete:'current-password'}),n1=h('input',{type:'password',placeholder:'Yeni ana parola (en az 12 karakter)',autocomplete:'new-password'}),n2=h('input',{type:'password',placeholder:'Yeni ana parolayı tekrar yazın',autocomplete:'new-password'}),er=h('div',{class:'err'}),m=meter(),b=h('button',{class:'p'},'Değiştir');
 n1.addEventListener('input',()=>m.set(n1.value));
 const o=modal(h('h2',{},'Ana parolayı değiştir'),cur,n1,m.el,n2,er,h('div',{class:'row sp'},h('button',{onclick:()=>o.remove()},'İptal'),b));
 b.onclick=async()=>{er.textContent='';if(n1.value.length<12)return er.textContent='Yeni parola en az 12 karakter olmalı.';if(n1.value!==n2.value)return er.textContent='Yeni parolalar eşleşmiyor.';
  b.disabled=true;b.textContent='Çalışıyor…';await tick();
  try{const d=await S.read();try{await open(d,await derive(cur.value,unb64(d.salt)))}catch{throw new Error('Mevcut ana parola yanlış.')}
   salt=crypto.getRandomValues(new Uint8Array(16));key=await derive(n1.value,salt);const nd=await seal();await S.write(nd);lastSaved=nd.saved;o.remove();toast('Ana parola değiştirildi. Eski yedekler eski parolayla açılır.')}catch(e){er.textContent=e.message;b.disabled=false;b.textContent='Değiştir'}}}
/* ---- şifre kontrolü ---- */
function auditRows(){const live=items.filter(x=>!x.del&&x.p),g=new Map();live.forEach(x=>g.set(x.p,[...(g.get(x.p)||[]),x]));const yr=Date.now()-365*864e5;
 return live.map(x=>{const lv=strength(x.p),same=g.get(x.p).filter(z=>z.id!=x.id),old=!!(x.u&&x.u<yr);return{x,lv,same,old,bad:lv<=1||same.length>0,score:[5,4,2,1,0][lv]+(same.length?3:0)+(old?1:0)}})
  .sort((a,b)=>b.score-a.score||(a.x.t||'').localeCompare(b.x.t||'','tr'))}
function audit(){const rows=auditRows();
 if(!rows.length)return modal(h('h2',{},'Şifre kontrolü'),h('p',{class:'m'},'Kontrol edilecek parola yok. Önce birkaç kayıt ekleyin.'),h('button',{class:'w',onclick:e=>e.target.closest('.ov').remove()},'Kapat'));
 let cur='all';const bad=rows.filter(r=>r.bad).length;
 const F=[['all','Tümü',()=>true],['same','Tekrar kullanılan',r=>r.same.length>0],['l0','Çok zayıf',r=>r.lv==0],['l1','Zayıf',r=>r.lv==1],['l2','Orta',r=>r.lv==2],['l3','Güçlü',r=>r.lv==3],['l4','Çok güçlü',r=>r.lv==4],['old','Eski (1 yıl+)',r=>r.old]];
 const chips=h('div',{class:'row',style:'flex-wrap:wrap;gap:6px;margin:12px 0'}),list=h('div',{class:'alist'});
 const dist=h('div',{class:'sum'},...[0,1,2,3,4].map(l=>{const n=rows.filter(r=>r.lv==l).length;return n>0&&h('i',{style:`flex:${n};background:${STR[l][1]}`,title:STR[l][0]+': '+n})}));
 function row(r){const x=r.x;return h('div',{class:'arow',onclick:()=>{o.remove();editor(x)}},
  h('div',{class:'meta'},h('b',{},x.t||x.url),h('span',{},x.n||x.url||''),r.same.length>0&&h('span',{style:'color:var(--warn)'},'Aynı parola: '+r.same.slice(0,3).map(z=>z.t||z.url).join(', ')+(r.same.length>3?' +'+(r.same.length-3):''))),
  h('div',{class:'tags'},h('span',{class:'tag',style:'background:'+STR[r.lv][1]},STR[r.lv][0]),r.same.length>0&&h('span',{class:'tag',style:'background:#c2410c'},(r.same.length+1)+' kayıtta aynı'),r.old&&h('span',{class:'tag',style:'background:#64748b'},'Eski')))}
 const more=h('button',{class:'w',style:'margin-top:4px',onclick:()=>page()},'Daha fazla göster');let cl=[],shown=0;
 function page(){const f=document.createDocumentFragment();cl.slice(shown,shown+50).forEach(r=>f.append(row(r)));list.insertBefore(f,more);shown=Math.min(cl.length,shown+50);more.style.display=shown<cl.length?'':'none';more.textContent='Daha fazla göster ('+(cl.length-shown)+')'}
 function draw(){chips.replaceChildren(...F.map(([k,t,fn])=>{const n=rows.filter(fn).length;return h('button',{class:'s'+(cur==k?' p':''),style:n||k=='all'?'':'opacity:.55',onclick:()=>{cur=k;draw()}},t+' '+n)}));
  cl=rows.filter(F.find(f=>f[0]==cur)[2]);shown=0;list.replaceChildren(more);list.scrollTop=0;if(!cl.length)list.prepend(h('div',{class:'empty'},'Bu filtrede kayıt yok.'));page()}
 const o=modal(h('h2',{},'Şifre kontrolü'),
  h('p',{style:'margin:0;font-weight:600'},bad?rows.length+' parolanın '+bad+' tanesi dikkat gerektiriyor.':'Harika, tüm parolalarınız güçlü ve benzersiz.'),
  h('p',{class:'m'},'Zayıf ve tekrar kullanılan parolalar en üstte, önem sırasına göre listelenir. Kayda dokunarak parolayı değiştirebilirsiniz. Kontrol tamamen cihazınızda yapılır, parolalar gösterilmez.'),dist,chips,list,
  h('div',{style:'margin-top:12px'},h('button',{class:'w',onclick:()=>o.remove()},'Kapat')));
 o.firstChild.classList.add('audit');draw()}
async function moveVault(){try{const r=await simpass.move();if(r&&r.path){vinfo=await simpass.info();toast('Kasa dosyası taşındı')}}catch(e){toast('Taşınamadı: '+e.message)}}
async function mkShortcut(){try{const r=await simpass.shortcut();toast(r&&r.ok?'Kısayollar oluşturuldu (Masaüstü ve Başlat menüsü)':'Kısayol oluşturulamadı')}catch(e){toast('Kısayol oluşturulamadı')}}
function settings(){const fi=h('input',{type:'file',accept:'.csv,text/csv',style:'display:none',onchange:e=>{e.target.files[0]&&importCsv(e.target.files[0]);o.remove()}}),
 fr=h('input',{type:'file',accept:'.json,.vault,application/json',style:'display:none',onchange:e=>{const f=e.target.files[0];o.remove();f&&restore(f)}});
 const o=modal(h('h2',{},'Ayarlar'),h('p',{class:'m'},items.filter(x=>!x.del).length+' kayıt · AES-256-GCM, PBKDF2 (600.000 tur). Ana parolanız ve verileriniz internete gönderilmez.'),
  h('p',{class:'m',style:'word-break:break-all'},'Kasa dosyası: '+(vinfo.path||'')),fi,fr,
  h('div',{style:'display:grid;gap:9px;margin-top:12px'},
   h('button',{class:'p',onclick:()=>{o.remove();audit()}},'Şifre kontrolü'+(()=>{const n=auditRows().filter(r=>r.bad).length;return n?' · '+n+' sorun':''})()),
   h('button',{onclick:()=>{o.remove();backup()}},'Şifreli yedek al'),
   h('button',{onclick:()=>fr.click()},'Yedekten geri yükle'),
   h('button',{onclick:changeMaster},'Ana parolayı değiştir'),
   h('div',{class:'row'},h('button',{style:'flex:1',onclick:()=>simpass.reveal()},'Dosyayı klasörde göster'),h('button',{style:'flex:1',onclick:async()=>{o.remove();await moveVault()}},'Konumu değiştir')),
   h('button',{onclick:mkShortcut},'Masaüstü ve Başlat menüsüne kısayol ekle'),
   h('button',{onclick:()=>fi.click()},'CSV içe aktar (Chrome / Google / Proton)'),
   h('button',{onclick:async()=>{if(!await ask('Dışa aktarılan CSV dosyası ŞİFRESİZDİR. İşiniz bitince silmeyi unutmayın.','Dışa aktar'))return;
     await dl('simpass-disa-aktar.csv',['name,url,username,password,note',...items.filter(x=>!x.del).map(x=>[x.t,x.url,x.n,x.p,x.nt].map(csvq).join(','))].join('\n'))}},'CSV olarak dışa aktar (şifresiz!)'),
   h('button',{class:'d',onclick:async()=>{if(!await ask('Kasa dosyası kalıcı olarak silinecek. Yedeğiniz yoksa geri getirilemez.','Kalıcı olarak sil'))return;o.remove();
     try{await simpass.remove()}catch(e){return toast('Silinemedi: '+e.message)}
     clearTimeout(idleT);key=null;items=[];syncEl=null;toast('Kasa silindi');vinfo=await simpass.info();authView('setup')}},'Kasayı kalıcı olarak sil'),
   h('button',{onclick:()=>o.remove()},'Kapat')),h('p',{class:'m t',style:'margin-top:14px'},'SimPass 1.0.0'))}
simpass.onLock(()=>{if(key){notice='Ekran kilitlendiği için kasa kilitlendi.';lock()}});
init();
