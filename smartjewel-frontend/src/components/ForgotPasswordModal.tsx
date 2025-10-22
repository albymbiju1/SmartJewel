import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api';

const schema = z.object({
  email: z.string().email('Please enter a valid email address')
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [emailForReset, setEmailForReset] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ 
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await api.post('/auth/request-password-reset', { email: values.email });
      setIsSuccess(true);
      setEmailForReset(values.email);
      setMessage('A reset code has been sent to your email.');
    } catch (error: any) {
      // Always show success to avoid email enumeration
      setIsSuccess(true);
      setEmailForReset(values.email);
      setMessage('A reset code has been sent to your email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      if (!emailForReset) {
        setError('Email missing. Please enter your email and request a code again.');
        return;
      }
      await api.post('/auth/reset-password', { email: emailForReset, code, new_password: newPassword });
      setMessage('Password reset successful. You can now sign in.');
      setTimeout(() => handleClose(), 1000);
    } catch (error: any) {
      const data = error?.response?.data;
      const errCode = data?.error;
      if (errCode === 'reset_invalid') setError('Invalid code. Please try again.');
      else if (errCode === 'reset_expired') setError('The code has expired. Please request a new code.');
      else if (errCode === 'reset_attempts_exceeded') setError('Too many attempts. Please request a new code.');
      else if (errCode === 'no_reset') setError('No reset request found. Please request a code again.');
      else if (errCode === 'validation_failed') setError('Please enter the email, code and new password.');
      else setError(data?.error || 'Reset failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setError(null);
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-black/60 to-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[color:var(--brand-gold)]/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[color:var(--brand-gold)]">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <circle cx="12" cy="16" r="1"></circle>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Reset your password</h2>
              <p className="text-xs text-gray-500">We’ll email you a 6-digit code</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {isSuccess ? (
          /* Success & Reset State */
          <div className="py-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-500">Step <b>2</b> of <b>2</b></span>
              {emailForReset && (
                <span className="text-xs text-gray-500">To: <b>{emailForReset}</b></span>
              )}
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 mb-4 text-emerald-700 text-sm">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                <span>A reset code has been sent. Enter it below with your new password.</span>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">{error}</div>
            )}
            {message && (
              <div className="rounded-md bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-200">{message}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reset Code</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v8"></path>
                    <path d="M8 12h8"></path>
                  </svg>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="^[0-9]{6}$"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 border-gray-300 focus:ring-[color:var(--brand-gold)]/30"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <circle cx="12" cy="16" r="1"></circle>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <input
                    type="password"
                    className="w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 border-gray-300 focus:ring-[color:var(--brand-gold)]/30"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters. Avoid using your name or email.</p>
              </div>
              <button
                onClick={handleReset}
                disabled={isSubmitting || code.length !== 6 || newPassword.length < 6}
                className="w-full bg-[color:var(--brand-gold)] text-white hover:bg-amber-600 disabled:opacity-60 rounded-md py-2.5 font-medium"
              >
                {isSubmitting ? 'Resetting…' : 'Reset Password'}
              </button>
              <div className="flex items-center justify-between">
                <button
                  onClick={handleClose}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md py-2 px-4 font-medium"
                >
                  Close
                </button>
                {emailForReset && (
                  <button
                    onClick={async () => { try { await api.post('/auth/request-password-reset', { email: emailForReset }); setMessage('We resent the code to your email.'); } catch {} }}
                    className="text-sm text-[color:var(--brand-gold)] hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Form State */
          <>
            <p className="text-gray-600 text-sm mb-6">
              Enter your email address and we'll send you a 6-digit code to reset your password.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    {...register('email')}
                    className={`w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 ${
                      errors.email 
                        ? 'border-red-500 focus:ring-red-200' 
                        : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'
                    }`}
                  />
                </div>
                {errors.email && (
                  <span className="text-xs text-red-600 mt-1 block">{errors.email.message}</span>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md py-2.5 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[color:var(--brand-gold)] text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-md py-2.5 font-medium inline-flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};