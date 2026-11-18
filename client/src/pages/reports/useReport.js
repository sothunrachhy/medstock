import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../api/client';
import { useToast } from '../../context/ToastContext';

/** Fetches a report endpoint whenever its params change. */
export default function useReport(url, params, enabled = true) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(params);

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    api
      .get(url, { params: JSON.parse(key) })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [url, key, enabled, toast]);

  useEffect(load, [load]);
  return { data, loading, reload: load, setData };
}
