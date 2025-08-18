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
    <div className="auth-card">
      {/* Header */}
      <div className="auth-header">
        <div className="auth-logo">
          <img src="/logo192.png" alt="SmartJewel" />
        </div>
        <h1>Welcome Back</h1>
        <p>Sign in to your SmartJewel account</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
        {loginError && (
          <div className="error-message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            {loginError}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <div className="input-wrapper">
            <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...register('email')}
              className={errors.email ? 'error' : ''}
            />
          </div>
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="input-wrapper">
            <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <circle cx="12" cy="16" r="1"></circle>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              {...register('password')}
              className={errors.password ? 'error' : ''}
            />
            <button
              type="button"
              className="password-toggle"
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
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>

        <div className="form-actions">
          <label className="checkbox-wrapper">
            <input type="checkbox" />
            <span className="checkmark"></span>
            Remember me
          </label>
        </div>

        <button type="submit" disabled={isSubmitting} className="auth-button">
          {isSubmitting ? (
            <>
              <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      <div className="auth-footer">
        <p>
          Don't have an account?{' '}
          <button type="button" onClick={switchToRegister} className="auth-link">
            Create one here
          </button>
        </p>
      </div>
    </div>
  );
};
