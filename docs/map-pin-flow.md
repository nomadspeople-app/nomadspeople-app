# Map Pin Tap Flow — LOCKED RULE

## Date Locked: April 8, 2026
## Status: PERMANENT — Do not change this flow

---

## The Rule

When a user taps any pin on the map, the flow is ALWAYS:

### Step 1: Zoom In (400ms)
```
mapRef.current.animateToRegion({
  latitude: pin.latitude,
  longitude: pin.longitude,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
}, 400);
```

### Step 2: Wait for animation (450ms)

### Step 3: Open the popup
- Timer pin → TimerBubble (bottom card)
- Status pin → ActivityDetailSheet

---

## Why This Flow

1. **Density is the feature** — All pins are always visible. We NEVER hide pins behind clusters or numbered bubbles. A crowded map = a living city. That's the point.
2. **Zoom creates context** — Before showing details, the user sees where the pin is in the neighborhood. It feels natural, like walking closer to someone.
3. **Smooth animation** — The 400ms zoom is fast enough to not feel slow, slow enough to feel intentional and premium.

---

## What We Do NOT Do

- ❌ No clustering (react-native-map-clustering is installed but NOT used)
- ❌ No numbered bubble groups ("5 nomads")  
- ❌ No instant popup without zoom
- ❌ No hiding pins at any zoom level

---

## Nomads Count Bubble (top-left)

The bubble showing "X nomads here" updates based on the **visible map region**, not total city count. As the user zooms in, the number reflects only the nomads visible on screen.

```
onRegionChangeComplete → count checkins within visible bounds → update display
```

---

## Files

- `screens/HomeScreen.tsx` — handlePinTap function (zoom + delayed popup)
- `screens/HomeScreen.tsx` — MapView with onRegionChangeComplete for visible count
- `screens/HomeScreen.tsx` — buildNomadMarker (individual pin rendering)
- `components/TimerBubble.tsx` — bottom card for timer pins
- `components/ActivityDetailSheet.tsx` — sheet for status pins

---

## Implementation Reference

```typescript
const handlePinTap = (checkin) => {
  // Step 1: Smooth zoom to pin
  mapRef.current?.animateToRegion({
    latitude: checkin.latitude,
    longitude: checkin.longitude,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  }, 400);

  // Step 2: After zoom → open popup
  setTimeout(() => {
    if (isTimer) {
      setTimerBubbleCheckin(checkin);
    } else {
      setPopupData(checkin);
      setShowPopup(true);
    }
  }, 450);
};
```
