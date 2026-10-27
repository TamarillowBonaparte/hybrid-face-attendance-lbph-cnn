import { useEffect, useRef } from 'react';

export const usePolling = (callback, interval = 5000, dependencies = []) => {
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    // Set up the interval
    let id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [interval, ...dependencies]);
};
