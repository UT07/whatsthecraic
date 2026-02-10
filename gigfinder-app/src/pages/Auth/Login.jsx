import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import authAPI from '../../services/authAPI';
import { setToken, setUser } from '../../services/apiClient';

const Login = ({ setIsAuthenticated }) => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setErrorMessage('');
    setLoading(true);
    try {
      const result = await authAPI.login({
        email: data.email,
        password: data.password
      });
      setToken(result.token);
      setUser(result.user);
      setIsAuthenticated(true);
      navigate('/dashboard');
    } catch (error) {
      const message = error?.response?.data?.error?.message || 'Login failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 card animate-fade-up">
      <h1 className="section-title mb-2">Welcome back</h1>
      <p className="text-muted mb-6">Log in to sync Spotify insights and curate your feed.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm font-semibold">Email</label>
          <input
            type="email"
            {...register("email", { required: true })}
            className="input"
          />
          {errors.email && <span className="text-red-500 text-sm">Email is required.</span>}
        </div>
        <div>
          <label className="text-sm font-semibold">Password</label>
          <input
            type="password"
            {...register("password", { required: true })}
            className="input"
          />
          {errors.password && <span className="text-red-500 text-sm">Password is required.</span>}
        </div>
        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default Login;
