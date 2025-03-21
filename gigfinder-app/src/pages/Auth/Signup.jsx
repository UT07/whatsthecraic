import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();

  const onSubmit = (data) => {
    // Simulate a successful signup. In a real app, send data to your backend.
    alert('Signup successful! You can now log in.');
    navigate('/auth/login');
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-gray-800 p-6 rounded">
      <h1 className="text-2xl mb-4">Signup</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label>Name</label>
          <input
            type="text"
            {...register("name", { required: true })}
            className="w-full p-2 rounded bg-gray-700"
          />
          {errors.name && <span className="text-red-500">This field is required</span>}
        </div>
        <div className="mb-4">
          <label>Email</label>
          <input
            type="email"
            {...register("email", { required: true })}
            className="w-full p-2 rounded bg-gray-700"
          />
          {errors.email && <span className="text-red-500">This field is required</span>}
        </div>
        <div className="mb-4">
          <label>Password</label>
          <input
            type="password"
            {...register("password", { required: true, minLength: 8 })}
            className="w-full p-2 rounded bg-gray-700"
          />
          {errors.password && <span className="text-red-500">Password must be at least 8 characters</span>}
        </div>
        <button type="submit" className="bg-green-500 p-2 rounded w-full">Signup</button>
      </form>
    </div>
  );
};

export default Signup;
