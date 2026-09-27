import { createContext, useContext, useState, type ReactNode } from 'react';

export type AuthUser = {
  username: string;
  isAdmin: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (username: string, password: string) => {
    if (!username.trim() || !password.trim()) {
      throw new Error('Username and password are required.');
    }

    setIsLoading(true);

    // TODO: replace with real API call
    await new Promise((resolve) => setTimeout(resolve, 600));

    const normalizedUsername = username.trim();
    const isAdmin = normalizedUsername.toLowerCase() === 'admin';

    setUser({ username: normalizedUsername, isAdmin });
    setIsLoading(false);
  };

  const register = async (username: string, password: string, confirmPassword: string) => {
    if (!username.trim()) {
      throw new Error('Username is required.');
    }

    if (!password) {
      throw new Error('Password is required.');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    setIsLoading(true);

    // TODO: replace with real API call
    await new Promise((resolve) => setTimeout(resolve, 600));

    const normalizedUsername = username.trim();
    const isAdmin = normalizedUsername.toLowerCase() === 'admin';

    setUser({ username: normalizedUsername, isAdmin });
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

export default AuthContext;
