export const insertHTMLLineBreaks = (str: string): (string | JSX.Element)[] => {
  return str.split('\n').flatMap((line, i, arr) =>
    i < arr.length - 1 ? [line, <br key={i} />] : [line]
  );
};