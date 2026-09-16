const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

/**
 * Scene-based life cycle для iOS.
 *
 * Начиная с iOS 27 SDK UIKit отказывается запускать приложение, которое не
 * объявило scene-манифест: процесс стартует и тут же гасится с
 * «UIScene life cycle is required for apps built with this SDK». Внешне это
 * выглядит как мгновенный вылет с чёрным экраном, в консоли устройства —
 * как выход с кодом 0, без стека и крэш-репорта.
 *
 * Expo 57 всё нужное уже содержит: ExpoAppSceneDelegate (EXExpoAppSceneDelegate)
 * создаёт окно из подключившейся сцены и сам стартует React Native. Не хватает
 * только двух вещей, которых нет в шаблоне prebuild, — манифеста в Info.plist
 * и соответствия протоколу у AppDelegate. Их и дописываем.
 *
 * Плагин уйдёт, когда шаблон Expo догонит SDK: тогда обе правки появятся
 * в сгенерированном проекте сами, и этот файл можно будет удалить.
 */

const SCENE_DELEGATE = 'EXExpoAppSceneDelegate';

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE,
          },
        ],
      },
    };
    return cfg;
  });
}

function withAppDelegateConformance(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error(
        `withSceneLifecycle: ожидался Swift AppDelegate, а не ${cfg.modResults.language}`,
      );
    }

    let contents = cfg.modResults.contents;

    // 1. Сцен-делегат достаёт фабрику и окно из app delegate через протокол.
    const classDeclaration = 'class AppDelegate: ExpoAppDelegate {';
    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      if (!contents.includes(classDeclaration)) {
        throw new Error(
          'withSceneLifecycle: не найдено объявление класса AppDelegate — ' +
            'шаблон Expo изменился, плагин надо обновить',
        );
      }
      contents = contents.replace(
        classDeclaration,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }

    // 2. Окно создаёт сцена, а не app delegate. Если оставить старый вызов,
    //    React Native стартует дважды: один раз в окно, которое ни к какой
    //    сцене не привязано и на экран не попадает.
    const windowBlock =
      /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\n/;

    if (windowBlock.test(contents)) {
      contents = contents.replace(
        windowBlock,
        '    // Окно и запуск React Native — в ExpoAppSceneDelegate (см. plugins/withSceneLifecycle.js).\n',
      );
    } else if (contents.includes('factory.startReactNative(')) {
      throw new Error(
        'withSceneLifecycle: startReactNative в AppDelegate есть, но выглядит ' +
          'не так, как ожидает плагин — шаблон Expo изменился, плагин надо обновить',
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withAppDelegateConformance(withSceneManifest(config));
};
