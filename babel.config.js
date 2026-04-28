/**
 * Minimal Babel config — just the Expo preset.
 *
 * We removed the `transform-remove-console` plugin on 2026-04-23 after
 * it kept breaking EAS production builds (the plugin was fine in
 * devDependencies, but EAS production runs with NODE_ENV=production
 * which skips devDependencies; moving it to dependencies didn't take
 * because npm wouldn't refresh the lockfile's `"dev": true` marker for
 * an already-installed package). Stripping console.log was an
 * optimization, not a requirement. Sentry captures errors server-side;
 * stray console.log calls have a negligible bundle impact and are
 * actually useful during the closed testing period so testers can
 * paste stack traces back to us.
 *
 * If we ever want to re-add console stripping, consider Metro-level
 * transforms (expo-metro-config supports them) instead of a Babel
 * plugin — avoids the dev/prod dependency pitfall entirely.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [],
  };
};
