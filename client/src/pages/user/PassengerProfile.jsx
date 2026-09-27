import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input, { Select } from '../../components/common/Input';
import { useToast } from '../../components/common/Toast';
import { Camera, Upload, Bus, Mail, Phone, Building2, Edit2 } from 'lucide-react';

export const PassengerProfile = () => {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    bus_number: (user?.bus_number || 'S01').toUpperCase()
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        bus_number: (user.bus_number || 'S01').toUpperCase()
      });
    }
  }, [user?.name, user?.phone, user?.bus_number]);

  useEffect(() => {
    if (!socket || !user?.id) return;
    const handlePassengerSync = (payload) => {
      if (payload && Number(payload.id) === Number(user.id)) {
        updateUser(payload);
      }
    };
    socket.on('passenger:updated', handlePassengerSync);
    return () => {
      socket.off('passenger:updated', handlePassengerSync);
    };
  }, [socket, user?.id]);

  const passengerBusCode = (user?.bus_number || 'S01').toUpperCase();
  const avatarSrc =
    user?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'User')}`;

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({
        title: 'Invalid File Format',
        message: 'Please select a valid image file (PNG, JPG, WEBP).',
        type: 'danger'
      });
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Image = reader.result;
        const res = await api.put('/auth/me/avatar', { avatar_url: base64Image });
        const updatedData = res.data?.data || { avatar_url: base64Image };
        updateUser(updatedData);
        addToast({
          title: 'Passenger Profile Image Updated',
          message: 'Your profile image has been saved and synced to Driver & Admin logins.',
          type: 'success'
        });
      } catch (err) {
        addToast({
          title: 'Upload Failed',
          message: err.response?.data?.message || 'Could not update passenger profile image.',
          type: 'danger'
        });
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast({
        title: 'Name Required',
        message: 'Please enter your name.',
        type: 'warning'
      });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await api.put('/auth/me/profile', {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        bus_number: formData.bus_number.trim().toUpperCase()
      });
      if (res.data?.success && res.data.data) {
        updateUser(res.data.data);
        setIsEditOpen(false);
        addToast({
          title: 'Profile Updated',
          message: 'Your passenger profile has been updated across Passenger, Driver, and Admin logins.',
          type: 'success'
        });
      }
    } catch (err) {
      addToast({
        title: 'Update Failed',
        message: err.response?.data?.message || 'Could not update profile.',
        type: 'danger'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
          Passenger Profile
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          View your registered bus details and edit your passenger profile & image
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Passenger Avatar with Edit Overlay */}
            <div className="relative group">
              <img
                src={avatarSrc}
                alt="Passenger profile avatar"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-brand-500 shadow-md"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg transition-transform hover:scale-105"
                title="Edit Passenger Image"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <div className="text-center sm:text-left space-y-1.5">
              <h3 className="text-xl font-black text-navy-900 dark:text-white">
                {user?.name || 'Passenger'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user?.organization_name || user?.organization || 'Sairam Engineering College'}
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Badge status="active">Verified Passenger</Badge>
                <span className="px-2.5 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-blue-300 text-xs font-black">
                  Bus {passengerBusCode}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploadingPhoto}
              icon={Upload}
              onClick={() => fileInputRef.current?.click()}
            >
              Edit Profile Image
            </Button>
            <Button
              type="button"
              size="sm"
              icon={Edit2}
              onClick={() => setIsEditOpen(true)}
            >
              Edit Profile
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px]">
              <Mail className="w-3.5 h-3.5 text-brand-500" /> Registered Email
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">
              {user?.email || 'student@shuttle.com'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px]">
              <Phone className="w-3.5 h-3.5 text-emerald-500" /> Contact Phone
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">
              {user?.phone || '+91 98765 43210'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px]">
              <Bus className="w-3.5 h-3.5 text-brand-500" /> Registered Bus Number
            </span>
            <span className="font-black text-brand-600 dark:text-blue-400 block text-sm">
              Bus {passengerBusCode}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px]">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Organization / Campus
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">
              {user?.organization_name || user?.organization || 'Sairam Engineering College'}
            </span>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Passenger Profile"
        subtitle="Changes immediately reflect across Passenger, Driver, and Admin portals"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <Input
            label="Contact Phone"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="+91 98765 43210"
          />
          <Select
            label="Registered Bus Number"
            value={formData.bus_number}
            onChange={(e) => setFormData((prev) => ({ ...prev, bus_number: e.target.value }))}
            options={[
              { value: 'S01', label: 'Bus S01' },
              { value: 'S02', label: 'Bus S02' },
              { value: 'S03', label: 'Bus S03' },
              { value: 'S04', label: 'Bus S04' }
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingProfile}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PassengerProfile;
