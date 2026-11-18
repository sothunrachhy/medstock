import { useEffect, useState } from 'react';
import api from '../api/client';

/** Current password rule from Settings → Auth (falls back to 6 characters). */
export default function usePasswordPolicy() {
  const [policy, setPolicy] = useState({ minPasswordLength: 6 });
  useEffect(() => {
    api
      .get('/auth/policy')
      .then((r) => setPolicy(r.data))
      .catch(() => {});
  }, []);
  return policy;
}
