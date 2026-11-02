import { useQuery } from '@tanstack/react-query';
import { unwrap } from '../../shared/api/client';
import {
  followHome,
  listFollows,
  regenerateShareCode,
  unfollowHome,
} from '../../shared/api/generated';
import { saveShareCode } from './share-code';

export const FOLLOWS_KEY = ['follows'] as const;

/** Las casas que sigo, con su estado y el nombre que les puse yo. */
export function useFollows() {
  return useQuery({
    queryKey: FOLLOWS_KEY,
    queryFn: async () => (await unwrap(listFollows())).items,
  });
}

export function follow(code: string, alias: string) {
  return unwrap(followHome({ body: { code, alias } }));
}

export async function unfollow(homeId: string): Promise<void> {
  await unwrap(unfollowHome({ path: { homeId } }));
}

/** Pide un código nuevo (el viejo deja de servir y se quita a los seguidores, D-030) y lo recuerda. */
export async function regenerate(): Promise<string> {
  const { shareCode } = await unwrap(regenerateShareCode());
  await saveShareCode(shareCode);
  return shareCode;
}
