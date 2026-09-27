import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Shield,
  Bell,
  Save,
  CheckCircle2,
  UserCheck,
  IdCard,
  Upload,
  Eye,
  Trash2,
  Sparkles,
  Mail
} from 'lucide-react';

export const AdminSettings = () => {
  const { user } = useAuth();
  const [adminName, setAdminName] = useState(user?.name || 'System Administrator');
  const [adminEmail, setAdminEmail] = useState(user?.email || 'admin@shuttletrack.io');
  const [campusName, setCampusName] = useState('Sairam Engineering College');
  const [sampleIdCardUrl, setSampleIdCardUrl] = useState('');
  const [sampleKeywords, setSampleKeywords] = useState([]);
  const [speedLimit, setSpeedLimit] = useState('35');
  const [delayThreshold, setDelayThreshold] = useState('5');
  const [googleMapsKey, setGoogleMapsKey] = useState(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB2GCqJ6Je3N04Mie2Ga3SsF39xXws0vZQ'
  );
  const [saving, setSaving] = useState(false);
  const [uploadingSample, setUploadingSample] = useState(false);
  const [previewSampleModal, setPreviewSampleModal] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/stats/settings');
        if (res.data?.success && res.data.data) {
          const s = res.data.data;
          if (s.organization_name) setCampusName(s.organization_name);
          if (s.admin_profile_name) setAdminName(s.admin_profile_name);
          if (s.admin_profile_email) setAdminEmail(s.admin_profile_email);
          if (s.sample_id_card_url !== undefined) setSampleIdCardUrl(s.sample_id_card_url || '');
          if (Array.isArray(s.sample_id_format_keywords)) setSampleKeywords(s.sample_id_format_keywords);
          if (s.speed_limit !== undefined) setSpeedLimit(String(s.speed_limit));
          if (s.delay_threshold !== undefined) setDelayThreshold(String(s.delay_threshold));
          if (s.google_maps_key !== undefined) setGoogleMapsKey(s.google_maps_key || '');
        }
      } catch (err) {
        console.error('Error loading system settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const compressImageToBase64 = (rawDataUrl) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1100;
          let w = img.width || 800;
          let h = img.height || 500;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        } catch (_) {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });

  const handleSampleIdUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast({
        title: 'Invalid File Format',
        message: 'Please upload a valid PNG or JPG image of the Sample Passenger ID Card.',
        type: 'danger'
      });
      return;
    }

    setUploadingSample(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = await compressImageToBase64(reader.result);
      setSampleIdCardUrl(base64Data);
      try {
        const res = await api.put('/stats/settings', {
          organization_name: campusName.trim() || 'Sairam Engineering College',
          admin_profile_name: adminName.trim(),
          admin_profile_email: adminEmail.trim(),
          sample_id_card_url: base64Data,
          speed_limit: Number(speedLimit) || 35,
          delay_threshold: Number(delayThreshold) || 5,
          google_maps_key: googleMapsKey.trim()
        });
        if (res.data?.success && res.data.data) {
          setSampleKeywords(res.data.data.sample_id_format_keywords || []);
          addToast({
            title: 'Sample Passenger ID Card Uploaded',
            message: `Official Passenger ID Card format saved in Admin Profile for "${res.data.data.organization_name}". Passengers must match this card structure & organization to create an account.`,
            type: 'success'
          });
        }
      } catch (err) {
        addToast({
          title: 'Sample Upload Notice',
          message: 'Sample image loaded locally. Click "Save Admin Profile & Preferences" to persist.',
          type: 'warning'
        });
      } finally {
        setUploadingSample(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSampleId = async () => {
    setSampleIdCardUrl('');
    setSampleKeywords([]);
    try {
      await api.put('/stats/settings', {
        organization_name: campusName.trim() || 'Sairam Engineering College',
        sample_id_card_url: ''
      });
      addToast({
        title: 'Sample ID Card Removed',
        message: 'Sample Passenger ID Card format cleared. Upload a new format to allow passenger signups.',
        type: 'warning'
      });
    } catch (_) {}
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!campusName.trim()) {
      addToast({
        title: 'Organization Name Required',
        message: 'Please enter the official Campus / Organization Name.',
        type: 'danger'
      });
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/stats/settings', {
        organization_name: campusName.trim(),
        admin_profile_name: adminName.trim(),
        admin_profile_email: adminEmail.trim(),
        sample_id_card_url: sampleIdCardUrl,
        speed_limit: Number(speedLimit) || 35,
        delay_threshold: Number(delayThreshold) || 5,
        google_maps_key: googleMapsKey.trim()
      });

      if (googleMapsKey.trim()) {
        localStorage.setItem('shuttle_google_maps_key', googleMapsKey.trim());
      } else {
        localStorage.removeItem('shuttle_google_maps_key');
      }

      if (res.data?.success) {
        if (Array.isArray(res.data.data?.sample_id_format_keywords)) {
          setSampleKeywords(res.data.data.sample_id_format_keywords);
        }
        addToast({
          title: 'Admin Profile & Settings Saved',
          message: `Organization "${res.data.data.organization_name}" & Sample Passenger ID Card format saved successfully.`,
          type: 'success'
        });
      }
    } catch (err) {
      addToast({
        title: 'Error Saving Settings',
        message: 'Could not update Admin Profile & system settings',
        type: 'danger'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-premium flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Admin Profile & System Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your Admin Profile, upload the official Sample / Format Passenger ID Card, and configure Organization verification
          </p>
        </div>
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
          <img
            src={user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(adminName || 'Admin')}`}
            alt={adminName}
            className="w-10 h-10 rounded-xl object-cover border border-brand-300 dark:border-brand-700"
          />
          <div>
            <p className="text-xs font-extrabold text-navy-900 dark:text-white">{adminName}</p>
            <p className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {adminEmail}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Admin Profile & Official Sample / Format Passenger ID Card Upload */}
        <Card className="space-y-5 border-2 border-brand-200/70 dark:border-brand-900/60">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <IdCard className="w-5 h-5 text-brand-500" />
              <div>
                <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                  Admin Profile & Official Passenger Sample ID Card Format
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Upload the official Sample / Format ID Card of Passenger here first. Passengers can only create an account if their uploaded ID card matches this format & organization.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border ${
                sampleIdCardUrl
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {sampleIdCardUrl ? 'Sample Passenger ID Format Active' : 'Upload Sample ID Format Required'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Administrator Name"
              id="adminProfileName"
              placeholder="System Administrator"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />
            <Input
              label="Administrator Dispatch Email (Sender Reference)"
              id="adminProfileEmail"
              type="email"
              placeholder="admin@shuttletrack.io"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>

          {/* Sample Passenger ID Card Upload Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-navy-900 dark:text-white">
                  Sample / Format ID Card of Passenger (Required for Passenger Account Creation)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  First upload your institution's sample passenger ID card format here. When a passenger signs up, their uploaded ID card is verified against this format and <strong className="text-navy-900 dark:text-white">"{campusName}"</strong>.
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-sm transition-all shrink-0">
                <Upload className="w-4 h-4" />
                <span>{uploadingSample ? 'Analyzing Format...' : sampleIdCardUrl ? 'Replace Sample ID Card' : 'Upload Sample ID Card'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSampleIdUpload}
                  className="hidden"
                />
              </label>
            </div>

            {sampleIdCardUrl ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70">
                <div className="flex items-center gap-3.5">
                  <img
                    src={sampleIdCardUrl}
                    alt="Admin Uploaded Sample Passenger ID Card Format"
                    onClick={() => setPreviewSampleModal(true)}
                    className="w-24 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Official Passenger ID Format Uploaded & Active</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Organization Match: <strong className="text-navy-900 dark:text-white">{campusName}</strong>
                    </p>
                    {sampleKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {sampleKeywords.slice(0, 8).map((kw, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[10px] font-semibold border border-brand-200/60 dark:border-brand-800"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setPreviewSampleModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSampleId}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
                <strong>No Sample Passenger ID Card Format Uploaded Yet:</strong> Please upload the sample / format ID card of a passenger above. Until Admin uploads this format, new passengers cannot verify their ID card or create an account.
              </div>
            )}
          </div>
        </Card>

        {/* Organization & Speed Policy Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                Organization Verification & Fleet Policy
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              Enforced on Passenger Sign Up
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Campus / Organization Name"
                id="campus"
                required
                placeholder="e.g. Sairam Engineering College"
                value={campusName}
                onChange={(e) => setCampusName(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Passengers can only create an account when their entered Organization Name and ID Card match{' '}
                <strong className="text-navy-900 dark:text-white">"{campusName}"</strong> and the Admin Sample ID format.
              </p>
            </div>

            <div>
              <Input
                label="Speed Limit Threshold (km/h)"
                id="speed"
                type="number"
                value={speedLimit}
                onChange={(e) => setSpeedLimit(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Maximum allowed shuttle speed before telemetry flags overspeeding.
              </p>
            </div>
          </div>
        </Card>

        {/* Map API Provider */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Shield className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-bold text-navy-900 dark:text-white">
              Map Provider & API Keys
            </h3>
          </div>

          <div>
            <Input
              label="Google Maps API Key (Optional)"
              id="googleKey"
              placeholder="AIzaSy..."
              value={googleMapsKey}
              onChange={(e) => setGoogleMapsKey(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              If left blank, the application automatically uses built-in high-performance CartoDB Vector Tiles without requiring billing keys.
            </p>
          </div>
        </Card>

        {/* Dispatch Alerts */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Bell className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-bold text-navy-900 dark:text-white">
              Automated Alert Thresholds
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Delay / Arrival Exceeded Trigger Threshold (minutes)"
              id="delayMins"
              type="number"
              value={delayThreshold}
              onChange={(e) => setDelayThreshold(e.target.value)}
            />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" icon={Save} size="md" disabled={saving}>
            {saving ? 'Saving Admin Profile & Preferences...' : 'Save Admin Profile & System Preferences'}
          </Button>
        </div>
      </form>

      {/* Modal Preview for Sample Passenger ID Card */}
      {previewSampleModal && sampleIdCardUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewSampleModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-black text-navy-900 dark:text-white">
                  Official Sample Passenger ID Card Format
                </h4>
                <p className="text-[11px] text-slate-500">{campusName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSampleModal(false)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Close
              </button>
            </div>
            <img
              src={sampleIdCardUrl}
              alt="Sample Passenger ID Format"
              className="w-full max-h-96 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;

