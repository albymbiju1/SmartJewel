import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onSuccess: (tokens: any, user: any) => void;
  switchToRegister: () => void;
}

export const LoginForm: React.FC<Props> = ({ onSuccess, switchToRegister }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ 
    resolver: zodResolver(schema)
  });
  
  const onSubmit = async (values: FormValues) => {
    try {
      setLoginError(null);
      const res = await api.post('/auth/login', values);
      // user object now contains full_name, role, permissions
      onSuccess({ access_token: res.data.access_token, refresh_token: res.data.refresh_token }, res.data.user);
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData?.error === 'validation_failed' && errorData?.details) {
        // Handle validation errors
        const validationMessages = Object.values(errorData.details).flat().join(', ');
        setLoginError(validationMessages);
      } else if (errorData?.error === 'invalid_credentials') {
        setLoginError('Invalid email or password. Please try again.');
      } else {
        setLoginError(errorData?.error || 'Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <img src="/logo192.png" alt="SmartJewel logo" width="192" height="192" className="h-10 md:h-12 w-auto object-contain drop-shadow-sm select-none" />
        </div>
        <h1 className="text-xl font-semibold text-gray-800">Welcome Back</h1>
        <p className="text-gray-500 text-sm">Sign in to your SmartJewel account</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {loginError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            {loginError}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...register('email')}
              className={`w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 ${errors.email ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
            />
          </div>
          {errors.email && <span className="text-xs text-red-600 mt-1 block">{errors.email.message}</span>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <circle cx="12" cy="16" r="1"></circle>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password')}
              className={`w-full h-11 rounded-md border bg-white px-10 pr-10 text-sm focus:outline-none focus:ring-2 ${errors.password ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          {errors.password && <span className="text-xs text-red-600 mt-1 block">{errors.password.message}</span>}
        </div>

        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4" />
            Remember me
          </label>
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full bg-[color:var(--brand-gold)] text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-md py-2.5 font-medium inline-flex items-center justify-center gap-2">
          {isSubmitting ? (
            <>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="text-center mt-6 text-sm text-gray-500">
        <p>
          Don't have an account?{' '}
          <button type="button" onClick={switchToRegister} className="text-[color:var(--brand-gold)] hover:underline">
            Create one here
          </button>
        </p>
      </div>
    </div>
  );
};
