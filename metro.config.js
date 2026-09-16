const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('gpx');

/**
 * Опциональные нативные пакеты.
 *
 * react-native-background-geolocation платная и ставится отдельно (в debug
 * бесплатна, лицензия нужна только для релиза). Обёртка вокруг неё лежит
 * в src/features/tracking/transistor.ts и защищена try/catch — но этого мало:
 * Metro резолвит require() статически, на этапе сборки, и падает на
 * отсутствующем модуле ещё до того, как выполнится хоть одна строка кода.
 *
 * Поэтому неустановленные опциональные модули подменяются пустышкой,
 * а код проверяет наличие настоящего API, а не сам факт импорта.
 */
const OPTIONAL_MODULES = ['react-native-background-geolocation'];

function isInstalled(name) {
  try {
    require.resolve(name, { paths: [__dirname] });
    return true;
  } catch {
    return false;
  }
}

const missing = OPTIONAL_MODULES.filter((name) => !isInstalled(name));

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (missing.includes(moduleName)) {
    return { type: 'empty' };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
