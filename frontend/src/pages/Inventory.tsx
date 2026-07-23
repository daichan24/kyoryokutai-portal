import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  History,
  Package,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../utils/api';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

type InventoryCategory = 'DRINKS' | 'FOOD' | 'SUPPLIES' | 'BAGS' | 'OTHER';

interface InventoryUserRef {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  category: InventoryCategory;
  name: string;
  capacity: string | null;
  quantity: number | null;
  quantitySuffix: string | null;
  quantityNote: string | null;
  expiry: string | null;
  sortOrder: number;
  updatedAt: string;
  updatedBy: InventoryUserRef | null;
}

interface InventoryResponse {
  items: InventoryItem[];
  lastUpdated: {
    at: string;
    by: InventoryUserRef | null;
    isInitial: boolean;
  };
}

interface InventoryChange {
  id: string;
  itemId: string | null;
  itemName: string;
  itemCapacity: string | null;
  itemQuantitySuffix: string | null;
  category: InventoryCategory;
  changeType: 'ADD' | 'UPDATE' | 'DELETE';
  previousQuantity: number | null;
  nextQuantity: number | null;
  previousExpiry: string | null;
  nextExpiry: string | null;
}

interface InventoryUpdate {
  id: string;
  createdAt: string;
  updatedBy: InventoryUserRef | null;
  changes: InventoryChange[];
}

interface InventoryDraft {
  quantity: string;
  expiry: string;
}

interface AddItemDraft {
  category: InventoryCategory;
  name: string;
  capacity: string;
  quantity: string;
  quantitySuffix: string;
  quantityNote: string;
  expiry: string;
}

const CATEGORY_CONFIG: Record<
  InventoryCategory,
  { label: string; showCapacity: boolean; showExpiry: boolean }
> = {
  DRINKS: { label: '飲料', showCapacity: true, showExpiry: true },
  FOOD: { label: '調味料・食品等', showCapacity: true, showExpiry: true },
  SUPPLIES: { label: '備品', showCapacity: true, showExpiry: false },
  BAGS: { label: '袋類', showCapacity: true, showExpiry: false },
  OTHER: { label: 'その他備品', showCapacity: false, showExpiry: false },
};

const CATEGORY_ORDER: InventoryCategory[] = ['DRINKS', 'FOOD', 'SUPPLIES', 'BAGS', 'OTHER'];
const EMPTY_ITEMS: InventoryItem[] = [];
const EMPTY_ADD_ITEM: AddItemDraft = {
  category: 'DRINKS',
  name: '',
  capacity: '',
  quantity: '',
  quantitySuffix: '',
  quantityNote: '',
  expiry: '',
};

function formatQuantity(value: number | null, suffix?: string | null, note?: string | null) {
  if (value === null) return '—';
  return `${value.toLocaleString('ja-JP')}${suffix || ''}${note ? `（${note}）` : ''}`;
}

function makeDrafts(items: InventoryItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        quantity: item.quantity === null ? '' : String(item.quantity),
        expiry: item.expiry || '',
      },
    ]),
  ) as Record<string, InventoryDraft>;
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error;
  }
  return '処理に失敗しました。時間をおいてもう一度お試しください。';
}

