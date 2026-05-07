import { useState, useEffect } from 'react';
import liff from '@line/liff';

export function useLiff(liffId) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    liff
      .init({ liffId })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const p = await liff.getProfile();
        setProfile(p);
        setReady(true);
      })
      .catch((err) => setError(err.message));
  }, [liffId]);

  return { ready, profile, error };
}
