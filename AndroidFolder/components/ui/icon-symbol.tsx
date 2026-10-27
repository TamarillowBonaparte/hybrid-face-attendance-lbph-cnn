// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Existing mappings
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',

  // Custom mappings for Profile & App consistency on Android
  'person.fill': 'person',
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle.fill': 'cancel',
  'exclamationmark.circle.fill': 'error',
  'graduationcap.fill': 'school',
  'arrow.right.square': 'logout',
  'lock.fill': 'lock',
  'bell.fill': 'notifications',
  'gearshape.fill': 'settings',
  'info.circle.fill': 'info',
  'checkmark': 'check',
  'xmark': 'close',
  'person.fill.checkmark': 'how-to-reg',
  'book.fill': 'book',
  'cross.case.fill': 'medical-services',
  'doc.text.fill': 'description',
  'mappin.and.ellipse': 'location-on',
  'chart.bar.fill': 'bar-chart',
  'qrcode': 'qr-code',
  'faceid': 'face',
  'doc.text': 'description',
  'clock.arrow.circlepath': 'history',
  'envelope': 'mail',
  'lock': 'lock-outline',
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'key.fill': 'vpn-key',
  'lock.rotation': 'lock-reset',
  'checkmark.shield': 'verified-user',
  'info.circle': 'info-outline',
  'calendar': 'calendar-today',
  'person.badge.plus': 'person-add',
  'person.crop.circle.badge.plus': 'person-add',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
