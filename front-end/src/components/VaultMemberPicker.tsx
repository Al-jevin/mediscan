import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { Profile } from '@/types/profile';
import ProfileAvatar from '@/components/ProfileAvatar';

type Props = {
  profiles: Profile[];
  selectedProfileId: string | null;
  onSelect: (profileId: string) => void;
  label?: string;
};

/** Pick which family member receives a newly saved vault medicine. */
export default function VaultMemberPicker({
  profiles,
  selectedProfileId,
  onSelect,
  label = 'Save to member',
}: Props) {
  const { colors } = useDisplayTheme();
  if (profiles.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.row}>
        {profiles.map((profile) => {
          const selected = profile.profile_id === selectedProfileId;
          return (
            <Pressable
              key={profile.profile_id}
              onPress={() => onSelect(profile.profile_id)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.actionPrimary : colors.borderDefault,
                  backgroundColor: selected ? colors.statusSuccessSoft : colors.surfacePrimary,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Save to ${profile.profile_display_name}`}
            >
              <ProfileAvatar icon={profile.profile_icon} size={28} />
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.actionPrimary : colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {profile.profile_display_name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.sm },
  label: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
});
