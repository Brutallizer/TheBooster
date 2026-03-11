import React, { useState } from 'react';

interface CreateProfileModalProps {
  onSubmit: (data: { name: string; account_type: 'free' | 'premium'; notes: string }) => void;
  onClose: () => void;
}

const CreateProfileModal: React.FC<CreateProfileModalProps> = ({ onSubmit, onClose }) => {
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<'free' | 'premium'>('free');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), account_type: accountType, notes });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">🎭 Buat Profil Baru</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, marginTop: -12 }}>
          Fingerprint unik akan di-generate otomatis untuk profil ini.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nama Profil</label>
            <input
              className="form-input"
              type="text"
              placeholder="Contoh: TikTok Akun 1"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tipe Akun</label>
            <select
              className="form-select"
              value={accountType}
              onChange={e => setAccountType(e.target.value as 'free' | 'premium')}
            >
              <option value="free">Free (Fingerprint Dasar)</option>
              <option value="premium">Premium (Semua Fitur)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Catatan (opsional)</label>
            <input
              className="form-input"
              type="text"
              placeholder="Catatan untuk profil ini..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              ✨ Buat Profil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProfileModal;
