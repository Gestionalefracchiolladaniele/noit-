import type { NoitSkiaProps, NoitVariant } from './noit-skia';
import { NoitSkia } from './noit-skia';

/**
 * Noit — the app's mascot. As of the Skia migration this is a thin wrapper
 * around NoitSkia (GPU-rendered via @shopify/react-native-skia).
 *
 * The old react-native-svg implementation crashed natively on real Android
 * (~60 SVG nodes + ~10 Reanimated shared values per frame — see CLAUDE.md
 * §Device-test findings), so EVERY screen now renders the Skia version through
 * this wrapper. Props are unchanged, so all ~13 call sites keep working without
 * edits. The previous SVG implementation is preserved in git history.
 */

export type { NoitVariant };

export type NoitProps = NoitSkiaProps;

export function Noit(props: NoitProps) {
  return <NoitSkia {...props} />;
}
