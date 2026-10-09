const {app,BrowserWindow,ipcMain,dialog,shell,clipboard,Menu,nativeTheme,powerMonitor,session}=require('electron');
const path=require('path'),fs=require('fs');
app.setName('SimPass');
let win=null,clipTimer=null;
if(!app.requestSingleInstanceLock()){app.quit()}
else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});

 /* --- kasa dosyası konumu --- */
 const cfgFile=()=>path.join(app.getPath('userData'),'config.json');
 const readCfg=()=>{try{return JSON.parse(fs.readFileSync(cfgFile(),'utf8'))}catch{return{}}};
 const writeCfg=c=>{fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(cfgFile(),JSON.stringify(c))};
 const vaultPath=()=>readCfg().vault||path.join(app.getPath('userData'),'kasa-verileri.vault');
 const validDoc=d=>d&&typeof d==='object'&&d.v===1&&typeof d.salt==='string'&&typeof d.iv==='string'&&typeof d.ct==='string';
 const exists=p=>{try{return fs.statSync(p).size>0}catch{return false}};
 const FILTERS=[{name:'SimPass kasa dosyası',extensions:['vault','json']}];

 ipcMain.handle('info',()=>{const p=vaultPath();return{path:p,name:path.basename(p),exists:exists(p)}});
 ipcMain.handle('read',()=>{const p=vaultPath();if(!exists(p))return null;let d;try{d=JSON.parse(fs.readFileSync(p,'utf8'))}catch{throw new Error('Kasa dosyası okunamadı veya bozuk')}if(!validDoc(d))throw new Error('Geçersiz kasa dosyası');return d});
 ipcMain.handle('write',(e,d)=>{if(!validDoc(d))throw new Error('Geçersiz kasa verisi');const p=vaultPath();fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d));fs.renameSync(tmp,p);return true});
 ipcMain.handle('choose',async()=>{const r=await dialog.showOpenDialog(win,{title:'Kasa dosyasını seçin',filters:FILTERS,properties:['openFile']});if(r.canceled||!r.filePaths[0])return null;const f=r.filePaths[0];let d;try{d=JSON.parse(fs.readFileSync(f,'utf8'))}catch{throw new Error('Bu dosya okunamadı')}if(!validDoc(d))throw new Error('Bu bir SimPass kasa dosyası değil');writeCfg({...readCfg(),vault:f});return{path:f}});
 ipcMain.handle('save',async(e,name,data)=>{const ext=path.extname(String(name)).slice(1)||'txt';const r=await dialog.showSaveDialog(win,{defaultPath:path.join(app.getPath('documents'),path.basename(String(name))),filters:[{name:ext.toUpperCase(),extensions:[ext]}]});if(r.canceled||!r.filePath)return{saved:false};fs.writeFileSync(r.filePath,String(data));return{saved:true,path:r.filePath}});
 ipcMain.handle('copy',async(e,t)=>{t=String(t);await clipboard.writeText(t);clearTimeout(clipTimer);clipTimer=setTimeout(async()=>{try{if(await clipboard.readText()===t)await clipboard.clear()}catch{}},30000);return true});
 ipcMain.handle('remove',()=>{const p=vaultPath();try{fs.unlinkSync(p)}catch(e){if(e.code!=='ENOENT')throw e}return true});
 ipcMain.handle('reveal',()=>{const p=vaultPath();if(fs.existsSync(p))shell.showItemInFolder(p);return true});
 ipcMain.handle('move',async()=>{const cur=vaultPath();const r=await dialog.showSaveDialog(win,{title:'Kasa dosyasının yeni konumu',defaultPath:cur,filters:FILTERS});if(r.canceled||!r.filePath)return null;const to=r.filePath;if(path.resolve(to)===path.resolve(cur))return null;
  if(exists(cur)){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(cur,to);if(fs.statSync(to).size!==fs.statSync(cur).size)throw new Error('Kopyalama doğrulanamadı');fs.unlinkSync(cur)}
  writeCfg({...readCfg(),vault:to});return{path:to}});
 ipcMain.handle('shortcut',()=>{if(process.platform!=='win32')return{ok:false};const opt={target:process.execPath,cwd:path.dirname(process.execPath),description:'SimPass',icon:process.execPath,iconIndex:0};
  const a=path.join(app.getPath('desktop'),'SimPass.lnk');const dir=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');fs.mkdirSync(dir,{recursive:true});const b=path.join(dir,'SimPass.lnk');
  const ok1=shell.writeShortcutLink(a,'create',opt),ok2=shell.writeShortcutLink(b,'create',opt);return{ok:ok1||ok2}});

 function createWindow(){
  win=new BrowserWindow({width:1000,height:780,minWidth:380,minHeight:540,title:'SimPass',show:false,
   backgroundColor:nativeTheme.shouldUseDarkColors?'#0a0f1a':'#eef2f8',icon:path.join(__dirname,'icon.png'),
   webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:false,spellcheck:false}});
  win.once('ready-to-show',()=>win.show());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.on('closed',()=>{win=null});
  win.loadFile(path.join(__dirname,'index.html'));
 }
 app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((wc,p,cb)=>cb(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!d.url.startsWith('file://')}));
  createWindow();
  const lock=()=>{if(win)win.webContents.send('lock')};
  powerMonitor.on('lock-screen',lock);powerMonitor.on('suspend',lock);
 });
 app.on('window-all-closed',()=>app.quit());
}
