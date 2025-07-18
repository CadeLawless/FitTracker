export const formatMinutes = (minutes:number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hrs}h`;
  } else {
    return `${hrs}h ${mins}m`;
  }
}