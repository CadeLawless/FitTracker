export const getNavbarOffset = (): int => {
  const navbar = document.getElementById('navbar'); // adjust to your navbar's actual ID or selector
  const isNavbarVisible = navbar && window.getComputedStyle(navbar).display !== 'none';
  return isNavbarVisible ? 80 : 10;
};

