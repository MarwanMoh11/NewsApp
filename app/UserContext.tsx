import React, { createContext, useState, useEffect, ReactNode } from 'react';

interface UserContextType {
  userToken: string | null;
  setUserToken: (token: string | null) => void;
}

export const UserContext = createContext<UserContextType>({
  userToken: null,
  setUserToken: () => {},
});

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userToken, setUserTokenState] = useState<string | null>(null);

  // Load token from localStorage on initial render (web only)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedToken = window.localStorage.getItem('userToken');
      if (storedToken) {
        setUserTokenState(storedToken);
      }
    }
  }, []);

  // Whenever userToken changes, save it to localStorage (web only)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (userToken) {
        window.localStorage.setItem('userToken', userToken);
      } else {
        window.localStorage.removeItem('userToken');
      }
    }
  }, [userToken]);

  const setUserToken = (token: string | null) => {
    setUserTokenState(token);
  };

  return (
    <UserContext.Provider value={{ userToken, setUserToken }}>
      {children}
    </UserContext.Provider>
  );
};
