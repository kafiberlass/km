/**
 * Квест дня — одна цель на сутки, которую приложение придумывает само.
 *
 * Зачем он нужен: туман на карте отвечает на вопрос «где я был», но не
 * отвечает на «куда пойти сегодня». Человек открывает приложение, видит
 * свои же вчерашние следы и закрывает его. Квест даёт повод выйти.
 *
 * Правила, по которым он выбирается:
 *
 *   Один. Список из пяти задач — это работа, а не прогулка; выполнять
 *   их все никто не станет, и невыполненные будут молча упрекать.
 *
 *   Выполнимый. Цель считается от того, сколько человек обычно ходит,
 *   а не от круглого числа из головы: десять тысяч шагов для того, кто
 *   ходит две тысячи, — не вызов, а объявление о том, что он неудачник.
 *
 *   Одинаковый весь день. Выбор зависит только от даты и от того, что
 *   есть на карте: открыл приложение утром и вечером — квест тот же.
 *   Поэтому здесь нет ни случайности, ни времени — только чистые функции,
 *   которые проверяются тестами.
 */

/** Сколько метров человек обычно проходит за день, если истории ещё нет. */
export const DEFAULT_TYPICAL_M = 2000;

/** Границы дневной цели: ниже — не вызов, выше — не прогулка. */
export const MIN_DISTANCE_GOAL_M = 1500;
export const MAX_DISTANCE_GOAL_M = 8000;

export type QuestKind = 'place' | 'district' | 'distance';

export interface Quest {
  kind: QuestKind;
  /** Что показать человеку: «Дойти до парка Горького». */
  title: string;
  /** Пояснение мелким шрифтом — расстояние, остаток, зачем. */
  hint: string;
  xpReward: number;
  /** К чему привязан квест: id места или квартала. Для «пройти N км» — null. */
  targetId: string | null;
  /** Сколько метров надо пройти. Только для kind === 'distance'. */
  goalM: number | null;
}

export interface QuestContext {
  /** Неоткрытые места, отсортированные как угодно: ближнее выберем сами. */
  places: readonly { id: string; title: string; type: string; distanceM: number }[];
  /** Кварталы, начатые но не законченные: 0 < ratio < 1. */
  districts: readonly { id: string; ratio: number }[];
  /** Сколько человек обычно проходит за день. */
  typicalM: number;
}

/** Дневная цель по расстоянию: чуть больше обычного, но в разумных рамках. */
export function distanceGoal(typicalM: number): number {
  const wanted = Number.isFinite(typicalM) && typicalM > 0 ? typicalM * 1.25 : DEFAULT_TYPICAL_M;
  const rounded = Math.round(wanted / 500) * 500;
  return Math.min(MAX_DISTANCE_GOAL_M, Math.max(MIN_DISTANCE_GOAL_M, rounded));
}

/**
 * Число из даты: один и тот же день даёт одно и то же число.
 *
 * Math.random() здесь был бы ошибкой: квест менялся бы при каждом
 * открытии приложения, и выполнить его было бы невозможно.
 */
export function daySeed(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function metersText(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

/**
 * Квест на день.
 *
 * Дальние места не предлагаются: цель «дойти» имеет смысл, пока до неё
 * действительно можно дойти. Кварталы — только те, что уже начаты:
 * закрыть начатое приятнее, чем начинать с нуля.
 */
export function pickQuest(dateKey: string, context: QuestContext): Quest {
  const seed = daySeed(dateKey);

  const reachable = [...context.places]
    .filter((place) => place.distanceM <= 4000)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 5);

  const almostDone = [...context.districts]
    .filter((district) => district.ratio > 0.25 && district.ratio < 1)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  const kinds: QuestKind[] = [];
  if (reachable.length > 0) kinds.push('place');
  if (almostDone.length > 0) kinds.push('district');
  kinds.push('distance');

  const kind = kinds[seed % kinds.length]!;

  if (kind === 'place') {
    const place = reachable[seed % reachable.length]!;
    return {
      kind,
      title: `Дойти до места: ${place.title}`,
      hint: `${metersText(place.distanceM)} от дома · откроется, когда подойдёте`,
      xpReward: 120,
      targetId: place.id,
      goalM: null,
    };
  }

  if (kind === 'district') {
    const district = almostDone[seed % almostDone.length]!;
    return {
      kind,
      title: 'Закрыть квартал',
      hint: `Пройдено ${Math.round(district.ratio * 100)}% — осталось немного`,
      xpReward: 150,
      targetId: district.id,
      goalM: null,
    };
  }

  const goalM = distanceGoal(context.typicalM);
  return {
    kind,
    title: `Пройти ${metersText(goalM)}`,
    hint: 'Можно за день, можно за раз — как удобно',
    xpReward: 100,
    targetId: null,
    goalM,
  };
}

export interface QuestProgress {
  done: boolean;
  /** 0..1 — для полоски. Для квестов «дойти» она либо 0, либо 1. */
  ratio: number;
  label: string;
}

export interface QuestState {
  /** Сколько метров пройдено сегодня. */
  todayM: number;
  /** Места, открытые сегодня. */
  openedPlaceIds: readonly string[];
  /** Доля пройденного по кварталу квеста, если он про квартал. */
  districtRatio: number;
}

export function questProgress(quest: Quest, state: QuestState): QuestProgress {
  if (quest.kind === 'place') {
    const done = quest.targetId != null && state.openedPlaceIds.includes(quest.targetId);
    return { done, ratio: done ? 1 : 0, label: done ? 'Дошли' : 'Ещё не дошли' };
  }

  if (quest.kind === 'district') {
    const ratio = Math.min(1, Math.max(0, state.districtRatio));
    return {
      done: ratio >= 1,
      ratio,
      label: ratio >= 1 ? 'Квартал закрыт' : `${Math.round(ratio * 100)}%`,
    };
  }

  const goal = quest.goalM ?? DEFAULT_TYPICAL_M;
  const ratio = Math.min(1, Math.max(0, state.todayM / goal));
  return {
    done: state.todayM >= goal,
    ratio,
    label: `${metersText(state.todayM)} из ${metersText(goal)}`,
  };
}
