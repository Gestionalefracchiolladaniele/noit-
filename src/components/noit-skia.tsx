import {
  Canvas,
  Circle,
  Group,
  Line,
  Oval,
  Path,
  RadialGradient,
  rect,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * NoitSkia — GPU-rendered Noit using @shopify/react-native-skia.
 *
 * Full 1:1 port of the SVG Noit (Noit.tsx). Same viewBox coordinate space
 * `-20 -22 240 252`, same shapes/colors/path-strings, same animation timings,
 * so it should look identical — but renders on the GPU in a single Canvas
 * instead of ~60 SVG nodes animated through the bridge (which crashes the
 * native side on real Android, see CLAUDE.md §Device-test findings).
 *
 * Coordinate model: SVG uses a viewBox; Skia has no viewBox, so the root Group
 * applies a matching scale/translate to map the original `-20 -22 240 252`
 * space onto the Canvas pixel size. Every inner coordinate below is the SAME
 * number as in the SVG — no manual re-tuning.
 *
 * Transform rules (learned from the blink bug):
 * - scale-around-a-point (blink, breathe): translate→scale→translate INSIDE
 *   the transform array, WITHOUT `origin`.
 * - rotate-around-a-point (plumes, fins, tilt): `rotateZ` + `origin`, WITHOUT
 *   manual translate.
 */

/**
 * The 9 Noit mascot poses. Canonical definition lives here (the Skia
 * implementation); Noit.tsx re-exports it for backward-compatible imports.
 */
export type NoitVariant
  = | 'idle'
    | 'listening'
    | 'thinking'
    | 'eating'
    | 'happy'
    | 'excited'
    | 'wink'
    | 'curious'
    | 'eyes_closed';

export type NoitSkiaProps = {
  state?: NoitVariant;
  size?: number;
  crown?: boolean;
  showSparkles?: boolean;
  glow?: boolean;
  static?: boolean;
};

// Original SVG viewBox: min-x=-20, min-y=-22, width=240, height=252.
const VB_MIN_X = -20;
const VB_MIN_Y = -22;
const VB_W = 240;

const DEG = Math.PI / 180;

// Helper: SVG <Ellipse cx cy rx ry> → Skia rect for <Oval>.
// Takes a single tuple to satisfy max-params; order matches SVG: [cx, cy, rx, ry].
function ovalRect([cx, cy, rx, ry]: readonly [number, number, number, number]) {
  return rect(cx - rx, cy - ry, rx * 2, ry * 2);
}

// eslint-disable-next-line max-lines-per-function -- single declarative drawing component; splitting hurts readability
export function NoitSkia({
  state = 'idle',
  size = 200,
  crown = false,
  showSparkles = true,
  glow = true,
  static: isStatic = false,
}: NoitSkiaProps) {
  // Canvas pixel dimensions (match the SVG container: width=size, height=size*1.15)
  const canvasW = size;
  const canvasH = size * 1.15;

  // Map viewBox space -> canvas pixels. Uniform scale (240*1.05=252).
  const scale = canvasW / VB_W;

  const isEating = state === 'eating';
  const isTilted = state === 'listening' || state === 'thinking';

  // Static mode: force off the expensive overlays (matches Noit.tsx).
  const effectiveGlow = isStatic ? false : glow;
  const effectiveSparkles = isStatic ? false : showSparkles;

  // --- Animations: reuse the SAME shared-value timings as the SVG Noit ---
  const breathe = useSharedValue(1);
  const jiggle = useSharedValue(1);
  const blink = useSharedValue(1);
  const finL = useSharedValue(-8);
  const finR = useSharedValue(8);
  const floatY = useSharedValue(0);
  const tilt = useSharedValue(0);
  const antenna = useSharedValue(0);
  const sp1 = useSharedValue(0);
  const sp2 = useSharedValue(0);
  const sp3 = useSharedValue(0);

  // State-dependent animations (re-run on state change) — mirrors Noit.tsx.
  useEffect(() => {
    if (isStatic)
      return;
    if (isEating) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 280, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.02, { duration: 280, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      jiggle.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 220, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.97, { duration: 220, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }
    else {
      jiggle.value = withTiming(1, { duration: 200 });
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.034, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
    if (isTilted) {
      tilt.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 700 }),
          withTiming(-6, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(-6, { duration: 1200 }),
          withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
    else {
      tilt.value = withTiming(0, { duration: 300 });
    }
  }, [state, isStatic]);

  // Persistent loops that DON'T depend on state (run once at mount).
  useEffect(() => {
    if (isStatic)
      return;
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4176 }),
        withTiming(0.07, { duration: 120 }),
        withTiming(1, { duration: 504 }),
      ),
      -1,
      false,
    );
    finL.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(-8, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    finR.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    floatY.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    antenna.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    sp1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    sp2.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    sp3.value = withDelay(
      1500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [isStatic]);

  // --- Derived transforms ---

  // Root: viewBox mapping (origin offset + scale) + float (translateY) + tilt
  // rotate around head center (100,100). In SVG: translate(0 float) rotate(tilt 100 100).
  const rootTransform = useDerivedValue(() => {
    // Compose: viewBox translate+scale, then float (translateY), then tilt rotate
    // about head center (100,100) via manual translate→rotateZ→translate (no origin,
    // since these are nested inside the viewBox scale/translate frame).
    return [
      { translateX: -VB_MIN_X * scale },
      { translateY: (-VB_MIN_Y + floatY.value) * scale },
      { scale },
      { translateX: 100 },
      { translateY: 100 },
      { rotateZ: tilt.value * DEG },
      { translateX: -100 },
      { translateY: -100 },
    ];
  });

  // Body breathe/jiggle: scale around the body anchor (100,168), like bodyProps:
  // translate(100 168) scale(b*j  b/max(j,0.5)) translate(-100 -168).
  const bodyTransform = useDerivedValue(() => {
    const b = breathe.value;
    const j = jiggle.value;
    return [
      { translateX: 100 },
      { translateY: 168 },
      { scaleX: b * j },
      { scaleY: b / Math.max(j, 0.5) },
      { translateX: -100 },
      { translateY: -168 },
    ];
  });

  // Eye blink: scaleY around eye center (100,100). NO origin (manual translate pivots).
  const eyeTransform = useDerivedValue(() => {
    return [
      { translateY: 100 },
      { scaleY: blink.value },
      { translateY: -100 },
    ];
  });

  // Hand fins wobble: rotate(finL 28 118) / rotate(finR 172 118) for idle,
  // rotate(finL 10 130) / rotate(finR 190 130) for eating.
  const finLPivot = isEating ? { x: 10, y: 130 } : { x: 28, y: 118 };
  const finRPivot = isEating ? { x: 190, y: 130 } : { x: 172, y: 118 };
  const finLTransform = useDerivedValue(() => [{ rotateZ: finL.value * DEG }]);
  const finRTransform = useDerivedValue(() => [{ rotateZ: finR.value * DEG }]);

  // Plume-tip stars sway: rotate(antenna*0.6 100 30).
  const antennaTransform = useDerivedValue(() => [{ rotateZ: antenna.value * 0.6 * DEG }]);

  // Sparkle transforms: opacity + translate(c)→scale→rotate→translate(-c).
  const sp1Opacity = useDerivedValue(() => sp1.value);
  const sp2Opacity = useDerivedValue(() => sp2.value);
  const sp3Opacity = useDerivedValue(() => sp3.value);
  const sp1Transform = useDerivedValue(() => [
    { translateX: 14 },
    { translateY: 42 },
    { scale: sp1.value },
    { rotateZ: sp1.value * 180 * DEG },
    { translateX: -14 },
    { translateY: -42 },
  ]);
  const sp2Transform = useDerivedValue(() => [
    { translateX: 183 },
    { translateY: 34 },
    { scale: sp2.value },
    { rotateZ: sp2.value * 180 * DEG },
    { translateX: -183 },
    { translateY: -34 },
  ]);
  const sp3Transform = useDerivedValue(() => [
    { translateX: 175 },
    { translateY: 42 },
    { scale: sp3.value },
    { rotateZ: sp3.value * 180 * DEG },
    { translateX: -175 },
    { translateY: -42 },
  ]);

  // Aura overlay sizing (matches Noit.tsx separate SVG).
  const auraSize = size * 1.5;

  return (
    <View style={[styles.container, { width: size, height: size * 1.15 }]}>
      {effectiveGlow && (
        <Canvas
          style={{
            position: 'absolute',
            top: (size * 1.15 - auraSize) / 2 + size * 0.05,
            left: (size - auraSize) / 2,
            width: auraSize,
            height: auraSize,
          }}
          pointerEvents="none"
        >
          <Circle cx={auraSize / 2} cy={auraSize / 2} r={auraSize / 2}>
            <RadialGradient
              c={vec(auraSize / 2, auraSize / 2)}
              r={auraSize / 2}
              colors={[
                'rgba(255,255,255,0.28)',
                'rgba(255,255,255,0.14)',
                'rgba(255,255,255,0.04)',
                'rgba(255,255,255,0)',
              ]}
              positions={[0, 0.3, 0.6, 1]}
            />
          </Circle>
        </Canvas>
      )}

      <Canvas style={{ width: canvasW, height: canvasH }}>
        <Group transform={rootTransform}>
          {effectiveSparkles && (
            <Group>
              {/* Big left star */}
              <Group transform={sp1Transform} opacity={sp1Opacity}>
                <Path
                  path="M14 42 L17.5 53.5 L21 42 L32.5 38.5 L21 35 L14 24 L10.5 35 L-1 38.5 Z"
                  color="#F5E060"
                />
              </Group>
              {/* Medium upper-right star */}
              <Group transform={sp2Transform} opacity={sp2Opacity}>
                <Path
                  path="M183 22 L185.8 31.5 L188.6 22 L198.1 19.2 L188.6 16.4 L183 8 L180.2 16.4 L170.7 19.2 Z"
                  color="rgba(255,255,255,0.85)"
                />
              </Group>
              {/* Small lower-right star */}
              <Group transform={sp3Transform} opacity={sp3Opacity}>
                <Path
                  path="M170 50 L172 56.5 L174 50 L180.5 48 L174 46 L170 40 L168 46 L161.5 48 Z"
                  color="rgba(255,220,255,0.8)"
                />
              </Group>
            </Group>
          )}

          {/* Ground shadow */}
          <Oval rect={ovalRect([100, 210, 50, 8])} color="#A484D4" opacity={0.18} />

          <Group transform={bodyTransform}>
            {/* === Left hand fin === */}
            {isTilted
              ? (
                  <Group transform={[{ rotateZ: -50 * DEG }]} origin={{ x: 22, y: 86 }}>
                    <Oval rect={ovalRect([22, 86, 26, 15])} color="#A484D4" />
                    <Oval rect={ovalRect([22, 86, 18, 10])} color="#C8B4F4" />
                  </Group>
                )
              : (
                  <Group transform={finLTransform} origin={finLPivot}>
                    <Group transform={[{ rotateZ: (isEating ? -35 : -25) * DEG }]} origin={finLPivot}>
                      <Oval
                        rect={isEating ? ovalRect([10, 130, 32, 18]) : ovalRect([28, 118, 26, 15])}
                        color="#A484D4"
                      />
                      <Oval
                        rect={isEating ? ovalRect([10, 130, 22, 12]) : ovalRect([28, 118, 18, 10])}
                        color="#C8B4F4"
                      />
                    </Group>
                  </Group>
                )}

            {/* === Right hand fin === */}
            <Group transform={finRTransform} origin={finRPivot}>
              <Group transform={[{ rotateZ: (isEating ? 35 : 25) * DEG }]} origin={finRPivot}>
                <Oval
                  rect={isEating ? ovalRect([190, 130, 32, 18]) : ovalRect([172, 118, 26, 15])}
                  color="#A484D4"
                />
                <Oval
                  rect={isEating ? ovalRect([190, 130, 22, 12]) : ovalRect([172, 118, 18, 10])}
                  color="#C8B4F4"
                />
              </Group>
            </Group>

            {/* === Fork — held by right fin. translate(14 12) when eating. === */}
            <Group transform={isEating ? [{ translateX: 14 }, { translateY: 12 }] : []}>
              {/* Tines (4 prongs) — body stroke + dark outline */}
              <Line p1={{ x: 179.5, y: 70 }} p2={{ x: 179.5, y: 94 }} color="#E8E4F4" strokeWidth={4} strokeCap="round" style="stroke" />
              <Line p1={{ x: 179.5, y: 70 }} p2={{ x: 179.5, y: 94 }} color="#5C3E9C" strokeWidth={1.4} strokeCap="round" style="stroke" opacity={0.9} />
              <Line p1={{ x: 185, y: 68 }} p2={{ x: 185, y: 94 }} color="#E8E4F4" strokeWidth={4} strokeCap="round" style="stroke" />
              <Line p1={{ x: 185, y: 68 }} p2={{ x: 185, y: 94 }} color="#5C3E9C" strokeWidth={1.4} strokeCap="round" style="stroke" opacity={0.9} />
              <Line p1={{ x: 191, y: 68 }} p2={{ x: 191, y: 94 }} color="#E8E4F4" strokeWidth={4} strokeCap="round" style="stroke" />
              <Line p1={{ x: 191, y: 68 }} p2={{ x: 191, y: 94 }} color="#5C3E9C" strokeWidth={1.4} strokeCap="round" style="stroke" opacity={0.9} />
              <Line p1={{ x: 196.5, y: 70 }} p2={{ x: 196.5, y: 94 }} color="#E8E4F4" strokeWidth={4} strokeCap="round" style="stroke" />
              <Line p1={{ x: 196.5, y: 70 }} p2={{ x: 196.5, y: 94 }} color="#5C3E9C" strokeWidth={1.4} strokeCap="round" style="stroke" opacity={0.9} />
              {/* Head plate */}
              <Path path="M 174 94 Q 188 88 202 94 L 202 102 Q 188 108 174 102 Z" color="#E8E4F4" />
              <Path path="M 174 94 Q 188 88 202 94 L 202 102 Q 188 108 174 102 Z" color="#5C3E9C" style="stroke" strokeWidth={1.4} />
              <Path path="M 176 92 Q 188 89 200 92" color="#FFFFFF" style="stroke" strokeWidth={1} strokeCap="round" opacity={0.85} />
              {/* Shaft */}
              <Line p1={{ x: 188, y: 102 }} p2={{ x: 188, y: 142 }} color="#E8E4F4" strokeWidth={5} strokeCap="round" style="stroke" />
              <Line p1={{ x: 188, y: 102 }} p2={{ x: 188, y: 142 }} color="#5C3E9C" strokeWidth={1.6} strokeCap="round" style="stroke" opacity={0.85} />
              <Line p1={{ x: 186.5, y: 106 }} p2={{ x: 186.5, y: 138 }} color="#FFFFFF" strokeWidth={1.2} strokeCap="round" style="stroke" opacity={0.7} />
              {/* Grip wrap */}
              <Line p1={{ x: 188, y: 112 }} p2={{ x: 188, y: 124 }} color="#5C3E9C" strokeWidth={7} strokeCap="round" style="stroke" />
              <Line p1={{ x: 184.5, y: 115 }} p2={{ x: 191.5, y: 115 }} color="#BCA8EE" strokeWidth={0.8} strokeCap="round" style="stroke" opacity={0.85} />
              <Line p1={{ x: 184.5, y: 118 }} p2={{ x: 191.5, y: 118 }} color="#BCA8EE" strokeWidth={0.8} strokeCap="round" style="stroke" opacity={0.85} />
              <Line p1={{ x: 184.5, y: 121 }} p2={{ x: 191.5, y: 121 }} color="#BCA8EE" strokeWidth={0.8} strokeCap="round" style="stroke" opacity={0.85} />
              {/* Star pommel */}
              <Path path="M188 142 L192.5 150.5 L201 151.5 L192.5 152.5 L188 161 L183.5 152.5 L175 151.5 L183.5 150.5 Z" color="#F5E060" />
              <Path path="M188 142 L192.5 150.5 L201 151.5 L192.5 152.5 L188 161 L183.5 152.5 L175 151.5 L183.5 150.5 Z" color="#E8C830" style="stroke" strokeWidth={1} />
              <Circle cx={188} cy={151.5} r={2} color="#FFF4A0" opacity={0.95} />
            </Group>

            {/* === Body === */}
            <Oval
              rect={isEating ? ovalRect([100, 118, 96, 102]) : ovalRect([100, 112, 78, 88])}
              color="#BCA8EE"
            />

            {/* === Head plumes (3) === */}
            {/* Left plume */}
            <Group transform={[{ rotateZ: -22 * DEG }]} origin={isEating ? { x: 76, y: 22 } : { x: 82, y: 18 }}>
              <Oval rect={isEating ? ovalRect([76, 22, 11, 18]) : ovalRect([82, 18, 9, 15])} color="#A484D4" />
            </Group>
            <Group transform={[{ rotateZ: -22 * DEG }]} origin={isEating ? { x: 76, y: 24 } : { x: 82, y: 20 }}>
              <Oval rect={isEating ? ovalRect([76, 24, 7, 13]) : ovalRect([82, 20, 6, 11])} color="#C8B4F4" />
            </Group>
            {/* Center plume */}
            <Oval rect={isEating ? ovalRect([100, 18, 12, 20]) : ovalRect([100, 14, 10, 17])} color="#A484D4" />
            <Oval rect={isEating ? ovalRect([100, 20, 8, 14]) : ovalRect([100, 16, 7, 12])} color="#C8B4F4" />
            {/* Right plume */}
            <Group transform={[{ rotateZ: 22 * DEG }]} origin={isEating ? { x: 124, y: 22 } : { x: 118, y: 18 }}>
              <Oval rect={isEating ? ovalRect([124, 22, 11, 18]) : ovalRect([118, 18, 9, 15])} color="#A484D4" />
            </Group>
            <Group transform={[{ rotateZ: 22 * DEG }]} origin={isEating ? { x: 124, y: 24 } : { x: 118, y: 20 }}>
              <Oval rect={isEating ? ovalRect([124, 24, 7, 13]) : ovalRect([118, 20, 6, 11])} color="#C8B4F4" />
            </Group>

            {/* === Crown (optional) === */}
            {crown && (
              <Group>
                <Path path="M68 50 L77 34 L90 48 L100 28 L110 48 L123 34 L132 50 Z" color="#F5E060" />
                <Path path="M68 50 L132 50 L132 57 Q 132 61 128 61 L72 61 Q 68 61 68 57 Z" color="#E8C830" />
                <Circle cx={77} cy={34} r={4.5} color="#FFF4A0" />
                <Circle cx={100} cy={28} r={4.5} color="#FFF4A0" />
                <Circle cx={123} cy={34} r={4.5} color="#FFF4A0" />
              </Group>
            )}

            {/* === Plume-tip stars (sway via antenna) === */}
            <Group transform={antennaTransform} origin={{ x: 100, y: 30 }}>
              <Path
                path={isEating
                  ? 'M68 -2 L70.5 3 L75.5 3.5 L70.5 4 L68 9 L65.5 4 L60.5 3.5 L65.5 3 Z'
                  : 'M74 0 L76.5 5 L81.5 5.5 L76.5 6 L74 11 L71.5 6 L66.5 5.5 L71.5 5 Z'}
                color="#F5E060"
              />
              <Path
                path={isEating
                  ? 'M68 -2 L70.5 3 L75.5 3.5 L70.5 4 L68 9 L65.5 4 L60.5 3.5 L65.5 3 Z'
                  : 'M74 0 L76.5 5 L81.5 5.5 L76.5 6 L74 11 L71.5 6 L66.5 5.5 L71.5 5 Z'}
                color="#E8C830"
                style="stroke"
                strokeWidth={0.7}
              />
              <Path
                path={isEating
                  ? 'M100 -10 L103 -3.5 L109.5 -3 L103 -2.5 L100 4 L97 -2.5 L90.5 -3 L97 -3.5 Z'
                  : 'M100 -7 L103 -0.5 L109.5 0 L103 0.5 L100 7 L97 0.5 L90.5 0 L97 -0.5 Z'}
                color="#F5E060"
              />
              <Path
                path={isEating
                  ? 'M100 -10 L103 -3.5 L109.5 -3 L103 -2.5 L100 4 L97 -2.5 L90.5 -3 L97 -3.5 Z'
                  : 'M100 -7 L103 -0.5 L109.5 0 L103 0.5 L100 7 L97 0.5 L90.5 0 L97 -0.5 Z'}
                color="#E8C830"
                style="stroke"
                strokeWidth={0.8}
              />
              <Path
                path={isEating
                  ? 'M132 -2 L134.5 3 L139.5 3.5 L134.5 4 L132 9 L129.5 4 L124.5 3.5 L129.5 3 Z'
                  : 'M126 0 L128.5 5 L133.5 5.5 L128.5 6 L126 11 L123.5 6 L118.5 5.5 L123.5 5 Z'}
                color="#F5E060"
              />
              <Path
                path={isEating
                  ? 'M132 -2 L134.5 3 L139.5 3.5 L134.5 4 L132 9 L129.5 4 L124.5 3.5 L129.5 3 Z'
                  : 'M126 0 L128.5 5 L133.5 5.5 L128.5 6 L126 11 L123.5 6 L118.5 5.5 L123.5 5 Z'}
                color="#E8C830"
                style="stroke"
                strokeWidth={0.7}
              />
            </Group>

            {/* === Belly === */}
            <Oval
              rect={isEating ? ovalRect([100, 130, 68, 72]) : ovalRect([100, 122, 50, 58])}
              color="#D8C8FA"
              opacity={0.65}
            />

            {/* === Bib === */}
            {isEating
              ? (
                  <Group>
                    <Path path="M 60 152 Q 56 178 70 196 Q 100 210 130 196 Q 144 178 140 152 Q 100 162 60 152 Z" color="#FFFFFF" />
                    <Path path="M 60 152 Q 56 178 70 196 Q 100 210 130 196 Q 144 178 140 152 Q 100 162 60 152 Z" color="#7B5BA9" style="stroke" strokeWidth={2.2} />
                    <Path path="M 60 174 Q 28 170 10 156" color="#7B5BA9" style="stroke" strokeWidth={2.8} strokeCap="round" opacity={0.75} />
                    <Path path="M 140 174 Q 172 170 190 156" color="#7B5BA9" style="stroke" strokeWidth={2.8} strokeCap="round" opacity={0.75} />
                    <Path path="M 70 162 Q 100 170 130 162" color="#7B5BA9" style="stroke" strokeWidth={1.1} strokeCap="round" opacity={0.35} />
                    <Path path="M100 178 L104 188 L114 189 L104 190 L100 200 L96 190 L86 189 L96 188 Z" color="#F5E060" />
                    <Path path="M100 178 L104 188 L114 189 L104 190 L100 200 L96 190 L86 189 L96 188 Z" color="#E8C830" style="stroke" strokeWidth={0.9} />
                    <Circle cx={100} cy={189} r={1.8} color="#FFF4A0" opacity={0.95} />
                  </Group>
                )
              : (
                  <Group>
                    <Path path="M 70 142 Q 68 164 78 178 Q 100 188 122 178 Q 132 164 130 142 Q 100 150 70 142 Z" color="#FFFFFF" />
                    <Path path="M 70 142 Q 68 164 78 178 Q 100 188 122 178 Q 132 164 130 142 Q 100 150 70 142 Z" color="#7B5BA9" style="stroke" strokeWidth={2} />
                    <Path path="M 70 160 Q 40 158 24 146" color="#7B5BA9" style="stroke" strokeWidth={2.6} strokeCap="round" opacity={0.75} />
                    <Path path="M 130 160 Q 160 158 176 146" color="#7B5BA9" style="stroke" strokeWidth={2.6} strokeCap="round" opacity={0.75} />
                    <Path path="M 78 150 Q 100 156 122 150" color="#7B5BA9" style="stroke" strokeWidth={1} strokeCap="round" opacity={0.35} />
                    <Path path="M100 162 L103.5 170 L112 171 L103.5 172 L100 180 L96.5 172 L88 171 L96.5 170 Z" color="#F5E060" />
                    <Path path="M100 162 L103.5 170 L112 171 L103.5 172 L100 180 L96.5 172 L88 171 L96.5 170 Z" color="#E8C830" style="stroke" strokeWidth={0.8} />
                    <Circle cx={100} cy={171} r={1.6} color="#FFF4A0" opacity={0.95} />
                  </Group>
                )}

            {/* === Cheeks === */}
            {isEating
              ? (
                  <Group>
                    <Oval rect={ovalRect([48, 120, 32, 24])} color="#F2B8CC" opacity={0.9} />
                    <Oval rect={ovalRect([152, 120, 32, 24])} color="#F2B8CC" opacity={0.9} />
                  </Group>
                )
              : (
                  <Group>
                    <Oval rect={ovalRect([64, 122, 14, 9])} color="#F2B8CC" opacity={0.5} />
                    <Oval rect={ovalRect([136, 122, 14, 9])} color="#F2B8CC" opacity={0.5} />
                  </Group>
                )}

            {/* === Eyebrows === */}
            {(state === 'happy' || state === 'excited' || state === 'eating') && (
              <Group>
                <Path path="M 62 77 Q 79 65 94 77" color="#1E1240" style="stroke" strokeWidth={3} strokeCap="round" opacity={0.45} />
                <Path path="M 106 77 Q 121 65 138 77" color="#1E1240" style="stroke" strokeWidth={3} strokeCap="round" opacity={0.45} />
              </Group>
            )}
            {(state === 'curious' || state === 'thinking') && (
              <Group>
                <Path path="M 66 83 Q 79 73 92 81" color="#1E1240" style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.45} />
                <Path path="M 108 81 Q 121 75 134 83" color="#1E1240" style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.45} />
              </Group>
            )}
            {state === 'wink' && (
              <Group>
                <Path path="M 66 83 Q 79 75 92 83" color="#1E1240" style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.38} />
                <Path path="M 108 78 Q 121 70 134 78" color="#1E1240" style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.5} />
              </Group>
            )}
            {(state === 'idle' || state === 'listening' || state === 'eyes_closed') && (
              <Group>
                <Path path="M 66 83 Q 79 75 92 83" color="#1E1240" style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.38} />
                <Path path="M 108 83 Q 121 75 134 83" color="#1E1240" style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.38} />
              </Group>
            )}

            {/* === Eyes (blink via eyeTransform) === */}
            <Group transform={eyeTransform}>
              {(state === 'idle' || state === 'listening') && (
                <Group>
                  <Circle cx={79} cy={100} r={13} color="#1E1240" />
                  <Circle cx={74} cy={95} r={2.5} color="white" opacity={0.95} />
                  <Path path="M83 90.5 L84.5 94.2 L88.5 95 L84.5 95.8 L83 99.5 L81.5 95.8 L77.5 95 L81.5 94.2 Z" color="white" opacity={0.95} />
                  <Circle cx={121} cy={state === 'listening' ? 102 : 100} r={13} color="#1E1240" />
                  <Circle cx={116} cy={state === 'listening' ? 97 : 95} r={2.5} color="white" opacity={0.95} />
                  <Path
                    path={state === 'listening'
                      ? 'M125 92.5 L126.5 96.2 L130.5 97 L126.5 97.8 L125 101.5 L123.5 97.8 L119.5 97 L123.5 96.2 Z'
                      : 'M125 90.5 L126.5 94.2 L130.5 95 L126.5 95.8 L125 99.5 L123.5 95.8 L119.5 95 L123.5 94.2 Z'}
                    color="white"
                    opacity={0.95}
                  />
                </Group>
              )}

              {(state === 'curious' || state === 'thinking') && (
                <Group>
                  <Circle cx={79} cy={100} r={13} color="#1E1240" />
                  <Circle cx={74} cy={95} r={2.5} color="white" opacity={0.95} />
                  <Path path="M79 89.5 L80.5 93.2 L84.5 94 L80.5 94.8 L79 98.5 L77.5 94.8 L73.5 94 L77.5 93.2 Z" color="white" opacity={0.95} />
                  <Circle cx={121} cy={100} r={13} color="#1E1240" />
                  <Circle cx={116} cy={95} r={2.5} color="white" opacity={0.95} />
                  <Path path="M121 89.5 L122.5 93.2 L126.5 94 L122.5 94.8 L121 98.5 L119.5 94.8 L115.5 94 L119.5 93.2 Z" color="white" opacity={0.95} />
                </Group>
              )}

              {state === 'happy' && (
                <Group>
                  <Path path="M 64 100 Q 79 86 94 100" color="#1E1240" style="stroke" strokeWidth={5.5} strokeCap="round" />
                  <Path path="M 106 100 Q 121 86 136 100" color="#1E1240" style="stroke" strokeWidth={5.5} strokeCap="round" />
                </Group>
              )}

              {state === 'excited' && (
                <Group>
                  <Circle cx={79} cy={100} r={15} color="#1E1240" />
                  <Circle cx={73} cy={94} r={3} color="white" opacity={0.95} />
                  <Path path="M83 88.5 L84.8 93.2 L90 94 L84.8 94.8 L83 99.5 L81.2 94.8 L76 94 L81.2 93.2 Z" color="white" opacity={0.95} />
                  <Circle cx={121} cy={100} r={15} color="#1E1240" />
                  <Circle cx={115} cy={94} r={3} color="white" opacity={0.95} />
                  <Path path="M125 88.5 L126.8 93.2 L132 94 L126.8 94.8 L125 99.5 L123.2 94.8 L118 94 L123.2 93.2 Z" color="white" opacity={0.95} />
                </Group>
              )}

              {state === 'wink' && (
                <Group>
                  <Circle cx={79} cy={100} r={13} color="#1E1240" />
                  <Circle cx={74} cy={95} r={2.5} color="white" opacity={0.95} />
                  <Path path="M83 90.5 L84.5 94.2 L88.5 95 L84.5 95.8 L83 99.5 L81.5 95.8 L77.5 95 L81.5 94.2 Z" color="white" opacity={0.95} />
                  <Path path="M 108 100 Q 121 92 134 100" color="#1E1240" style="stroke" strokeWidth={5.5} strokeCap="round" />
                </Group>
              )}

              {state === 'eating' && (
                <Group>
                  <Line p1={{ x: 67, y: 86 }} p2={{ x: 91, y: 110 }} color="#1E1240" strokeWidth={6} strokeCap="round" style="stroke" />
                  <Line p1={{ x: 91, y: 86 }} p2={{ x: 67, y: 110 }} color="#1E1240" strokeWidth={6} strokeCap="round" style="stroke" />
                  <Line p1={{ x: 109, y: 86 }} p2={{ x: 133, y: 110 }} color="#1E1240" strokeWidth={6} strokeCap="round" style="stroke" />
                  <Line p1={{ x: 133, y: 86 }} p2={{ x: 109, y: 110 }} color="#1E1240" strokeWidth={6} strokeCap="round" style="stroke" />
                </Group>
              )}

              {state === 'eyes_closed' && (
                <Group>
                  <Path path="M 67 100 Q 79 108 91 100" color="#1E1240" style="stroke" strokeWidth={4} strokeCap="round" />
                  <Path path="M 109 100 Q 121 108 133 100" color="#1E1240" style="stroke" strokeWidth={4} strokeCap="round" />
                </Group>
              )}
            </Group>

            {/* === Mouth === */}
            {isEating
              ? (
                  <Group>
                    <Oval rect={ovalRect([100, 132, 22, 17])} color="#1E1240" />
                    <Oval rect={ovalRect([100, 134, 18, 14])} color="#F5A0B8" />
                    <Oval rect={ovalRect([100, 143, 10, 7])} color="#E07090" />
                  </Group>
                )
              : state === 'happy' || state === 'excited'
                ? (
                    <Group>
                      <Oval rect={ovalRect([100, 126, 14, 10])} color="#1E1240" />
                      <Oval rect={ovalRect([100, 128, 11, 8])} color="#F5A0B8" />
                    </Group>
                  )
                : state === 'curious' || state === 'thinking'
                  ? (
                      <Group>
                        <Oval rect={ovalRect([100, 127, 9, 6.5])} color="#1E1240" />
                        <Oval rect={ovalRect([100, 128.5, 6.5, 5])} color="#F5A0B8" />
                      </Group>
                    )
                  : (
                      <Group>
                        <Oval rect={ovalRect([100, 126, 10, 7])} color="#1E1240" />
                        <Oval rect={ovalRect([100, 127.5, 7, 5])} color="#F5A0B8" />
                      </Group>
                    )}

            {/* === Feet === */}
            <Oval
              rect={isEating ? ovalRect([70, 214, 22, 12]) : ovalRect([78, 194, 20, 11])}
              color="#A484D4"
            />
            <Oval
              rect={isEating ? ovalRect([130, 214, 22, 12]) : ovalRect([122, 194, 20, 11])}
              color="#A484D4"
            />
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});
