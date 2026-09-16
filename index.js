/**
 * Точка входа.
 *
 * Нужна только ради полифила: h3-js падает на `new TextDecoder("utf-16le")`
 * при загрузке модуля, а грузится он по цепочке импортов из первого же
 * экрана. Полифил обязан выполниться раньше — отсюда собственный entry
 * вместо expo-router/entry в package.json.
 */
import './src/core/polyfills/textDecoder';

import 'expo-router/entry';
