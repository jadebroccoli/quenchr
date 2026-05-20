/**
 * Expo config plugin: adds the QuenchrLiveActivity widget extension target
 * to the iOS Xcode project.
 *
 * Pattern copied from react-native-nitro-screen-recorder's
 * withBroadcastExtensionXcodeProject.js (proven to work in this project).
 *
 * What this does:
 *  1. Copies Swift + plist files from targets/quenchr-live-activity/ into
 *     ios/QuenchrLiveActivity/ during prebuild.
 *  2. Adds a PBXGroup + PBXNativeTarget (widget extension) with Sources,
 *     Resources, and Frameworks build phases.
 *  3. Links WidgetKit, ActivityKit, SwiftUI frameworks.
 *  4. Patches build settings by walking pbxXCBuildConfigurationSection and
 *     matching on PRODUCT_NAME — the only reliable way in this version of
 *     the xcode npm package.
 *  5. Sets NSSupportsLiveActivities = YES in the main app Info.plist.
 */

const { withXcodeProject, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ── Constants ──────────────────────────────────────────────────────────────────

const EXT_NAME = 'QuenchrLiveActivity';
const EXT_BUNDLE_ID = 'com.quenchr.app.live-activity';
const EXT_DEPLOYMENT_TARGET = '16.2';
const APP_GROUP = 'group.com.quenchr.app.screen-recorder';

const SOURCE_FILES = [
  'QuenchrAttributes.swift',
  'QuenchrLiveActivity.swift',
  'QuenchrLiveActivityBundle.swift',
];
const RESOURCE_FILES = ['Info.plist'];
const ENTITLEMENTS_FILE = 'QuenchrLiveActivity.entitlements';
const ALL_FILES = [...SOURCE_FILES, ...RESOURCE_FILES, ENTITLEMENTS_FILE];

// ── Main export ────────────────────────────────────────────────────────────────

module.exports = function withLiveActivity(config) {
  // 0. Register the extension with EAS credential management so EAS creates
  //    a provisioning profile for com.quenchr.app.live-activity before building.
  //    Pattern copied from react-native-nitro-screen-recorder's withEasManagedCredentials.
  config.extra = {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions: [
              ...(config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? []),
              {
                targetName: EXT_NAME,
                bundleIdentifier: EXT_BUNDLE_ID,
                entitlements: {
                  'com.apple.security.application-groups': [APP_GROUP],
                },
              },
            ],
          },
        },
      },
    },
  };

  // 1. Add NSSupportsLiveActivities to main app Info.plist
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSSupportsLiveActivities = true;
    cfg.modResults.NSSupportsLiveActivitiesFrequentUpdates = false;
    return cfg;
  });

  // 2. Xcode project manipulation
  config = withXcodeProject(config, (cfg) => {
    const pbx = cfg.modResults;
    const projectRoot = cfg.modRequest.projectRoot; // = apps/mobile/
    const iosDir = path.join(projectRoot, 'ios');
    const extDir = path.join(iosDir, EXT_NAME);
    // targets/ lives inside apps/mobile/ — no need for ../
    const sourceDir = path.join(projectRoot, 'targets', 'quenchr-live-activity');

    // ── Idempotency ────────────────────────────────────────────────────────────
    if (pbx.pbxTargetByName(EXT_NAME)) {
      console.log(`[withLiveActivity] ${EXT_NAME} target already exists — skipping`);
      return cfg;
    }
    const existingGroups = pbx.hash.project.objects.PBXGroup;
    if (Object.values(existingGroups).some((g) => g && g.name === EXT_NAME)) {
      console.log(`[withLiveActivity] ${EXT_NAME} group already exists — skipping`);
      return cfg;
    }

    // ── Copy extension files into ios/ ─────────────────────────────────────────
    fs.mkdirSync(extDir, { recursive: true });
    ALL_FILES.forEach((file) => {
      const src = path.join(sourceDir, file);
      const dst = path.join(extDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      } else {
        console.warn(`[withLiveActivity] source file not found: ${src}`);
      }
    });

    // ── Workaround: addTarget crashes if these sections are missing ───────────
    // (only happens in single-target projects — defensive)
    const projObjects = pbx.hash.project.objects;
    projObjects.PBXTargetDependency = projObjects.PBXTargetDependency || {};
    projObjects.PBXContainerItemProxy = projObjects.PBXContainerItemProxy || {};

    // ── 1. Create PBXGroup first (before addTarget) ────────────────────────────
    const extGroup = pbx.addPbxGroup(ALL_FILES, EXT_NAME, EXT_NAME);

    // Add group to the top-level (unnamed, pathless) group
    const groups = pbx.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      if (
        typeof groups[key] === 'object' &&
        groups[key].name === undefined &&
        groups[key].path === undefined
      ) {
        pbx.addToPbxGroup(extGroup.uuid, key);
      }
    });

    // ── 2. Create native target ────────────────────────────────────────────────
    const target = pbx.addTarget(EXT_NAME, 'app_extension', EXT_NAME);

    // ── 3. Build phases ────────────────────────────────────────────────────────
    pbx.addBuildPhase(SOURCE_FILES, 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    pbx.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    pbx.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    // ── 4. Frameworks ──────────────────────────────────────────────────────────
    const fwOpt = { target: target.uuid, sourceTree: 'SDKROOT', link: false };
    pbx.addFramework('WidgetKit.framework', fwOpt);
    pbx.addFramework('ActivityKit.framework', fwOpt);
    pbx.addFramework('SwiftUI.framework', fwOpt);

    // ── 5. Build settings via pbxXCBuildConfigurationSection ──────────────────
    // (addBuildSettings does not exist in the xcode npm package — use direct
    //  assignment on the config entries that match our target's PRODUCT_NAME)
    const configurations = pbx.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const config = configurations[key];
      const b = config.buildSettings;
      if (!b) continue;
      if (b.PRODUCT_NAME !== `"${EXT_NAME}"`) continue;

      b.CLANG_ENABLE_MODULES = 'YES';
      b.CODE_SIGN_ENTITLEMENTS = `"${EXT_NAME}/${ENTITLEMENTS_FILE}"`;
      b.CODE_SIGN_STYLE = 'Automatic';
      b.CURRENT_PROJECT_VERSION = cfg.ios?.buildNumber ?? '1';
      b.GENERATE_INFOPLIST_FILE = 'NO';
      b.INFOPLIST_FILE = `"${EXT_NAME}/Info.plist"`;
      b.IPHONEOS_DEPLOYMENT_TARGET = EXT_DEPLOYMENT_TARGET;
      b.LD_RUNPATH_SEARCH_PATHS =
        '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"';
      b.MARKETING_VERSION = cfg.version ?? '0.1.0';
      b.PRODUCT_BUNDLE_IDENTIFIER = `"${EXT_BUNDLE_ID}"`;
      b.SKIP_INSTALL = 'YES';
      b.SWIFT_EMIT_LOC_STRINGS = 'YES';
      b.SWIFT_VERSION = '5.0';
      b.TARGETED_DEVICE_FAMILY = '"1,2"';
    }

    // ── 6. Copy DEVELOPMENT_TEAM from main app to extension ───────────────────
    let devTeam;
    for (const key in configurations) {
      const b = configurations[key]?.buildSettings;
      if (!b || !b.DEVELOPMENT_TEAM) continue;
      const name = (b.PRODUCT_NAME || '').replace(/"/g, '');
      if (!name.includes('Extension') && !name.includes('Widget')) {
        devTeam = b.DEVELOPMENT_TEAM;
        break;
      }
    }
    if (devTeam) {
      pbx.addTargetAttribute('DevelopmentTeam', devTeam);
      pbx.addTargetAttribute('DevelopmentTeam', devTeam, pbx.pbxTargetByName(EXT_NAME));
    }

    console.log(`[withLiveActivity] ${EXT_NAME} target added successfully`);
    return cfg;
  });

  return config;
};
