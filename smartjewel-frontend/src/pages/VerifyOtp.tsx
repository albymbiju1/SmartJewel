import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

export const VerifyOtp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const initialEmail = location?.state?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/verify-otp', { email, otp });
      setMessage('Verification successful. You can now sign in.');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err: any) {
      const data = err?.response?.data;
      const errCode = data?.error;
      if (errCode === 'otp_invalid') setError('Invalid code. Please try again.');
      else if (errCode === 'otp_expired') setError('The code has expired. Please resend a new code.');
      else if (errCode === 'otp_attempts_exceeded') setError('Too many attempts. Please resend a new code.');
      else if (errCode === 'no_otp') setError('No code found. Please resend a new code.');
      else setError(data?.error || 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    setMessage(null);
    setIsResending(true);
    try {
      await api.post('/auth/request-otp', { email });
      setMessage('A new code has been sent to your email.');
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.error || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl w-full max-w-md mx-auto mt-12">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <img src="/logo192.png" alt="SmartJewel logo" width="192" height="192" className="h-10 md:h-12 w-auto object-contain" />
        </div>
        <h1 className="text-xl font-semibold text-gray-800">Verify your email</h1>
        <p className="text-gray-500 text-sm">Enter the 6-digit code sent to your email</p>
      </div>

      {message && (
        <div className="mb-4 rounded-md bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-200">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">{error}</div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            className="w-full h-11 rounded-md border bg-white px-3 text-sm border-gray-300"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="^[0-9]{6}$"
            maxLength={6}
            autoComplete="one-time-code"
            name="otp"
            required
            className="w-full h-11 rounded-md border bg-white px-3 text-sm border-gray-300"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="123456"
            title="Enter the 6-digit code"
          />
        </div>
        <button type="submit" disabled={isSubmitting || !email || otp.length !== 6} className="w-full bg-[color:var(--brand-gold)] text-white hover:bg-amber-600 disabled:opacity-60 rounded-md py-2.5 font-medium">
          {isSubmitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <div className="text-center mt-4">
        <button onClick={resend} disabled={isResending || !email} className="text-sm text-[color:var(--brand-gold)] hover:underline">
          {isResending ? 'Sending…' : 'Resend code'}
        </button>
      </div>
    </div>
  );
}