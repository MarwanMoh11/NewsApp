// app/ContentChoiceContext.tsx
import React, { createContext, useState, ReactNode } from 'react';

interface ContentChoiceContextType {
  contentChoice: string;
  setContentChoice: (choice: string) => void;
}

export const ContentChoiceContext = createContext<ContentChoiceContextType>({
  contentChoice: 'All',
  setContentChoice: () => {},
});

export const ContentChoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [contentChoice, setContentChoice] = useState<string>('All');
  return (
    <ContentChoiceContext.Provider value={{ contentChoice, setContentChoice }}>
      {children}
    </ContentChoiceContext.Provider>
  );
};
