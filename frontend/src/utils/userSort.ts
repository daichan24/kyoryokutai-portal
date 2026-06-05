import type { User } from '../types';

export function compareUsersByDisplayOrder(a: Pick<User, 'displayOrder' | 'name'>, b: Pick<User, 'displayOrder' | 'name'>) {
  const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return a.name.localeCompare(b.name, 'ja');
}

export function sortUsersByDisplayOrder<T extends Pick<User, 'displayOrder' | 'name'>>(users: T[]) {
  return [...users].sort(compareUsersByDisplayOrder);
}
