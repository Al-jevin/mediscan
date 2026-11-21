import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Radius } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { MedicineForm } from '@/types/medicine';

type Props = { form: MedicineForm; size?: number };

export default function MedicineIcon({ form, size = 56 }: Props) {
  const { colors } = useDisplayTheme();
  const iconSize = Math.round(size * 0.45);
  const color = colors.actionPrimary;
  let icon;
  switch (form) {
    case 'Tablet':
      icon = <Ionicons name="remove-circle-outline" size={iconSize} color={color} />;
      break;
    case 'Capsule':
      icon = <MaterialCommunityIcons name="pill" size={iconSize} color={color} />;
      break;
    case 'Syrup':
      icon = <MaterialCommunityIcons name="bottle-tonic-outline" size={iconSize} color={color} />;
      break;
    case 'Drops':
      icon = <MaterialCommunityIcons name="eyedropper" size={iconSize} color={color} />;
      break;
    case 'Inhaler':
      icon = <MaterialCommunityIcons name="spray" size={iconSize} color={color} />;
      break;
    case 'Injection':
      icon = <MaterialCommunityIcons name="needle" size={iconSize} color={color} />;
      break;
    default:
      icon = <MaterialCommunityIcons name="medical-bag" size={iconSize} color={color} />;
  }
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size > 64 ? Radius.md : Radius.sm,
          backgroundColor: colors.surfaceSecondary,
        },
      ]}
      accessibilityLabel={`${form} icon`}
    >
      {icon}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
