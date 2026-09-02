import { useState } from 'react';
import { downloadBackup, updateSetting } from './api';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card, Spinner, Alert } from '../../components/ui';

const DEFAULT_HELP = [
  { key: 'tutorial', title: 'Tutorial', enabled: true, url: '', html: '' },
  { key: 'support', title: 'Support & Contact', enabled: true, url: '', html: '' },
  { key: 'faqs', title: 'FAQs', enabled: true, url: '', html: '' },
];

// Merge stored help config over the fixed three sections so all always appear.
function normalizeHelp(stored) {
  return DEFAULT_HELP.map((d) => {
    const s = (stored || []).find((x) => x.key === d.key) || {};
    return { ...d, ...s };
  });
}

function HelpSettings() {
  const { bootstrap, reloadBootstrap } = useAuth();
  const toast = useToast();
  const [sections, setSections] = useState(() => normalizeHelp(bootstrap?.settings?.help?.sections));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (key, field, value) =>
    setSections((list) => list.map((s) => (s.key === key ? { ...s, [field]: value } : s)));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateSetting('help', 'sections', sections);
      await reloadBootstrap();
      toast.success('Help content saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h3 className="font-semibold text-slate-700 dark:text-slate-200">Help Centre</h3>
      <p className="mt-1 text-sm text-slate-500">
        Configure the three Help sections shown when users click the Help icon in the header. Provide an external URL to
        embed a hosted page, or write HTML content directly. Disabled sections are hidden from the Help window.
      </p>
      {error && <Alert>{error}</Alert>}

      <div className="mt-4 space-y-4">
        {sections.map((s) => (
          <div key={s.key} className="rounded-lg border border-cream-300 p-3 dark:border-slate-700">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <input
                className="input flex-1 min-w-[160px] font-medium"
                value={s.title}
                onChange={(e) => setField(s.key, 'title', e.target.value)}
                placeholder="Section title"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={!!s.enabled} onChange={(e) => setField(s.key, 'enabled', e.target.checked)} /> Enabled
              </label>
            </div>
            <label className="label">External URL <span className="text-xs font-normal text-slate-400">(optional — overrides HTML)</span></label>
            <input
              className="input mb-2"
              value={s.url || ''}
              onChange={(e) => setField(s.key, 'url', e.target.value)}
              placeholder="https://example.com/help/tutorial"
            />
            <label className="label">HTML content</label>
            <textarea
              className="input font-mono text-xs"
              rows={4}
              value={s.html || ''}
              onChange={(e) => setField(s.key, 'html', e.target.value)}
              placeholder="<h2>Title</h2><p>Your help content…</p>"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : 'Save Help Content'}
        </button>
      </div>
    </Card>
  );
}

export default function SystemPage() {
  const { can } = useAuth();
  const [state, setState] = useState({ loading: false, error: '' });

  const onBackup = async () => {
    setState({ loading: true, error: '' });
    try {
      await downloadBackup();
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, 'Backup failed') });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <Card>
        <h3 className="font-semibold text-slate-700">Database Backup</h3>
        <p className="mt-1 text-sm text-slate-500">
          Download a complete SQL dump of this deployment's database to your computer.
        </p>
        <button className="btn-primary mt-4" onClick={onBackup} disabled={state.loading}>
          {state.loading ? <Spinner className="h-4 w-4" /> : 'Download Backup'}
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Requires <code>mysqldump</code> on the server. Restore functionality is planned for a later release.
        </p>
      </Card>

      {can('settings.update') && <HelpSettings />}
    </div>
  );
}
