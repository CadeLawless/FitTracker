import { isNavbarVisible } from "./isNavbarVisible";

export const scrollToElement = (element: HTMLElement) => {
  const offset = isNavbarVisible() ? 75 : 10;

  const y = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top: y,
    behavior: 'smooth',
  });
};

export const scrollToRef = (elementRef: React.RefObject<HTMLElement>, condition: Boolean) => {
  if (condition) {    
    if(elementRef.current){
      scrollToElement(elementRef.current);
    }
  }
}