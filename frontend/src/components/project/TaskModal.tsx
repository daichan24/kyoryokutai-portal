import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Task, Project, Location, User, Schedule } from '../../types';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../utils/date';

interface TaskModalProps {
  missionId?: string;
  projectId?: string;
  task?: Task | null;
  schedule?: Schedule | null;
  defaultDate?: Date | null;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDuplicate?: (task: Task) => void;
  readOnly?: boolean;
  suspendOutsidePointerClose?: boolean;
  onCreateProjectRequest?: () => void;
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});
const ITEM_H = 36;
const VISIBLE = 5;

const TimePicker: React.FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const currentIdx = TIME_OPTIONS.indexOf(value);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = Math.max(0, (currentIdx - Math.floor(VISIBLE / 2)) * ITEM_H);
    }
  }, [open, currentIdx]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const scroll = (dir: -1 | 1) => {
    const ni = Math.max(0, Math.min(TIME_OPTIONS.length - 1, currentIdx + dir));
    onChange(TIME_OPTIONS[ni]);
    if (listRef.current) listRef.current.scrollTop = Math.max(0, (ni - Math.floor(VISIBLE / 2)) * ITEM_H);
  };

  const label = value ? `${parseInt(value.split(':')[0])}:${value.split(':')[1]}` : '--:--';
  return (
    <div ref={containerRef} className="relative">
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(v => !v)}
        className={`w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm text-left flex items-center justify-between ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-400 cursor-pointer'}`}>
        <span>{label}</span><ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden w-28">
          <button type="button" onClick={() => scroll(-1)} className="w-full flex justify-center py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><ChevronUp className="h-4 w-4" /></button>
          <div ref={listRef} className="overflow-y-auto" style={{ height: `${ITEM_H * VISIBLE}px`, scrollbarWidth: 'none' }}>
            {TIME_OPTIONS.map((t, i) => (
              <div key={t} onClick={() => { onChange(t); setOpen(false); }}
                className={`flex items-center justify-center cursor-pointer transition-colors text-sm font-medium ${i === currentIdx ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                style={{ height: `${ITEM_H}px` }}>
                {parseInt(t.split(':')[0])}:{t.split(':')[1]}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => scroll(1)} className="w-full flex justify-center py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><ChevronDown className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
};

const DateInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; min?: string; disabled?: boolean }> = ({ label, value, onChange, min, disabled }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div onClick={() => !disabled && ref.current?.showPicker?.()}>
        <input ref={ref} type="date" value={value} min={min} onChange={e => onChange(e.target.value)} disabled={disabled}
          className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm cursor-pointer disabled:opacity-60" />
      </div>
    </div>
  );
};
