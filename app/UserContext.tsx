import React, { createContext, useState, useEffect, ReactNode } from 'react';

interface UserContextType {
  userToken: string | null;
  setUserToken: (token: string | null) => void;
  isDarkTheme: boolean;
  toggleTheme: () => void;
}

export const UserContext = createContext<UserContextType>({
  userToken: null,
  setUserToken: () => {},
  isDarkTheme: false,
  toggleTheme: () => {},
});

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userToken, setUserTokenState] = useState<string | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  // Load userToken from localStorage on initial render
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedToken = window.localStorage.getItem('userToken');
      if (storedToken) {
        setUserTokenState(storedToken);
      }
    }
  }, []);

  // Save userToken to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (userToken) {
        window.localStorage.setItem('userToken', userToken);
      } else {
        window.localStorage.removeItem('userToken');
      }
    }
  }, [userToken]);

  // Load theme preference from localStorage on initial render
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('isDarkTheme');
      if (storedTheme) {
        setIsDarkTheme(storedTheme === 'true');
      }
    }
  }, []);

  // Save theme preference to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('isDarkTheme', isDarkTheme.toString());
    }


  }, [isDarkTheme]);

  const setUserToken = (token: string | null) => {
    setUserTokenState(token);
  };

  const toggleTheme = () => {
    setIsDarkTheme((prevTheme) => !prevTheme);
  };

  return (
    <UserContext.Provider
      value={{ userToken, setUserToken, isDarkTheme, toggleTheme }}
    >
      {children}
    </UserContext.Provider>
  );
};
