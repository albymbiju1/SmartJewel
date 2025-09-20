import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [address, setAddress] = useState(user?.address || '');
  const [email] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Password modal state
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isPwdSaving, setIsPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">Please log in to view your profile.</div>
      </div>
    );
  }

  const roleLabel = user.role?.role_name || (user.roles?.[0] ?? 'User');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await api.patch('/customers/me', { full_name: fullName, phone_number: phone, address });
      setMessage('Profile updated successfully');
      // Update local auth state so UI reflects latest values immediately
      updateUser({ full_name: res.data.full_name ?? fullName, phone_number: res.data.phone_number ?? phone, address: res.data.address ?? address });
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Unable to update profile right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPwdSaving(true);
    setPwdMessage(null);
    try {
      await api.patch('/customers/me/password', { old_password: oldPassword, new_password: newPassword });
      setPwdMessage('Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setShowPassword(false);
    } catch (err: any) {
      setPwdMessage(err?.response?.data?.error || 'Unable to update password right now.');
    } finally {
      setIsPwdSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold">
            {(fullName || email).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{fullName || email}</div>
            <div className="text-sm text-gray-500">{roleLabel}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your address"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Update Profile'}
            </button>
            <button
              type="button"
              onClick={() => setShowPassword(true)}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200"
            >
              Update Password
            </button>
          </div>
        </form>

        {message && (
          <div className="mt-4 text-sm text-gray-700">{message}</div>
        )}
      </div>

      {/* Password Modal */}
      {showPassword && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={isPwdSaving} className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {isPwdSaving ? 'Updating...' : 'Update Password'}
                </button>
                <button type="button" onClick={() => setShowPassword(false)} className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200">
                  Cancel
                </button>
              </div>
              {pwdMessage && <div className="text-sm text-gray-700">{pwdMessage}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};