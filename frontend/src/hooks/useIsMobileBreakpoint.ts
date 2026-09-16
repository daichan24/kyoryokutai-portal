import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

/**
 * 画面幅ベースのモバイル判定（デバイス UA は使わない）
 */
export function useIsMobileBreakpoint(): boolean {
  // 初回レンダー時からwindow.matchMediaで判定する(falseで初期化すると、実際は
  // モバイルでも初回レンダーの一瞬だけデスクトップとして扱われてしまう)
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false));

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return mobile;
}
