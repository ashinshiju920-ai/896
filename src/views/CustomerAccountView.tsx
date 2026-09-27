import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, LogOut, ShieldCheck, Loader2, KeyRound } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BackButton } from '../components/BackButton';

export const CustomerAccountView: React.FC = () => {
  const navigate = useNavigate();
  const { currentCustomer, logoutCustomer, showToast, isCustomerLoading } = useShop();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  if (isCustomerLoading) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
      </div>
    );
  }

  if (!currentCustomer) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto ring-8 ring-slate-50">
          <User className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            Sign in to view your account
          </h1>
          <p className="text-xs text-slate-500">
            Please log in with your email and password to manage your study materials and profile.
          </p>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    setIsUpdating(true);

    try {
      const res = await fetch('/api/customer/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPassSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        showToast('Password changed successfully!', 'success');
      } else {
        setPassError(data.error || 'Failed to update password.');
      }
    } catch {
      setPassError('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      <div className="flex items-center justify-between">
        <BackButton to="/my-materials" label="My Materials" />
        <button
          onClick={logoutCustomer}
          className="px-4 py-2 border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl font-['Plus_Jakarta_Sans',sans-serif]">
            {currentCustomer.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-block mb-1">
              Active Student Account
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              {currentCustomer.name}
            </h1>
            <p className="text-xs text-slate-500">
              Verified Lifetime Digital Entitlement Holder
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400" />
              Email Address
            </span>
            <span className="font-semibold text-slate-900 break-all">{currentCustomer.email}</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400" />
              Phone Number
            </span>
            <span className="font-semibold text-slate-900">{currentCustomer.phone || 'Not provided'}</span>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Change Password
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Keep your account secure with a strong password of at least 8 characters.
          </p>
        </div>

        {passError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
            {passError}
          </div>
        )}

        {passSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
            {passSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password (min 8)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isUpdating}
            className="px-6 py-2.5 bg-[#00875a] hover:bg-[#00734c] disabled:opacity-70 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
