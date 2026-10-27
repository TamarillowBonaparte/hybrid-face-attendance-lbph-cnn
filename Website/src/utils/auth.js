// src/utils/auth.js

// Keys used in storage
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const ROLE_KEY = 'role';
const USERNAME_KEY = 'username';

// --- Exported Functions ---

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

export const setToken = (token, remember = false) => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

export const getUser = () => {
  const userStr = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
};

export const setUser = (user, remember = false) => {
  const userStr = JSON.stringify(user);
  if (remember) {
    localStorage.setItem(USER_KEY, userStr);
    if (user.role) localStorage.setItem(ROLE_KEY, user.role);
    if (user.name) localStorage.setItem(USERNAME_KEY, user.name);
  } else {
    sessionStorage.setItem(USER_KEY, userStr);
    if (user.role) sessionStorage.setItem(ROLE_KEY, user.role);
    if (user.name) sessionStorage.setItem(USERNAME_KEY, user.name);
  }
};

export const getRole = () => {
  return localStorage.getItem(ROLE_KEY) || sessionStorage.getItem(ROLE_KEY);
};

export const setRole = (role, remember = false) => {
  if (remember) {
    localStorage.setItem(ROLE_KEY, role);
  } else {
    sessionStorage.setItem(ROLE_KEY, role);
  }
};

export const getUsername = () => {
  return localStorage.getItem(USERNAME_KEY) || sessionStorage.getItem(USERNAME_KEY);
};

export const setUsername = (username, remember = false) => {
  if (remember) {
    localStorage.setItem(USERNAME_KEY, username);
  } else {
    sessionStorage.setItem(USERNAME_KEY, username);
  }
};

export const clearAuth = () => {
  removeToken();
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
};

export const isAuthenticated = () => {
  const token = getToken();
  return !!token && !isTokenExpired();
};

// Check if JWT token is expired
export const isTokenExpired = () => {
  const token = getToken();
  if (!token) return true;

  try {
    // JWT payload is the second segment (base64url encoded)
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false; // No exp claim, assume not expired
    // exp is in seconds, Date.now() is in milliseconds — add 5s buffer
    return payload.exp * 1000 < Date.now() + 5000;
  } catch (e) {
    // If token can't be decoded, treat as expired
    return true;
  }
};

// Force logout: clear all auth data and redirect to login
export const forceLogout = () => {
  clearAuth();
  // Only redirect if not already on the login page
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
};