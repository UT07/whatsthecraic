import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import authAPI from '../../services/authAPI';

const ForgotPassword = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const result = await authAPI.resetPassword({
        email: data.email,
        newPassword: data.newPassword
      });
      setMessage(result.message || 'Password has been reset successfully. You can now log in.');
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to reset password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <h1 className="section-title mb-2">Reset Password</h1>
          <p className="text-muted">Enter your email and a new password</p>
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
              <label className="block text-sm font-semibold mb-2">New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                {...register("newPassword", { required: true, minLength: 6 })}
                className="input"
              />
              {errors.newPassword && <span className="text-red-500 text-sm mt-1 block">Password must be at least 6 characters.</span>}
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{error}</p>}
            {message && <p className="text-green-600 text-sm bg-green-50 p-3 rounded-md">{message}</p>}
            <button type="submit" className="btn btn-primary w-full mt-6" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
        <div className="mt-6 text-center">
          <p className="text-muted text-sm">
            Remember your password?{' '}
            <Link to="/auth/login" className="text-accent font-semibold hover:text-accent-2 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
