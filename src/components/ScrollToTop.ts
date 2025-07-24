import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top on pathname change
    window.scrollTo(0, 0);
  }, [pathname]);

  return null; // No UI
};

export default ScrollToTop;