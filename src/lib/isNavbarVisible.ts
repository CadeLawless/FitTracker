export const isNavbarVisible = () => {
    const navbar = document.getElementById('navbar');
    return navbar && window.getComputedStyle(navbar).display !== 'none';
};