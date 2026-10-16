import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Lock } from 'lucide-react';
import { api } from '../../utils/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { renderPdfFileName } from '../../utils/pdfSaveLocations';
import { saveBlobAsFile, describeDownloadError } from '../../utils/saveFile';

interface CategoryOption {
  value: string;
  label: string;
}

interface ReportEntry {
  id: string;
  spentAt: string;
  description: string;
  amount: number;
  category: string | null;
  counterparty: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** スタッフが隊員を選んで出力する場合の隊員ID（隊員本人のときは undefined） */
  targetUserId?: string;
  memberName: string;
  categories: CategoryOption[];
  fileNameTemplate?: string;
}

/** 日本時間の今日が属する年度（4月始まり） */
function currentFiscalYear() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

type Draft = { category: string; counterparty: string };

/**
 * 報告書PDFの出力前確認。承認済みの支出について「項目」「相手方」だけを補記できる。
 * 金額・日付・内容は承認済みの値のまま変更できない（サーバー側でも項目・相手方以外は受け付けない）。
 */
export const ActivityExpenseReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetUserId,
  memberName,
  categories,
  fileNameTemplate,
}) => {
  const queryClient = useQueryClient();
  const thisYear = currentFiscalYear();
  const [fiscalYear, setFiscalYear] = useState(thisYear);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [isWorking, setIsWorking] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-expenses', 'report-entries', targetUserId ?? 'me', fiscalYear],
    queryFn: async () => {
      const r = await api.get<{ periodLabel: string; entries: ReportEntry[] }>('/api/activity-expenses/report-entries', {
        params: { userId: targetUserId, fiscalYear },
      });
      return r.data;
    },
    enabled: isOpen,
  });

  // 年度を切り替えたり開き直したら、編集中の内容はサーバーの値から作り直す
  useEffect(() => {
    if (!data) return;
    setDrafts(
      Object.fromEntries(
        data.entries.map((e) => [e.id, { category: e.category || '', counterparty: e.counterparty || '' }]),
      ),
    );
  }, [data]);

  const entries = data?.entries ?? [];
  const changedItems = useMemo(
    () =>
      entries
        .filter((e) => {
          const d = drafts[e.id];
          if (!d) return false;
          return d.category !== (e.category || '') || d.counterparty.trim() !== (e.counterparty || '');
        })
        .map((e) => {
          const d = drafts[e.id];
          return {
            id: e.id,
            ...(d.category ? { category: d.category } : {}),
            counterparty: d.counterparty.trim() || null,
          };
        }),
    [entries, drafts],
  );
  const missingCategoryCount = entries.filter((e) => !drafts[e.id]?.category).length;
  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const saveChanges = async () => {
    if (changedItems.length === 0) return;
    await api.patch('/api/activity-expenses/entries/report-fields', { items: changedItems });
    await queryClient.invalidateQueries({ queryKey: ['activity-expenses'] });
  };

  const handleSaveOnly = async () => {
    setIsWorking(true);
    try {
      await saveChanges();
    } catch (error) {
      alert(describeDownloadError(error));
    } finally {
      setIsWorking(false);
    }
  };

  const handleSaveAndDownload = async () => {
    if (missingCategoryCount > 0 && !window.confirm(`項目が未設定の${missingCategoryCount}件は「未分類」として出力されます。このまま出力しますか？`)) {
      return;
    }
    setIsWorking(true);
    try {
      await saveChanges();
      const response = await api.get('/api/activity-expenses/report-pdf', {
        params: { userId: targetUserId, fiscalYear },
        responseType: 'blob',
        timeout: 60_000,
      });
      if (response.data instanceof Blob && response.data.type === 'application/json') {
        const errorData = JSON.parse(await response.data.text());
        throw new Error(errorData.error || 'PDF出力に失敗しました');
      }
      const fileName = renderPdfFileName(fileNameTemplate, {
        name: memberName,
        date: format(new Date(), 'yyyyMMdd'),
        type: '活動経費報告書',
      });
      await saveBlobAsFile(new Blob([response.data]), fileName, {
        description: '活動経費報告書PDF',
        saveLocationType: 'activityExpenseReport',
      });
      onClose();
    } catch (error) {
      alert(describeDownloadError(error));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (changedItems.length > 0 && !window.confirm('保存していない変更があります。閉じますか？')) return;
        onClose();
      }}
      title="報告書PDFの出力"
      maxWidthClassName="max-w-5xl"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleSaveOnly} disabled={isWorking || changedItems.length === 0}>
            変更を保存（{changedItems.length}件）
          </Button>
          <Button type="button" onClick={handleSaveAndDownload} disabled={isWorking || isLoading}>
            {isWorking ? '処理中...' : changedItems.length > 0 ? '保存してPDFを出力' : 'PDFを出力'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="font-medium text-gray-700 dark:text-gray-300">対象年度</label>
          <select
            value={fiscalYear}
            onChange={(e) => {
              if (changedItems.length > 0 && !window.confirm('保存していない変更があります。年度を切り替えますか？')) return;
              setFiscalYear(Number(e.target.value));
            }}
            className="px-2 py-1 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
          >
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}年度（{y}年4月〜{y + 1}年3月）
              </option>
            ))}
          </select>
          <span className="text-gray-500 dark:text-gray-400">{memberName}さん</span>
        </div>
        <p className="flex items-start gap-1.5 rounded-md bg-gray-50 dark:bg-gray-900/40 p-2 text-xs text-gray-600 dark:text-gray-300">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          承認済みの支出が報告書に載ります。ここでは「項目」と「相手方（支払先）」だけ追記・変更でき、承認はそのまま残ります。日付・内容・金額は承認済みのため変更できません。
        </p>

        {isLoading ? (
          <LoadingSpinner />
        ) : isError ? (
          <p className="text-sm text-red-600">一覧の取得に失敗しました。</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">この年度の承認済みの支出はありません。</p>
        ) : (
          <>
            {missingCategoryCount > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">項目が未設定の支出が{missingCategoryCount}件あります。</p>
            )}
            <div className="max-h-[55vh] overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">日付</th>
                    <th className="px-2 py-2 text-left font-medium">内容</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">金額</th>
                    <th className="px-2 py-2 text-left font-medium">項目</th>
                    <th className="px-2 py-2 text-left font-medium">相手方</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {entries.map((e) => {
                    const d = drafts[e.id] ?? { category: '', counterparty: '' };
                    return (
                      <tr key={e.id}>
                        <td className="px-2 py-1.5 whitespace-nowrap text-gray-600 dark:text-gray-300">{format(parseISO(e.spentAt), 'yyyy/M/d')}</td>
                        <td className="px-2 py-1.5 text-gray-800 dark:text-gray-100">{e.description}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">¥{e.amount.toLocaleString('ja-JP')}</td>
                        <td className="px-2 py-1.5">
                          <select
                            value={d.category}
                            onChange={(ev) => setDraft(e.id, { category: ev.target.value })}
                            className={`w-full min-w-[8rem] px-2 py-1 border rounded-md bg-white dark:bg-gray-800 text-sm ${
                              d.category ? 'border-gray-300 dark:border-gray-600' : 'border-amber-400'
                            }`}
                          >
                            <option value="" disabled={!!e.category}>
                              未設定
                            </option>
                            {categories.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={d.counterparty}
                            onChange={(ev) => setDraft(e.id, { counterparty: ev.target.value })}
                            maxLength={500}
                            placeholder="例：〇〇商店"
                            className="w-full min-w-[8rem] px-2 py-1 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700/60">
                  <tr>
                    <td colSpan={2} className="px-2 py-2 text-right font-medium">
                      合計（{entries.length}件）
                    </td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">¥{total.toLocaleString('ja-JP')}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
