import React, { useState } from "react";
import { Auth } from "@aws-amplify/auth";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await Auth.signIn(email, password);
      navigate("/");
    } catch (err) {
      alert("Login Failed: " + err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-green-400">
      <h2 className="text-2xl">Login</h2>
      <input className="p-2 m-2 bg-gray-800" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input className="p-2 m-2 bg-gray-800" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin} className="p-2 bg-green-400 text-black rounded">Login</button>
    </div>
  );
};

export default Login;
