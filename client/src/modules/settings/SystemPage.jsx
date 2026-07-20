import { useState } from 'react';
import { downloadBackup } from './api';
import { errorMessage } from '../../lib/api';
import { Card, Spinner, Alert } from '../../components/ui';

export default function SystemPage() {
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
    </div>
  );
}
