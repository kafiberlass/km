/**
 * Вид места, который понимает сервер.
 *
 * Отдельным файлом от отправки: там внутри клиент Supabase и половина
 * react-native, а это правило должно проверяться тестами в node.
 *
 * На сервере стоит проверка списком. Чужое значение он отвергнет вместе
 * со всей строкой, и визит пропадёт молча — поэтому приводим здесь.
 */

export type VisitType = 'cafe' | 'park' | 'viewpoint' | 'landmark';

const KNOWN: VisitType[] = ['cafe', 'park', 'viewpoint', 'landmark'];

export function visitTypeOf(type: string): VisitType {
  return (KNOWN as string[]).includes(type) ? (type as VisitType) : 'viewpoint';
}
