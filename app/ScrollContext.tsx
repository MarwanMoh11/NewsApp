// app/ScrollContext.tsx

import React, { createContext, useState } from 'react';

interface ScrollContextProps {
  homePageScrollPosition: number;
  setHomePageScrollPosition: (position: number) => void;
  repostFeedScrollPosition: number;
  setRepostFeedScrollPosition: (position: number) => void;
  // Add more scroll positions for other pages if needed
}

export const ScrollContext = createContext<ScrollContextProps>({
  homePageScrollPosition: 0,
  setHomePageScrollPosition: () => {},
  repostFeedScrollPosition: 0,
  setRepostFeedScrollPosition: () => {},
});

export const ScrollProvider: React.FC = ({ children }) => {
  const [homePageScrollPosition, setHomePageScrollPosition] = useState(0);
  const [repostFeedScrollPosition, setRepostFeedScrollPosition] = useState(0);

  return (
    <ScrollContext.Provider
      value={{
        homePageScrollPosition,
        setHomePageScrollPosition,
        repostFeedScrollPosition,
        setRepostFeedScrollPosition,
      }}
    >
      {children}
    </ScrollContext.Provider>
  );
};
