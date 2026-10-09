const {contextBridge,ipcRenderer}=require('electron');
const call=async(c,...a)=>{try{return await ipcRenderer.invoke(c,...a)}catch(e){throw new Error(String(e&&e.message||e).replace(/^Error invoking remote method '[^']*': (Error: )?/,''))}};
contextBridge.exposeInMainWorld('simpass',{
 info:()=>call('info'),read:()=>call('read'),write:d=>call('write',d),
 choose:m=>call('choose',m),save:(n,d)=>call('save',n,d),copy:t=>call('copy',t),
 remove:()=>call('remove'),reveal:()=>call('reveal'),move:()=>call('move'),shortcut:()=>call('shortcut'),
 onLock:f=>ipcRenderer.on('lock',()=>f())
});
