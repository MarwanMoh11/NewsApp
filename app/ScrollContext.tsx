import React, { createContext, useState, ReactNode } from 'react'; // Import ReactNode

interface ScrollContextProps {
  scrollToTop: () => void;
  setScrollToTop: (fn: () => void) => void;
}

// Define props for ScrollProvider, explicitly including children
interface ScrollProviderComponentProps {
  children?: ReactNode; // 'children' can be optional depending on your use case
}

export const ScrollContext = createContext<ScrollContextProps>({
  scrollToTop: () => {},
  setScrollToTop: () => {},
});

// Use the new props interface with React.FC
export const ScrollProvider: React.FC<ScrollProviderComponentProps> = ({ children }) => {
  const [scrollToTopFn, setScrollToTopFn] = useState<() => void>(() => () => {});

  return (
      <ScrollContext.Provider value={{ scrollToTop: scrollToTopFn, setScrollToTop: setScrollToTopFn }}>
        {children}
      </ScrollContext.Provider>
  );
};