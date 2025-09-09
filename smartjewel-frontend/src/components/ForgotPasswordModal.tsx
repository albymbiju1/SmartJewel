import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { firebaseAuthService } from '../services/firebaseAuth';

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

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ 
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      await firebaseAuthService.sendPasswordReset(values.email);
      setIsSuccess(true);
    } catch (error: any) {
      // For security, we show the same message regardless of whether the email exists
      setIsSuccess(true);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Reset Password</h2>
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
          /* Success State */
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Check Your Email</h3>
            <p className="text-gray-600 text-sm mb-6">
              If this email is registered, a password reset link has been sent to your inbox.
            </p>
            <button
              onClick={handleClose}
              className="w-full bg-[color:var(--brand-gold)] text-white hover:bg-amber-600 rounded-md py-2.5 font-medium"
            >
              Got it
            </button>
          </div>
        ) : (
          /* Form State */
          <>
            <p className="text-gray-600 text-sm mb-6">
              Enter your email address and we'll send you a link to reset your password.
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