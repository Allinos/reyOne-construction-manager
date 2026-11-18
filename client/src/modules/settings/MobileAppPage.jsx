import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/api';
import { Card, Alert, Spinner } from '../../components/ui';
import Icon from '../../components/Icon';
import { listModules, toggleModule } from '../modulemanager/api';
import { updateSetting } from './api';
import { Switch } from './editors';

// Modules the Flutter app knows how to show.
const APP_MODULES = [
  { key: 'attendance', label: 'Attendance' },
  { key: 'projects', label: 'Projects & tasks' },
  { key: 'inspections', label: 'Site inspection' },
  { key: 'materials', label: 'Materials' },
  { key: 'queries', label: 'Queries' },
];

// Connection code = "RY1-" + base64url(JSON { u: serverUrl, n: companyName }).
// The single reyOne Site app decodes it to find this company's own server, so
// every client instance (its own domain/subdomain) works with the same app.
export function makeConnectionCode(url, name) {
  const json = JSON.stringify({ u: url, n: name || '' });
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `RY1-${b64}`;
}

export default function MobileAppPage() {
  const { bootstrap, reloadBootstrap, can } = useAuth();
  const toast = useToast();
  const canManage = can('modules.update');
  const company = bootstrap?.company?.name || 'reyOne';
  const saved = bootstrap?.settings?.mobile?.server_url;
  const [modules, setModules] = useState(null);
  const [url, setUrl] = useState(saved || window.location.origin);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { listModules().then(setModules).catch(() => setModules([])); }, []);
  const mobile = modules?.find((m) => m.key === 'mobile_app');
  const enabledKeys = new Set((modules || []).filter((m) => m.enabled).map((m) => m.key));

  const cleanUrl = url.trim().replace(/\/+$/, '');
  const code = useMemo(() => makeConnectionCode(cleanUrl, company), [cleanUrl, company]);

  useEffect(() => {
    QRCode.toDataURL(code, { width: 240, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [code]);

  const toggle = async (on) => {
    setBusy(true);
    try {
      await toggleModule('mobile_app', on);
      setModules(await listModules());
      await reloadBootstrap();
      toast.success(on ? 'Mobile app activated' : 'Mobile app deactivated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveUrl = async () => {
    try {
      await updateSetting('mobile', 'server_url', cleanUrl);
      await reloadBootstrap();
      toast.success('Server address saved');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error('Copy failed — select and copy manually'); }
  };

  if (!modules) return <div className="flex justify-center p-10"><Spinner /></div>;
  const on = !!mobile?.enabled;
  const insecure = cleanUrl.startsWith('http://') && !/localhost|127\.0\.0\.1/.test(cleanUrl);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">reyOne Site mobile app</h3>
            <p className="mt-0.5 text-sm text-slate-500">Let your team mark attendance, run inspections with photos, raise material requests and queries from their phones.</p>
          </div>
          <Switch label="Activate mobile app" checked={on} disabled={!canManage || busy} onChange={toggle} />
        </div>
        {!on && <div className="mt-3"><Alert type="info">The app is off for this company. Turn it on to show the connection QR code.</Alert></div>}
      </Card>

      {on && (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Connect a phone</h3>
              <p className="mt-0.5 text-xs text-slate-500">In the app, tap <b>Scan QR code</b> on the sign-in screen.</p>
              <div className="mt-3 flex justify-center rounded-xl bg-white p-3 ring-1 ring-slate-200">
                {qr ? <img src={qr} alt="Connection QR code" className="h-56 w-56" /> : <Spinner />}
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">Connects to <b>{company}</b></p>
            </Card>
            <Card className="lg:col-span-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Or enter a code</h3>
              <p className="mt-0.5 text-xs text-slate-500">No camera? Tap <b>Enter code</b> in the app and paste this connection code — or type the server address.</p>
              <label className="label mt-3">Connection code</label>
              <div className="flex gap-2">
                <input readOnly className="input font-mono text-xs" value={code} onFocus={(e) => e.target.select()} />
                <button className="btn-secondary" onClick={() => copy(code, 'Code')}><Icon name="copy" className="h-4 w-4" /> Copy</button>
              </div>
              <label className="label mt-3">Server address</label>
              <div className="flex gap-2">
                <input className="input" value={url} disabled={!can('settings.update')} onChange={(e) => setUrl(e.target.value)} />
                {can('settings.update') && cleanUrl !== (saved || window.location.origin) && <button className="btn-primary" onClick={saveUrl}>Save</button>}
                <button className="btn-secondary" onClick={() => copy(cleanUrl, 'Address')}><Icon name="copy" className="h-4 w-4" /></button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Defaults to this site's address. Change it only if the API is served from a different domain.</p>
              {insecure && <div className="mt-2"><Alert type="warning">Phones require a secure (https://) address. Set up SSL for this domain before rolling out the app.</Alert></div>}
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                <li>Install <b>reyOne Site</b> on the phone.</li>
                <li>Open it and scan the QR code (or enter the code).</li>
                <li>Sign in with the same email and password used here.</li>
              </ol>
            </Card>
          </div>
          <Card>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Available in the app</h3>
            <p className="mt-0.5 text-xs text-slate-500">The app shows only modules enabled for this company, and each person only sees what their role allows.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {APP_MODULES.map((m) => (
                <span key={m.key} className={`badge ${enabledKeys.has(m.key) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400 line-through'}`}>{m.label}</span>
              ))}
              <span className="badge bg-emerald-50 text-emerald-700">Notifications</span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
