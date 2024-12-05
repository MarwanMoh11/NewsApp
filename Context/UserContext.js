import React, { createContext, useContext, useState } from 'react';

// Create the context
const UserContext = createContext(null);

// Create the UserProvider component
export const UserProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null); // Store user info here

  return (
    <UserContext.Provider value={{ userInfo, setUserInfo }}>
      {children}  {/* Wrap children with this provider */}
    </UserContext.Provider>
  );
};

// Custom hook to access user info
export const useUser = () => useContext(UserContext);
