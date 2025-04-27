// app/ScrollContext.tsx
import React, { createContext, useState } from 'react';

interface ScrollContextProps {
  scrollToTop: () => void;
  setScrollToTop: (fn: () => void) => void;
}

export const ScrollContext = createContext<ScrollContextProps>({
  scrollToTop: () => {},
  setScrollToTop: () => {},
});

export const ScrollProvider: React.FC = ({ children }) => {
  const [scrollToTopFn, setScrollToTopFn] = useState<() => void>(() => () => {});

  return (
    <ScrollContext.Provider value={{ scrollToTop: scrollToTopFn, setScrollToTop: setScrollToTopFn }}>
      {children}
    </ScrollContext.Provider>
  );
};
