import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(6).max(128),
  phone: z.string().min(7).max(16).regex(/^[0-9\-\+ ]+$/)
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onSuccess: () => void;
  switchToLogin: () => void;
}

export const RegisterForm: React.FC<Props> = ({ onSuccess, switchToLogin }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema)});
  const onSubmit = async (values: FormValues) => {
    await api.post('/auth/register', values);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card">
      <h2>Register</h2>
      <label>Name</label>
      <input {...register('name')} />
      {errors.name && <span className="err">{errors.name.message}</span>}
      <label>Email</label>
      <input type="email" {...register('email')} />
      {errors.email && <span className="err">{errors.email.message}</span>}
      <label>Password</label>
      <input type="password" {...register('password')} />
      {errors.password && <span className="err">{errors.password.message}</span>}
  <label>Phone</label>
  <input {...register('phone')} />
  {errors.phone && <span className="err">{errors.phone.message}</span>}
      <button disabled={isSubmitting} className="primary">{isSubmitting? '...' : 'Create Account'}</button>
      <div className="alt">Have an account? <button type="button" onClick={switchToLogin}>Login</button></div>
    </form>
  );
};
