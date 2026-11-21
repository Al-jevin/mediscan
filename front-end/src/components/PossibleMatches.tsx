import { StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { PossibleMatch } from '@/data/mockScanResults';
import PossibleMatchCard from './PossibleMatchCard';

type Props = {
  matches: PossibleMatch[];
  selectedId?: string | null;
  onSelect?: (match: PossibleMatch) => void;
};

export default function PossibleMatches({ matches, selectedId, onSelect }: Props) {
  const { colors, isDark } = useDisplayTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Possible Matches</Text>

      {matches.map((m) => (
        <PossibleMatchCard
          key={m.id}
          match={m}
          selected={m.id === selectedId}
          showCheck
          onPress={() => onSelect?.(m)}
        />
      ))}

      <View
        style={[
          styles.note,
          {
            backgroundColor: isDark ? 'rgba(251, 191, 36, 0.12)' : '#FFE8CB',
            borderColor: isDark ? 'rgba(251, 191, 36, 0.4)' : '#E89C38',
          },
        ]}
      >
        <Text style={[styles.noteText, { color: isDark ? '#FDE68A' : '#000000' }]}>
          These are possible matches only. Please scan the label, box, or blister pack for confirmation
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm + 2 },
  heading: { ...Type.h2, paddingVertical: Spacing.sm },
  note: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: 30,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  noteText: { ...Type.body, fontWeight: '500', textAlign: 'center' },
});