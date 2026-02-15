import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <h1 className="section-title mb-2">Welcome back</h1>
          <p className="text-muted">Sign in to discover and save your favorite events</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                {...register("email", { required: true })}
                className="input"
              />
              {errors.email && <span className="text-red-500 text-sm mt-1 block">Email is required.</span>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                {...register("password", { required: true })}
                className="input"
              />
              {errors.password && <span className="text-red-500 text-sm mt-1 block">Password is required.</span>}
            </div>
            {errorMessage && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{errorMessage}</p>}
            <div className="text-right">
              <Link to="/auth/forgot-password" className="text-sm text-accent hover:text-accent-2 transition-colors">
                Forgot password?
              </Link>
            </div>
            <button type="submit" className="btn btn-primary w-full mt-6" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-muted text-sm">
            Don't have an account?{' '}
            <Link to="/auth/signup" className="text-accent font-semibold hover:text-accent-2 transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
