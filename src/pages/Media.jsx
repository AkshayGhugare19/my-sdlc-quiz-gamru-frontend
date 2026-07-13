import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import endpoints from '../services/api.js';
import { EmptyState, PageHeader, Spinner, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';

const isImage = (m) => {
  const url = m.url || m.src || '';
  const type = m.mimeType || m.type || '';
  return /^image\//i.test(type) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(url);
};

export default function Media() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await endpoints.media.list();
      setItems(Array.isArray(res) ? res : res?.items || []);
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title || file.name);
      await endpoints.media.upload(fd);
      toast('Media uploaded');
      setUploadOpen(false);
      setFile(null);
      setTitle('');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const doDelete = async (m) => {
    try {
      await endpoints.media.remove(m.id);
      toast('Media deleted');
      setConfirmDel(null);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const fullUrl = (m) => {
    const u = m.url || m.src || '';
    if (!u) return '';
    return /^https?:/i.test(u) ? u : `${endpoints.baseUrl}${u.startsWith('/') ? '' : '/'}${u}`;
  };

  return (
    <div>
      <PageHeader
        title="Media Library"
        subtitle="Images and assets used across courses, avatars and badges"
        icon="image"
        actions={
          <button onClick={() => setUploadOpen(true)} className="btn-primary flex items-center gap-2">
            <Icon name="upload" className="w-4 h-4" />
            Upload
          </button>
        }
      />

      {loading ? (
        <div className="py-24 grid place-items-center text-neon">
          <Spinner className="w-8 h-8" />
        </div>
      ) : error ? (
        <div className="glass rounded-2xl p-8 text-center text-white/50">Could not load media. {error}</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl">
          <EmptyState icon="image" title="No media yet" hint="Upload your first asset." />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((m, i) => (
            <motion.div
              key={m.id || i}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-2xl overflow-hidden group"
            >
              <div className="aspect-square bg-black/30 grid place-items-center overflow-hidden relative">
                {isImage(m) ? (
                  <img
                    src={fullUrl(m)}
                    alt={m.title || 'media'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Icon name="image" className="w-10 h-10 text-white/25" />
                )}
                <button
                  onClick={() => setConfirmDel(m)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-night/70 text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3">
                <div className="text-sm text-white/85 font-medium truncate">{m.title || m.filename || `Asset ${m.id}`}</div>
                <div className="text-xs text-white/35 truncate">{m.mimeType || m.type || 'file'}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Media" maxWidth="max-w-lg">
        <form onSubmit={doUpload} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional display title" className="field" />
          </div>
          <div>
            <label className="label">File</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border-2 border-dashed border-white/15 hover:border-neon/40 transition p-8 text-center cursor-pointer bg-black/20"
            >
              <Icon name="upload" className="w-8 h-8 mx-auto text-white/40 mb-2" />
              {file ? (
                <div className="text-sm text-white/85">{file.name}</div>
              ) : (
                <div className="text-sm text-white/45">Click to choose a file</div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button type="button" onClick={() => setUploadOpen(false)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={!file || uploading} className="btn-primary flex items-center gap-2">
              {uploading && <Spinner className="w-4 h-4" />}
              Upload
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete media?" maxWidth="max-w-md">
        <p className="text-white/60 text-sm mb-6">
          Delete <span className="text-white font-semibold">{confirmDel?.title || confirmDel?.filename || 'this asset'}</span>? This
          cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmDel(null)} className="btn-ghost">
            Cancel
          </button>
          <button onClick={() => doDelete(confirmDel)} className="btn-danger">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
