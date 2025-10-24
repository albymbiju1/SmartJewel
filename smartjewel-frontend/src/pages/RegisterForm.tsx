import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api';
import { registrationSchema, RegistrationFormValues } from '../utils/validation';
import { firebaseAuthService } from '../services/firebaseAuth';

type FormValues = RegistrationFormValues;

interface Props {
  onSuccess: (email: string) => void;
  switchToLogin: () => void;
}

export const RegisterForm: React.FC<Props> = ({ onSuccess, switchToLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting, isValid, touchedFields }, getValues } = useForm<FormValues>({ 
    resolver: zodResolver(registrationSchema),
    mode: 'onBlur',
    criteriaMode: 'all'
  });

  const isFieldValid = (name: keyof FormValues) => {
    const val = getValues(name);
    const hasValue = typeof val === 'string' ? val.length > 0 : !!val;
    return touchedFields[name] && !errors[name] && hasValue;
  };

  const shouldShowError = (name: keyof FormValues) => {
    return touchedFields[name] && errors[name];
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setRegisterError(null);
      
      // Register only via backend; backend will handle Firebase linking/creation
      const response = await api.post('/auth/register', {
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone
      });

      // Redirect to OTP verification with email prefilled
      onSuccess(values.email);
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData?.error === 'validation_failed' && errorData?.details) {
        // Handle validation errors
        const validationMessages = Object.values(errorData.details).flat().join(', ');
        setRegisterError(validationMessages);
      } else if (errorData?.error === 'account_unverified') {
        // Redirect to OTP verification with email prefilled and request resend
        try {
          await api.post('/auth/request-otp', { email: values.email });
        } catch {}
        onSuccess(values.email);
        return;
      } else if (errorData?.error === 'email_in_use') {
        setRegisterError('This email is already registered. Please use a different email or try logging in.');
      } else {
        setRegisterError(errorData?.error || 'Registration failed. Please try again.');
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
        <h1 className="text-xl font-semibold text-gray-800">Create Account</h1>
        <p className="text-gray-500 text-sm">Join SmartJewel and discover premium jewelry</p>
      </div>

      {/* Register Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {registerError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            {registerError}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              {...register('name')}
              className={`w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 ${shouldShowError('name') ? 'border-red-500 focus:ring-red-200' : isFieldValid('name') ? 'border-emerald-500 focus:ring-emerald-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
            />
          </div>
          {shouldShowError('name') && <span className="text-xs text-red-600 mt-1 block">{errors.name?.message}</span>}
        </div>

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
              className={`w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 ${shouldShowError('email') ? 'border-red-500 focus:ring-red-200' : isFieldValid('email') ? 'border-emerald-500 focus:ring-emerald-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
            />
          </div>
          {shouldShowError('email') && <span className="text-xs text-red-600 mt-1 block">{errors.email?.message}</span>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            <input
              id="phone"
              type="tel"
              placeholder="Enter your phone number"
              {...register('phone')}
              className={`w-full h-11 rounded-md border bg-white px-10 text-sm focus:outline-none focus:ring-2 ${shouldShowError('phone') ? 'border-red-500 focus:ring-red-200' : isFieldValid('phone') ? 'border-emerald-500 focus:ring-emerald-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
            />
          </div>
          {shouldShowError('phone') && <span className="text-xs text-red-600 mt-1 block">{errors.phone?.message}</span>}
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
              placeholder="Create a password"
              {...register('password')}
              className={`w-full h-11 rounded-md border bg-white px-10 pr-10 text-sm focus:outline-none focus:ring-2 ${shouldShowError('password') ? 'border-red-500 focus:ring-red-200' : isFieldValid('password') ? 'border-emerald-500 focus:ring-emerald-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
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
          {shouldShowError('password') && <span className="text-xs text-red-600 mt-1 block">{errors.password?.message}</span>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <circle cx="12" cy="16" r="1"></circle>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              {...register('confirmPassword')}
              className={`w-full h-11 rounded-md border bg-white px-10 pr-10 text-sm focus:outline-none focus:ring-2 ${shouldShowError('confirmPassword') ? 'border-red-500 focus:ring-red-200' : isFieldValid('confirmPassword') ? 'border-emerald-500 focus:ring-emerald-200' : 'border-gray-300 focus:ring-[color:var(--brand-gold)]/30'}`}
            />
          </div>
          {shouldShowError('confirmPassword') && <span className="text-xs text-red-600 mt-1 block">{errors.confirmPassword?.message}</span>}
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" required className="h-4 w-4 mt-1" />
          I agree to the Terms of Service and Privacy Policy
        </div>

        <button type="submit" disabled={isSubmitting || !isValid} className="w-full bg-[color:var(--brand-gold)] text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-md py-2.5 font-medium inline-flex items-center justify-center gap-2">
          {isSubmitting ? (
            <>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="text-center mt-6 text-sm text-gray-500">
        <p>
          Already have an account?{' '}
          <button type="button" onClick={switchToLogin} className="text-[color:var(--brand-gold)] hover:underline">
            Sign in here
          </button>
        </p>
      </div>
    </div>
  );
};