export const Inventory: React.FC = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, InventoryDraft>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addItem, setAddItem] = useState<AddItemDraft>(EMPTY_ADD_ITEM);

  const inventoryQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await api.get<InventoryResponse>('/api/inventory');
      return response.data;
    },
  });

  const historyQuery = useQuery({
    queryKey: ['inventory', 'history'],
    queryFn: async () => {
      const response = await api.get<InventoryUpdate[]>('/api/inventory/history?limit=20');
      return response.data || [];
    },
    enabled: historyOpen,
  });

  const items = inventoryQuery.data?.items ?? EMPTY_ITEMS;
  const groupedItems = useMemo(
    () =>
      Object.fromEntries(
        CATEGORY_ORDER.map((category) => [category, items.filter((item) => item.category === category)]),
      ) as Record<InventoryCategory, InventoryItem[]>,
    [items],
  );

  const changedRows = useMemo(() => {
    if (!editing) return [];
    return items.flatMap((item) => {
      const draft = drafts[item.id];
      if (!draft) return [];
      const quantity = draft.quantity.trim() === '' ? null : Number(draft.quantity);
      const expiry = draft.expiry.trim() || null;
      if (quantity === item.quantity && expiry === (item.expiry || null)) return [];
      return [{ id: item.id, quantity, expiry, expectedUpdatedAt: item.updatedAt }];
    });
  }, [drafts, editing, items]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put<{ changedCount: number }>('/api/inventory', { changes: changedRows });
      return response.data;
    },
    onSuccess: async (result) => {
      setEditing(false);
      setDrafts({});
      setSaveError(null);
      setMessage(`${result.changedCount}件の在庫を更新しました。`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'history'] }),
      ]);
    },
    onError: (error) => setSaveError(errorMessage(error)),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/inventory', {
        category: addItem.category,
        name: addItem.name.trim(),
        capacity: addItem.capacity.trim() || null,
        quantity: addItem.quantity.trim() === '' ? null : Number(addItem.quantity),
        quantitySuffix: addItem.quantitySuffix.trim() || null,
        quantityNote: addItem.quantityNote.trim() || null,
        expiry: addItem.expiry.trim() || null,
      });
    },
    onSuccess: async () => {
      setAddOpen(false);
      setAddItem(EMPTY_ADD_ITEM);
      setSaveError(null);
      setMessage('在庫項目を追加しました。');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'history'] }),
      ]);
    },
    onError: (error) => setSaveError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      await api.delete(`/api/inventory/${item.id}`, {
        data: { expectedUpdatedAt: item.updatedAt },
      });
      return item;
    },
    onSuccess: async (item) => {
      setEditing(false);
      setDrafts({});
      setSaveError(null);
      setMessage(`「${item.name}」を削除しました。`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'history'] }),
      ]);
    },
    onError: (error) => setSaveError(errorMessage(error)),
  });

  const startEditing = () => {
    setDrafts(makeDrafts(items));
    setEditing(true);
    setMessage(null);
    setSaveError(null);
  };

  const cancelEditing = () => {
    if (changedRows.length && !window.confirm('入力した変更を破棄しますか？')) return;
    setEditing(false);
    setDrafts({});
    setSaveError(null);
  };

  const save = () => {
    if (!changedRows.length) return;
    if (!window.confirm(`${changedRows.length}件の変更を保存しますか？\n保存後、更新者と差分が履歴に残ります。`)) return;
    saveMutation.mutate();
  };

  const deleteItem = (item: InventoryItem) => {
    if (changedRows.length) {
      setSaveError('個数の変更を先に保存するか、キャンセルしてから項目を削除してください。');
      return;
    }
    const label = `${item.name}${item.capacity ? `（${item.capacity}）` : ''}`;
    if (!window.confirm(`「${label}」を削除しますか？\n削除した記録は更新履歴に残ります。`)) return;
    deleteMutation.mutate(item);
  };

  const submitAddItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!addItem.name.trim() || createMutation.isPending) return;
    createMutation.mutate();
  };

  const setDraft = (itemId: string, field: keyof InventoryDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }));
  };

  const renderCategory = (category: InventoryCategory) => {
    const config = CATEGORY_CONFIG[category];
    const categoryItems = groupedItems[category];
    if (!categoryItems.length) return null;

    return (
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/80">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">〈{config.label}〉</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-4 py-2.5">品物</th>
                {config.showCapacity && <th className="w-28 px-3 py-2.5">容量</th>}
                <th className="w-28 px-3 py-2.5 text-right">個数</th>
                {config.showExpiry && <th className="w-52 px-4 py-2.5">賞味期限</th>}
                {editing && <th className="w-16 px-3 py-2.5 text-center">操作</th>}
              </tr>
            </thead>
            <tbody>
              {categoryItems.map((item) => {
                const draft = drafts[item.id];
                const isZero = !editing && item.quantity === 0;
                return (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0 dark:border-gray-700/70">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.name}</td>
                    {config.showCapacity && (
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{item.capacity || '—'}</td>
                    )}
                    <td className="px-3 py-2 text-right">
                      {editing && draft ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            max="999999"
                            step="any"
                            inputMode="decimal"
                            value={draft.quantity}
                            onChange={(event) => setDraft(item.id, 'quantity', event.target.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            aria-label={`${item.name}${item.capacity ? ` ${item.capacity}` : ''}の個数`}
                            className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-right font-semibold text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                          />
                          {item.quantitySuffix && <span className="text-gray-500">{item.quantitySuffix}</span>}
                          {item.quantityNote && <span className="text-xs text-amber-700">（{item.quantityNote}）</span>}
                        </div>
                      ) : (
                        <span
                          className={
                            isZero
                              ? 'inline-flex rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : 'font-semibold text-gray-900 dark:text-gray-100'
                          }
                        >
                          {formatQuantity(item.quantity, item.quantitySuffix, item.quantityNote)}
                        </span>
                      )}
                    </td>
                    {config.showExpiry && (
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                        {editing && draft ? (
                          <input
                            type="text"
                            value={draft.expiry}
                            onChange={(event) => setDraft(item.id, 'expiry', event.target.value)}
                            placeholder="例：2027/8"
                            aria-label={`${item.name}の賞味期限`}
                            className="w-full min-w-40 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                          />
                        ) : (
                          item.expiry || '—'
                        )}
                      </td>
                    )}
                    {editing && (
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => deleteItem(item)}
                          disabled={deleteMutation.isPending}
                          title={`${item.name}を削除`}
                          aria-label={`${item.name}${item.capacity ? ` ${item.capacity}` : ''}を削除`}
                          className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  if (inventoryQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (inventoryQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
        在庫情報を読み込めませんでした。
        <button type="button" className="ml-2 underline" onClick={() => inventoryQuery.refetch()}>
          再読み込み
        </button>
      </div>
    );
  }

  const lastUpdated = inventoryQuery.data!.lastUpdated;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">在庫管理</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              {format(parseISO(lastUpdated.at), lastUpdated.isInitial ? 'yyyy年M月d日現在' : 'yyyy年M月d日 H:mm更新')}
            </span>
            <span>{lastUpdated.by ? `更新者：${lastUpdated.by.name}` : '初期登録'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setHistoryOpen((current) => !current);
              setExpandedHistoryId(null);
            }}
          >
            <History className="mr-2 h-4 w-4" />
            {historyOpen ? '差分を閉じる' : '前回との差分'}
          </Button>
          {!editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddItem(EMPTY_ADD_ITEM);
                  setAddOpen(true);
                  setMessage(null);
                  setSaveError(null);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                項目を追加
              </Button>
              <Button type="button" onClick={startEditing} disabled={!items.length}>
                <Pencil className="mr-2 h-4 w-4" />
                在庫数を編集
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={cancelEditing} disabled={saveMutation.isPending}>
                <X className="mr-2 h-4 w-4" />
                キャンセル
              </Button>
              <Button type="button" onClick={save} disabled={!changedRows.length || saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? '保存中…' : `変更を保存${changedRows.length ? `（${changedRows.length}件）` : ''}`}
              </Button>
            </>
          )}
        </div>
      </header>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {message}
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {saveError}
        </div>
      )}

      {editing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          個数と賞味期限を変更できます。項目自体を消す場合は、右端の削除ボタンを使用してください。
        </div>
      )}

      {historyOpen && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">更新差分</h2>
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-6"><LoadingSpinner /></div>
          ) : historyQuery.isError ? (
            <p className="text-sm text-red-700 dark:text-red-300">更新履歴を読み込めませんでした。</p>
          ) : !historyQuery.data?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">まだ更新履歴はありません。現在の値は2026年7月17日時点の初期登録です。</p>
          ) : (
            <div className="space-y-2">
              {historyQuery.data.map((update, index) => {
                const expanded = index === 0 || expandedHistoryId === update.id;
                return (
                  <div key={update.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => index !== 0 && setExpandedHistoryId(expanded ? null : update.id)}
                      className="flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-left dark:bg-gray-900/40"
                    >
                      <span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {index === 0 ? '前回の更新' : format(parseISO(update.createdAt), 'yyyy年M月d日 H:mm')}
                        </span>
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          {update.updatedBy?.name || '退会済みユーザー'}・{update.changes.length}件
                        </span>
                      </span>
                      {index !== 0 && (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </button>
                    {expanded && (
                      <div className="divide-y divide-gray-100 px-4 dark:divide-gray-700">
                        {update.changes.map((change) => {
                          const item = items.find((candidate) => candidate.id === change.itemId);
                          const quantitySuffix = change.itemQuantitySuffix || item?.quantitySuffix;
                          const quantityChanged = change.previousQuantity !== change.nextQuantity;
                          const expiryChanged = (change.previousExpiry || null) !== (change.nextExpiry || null);
                          return (
                            <div key={change.id} className="py-3 text-sm sm:flex sm:items-start sm:justify-between sm:gap-4">
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {change.itemName}
                                {change.itemCapacity && <span className="ml-1 font-normal text-gray-500">（{change.itemCapacity}）</span>}
                                {change.changeType === 'ADD' && (
                                  <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300">
                                    項目を追加
                                  </span>
                                )}
                                {change.changeType === 'DELETE' && (
                                  <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                    項目を削除
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 space-y-1 text-gray-600 dark:text-gray-300 sm:mt-0 sm:text-right">
                                {change.changeType === 'ADD' && (
                                  <div>初期個数：<span className="font-semibold text-gray-900 dark:text-gray-100">{formatQuantity(change.nextQuantity, quantitySuffix)}</span></div>
                                )}
                                {change.changeType === 'DELETE' && (
                                  <div>削除時個数：<span className="font-semibold text-gray-900 dark:text-gray-100">{formatQuantity(change.previousQuantity, quantitySuffix)}</span></div>
                                )}
                                {change.changeType === 'UPDATE' && quantityChanged && (
                                  <div>
                                    個数：<span className="line-through opacity-70">{formatQuantity(change.previousQuantity, quantitySuffix)}</span>
                                    <span className="mx-1.5">→</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{formatQuantity(change.nextQuantity, quantitySuffix)}</span>
                                  </div>
                                )}
                                {change.changeType === 'UPDATE' && expiryChanged && (
                                  <div>
                                    賞味期限：<span className="line-through opacity-70">{change.previousExpiry || '未入力'}</span>
                                    <span className="mx-1.5">→</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{change.nextExpiry || '未入力'}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {renderCategory('DRINKS')}
          {renderCategory('FOOD')}
        </div>
        <div className="space-y-6">
          {renderCategory('SUPPLIES')}
          {renderCategory('BAGS')}
          {renderCategory('OTHER')}
        </div>
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !createMutation.isPending) setAddOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-inventory-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800"
          >
            <form onSubmit={submitAddItem}>
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                <h2 id="add-inventory-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">在庫項目を追加</h2>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={createMutation.isPending}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="閉じる"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {saveError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {saveError}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">カテゴリ</label>
                  <select
                    value={addItem.category}
                    onChange={(event) => {
                      const category = event.target.value as InventoryCategory;
                      setAddItem((current) => ({
                        ...current,
                        category,
                        expiry: category === 'DRINKS' || category === 'FOOD' ? current.expiry : '',
                      }));
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    {CATEGORY_ORDER.map((category) => (
                      <option key={category} value={category}>{CATEGORY_CONFIG[category].label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">品物名 <span className="text-red-600">*</span></label>
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    value={addItem.name}
                    onChange={(event) => setAddItem((current) => ({ ...current, name: event.target.value }))}
                    placeholder="例：紙ナプキン"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">容量・規格</label>
                    <input
                      maxLength={50}
                      value={addItem.capacity}
                      onChange={(event) => setAddItem((current) => ({ ...current, capacity: event.target.value }))}
                      placeholder="例：200ml"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">個数</label>
                    <input
                      type="number"
                      min="0"
                      max="999999"
                      step="any"
                      inputMode="decimal"
                      value={addItem.quantity}
                      onChange={(event) => setAddItem((current) => ({ ...current, quantity: event.target.value }))}
                      placeholder="0"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">個数の単位</label>
                    <input
                      maxLength={20}
                      value={addItem.quantitySuffix}
                      onChange={(event) => setAddItem((current) => ({ ...current, quantitySuffix: event.target.value }))}
                      placeholder="例：本"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">個数の補足</label>
                    <input
                      maxLength={50}
                      value={addItem.quantityNote}
                      onChange={(event) => setAddItem((current) => ({ ...current, quantityNote: event.target.value }))}
                      placeholder="例：残り少"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                {(addItem.category === 'DRINKS' || addItem.category === 'FOOD') && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">賞味期限</label>
                    <input
                      maxLength={200}
                      value={addItem.expiry}
                      onChange={(event) => setAddItem((current) => ({ ...current, expiry: event.target.value }))}
                      placeholder="例：2027/8"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={createMutation.isPending}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={!addItem.name.trim() || createMutation.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? '追加中…' : '項目を追加'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
