import { StyleSheet, Text, View } from 'react-native';

export type AppIconName =
  | 'home-outline' | 'home'
  | 'document-text-outline' | 'document-text'
  | 'finger-print-outline' | 'finger-print'
  | 'wallet-outline' | 'wallet'
  | 'person-outline' | 'person'
  | 'calendar-outline' | 'time-outline'
  | 'checkmark-done-outline' | 'lock-closed-outline'
  | 'add' | 'close' | 'chevron-forward';

interface IconProps { name: AppIconName; size?: number; color: string }

/**
 * Small code-native icon set. It avoids runtime font downloads, which makes
 * icons deterministic in Expo Go, offline demos and production bundles.
 */
export function AppIcon({ name, size = 22, color }: IconProps) {
  const stroke = Math.max(1.5, size * 0.09);
  const common = { width: size, height: size };
  const filled = !name.endsWith('-outline');

  if (name === 'add' || name === 'close' || name === 'chevron-forward' || name === 'checkmark-done-outline') {
    const glyph = name === 'add' ? '+' : name === 'close' ? '×' : name === 'chevron-forward' ? '›' : '✓';
    return <Text style={[styles.glyph, { width: size, color, fontSize: name === 'chevron-forward' ? size * 1.35 : size, lineHeight: size }]}>{glyph}</Text>;
  }

  if (name.startsWith('home')) return <View style={[styles.canvas, common]}>
    <View style={{ position: 'absolute', left: size * .19, top: size * .12, width: size * .62, height: size * .62, borderLeftWidth: stroke, borderTopWidth: stroke, borderColor: color, transform: [{ rotate: '45deg' }], borderTopLeftRadius: stroke }} />
    <View style={{ position: 'absolute', left: size * .22, bottom: size * .08, width: size * .56, height: size * .52, borderWidth: stroke, borderTopWidth: 0, borderColor: color, backgroundColor: filled ? color : 'transparent', borderBottomLeftRadius: stroke * 1.5, borderBottomRightRadius: stroke * 1.5 }} />
  </View>;

  if (name.startsWith('document')) return <View style={[styles.canvas, common]}>
    <View style={{ width: size * .7, height: size * .86, borderWidth: stroke, borderColor: color, borderRadius: stroke * 1.5, paddingHorizontal: size * .12, paddingTop: size * .2, gap: size * .1, backgroundColor: filled ? `${color}22` : 'transparent' }}>
      {[.38, .5, .32].map((width, index) => <View key={index} style={{ width: size * width, height: stroke, borderRadius: stroke, backgroundColor: color }} />)}
    </View>
  </View>;

  if (name.startsWith('finger-print')) return <View style={[styles.canvas, common]}>
    <View style={{ width: size * .78, height: size * .78, borderWidth: stroke, borderColor: color, borderRadius: size, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? `${color}22` : 'transparent' }}>
      <View style={{ width: size * .43, height: size * .55, borderWidth: stroke, borderColor: color, borderRadius: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: stroke * 1.4, height: size * .29, borderRadius: stroke, backgroundColor: color }} />
      </View>
    </View>
  </View>;

  if (name.startsWith('wallet')) return <View style={[styles.canvas, common]}>
    <View style={{ width: size * .86, height: size * .62, borderWidth: stroke, borderColor: color, borderRadius: size * .13, backgroundColor: filled ? `${color}22` : 'transparent' }} />
    <View style={{ position: 'absolute', right: size * .02, width: size * .32, height: size * .26, borderWidth: stroke, borderColor: color, borderRadius: size * .1, backgroundColor: filled ? color : 'transparent' }} />
  </View>;

  if (name.startsWith('person')) return <View style={[styles.canvas, common]}>
    <View style={{ position: 'absolute', top: size * .06, width: size * .34, height: size * .34, borderRadius: size, borderWidth: stroke, borderColor: color, backgroundColor: filled ? color : 'transparent' }} />
    <View style={{ position: 'absolute', bottom: size * .05, width: size * .75, height: size * .42, borderTopLeftRadius: size, borderTopRightRadius: size, borderWidth: stroke, borderBottomWidth: 0, borderColor: color, backgroundColor: filled ? `${color}22` : 'transparent' }} />
  </View>;

  if (name === 'calendar-outline') return <View style={[styles.canvas, common]}>
    <View style={{ width: size * .84, height: size * .76, marginTop: size * .1, borderWidth: stroke, borderColor: color, borderRadius: size * .1 }}>
      <View style={{ height: size * .18, borderBottomWidth: stroke, borderColor: color, backgroundColor: `${color}22` }} />
    </View>
    <View style={{ position: 'absolute', top: size * .02, left: size * .27, width: stroke, height: size * .24, backgroundColor: color }} />
    <View style={{ position: 'absolute', top: size * .02, right: size * .27, width: stroke, height: size * .24, backgroundColor: color }} />
  </View>;

  if (name === 'time-outline') return <View style={[styles.canvas, common]}>
    <View style={{ width: size * .82, height: size * .82, borderWidth: stroke, borderColor: color, borderRadius: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: stroke, height: size * .25, top: size * .15, backgroundColor: color, borderRadius: stroke }} />
      <View style={{ position: 'absolute', width: size * .24, height: stroke, left: size * .39, top: size * .39, backgroundColor: color, transform: [{ rotate: '32deg' }], transformOrigin: 'left center' }} />
    </View>
  </View>;

  return <View style={[styles.canvas, common]}>
    <View style={{ position: 'absolute', top: size * .03, width: size * .56, height: size * .46, borderWidth: stroke, borderBottomWidth: 0, borderColor: color, borderTopLeftRadius: size, borderTopRightRadius: size }} />
    <View style={{ position: 'absolute', bottom: size * .08, width: size * .78, height: size * .56, borderRadius: size * .12, backgroundColor: color }} />
  </View>;
}

const styles = StyleSheet.create({
  canvas: { alignItems: 'center', justifyContent: 'center' },
  glyph: { textAlign: 'center', fontWeight: '800' },
});
