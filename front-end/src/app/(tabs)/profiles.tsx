import { getAvatarSource } from '@/constants/avatars';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useProfile } from '../../context/ProfileContext';
import { fromApiDate } from '../../lib/validation';
import { Profile } from '../../types/profile';

export default function FamilyProfilesTab() {
  const router = useRouter();
  const { colors, type } = useDisplayTheme();
  const { profiles, pendingDeleteId, undoDelete, undoSecondsLeft } = useProfile();

  const renderItem = ({ item }: { item: Profile }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: '/profile-detail',
          params: { profileId: item.profile_id },
        });
      }}
    >
      <View style={[styles.avatarCircle, { backgroundColor: colors.primarySoft }]}>
        <Image
          source={getAvatarSource(item.profile_icon)}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          resizeMode="cover"
        />
      </View>

      <View style={styles.info}>
        <Text style={[type.label, styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.profile_fullname}
        </Text>
        <Text style={[type.caption, styles.relationship, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.profile_display_name} • Born {fromApiDate(item.profile_birthdate)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const limitReached = profiles.length >= 6;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfacePrimary }]}>
      <View style={[styles.topBanner, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={[type.caption, styles.bannerText, { color: colors.textPrimary }]}>
          Manage medicines by family member
        </Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.profile_id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surfacePrimary,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor: limitReached ? colors.surfaceSecondary : colors.actionPrimary,
              borderColor: limitReached ? colors.border : 'transparent',
              borderWidth: limitReached ? 1 : 0,
            },
          ]}
          activeOpacity={0.86}
          disabled={limitReached}
          onPress={() => router.push('/add-edit-profile')}
          accessibilityRole="button"
        >
          {!limitReached ? (
            <Ionicons name="add" size={20} color={colors.onAction} />
          ) : null}
          <Text
            style={[
              type.label,
              styles.addButtonText,
              { color: limitReached ? colors.textMuted : colors.onAction },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {limitReached ? 'Profile Limit Reached (6 Max)' : 'Add Family Member'}
          </Text>
        </TouchableOpacity>
      </View>

      {pendingDeleteId !== null && (
        <View
          style={[
            styles.undoToast,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[type.caption, styles.undoText, { color: colors.textPrimary }]}>
            Profile deleted. Undo in {undoSecondsLeft}s
          </Text>
          <TouchableOpacity onPress={undoDelete} hitSlop={8}>
            <Text style={[type.label, styles.undoAction, { color: colors.statusSuccess }]}>
              UNDO
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerText: {
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
  },
  relationship: {
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    minHeight: 48,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    fontWeight: '700',
  },
  undoToast: {
    position: 'absolute',
    bottom: 84,
    left: 16,
    right: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  undoText: {
    flex: 1,
  },
  undoAction: {
    fontWeight: '700',
  },
});