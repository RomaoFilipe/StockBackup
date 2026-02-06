"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { getSessionClient } from "@/utils/authClient";

interface User {
  id: string;
  name?: string;
  email: string;
  role?: "USER" | "ADMIN";
  tenantId?: string;
  isActive?: boolean;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize local storage with default values if not already set
    if (localStorage.getItem("isAuth") === null) {
      localStorage.setItem("isAuth", "false");
    }
    if (localStorage.getItem("isLoggedIn") === null) {
      localStorage.setItem("isLoggedIn", "false");
    }
    if (localStorage.getItem("getSession") === null) {
      localStorage.setItem("getSession", "");
    }
    if (localStorage.getItem("theme") === null) {
      localStorage.setItem("theme", "light");
    }
    if (localStorage.getItem("jiraBaseUrl") === null) {
      localStorage.setItem("jiraBaseUrl", "atlassian.net");
    }
    if (localStorage.getItem("captureCloudUrl") === null) {
      localStorage.setItem(
        "captureCloudUrl",
        "https://prod-capture.zephyr4jiracloud.com/capture"
      );
    }

    const checkSession = async () => {
      setIsAuthLoading(true);
      try {
        const session = await getSessionClient();
        if (session) {
          setIsLoggedIn(true);
          setUser({
            id: session.id,
            name: session.name ?? undefined,
            email: session.email,
            role: session.role,
          });
          localStorage.setItem("isAuth", "true");
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("getSession", JSON.stringify(session));
          return;
        }

        clearAuthData();
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await axiosInstance.post("/auth/login", {
        email,
        password,
      });

      const session = await getSessionClient();
      if (!session) {
        throw new Error("Login succeeded but session could not be loaded");
      }

      setIsLoggedIn(true);
      setUser({
        id: session.id,
        name: session.name ?? undefined,
        email: session.email,
        role: session.role,
        tenantId: (session as any).tenantId,
        isActive: (session as any).isActive,
      });

      localStorage.setItem("isAuth", "true");
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("getSession", JSON.stringify(session));
    } catch (error) {
      console.error("Error logging in:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post("/auth/logout");
      clearAuthData();
      // Debug log - only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log("Logout successful, session ID removed");
      }
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  };

  const clearAuthData = () => {
    setIsLoggedIn(false);
    setUser(null);
    // Clear attributes from local storage
    localStorage.setItem("isAuth", "false");
    localStorage.setItem("isLoggedIn", "false");
    localStorage.setItem("getSession", "");
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAuthLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
