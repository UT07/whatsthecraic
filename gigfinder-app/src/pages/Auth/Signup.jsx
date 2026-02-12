import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import authAPI from '../../services/authAPI';

const Signup = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setErrorMessage('');
    setLoading(true);
    try {
      await authAPI.signup({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role || 'user'
      });
      navigate('/auth/login');
    } catch (error) {
      const message = error?.response?.data?.error?.message || 'Signup failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <h1 className="section-title mb-2">Create your profile</h1>
          <p className="text-muted">Start discovering your next favorite event</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Full name</label>
              <input
                type="text"
                placeholder="Your name"
                {...register("name", { required: true })}
                className="input"
              />
              {errors.name && <span className="text-red-500 text-sm mt-1 block">Name is required.</span>}
            </div>
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
                placeholder="Minimum 8 characters"
                {...register("password", { required: true, minLength: 8 })}
                className="input"
              />
              {errors.password && <span className="text-red-500 text-sm mt-1 block">Minimum 8 characters required.</span>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">I'm an</label>
              <select {...register("role")} className="input">
                <option value="user">Event attendee</option>
                <option value="organizer">Event organizer</option>
              </select>
            </div>
            {errorMessage && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{errorMessage}</p>}
            <button type="submit" className="btn btn-primary w-full mt-6" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-muted text-sm">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-accent font-semibold hover:text-accent-2 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
