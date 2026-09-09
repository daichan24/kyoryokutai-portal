import { useSyncExternalStore } from 'react';
import { api } from './api';
import { AuthSession, getAuthSession, isCurrentAuthSession, onAuthSessionEnd } from './authSession';
import { queryClient } from './queryClient';

export interface NotepadSummary { id: string; title: string; order: number; updatedAt: string }
export interface NotepadDetail extends NotepadSummary { content: string; createdAt: string }
interface Draft {
  session: AuthSession; userId: string; id: string; title: string; content: string;
  version: number; dirty: boolean; saving: boolean; error: boolean; lastSaved: Date | null;
  timer?: ReturnType<typeof setTimeout>; inFlight?: Promise<void>; cancelled?: boolean;
}
export const notepadKeys = {
  list: (userId: string | undefined) => ['notepads', userId] as const,
  detail: (userId: string | undefined, id: string | undefined) => ['notepad', userId, id] as const,
};
const drafts = new Map<string, Draft>();
const listeners = new Set<() => void>();
let revision = 0;
const changed = () => { revision += 1; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getRevision = () => revision;
const key = (userId: string, id: string, session = getAuthSession()) => `${session.epoch}:${userId}:${id}`;
export const useNotepadDrafts = () => { useSyncExternalStore(subscribe, getRevision); };
export const getNotepadDraft = (userId?: string, id?: string) => userId && id ? drafts.get(key(userId, id)) : undefined;
export const failedNotepadDrafts = (userId?: string) => [...drafts.values()].filter(d => d.userId === userId && d.error && isCurrentAuthSession(d.session));
export const hasUnsavedNotepads = () => [...drafts.values()].some(d => d.dirty && isCurrentAuthSession(d.session));

async function save(draft: Draft): Promise<void> {
  if (draft.cancelled || !isCurrentAuthSession(draft.session) || !draft.dirty) return;
  if (draft.timer) { clearTimeout(draft.timer); draft.timer = undefined; }
  if (draft.inFlight) return draft.inFlight;
  const version = draft.version;
  const payload = { title: draft.title, content: draft.content };
  draft.saving = true; draft.error = false; changed();
  draft.inFlight = (async () => {
    try {
      const { data } = await api.put<NotepadDetail>(`/api/me/notepad/${draft.id}`, payload, { authSession: draft.session });
      if (draft.cancelled || !isCurrentAuthSession(draft.session)) return;
      // A read started before this PUT may still contain the old title/body.
      // Cancel both cache entries we publish so its response cannot replace the save.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notepadKeys.detail(draft.userId, draft.id), exact: true }),
        queryClient.cancelQueries({ queryKey: notepadKeys.list(draft.userId), exact: true }),
      ]);
      if (draft.cancelled || !isCurrentAuthSession(draft.session)) return;
      if (draft.version === version) {
        draft.dirty = false; draft.lastSaved = new Date();
        queryClient.setQueryData(notepadKeys.detail(draft.userId, draft.id), data);
        queryClient.setQueryData<NotepadSummary[]>(notepadKeys.list(draft.userId), previous => previous?.map(note => note.id === draft.id ? { ...note, title: data.title, updatedAt: data.updatedAt } : note));
      }
      // Recover every cancelled initial list, even when this successful PUT is superseded
      // and the following save fails. Publishing memo data remains version-guarded above.
      void queryClient.invalidateQueries({ queryKey: notepadKeys.list(draft.userId), exact: true });
    } catch {
      if (!draft.cancelled && isCurrentAuthSession(draft.session)) draft.error = true;
    } finally {
      draft.saving = false; draft.inFlight = undefined;
      if (!draft.cancelled && isCurrentAuthSession(draft.session)) {
        changed();
        // Serialize follow-up edits; never let the older response clear newer text.
        if (draft.dirty && !draft.error && draft.version !== version) await save(draft);
      }
    }
  })();
  return draft.inFlight;
}

export const queueNotepadSave = (userId: string, id: string, title: string, content: string) => {
  const session = getAuthSession();
  if (!session.token) return;
  let draft = drafts.get(key(userId, id, session));
  if (!draft) {
    draft = { session, userId, id, title, content, version: 0, dirty: false, saving: false, error: false, lastSaved: null };
    drafts.set(key(userId, id, session), draft);
  }
  draft.title = title; draft.content = content; draft.version += 1; draft.dirty = true; draft.error = false;
  if (draft.timer) clearTimeout(draft.timer);
  draft.timer = setTimeout(() => { void save(draft); }, 2000);
  changed();
};
export const flushNotepadSave = (userId: string, id: string, session: AuthSession, retry = false) => {
  const draft = drafts.get(key(userId, id, session));
  if (!draft || (draft.error && !retry)) return Promise.resolve();
  return save(draft);
};
export const discardNotepadDraft = async (userId: string, id: string, session: AuthSession) => {
  const draftKey = key(userId, id, session), draft = drafts.get(draftKey);
  if (!draft) return;
  draft.cancelled = true;
  if (draft.timer) clearTimeout(draft.timer);
  drafts.delete(draftKey); changed();
  await draft.inFlight;
};
onAuthSessionEnd(() => {
  for (const draft of drafts.values()) { draft.cancelled = true; if (draft.timer) clearTimeout(draft.timer); }
  drafts.clear(); changed();
});
