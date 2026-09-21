/**
 * Квест дня для экранов.
 *
 * Пересчитывается, когда меняется то, от чего он зависит: пройденные
 * клетки, открытые места, текущая прогулка. Каждое из этих чисел и так
 * живёт в store, так что лишних подписок не появляется.
 */

import { useEffect, useMemo } from 'react';

import { CELLS_PER_DISTRICT, DISTRICT_DONE_RATIO } from '@/core/geo/districts';
import type { LngLat } from '@/core/geo/mercator';
import { deviceTimeZone } from '@/core/rules/streak';
import { getProfile } from '@/core/db/repo';
import { useWalkStore } from '@/store/useWalkStore';

import { isQuestRewarded, markQuestRewarded, todayQuest, type TodayQuest } from './today';

export function useQuest(origin: LngLat | null): TodayQuest {
  const claimQuest = useWalkStore((s) => s.claimQuest);
  const exploredCells = useWalkStore((s) => s.exploredCells);
  const placesVersion = useWalkStore((s) => s.placesVersion);
  const districts = useWalkStore((s) => s.districts);
  const distanceM = useWalkStore((s) => s.distanceM);

  const quest = useMemo(() => {
    const profile = getProfile();
    const timeZone = profile.timeZone === 'UTC' ? deviceTimeZone() : profile.timeZone;

    return todayQuest(
      {
        origin,
        districts,
        cellsToClose: CELLS_PER_DISTRICT * DISTRICT_DONE_RATIO,
        timeZone,
        now: Date.now(),
      },
      distanceM,
    );
  }, [origin?.lat, origin?.lng, districts, exploredCells, placesVersion, distanceM]);

  /*
    Награда начисляется здесь, а не в движке прогулки, потому что
    выполнение квеста видно только отсюда: движок не знает ни про даты,
    ни про то, какой квест сегодня. Отметка ставится до начисления —
    второй экран, открытый в ту же секунду, награду не повторит.
  */
  useEffect(() => {
    if (!quest.progress.done) return;
    if (isQuestRewarded(quest.dateKey)) return;

    markQuestRewarded(quest.dateKey);
    claimQuest(quest.quest.xpReward, quest.quest.title);
  }, [quest, claimQuest]);

  return quest;
}
