// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../utils/apiUtils";
import { setToken, setUser, setRole, setUsername } from "../utils/auth";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberMeEmail");
    const savedPassword = localStorage.getItem("rememberMePassword");
    const savedRememberMe = localStorage.getItem("rememberMeCheckbox") === "true";

    if (savedEmail) setUsernameInput(savedEmail);
    if (savedPassword) setPassword(savedPassword);
    if (savedRememberMe) setRememberMe(true);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!username.includes("@")) {
      setErrorMsg("Email harus mengandung karakter '@'");
      return;
    }

    setIsLoading(true);

    try {
      const data = await login(username, password);
      // login returns { access_token, user: { id, name, email, role } }
      setToken(data.access_token, rememberMe);
      setUser(data.user, rememberMe);
      setRole(data.user.role, rememberMe);
      setUsername(data.user.name, rememberMe);

      if (rememberMe) {
        localStorage.setItem("rememberMeEmail", username);
        localStorage.setItem("rememberMePassword", password);
        localStorage.setItem("rememberMeCheckbox", "true");
      } else {
        localStorage.removeItem("rememberMeEmail");
        localStorage.removeItem("rememberMePassword");
        localStorage.removeItem("rememberMeCheckbox");
      }

      navigate("/dashboard");
    } catch (error) {
      setErrorMsg(error.message || "Gagal masuk. Periksa kembali username dan password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            E-Learn System
          </h2>
          <p className="text-gray-600">Masuk ke akun Anda</p>
        </div>

        {/* Info Banner & Error Messages */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Masukkan email"
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Remember */}
          <div className="flex items-center text-sm">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-600">Ingat saya</span>
            </label>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-0.5"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>Masuk</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            © 2025 E-Learn System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
