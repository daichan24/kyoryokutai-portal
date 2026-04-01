import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

/**
 * 画面幅ベースのモバイル判定（デバイス UA は使わない）
 */
export function useIsMobileBreakpoint(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return mobile;
}
