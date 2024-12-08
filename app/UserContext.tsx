import React, { createContext, useState, ReactNode } from 'react';

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
  const [userToken, setUserToken] = useState<string | null>(null);

  return (
    <UserContext.Provider value={{ userToken, setUserToken }}>
      {children}
    </UserContext.Provider>
  );
};
