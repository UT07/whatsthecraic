import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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
    <div className="max-w-md mx-auto mt-10 card animate-fade-up">
      <h1 className="section-title mb-2">Create your profile</h1>
      <p className="text-muted mb-6">Start personalizing your event intelligence.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm font-semibold">Name</label>
          <input
            type="text"
            {...register("name", { required: true })}
            className="input"
          />
          {errors.name && <span className="text-red-500 text-sm">Name is required.</span>}
        </div>
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
            {...register("password", { required: true, minLength: 8 })}
            className="input"
          />
          {errors.password && <span className="text-red-500 text-sm">Minimum 8 characters.</span>}
        </div>
        <div>
          <label className="text-sm font-semibold">Role</label>
          <select {...register("role")} className="input">
            <option value="user">Event-goer</option>
            <option value="organizer">Organizer</option>
          </select>
        </div>
        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
};

export default Signup;
