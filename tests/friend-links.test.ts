import { describe, expect, it } from 'vitest';

import { friendIdsFrom } from '@/features/friends/links';

const ME = 'me-uuid';
const BROTHER = 'brother-uuid';

describe('кто мне друг', () => {
  it('сам себе не друг', () => {
    // Политика доступа отдаёт обе строки связи: и мою, и встречную.
    // Во встречной friend_id — это я, и без фильтра я оказываюсь
    // в собственном списке друзей.
    const rows = [
      { user_id: ME, friend_id: BROTHER },
      { user_id: BROTHER, friend_id: ME },
    ];

    expect(friendIdsFrom(rows, ME)).toEqual([BROTHER]);
  });

  it('направление связи роли не играет', () => {
    expect(friendIdsFrom([{ user_id: BROTHER, friend_id: ME }], ME)).toEqual([BROTHER]);
    expect(friendIdsFrom([{ user_id: ME, friend_id: BROTHER }], ME)).toEqual([BROTHER]);
  });

  it('один друг не превращается в двух', () => {
    const rows = [
      { user_id: ME, friend_id: BROTHER },
      { user_id: BROTHER, friend_id: ME },
      { user_id: ME, friend_id: BROTHER },
    ];

    expect(friendIdsFrom(rows, ME)).toHaveLength(1);
  });

  it('пустые и битые строки не ломают список', () => {
    const rows = [
      { user_id: ME, friend_id: BROTHER },
      { user_id: null, friend_id: undefined },
      {},
      { friend_id: '' },
    ];

    expect(friendIdsFrom(rows, ME)).toEqual([BROTHER]);
  });

  it('без связей — пустой список', () => {
    expect(friendIdsFrom([], ME)).toEqual([]);
  });
});
