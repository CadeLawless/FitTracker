export const scrollToElement = (elementRef: React.RefObject<HTMLDivElement>, condition: Boolean) => {
  if (condition) {
    const navbar = document.getElementById('navbar');
    const isNavbarVisible = navbar && window.getComputedStyle(navbar).display !== 'none';
    const offset = isNavbarVisible ? 75 : 10;
    
    const y = elementRef.current.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({
      top: y,
      behavior: 'smooth',
    });
  }
}