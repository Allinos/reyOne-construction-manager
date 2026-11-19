import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Modal';
import api, { unwrap, errorMessage } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export default function ProfileModal({ onClose }) {
  const { user, reloadBootstrap } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const saveProfile = async () => {
    setBusy(true);
    try { await unwrap(api.patch('/auth/me', { name: f.name, phone: f.phone || null })); await reloadBootstrap(); toast.success('Profile updated'); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const changePw = async () => {
    if (pw.newPassword !== pw.confirm) { toast.error('New passwords do not match'); return; }
    setBusy(true);
    try {
      await unwrap(api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }));
      toast.success('Password changed — other devices have been signed out');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="My profile" footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Email</label><input className="input" value={user?.email || ''} disabled /></div>
          <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end"><button className="btn-primary btn-sm" disabled={busy || !f.name.trim()} onClick={saveProfile}>Save profile</button></div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
          <p className="col-span-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Change password</p>
          <div className="col-span-2"><label className="label">Current password</label><input type="password" className="input" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div><label className="label">New password</label><input type="password" className="input" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></div>
          <div><label className="label">Confirm</label><input type="password" className="input" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          <div className="col-span-2 flex justify-end"><button className="btn-secondary btn-sm" disabled={busy || !pw.currentPassword || !pw.newPassword} onClick={changePw}>Change password</button></div>
        </div>
      </div>
    </Modal>
  );
}

