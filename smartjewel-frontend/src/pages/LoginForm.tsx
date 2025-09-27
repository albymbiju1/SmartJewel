import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { firebaseAuthService } from '../services/firebaseAuth';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { useAuth } from '../contexts/AuthContext';
import { loginSchema, LoginFormValues } from '../utils/validation';

type FormValues = LoginFormValues;

interface Props {
  onSuccess: (tokens: { access_token: string; refresh_token: string }, user: any) => void;
  switchToRegister: () => void;
}

export const LoginForm: React.FC<Props> = ({ onSuccess, switchToRegister }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const { loginWithFirebase } = useAuth();
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors, isSubmitting, isValid, touchedFields }, getValues } = useForm<FormValues>({ 
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    criteriaMode: 'all'
  });

  const isFieldValid = (name: keyof FormValues) => {
    const val = getValues(name);
    const hasValue = typeof val === 'string' ? val.length > 0 : !!val;
    return touchedFields[name] && !errors[name] && hasValue;
  };
  
  const onSubmit = async (values: FormValues) => {
    try {
      setLoginError(null);
      // Direct backend login with email/password
      const response = await api.post('/auth/login', {
        email: values.email,
        password: values.password,
      });

      const tokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
      };
      const userData = response.data.user;

      onSuccess(tokens, userData);
    } catch (error: any) {
      const errorData = error?.response?.data;
      if (errorData?.error === 'validation_failed' && errorData?.details) {
        const validationMessages = Object.values(errorData.details).flat().join(', ');
        setLoginError(validationMessages);
      } else if (errorData?.error === 'account_unverified') {
        setLoginError('Please verify your email before signing in.');
        // Route to OTP verification with email prefilled
        const email = getValues('email');
        setTimeout(() => navigate('/verify-otp', { state: { email } }), 300);
      } else if (error?.response?.status === 401 || errorData?.error === 'invalid_credentials') {
        setLoginError('Invalid email or password. Please try again.');
      } else {
        setLoginError(errorData?.error || 'Login failed. Please try again.');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSigningIn(true);
      setLoginError(null);
      
      const result = await firebaseAuthService.signInWithGoogle();
      await loginWithFirebase(result.user);
      // After exchange, use tokens and user saved by AuthContext
      const access = localStorage.getItem('access_token') || '';
      const refresh = localStorage.getItem('refresh_token') || '';
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      onSuccess({ access_token: access, refresh_token: refresh }, userData);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Google sign-in failed. Please try again.';
      setLoginError(message);
    } finally {
      setIsGoogleSigningIn(false);
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
              className={`w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 ${errors.email ? 'border-red-500 focus:ring-red-200' : isFieldValid('email') ? 'border-emerald-500 focus:ring-emerald-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
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
              className={`w-full h-11 rounded-md border bg-white px-10 pr-10 text-sm focus:outline-none focus:ring-2 ${errors.password ? 'border-red-500 focus:ring-red-200' : isFieldValid('password') ? 'border-emerald-500 focus:ring-emerald-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
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
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-[color:var(--brand-gold)] hover:underline"
          >
            Forgot Password?
          </button>
        </div>

        <button type="submit" disabled={isSubmitting || !isValid} className="w-full bg-[color:var(--brand-gold)] text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-md py-2.5 font-medium inline-flex items-center justify-center gap-2">
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

      {/* Divider */}
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-gray-200"></div>
        <span className="px-4 text-sm text-gray-500">or</span>
        <div className="flex-1 border-t border-gray-200"></div>
      </div>

      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleSigningIn || isSubmitting}
        className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-md py-2.5 font-medium inline-flex items-center justify-center gap-3 transition-colors"
      >
        {isGoogleSigningIn ? (
          <>
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            Signing in with Google...
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>

      {/* Footer */}
      <div className="text-center mt-6 text-sm text-gray-500">
        <p>
          Don't have an account?{' '}
          <button type="button" onClick={switchToRegister} className="text-[color:var(--brand-gold)] hover:underline">
            Create one here
          </button>
        </p>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
};
