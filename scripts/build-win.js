// SimPass - Windows (x64) paketi üretir: dist/SimPass/SimPass.exe
// Kullanım: npm run build:win   (Linux/macOS/Windows üzerinde çalışır, Wine gerekmez)
const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
const asar = require('@electron/asar');
const ResEdit = require('resedit');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'SimPass');
const VERSION = require('electron/package.json').version;
const APP_VERSION = require('../package.json').version;

(async () => {
  fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  console.log(`Electron ${VERSION} (win32-x64) indiriliyor…`);
  const zip = await downloadArtifact({ version: VERSION, platform: 'win32', arch: 'x64', artifactName: 'electron' });
  await extract(zip, { dir: OUT });

  fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'SimPass.exe'));
  fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true });

  // Uygulamayı app.asar olarak paketle
  const stage = path.join(ROOT, 'dist', '_stage');
  fs.mkdirSync(stage, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(stage, f));
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: 'simpass', productName: 'SimPass', version: APP_VERSION, main: 'main.js' }));
  await asar.createPackage(stage, path.join(OUT, 'resources', 'app.asar'));
  fs.rmSync(stage, { recursive: true, force: true });

  // Yalnızca Türkçe ve İngilizce dil dosyaları kalsın
  const loc = path.join(OUT, 'locales');
  for (const f of fs.readdirSync(loc)) if (!['en-US.pak', 'tr.pak'].includes(f)) fs.rmSync(path.join(loc, f));

  // exe: simge ve sürüm bilgisi (resedit saf JS olduğu için Wine gerekmez)
  const exePath = path.join(OUT, 'SimPass.exe');
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(ROOT, 'assets', 'icon.ico')));
  for (const g of ResEdit.Resource.IconGroupEntry.fromEntries(res.entries))
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const [a, b, c] = APP_VERSION.split('.').map(Number);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'SimPass', ProductName: 'SimPass', CompanyName: 'SimPass', LegalCopyright: 'SimPass',
    OriginalFilename: 'SimPass.exe', InternalName: 'SimPass', FileVersion: `${APP_VERSION}.0`, ProductVersion: APP_VERSION,
  });
  vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));

  // Güvenlik ayarları (Electron fuses)
  await flipFuses(exePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });

  fs.copyFileSync(path.join(ROOT, 'docs', 'OKU-BENI.txt'), path.join(OUT, 'OKU-BENI.txt'));
  console.log('Hazır:', exePath);
})().catch(e => { console.error('HATA', e); process.exit(1); });
