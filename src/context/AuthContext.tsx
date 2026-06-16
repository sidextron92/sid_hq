"use client";

import React, { createContext, useContext, useCallback, useSyncExternalStore } from "react";
import pb from "@/lib/pocketbase";
import type { RecordModel } from "pocketbase";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<string>;
  verifySignupOtp: (otpId: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
type AuthSnapshot = { user: AuthUser | null; loading: boolean };
const serverAuthSnapshot: AuthSnapshot = { user: null, loading: true };
let authSnapshot: AuthSnapshot = serverAuthSnapshot;
const authListeners = new Set<() => void>();

function getAuthStoreUser(): AuthUser | null {
  if (!pb.authStore.isValid || !pb.authStore.record) return null;
  const record = pb.authStore.record as RecordModel;
  return { id: record.id, email: record.email, name: record.name };
}

function setAuthSnapshot(next: AuthSnapshot) {
  authSnapshot = next;
  for (const listener of authListeners) listener();
}

function readAuthStoreSnapshot(): AuthSnapshot {
  return { user: getAuthStoreUser(), loading: false };
}

function subscribeAuthStore(listener: () => void) {
  let active = true;
  authListeners.add(listener);

  queueMicrotask(() => {
    if (active) setAuthSnapshot(readAuthStoreSnapshot());
  });

  const unsub = pb.authStore.onChange((_token, record) => {
    if (record) {
      const r = record as RecordModel;
      setAuthSnapshot({ user: { id: r.id, email: r.email, name: r.name }, loading: false });
    } else {
      setAuthSnapshot({ user: null, loading: false });
    }
  });

  return () => {
    active = false;
    authListeners.delete(listener);
    unsub();
  };
}

function getAuthSnapshot() {
  return authSnapshot;
}

function getServerAuthSnapshot() {
  return serverAuthSnapshot;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSyncExternalStore(
    subscribeAuthStore,
    getAuthSnapshot,
    getServerAuthSnapshot
  );

  const login = useCallback(async (email: string, password: string) => {
    const result = await pb.collection("users").authWithPassword(email, password);
    const r = result.record as RecordModel;
    setAuthSnapshot({ user: { id: r.id, email: r.email, name: r.name }, loading: false });
  }, []);

  // Signup: create account + send OTP for verification. Returns otpId.
  const signup = useCallback(async (email: string, password: string, name?: string): Promise<string> => {
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      name: name || "",
    });
    // Send OTP for email verification
    const result = await pb.collection("users").requestOTP(email);
    return result.otpId;
  }, []);

  // Verify signup OTP — authenticates and verifies the user
  const verifySignupOtp = useCallback(async (otpId: string, code: string) => {
    const result = await pb.collection("users").authWithOTP(otpId, code);
    const r = result.record as RecordModel;
    setAuthSnapshot({ user: { id: r.id, email: r.email, name: r.name }, loading: false });
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setAuthSnapshot({ user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifySignupOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
