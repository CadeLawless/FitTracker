import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isNavbarVisible } from '../lib/isNavbarVisible';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const offset = isNavbarVisible() ? -75 : 0;

    // Scroll to top on pathname change
    window.scrollTo(0, offset);
  }, [pathname]);

  return null; // No UI
};

export default ScrollToTop;