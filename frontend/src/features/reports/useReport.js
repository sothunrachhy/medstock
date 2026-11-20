import { useCallback, useEffect, useState } from 'react';
import { errMsg } from '@/lib/api';
import { useToast } from '@/app/ToastContext';

/** Runs a report loader from lib/backend (e.g. reports.stockSummary) whenever its params change. */
export default function useReport(loader, params, enabled = true) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(params);

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    loader(JSON.parse(key))
      .then(setData)
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [loader, key, enabled, toast]);

  useEffect(load, [load]);
  return { data, loading, reload: load, setData };
}
