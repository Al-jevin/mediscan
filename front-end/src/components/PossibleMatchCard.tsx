import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Assets } from '@/constants/assets';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { PossibleMatch } from '@/data/mockScanResults';
import { getMedicineForm } from '@/utils/medicine';
import MedicineIcon from './medicine/MedicineIcon';

type Props = {
  match: PossibleMatch;
  selected?: boolean;
  showCheck?: boolean;
  onPress?: () => void;
};

export default function PossibleMatchCard({ match, selected, showCheck, onPress }: Props) {
  const { colors, isDark } = useDisplayTheme();

  const content = (
    <>
      <MedicineIcon form={getMedicineForm(match.form)} size={96} />
      <View style={styles.text}>
        <View>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {match.name}
          </Text>
          <Text style={[styles.category, { color: colors.textSecondary }]} numberOfLines={1}>
            {match.category}
          </Text>
        </View>
        <Text style={[styles.similarity, { color: isDark ? '#FCD34D' : '#E89C38' }]}>
          Similarity: {match.similarity}%
        </Text>
      </View>
      {selected && showCheck ? (
        <Image source={Assets.icons.checkSelected} style={styles.check} contentFit="contain" />
      ) : null}
    </>
  );

  const style = [
    styles.card,
    {
      backgroundColor: isDark ? colors.surfaceSecondary : colors.surfacePrimary,
      borderColor: colors.borderDefault,
    },
    selected && [
      styles.cardSelected,
      {
        backgroundColor: isDark ? 'rgba(64, 159, 138, 0.18)' : '#E8F4EF',
        borderColor: colors.actionPrimary,
      },
    ],
  ];

  if (!onPress) return <View style={style}>{content}</View>;

  return (
    <Pressable
      style={style}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${match.name}, similarity ${match.similarity}%`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  cardSelected: {
    padding: Spacing.sm + 1,
    borderWidth: 2,
  },
  text: { flex: 1, gap: Spacing.sm + 2 },
  name: { ...Type.label },
  category: { ...Type.caption },
  similarity: { ...Type.label, fontSize: 14, textAlign: 'right' },
  check: { position: 'absolute', top: 2, left: 2, width: 24, height: 24 },
});