/**
 * Люди на карте: своя метка и друзья — одним слоем.
 *
 * Вместе, а не по отдельности, ровно по одной причине: метки, попавшие
 * в одну точку, надо разводить, а развести их можно только зная про всех
 * сразу. Когда свою метку рисовал один компонент, а друзей другой, в одном
 * здании с другом обе оказывались в одном пикселе и выглядели как одна.
 *
 * Раскладка считается одним воркетом на весь слой: камера лежит
 * в SharedValue, пересчёт идёт на UI-потоке, React при панорамировании
 * не просыпается.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  cameraMatrixWorklet,
  lngLatToMercator,
  projectToScreenWorklet,
  type LngLat,
} from '@/core/geo/mercator';
import { fonts, palette } from '@/core/theme/tokens';
import type { SharedCamera } from '@/features/fog/FogLayer';
import { isFresh, type Friend } from '@/features/friends/types';
import { spreadMarkers } from '@/features/globe/projection';
import { Avatar } from '@/features/profile/Avatar';
import { initialsOf } from '@/features/profile/avatars';

const AVATAR = 40;
const HALO = 58;

/**
 * Ближе этого метки считаются слипшимися и расходятся.
 *
 * Чуть больше самой метки: касающиеся кружки ещё читаются как два человека,
 * а наложенные — уже нет.
 */
const MARKER_GAP = 46;

/** Своё лицо чуть крупнее чужих: это точка отсчёта на экране. */
const SELF_AVATAR = 44;

interface Person {
  key: string;
  point: LngLat;
  self: boolean;
  live: boolean;
  color: string;
  initials: string;
  name: string;
  /** Аватарка: своя из профиля, чужая — та, что друг себе выбрал. */
  avatar: string | null;
}

interface Props {
  me: LngLat;
  friends: readonly Friend[];
  origin: LngLat;
  camera: SharedValue<SharedCamera>;
  width: number;
  height: number;
  /** Своя метка ярче, пока идёт запись прогулки. */
  tracking: boolean;
  /** Своя аватарка и имя — чтобы на карте было лицо, а не точка. */
  myAvatar?: string | null;
  myName?: string | null;
}

export function PeopleLayer({
  me,
  friends,
  origin,
  camera,
  width,
  height,
  tracking,
  myAvatar = null,
  myName = null,
}: Props) {
  const originMerc = useMemo(() => lngLatToMercator(origin), [origin.lat, origin.lng]);

  const people = useMemo<Person[]>(() => {
    const list: Person[] = [
      {
        key: 'me',
        point: me,
        self: true,
        live: true,
        color: palette.ember,
        initials: initialsOf(myName ?? ''),
        name: myName ?? '',
        avatar: myAvatar,
      },
    ];

    for (const friend of friends) {
      if (!friend.position) continue;
      list.push({
        key: friend.id,
        point: friend.position,
        self: false,
        live: isFresh(friend.position),
        color: friend.color,
        initials: friend.initials,
        name: friend.name,
        avatar: friend.avatar,
      });
    }

    return list;
  }, [me.lat, me.lng, friends, myAvatar, myName]);

  const layout = useDerivedValue(() => {
    const matrix = cameraMatrixWorklet(
      camera.value.lng,
      camera.value.lat,
      camera.value.zoom,
      camera.value.bearing,
      width,
      height,
      originMerc.x,
      originMerc.y,
    );

    const screen = people.map((person) =>
      projectToScreenWorklet(person.point.lng, person.point.lat, matrix, originMerc.x, originMerc.y),
    );

    return spreadMarkers(screen, MARKER_GAP);
  }, [people, width, height, originMerc]);

  if (width === 0 || height === 0) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {people.map((person, index) => (
        <PersonMarker
          key={person.key}
          person={person}
          index={index}
          layout={layout}
          width={width}
          height={height}
          tracking={tracking}
        />
      ))}
    </View>
  );
}

function PersonMarker({
  person,
  index,
  layout,
  width,
  height,
  tracking,
}: {
  person: Person;
  index: number;
  layout: SharedValue<{ x: number; y: number }[]>;
  width: number;
  height: number;
  tracking: boolean;
}) {
  const size = person.self ? HALO : AVATAR;

  const style = useAnimatedStyle(() => {
    const screen = layout.value[index];
    if (!screen) return { opacity: 0 };

    // Уехавшие за край прячем: иначе метки копятся за границей экрана
    // и каждая продолжает пересчитываться каждый кадр.
    const margin = size * 2;
    const visible =
      screen.x > -margin &&
      screen.x < width + margin &&
      screen.y > -margin &&
      screen.y < height + margin;

    return {
      opacity: visible ? 1 : 0,
      transform: [{ translateX: screen.x - size / 2 }, { translateY: screen.y - size / 2 }],
    };
  });

  if (person.self) {
    return (
      <Animated.View style={[styles.selfMarker, style]}>
        {/* Ореол под лицом: по нему свою метку видно даже тогда,
            когда лицо ещё слишком мелкое, чтобы его разглядеть. */}
        <View style={[styles.halo, tracking && styles.haloActive]} />

        <View style={[styles.photoRing, styles.selfRing, { borderColor: palette.ember }]}>
          <Avatar value={person.avatar} size={SELF_AVATAR - 6} name={person.name || 'Я'} />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.marker, style]}>
      <View style={[styles.avatarWrap, !person.live && styles.stale]}>
        {person.avatar ? (
          // Рамку цвета друга оставляем и под фотографией: по ней метки
          // различаются на карте, когда лиц ещё не разглядеть.
          <View style={[styles.photoRing, { borderColor: person.color }]}>
            <Avatar value={person.avatar} size={AVATAR - 6} name={person.name} />
          </View>
        ) : (
          <View style={[styles.avatar, { backgroundColor: person.color }]}>
            <Text style={styles.avatarText}>{person.initials}</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {person.name}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Ширина фиксированная, чтобы подпись под меткой центрировалась
  // относительно самой метки, а не растягивала её.
  marker: { position: 'absolute', top: 0, left: 0, width: 96, marginLeft: -28, alignItems: 'center' },
  selfMarker: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },

  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: palette.parchmentBright,
    opacity: 0.35,
  },
  haloActive: { backgroundColor: palette.ember, opacity: 0.5 },
  // Своё лицо: кольцо цвета тропы, чтобы метка читалась как «я»,
  // а не как ещё один друг.
  selfRing: {
    width: SELF_AVATAR,
    height: SELF_AVATAR,
    borderRadius: SELF_AVATAR / 2,
    borderWidth: 3,
  },

  avatarWrap: { width: AVATAR, height: AVATAR },
  // Кружок под фотографию: сама она круглая, а рамка добавляет цвет друга.
  photoRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: palette.parchmentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stale: { opacity: 0.55 },
  avatarText: { color: palette.parchmentBright, fontFamily: fonts.display, fontWeight: '900', fontSize: 13 },
  name: {
    marginTop: 2,
    color: palette.textOnMap,
    fontSize: 11,
    fontFamily: fonts.display,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: palette.mapHalo,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
