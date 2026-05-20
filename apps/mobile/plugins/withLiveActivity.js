/**
 * Expo config plugin: adds the QuenchrLiveActivity widget extension target
 * to the iOS Xcode project.
 *
 * What this does:
 *  1. Copies Swift + plist files from targets/quenchr-live-activity/ into
 *     ios/QuenchrLiveActivity/ during prebuild.
 *  2. Adds a new Xcode native target (widget extension) with the correct
 *     build settings, build phases (Sources / Resources / Frameworks), and
 *     the WidgetKit + ActivityKit + SwiftUI framework references.
 *  3. Embeds the extension in the main app target so it ships with the IPA.
 *  4. Sets NSSupportsLiveActivities = YES in the main app Info.plist.
 *
 * References:
 *  - https://developer.apple.com/documentation/activitykit
 *  - https://docs.expo.dev/config-plugins/plugins-and-mods/
 */

const {
  withXcodeProject,
  withInfoPlist,
  withEntitlementsPlist,
  IOSConfig,
} = require('@expo/config-plugins');
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

// ── Main export ────────────────────────────────────────────────────────────────

module.exports = function withLiveActivity(config) {
  // Step 1: NSSupportsLiveActivities in the main app Info.plist
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSSupportsLiveActivities = true;
    // Opt out of frequent updates (saves battery; we update ~every 25 s)
    cfg.modResults.NSSupportsLiveActivitiesFrequentUpdates = false;
    return cfg;
  });

  // Step 2: Xcode project manipulation
  config = withXcodeProject(config, (cfg) => {
    const xcodeProject = cfg.modResults;
    const projectRoot = cfg.modRequest.projectRoot;
    const iosDir = path.join(projectRoot, 'ios');
    const extDir = path.join(iosDir, EXT_NAME);
    const sourceDir = path.join(projectRoot, '..', 'targets', 'quenchr-live-activity');

    // ── Idempotency guard ──────────────────────────────────────────────────────
    if (xcodeProject.pbxTargetByName(EXT_NAME)) {
      console.log(`[withLiveActivity] ${EXT_NAME} target already exists — skipping`);
      return cfg;
    }

    // ── Copy extension files into ios/ ─────────────────────────────────────────
    fs.mkdirSync(extDir, { recursive: true });
    [...SOURCE_FILES, ...RESOURCE_FILES, ENTITLEMENTS_FILE].forEach((file) => {
      const src = path.join(sourceDir, file);
      const dst = path.join(extDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      } else {
        console.warn(`[withLiveActivity] source file not found: ${src}`);
      }
    });

    // ── Add the extension target ───────────────────────────────────────────────
    const extTarget = xcodeProject.addTarget(
      EXT_NAME,
      'app_extension',
      EXT_NAME,
      EXT_BUNDLE_ID,
    );

    // ── Build phases ───────────────────────────────────────────────────────────
    xcodeProject.addBuildPhase(
      SOURCE_FILES,
      'PBXSourcesBuildPhase',
      'Sources',
      extTarget.uuid,
      { fileType: 'sourcecode.swift', path: EXT_NAME },
    );

    xcodeProject.addBuildPhase(
      RESOURCE_FILES,
      'PBXResourcesBuildPhase',
      'Resources',
      extTarget.uuid,
      { fileType: 'text.plist.xml', path: EXT_NAME },
    );

    xcodeProject.addBuildPhase(
      [],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      extTarget.uuid,
    );

    // ── Frameworks ─────────────────────────────────────────────────────────────
    // WidgetKit and ActivityKit are weakly linked (available on iOS 14+ / 16.2+)
    const frameworkOptions = { target: extTarget.uuid, weak: true };
    xcodeProject.addFramework('WidgetKit.framework', frameworkOptions);
    xcodeProject.addFramework('ActivityKit.framework', frameworkOptions);
    xcodeProject.addFramework('SwiftUI.framework', frameworkOptions);

    // ── Build settings ─────────────────────────────────────────────────────────
    const buildSettings = {
      ALWAYS_SEARCH_USER_PATHS: 'NO',
      CLANG_ANALYZER_NONNULL: 'YES',
      CODE_SIGN_ENTITLEMENTS: `${EXT_NAME}/${ENTITLEMENTS_FILE}`,
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: '$(CURRENT_PROJECT_VERSION)',
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `${EXT_NAME}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: EXT_DEPLOYMENT_TARGET,
      LD_RUNPATH_SEARCH_PATHS:
        '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks',
      MARKETING_VERSION: '$(MARKETING_VERSION)',
      PRODUCT_BUNDLE_IDENTIFIER: EXT_BUNDLE_ID,
      PRODUCT_NAME: '$(TARGET_NAME)',
      SKIP_INSTALL: 'YES',
      SWIFT_EMIT_LOC_STRINGS: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
    };

    // Apply to both Debug and Release build configurations
    const configNames = Object.keys(
      xcodeProject.pbxXCBuildConfigurationSection(),
    ).filter((key) => {
      const section = xcodeProject.pbxXCBuildConfigurationSection()[key];
      return (
        typeof section === 'object' &&
        section.buildSettings &&
        xcodeProject.getBuildConfigurationSection(key)
          ?.target === extTarget.uuid
      );
    });

    // Fallback: use addBuildSettings if config key lookup fails
    xcodeProject.addBuildSettings(buildSettings, extTarget.uuid, 'Debug');
    xcodeProject.addBuildSettings(buildSettings, extTarget.uuid, 'Release');

    // ── PBX group ──────────────────────────────────────────────────────────────
    const allFiles = [...SOURCE_FILES, ...RESOURCE_FILES, ENTITLEMENTS_FILE];
    const group = xcodeProject.addPbxGroup(allFiles, EXT_NAME, EXT_NAME);

    const mainGroupId =
      xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(group.uuid, mainGroupId);

    // ── Embed extension in the main app ────────────────────────────────────────
    // Find the first app target (main Quenchr target)
    const mainTargets = xcodeProject
      .getFirstProject()
      .firstProject.targets?.filter(
        (t) => xcodeProject.pbxNativeTargetSection()[t.value]?.productType ===
          '"com.apple.product-type.application"',
      ) ?? [];

    if (mainTargets.length > 0) {
      const mainTargetUuid = mainTargets[0].value;

      // Add dependency
      xcodeProject.addTargetDependency(mainTargetUuid, [extTarget.uuid]);

      // Embed the extension
      xcodeProject.addBuildPhase(
        [`${EXT_NAME}.appex`],
        'PBXCopyFilesBuildPhase',
        'Embed Foundation Extensions',
        mainTargetUuid,
        { dstSubfolderSpec: 13 }, // 13 = PlugIns
      );
    }

    console.log(`[withLiveActivity] ${EXT_NAME} target added successfully`);
    return cfg;
  });

  return config;
};
