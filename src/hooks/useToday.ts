import { useEffect, useState } from 'react';
import { todayString } from '../domain/dates';

/** Today's date as YYYY-MM-DD. Updates itself if the page stays open past midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayString());
  useEffect(() => {
    const tick = () => setToday((prev) => {
      const now = todayString();
      return now === prev ? prev : now;
    });
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}
