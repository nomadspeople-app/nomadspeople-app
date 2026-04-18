# Map Clustering — Decision Log

## Date: April 8, 2026

## Library: react-native-map-clustering

### What was done:
- Installed `react-native-map-clustering` (uses SuperCluster under the hood)
- Replaced `<MapView>` with `<ClusteredMapView>` in HomeScreen.tsx
- Added custom `renderCluster` for styled cluster bubbles (teal, rounded, shows count + "nomads")
- Added `onRegionChangeComplete` to track visible markers count
- Updated nomads count bubble to show region-based count (not total city count)

### Key props configured:
- `radius={50}` — clustering distance in pixels
- `maxZoom={18}` — clusters dissolve at close zoom
- `minPoints={2}` — need at least 2 markers to form a cluster
- `spiralEnabled={false}` — disabled spider view
- `animationEnabled={true}` — smooth cluster animations on iOS

### How it works:
1. At far zoom → nearby pins merge into green bubble showing "5 nomads"
2. Tap cluster → map zooms to that area, showing individual pins
3. At close zoom → all pins visible individually as before
4. Nomads count bubble (top-left) updates based on what's visible on screen

### Files modified:
- `screens/HomeScreen.tsx` — ClusteredMapView, cluster styles, visible count state
- `package.json` — added react-native-map-clustering dependency

### How to revert:
1. Change `<ClusteredMapView` back to `<MapView` (from react-native-maps)
2. Remove clustering-specific props (clusterColor, renderCluster, etc.)
3. Remove `visibleNomadCount` state and `onRegionChangeComplete` handler
4. Revert nomads bubble count to use `nomadsCount` directly
5. Remove cluster styles from makeStyles
6. `npm uninstall react-native-map-clustering`
