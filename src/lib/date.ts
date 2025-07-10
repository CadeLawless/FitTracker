export const formatDate = (date: string): Date => {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));
  return localDate; // Or format however you like
};