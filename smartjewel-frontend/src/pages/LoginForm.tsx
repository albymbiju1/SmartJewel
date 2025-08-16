import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onSuccess: (tokens: any, user: any) => void;
  switchToRegister: () => void;
}

export const LoginForm: React.FC<Props> = ({ onSuccess, switchToRegister }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema)});
  const onSubmit = async (values: FormValues) => {
    const res = await api.post('/auth/login', values);
    onSuccess({ access_token: res.data.access_token, refresh_token: res.data.refresh_token }, res.data.user);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card">
      <h2>Login</h2>
      <label>Email</label>
      <input type="email" {...register('email')} />
      {errors.email && <span className="err">{errors.email.message}</span>}
      <label>Password</label>
      <input type="password" {...register('password')} />
      {errors.password && <span className="err">{errors.password.message}</span>}
      <button disabled={isSubmitting} className="primary">{isSubmitting? '...' : 'Login'}</button>
      <div className="alt">No account? <button type="button" onClick={switchToRegister}>Register</button></div>
    </form>
  );
};
