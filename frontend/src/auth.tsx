import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import * as api from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, fullName: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  });

  const registerMutation = useMutation({
    mutationFn: ({
      email,
      fullName,
      password,
    }: {
      email: string;
      fullName: string;
      password: string;
    }) => api.register(email, fullName, password),
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["me"], null);
    },
  });

  const user = meQuery.data ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: meQuery.isLoading,
        isAdmin: Boolean(user?.is_admin || user?.role === "admin"),
        login: (email, password) => loginMutation.mutateAsync({ email, password }),
        register: (email, fullName, password) =>
          registerMutation.mutateAsync({ email, fullName, password }),
        logout: () => logoutMutation.mutateAsync(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
