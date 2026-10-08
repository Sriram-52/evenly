const { withPodfile } = require("expo/config-plugins");

// Some pods (e.g. ReachabilitySwift, pulled in by expo-updates) still declare
// iOS 12.0, which Xcode 27 rejects outright for device builds ("supported
// deployment target versions is 15.0 to ..."). Raise any pod target below the
// app's own deployment target up to it.
const MARKER = "# with-pod-deployment-target";

const SNIPPET = `
    ${MARKER}
    app_target = podfile_properties['ios.deploymentTarget'] || '16.4'
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        current = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new(app_target)
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_target
        end
      end
    end
`;

module.exports = function withPodDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults;
    if (!podfile.contents.includes(MARKER)) {
      podfile.contents = podfile.contents.replace(
        /post_install do \|installer\|\n/,
        (match) => match + SNIPPET,
      );
    }
    return config;
  });
};
