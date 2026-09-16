module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: false }]],
    plugins: [
      // Должен быть последним. В Reanimated 4 воркет-плагин живёт в react-native-worklets.
      'react-native-worklets/plugin',
    ],
  };
};
