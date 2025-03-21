import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

const Login = ({ setIsAuthenticated }) => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();

  const onSubmit = (data) => {
    // For a real app, validate the credentials on the backend.
    // Here, we simulate successful login if email and password are provided.
    if (data.email && data.password) {
      // Set a dummy token in localStorage
      localStorage.setItem('dummyToken', 'my-secret-token');
      setIsAuthenticated(true);
      navigate('/dashboard');
    } else {
      alert('Invalid credentials');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-gray-800 p-6 rounded">
      <h1 className="text-2xl mb-4">Login</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
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
            {...register("password", { required: true })}
            className="w-full p-2 rounded bg-gray-700"
          />
          {errors.password && <span className="text-red-500">This field is required</span>}
        </div>
        <button type="submit" className="bg-green-500 p-2 rounded w-full">Login</button>
      </form>
    </div>
  );
};

export default Login;
