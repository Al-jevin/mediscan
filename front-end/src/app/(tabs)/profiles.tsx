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
  const { colors } = useDisplayTheme();
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
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {item.profile_fullname}
        </Text>
        <Text style={[styles.relationship, { color: colors.textSecondary }]}>
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
        <Text style={[styles.bannerText, { color: colors.textPrimary }]}>
          Manage medicines by family member
        </Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.profile_id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity
        style={[
          styles.addButton,
          { backgroundColor: limitReached ? colors.border : colors.actionPrimary },
        ]}
        disabled={limitReached}
        onPress={() => router.push('/add-edit-profile')}
      >
        <Ionicons name="add" size={20} color={colors.onAction} style={{ marginRight: 6 }} />
        <Text style={[styles.addButtonText, { color: colors.onAction }]}>
          {limitReached ? 'Profile Limit Reached (6 Max)' : 'Add Family Member'}
        </Text>
      </TouchableOpacity>

      {pendingDeleteId !== null && (
        <View style={[styles.undoToast, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.undoText, { color: colors.textPrimary }]}>
            Profile deleted. Undo in {undoSecondsLeft}s
          </Text>
          <TouchableOpacity onPress={undoDelete}>
            <Text style={[styles.undoAction, { color: colors.statusSuccess }]}>UNDO</Text>
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
    padding: 14,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: 16,
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
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  relationship: {
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
  },
  addButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  undoToast: {
    position: 'absolute',
    bottom: 85,
    left: 16,
    right: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  undoText: {
    fontSize: 13,
  },
  undoAction: {
    fontWeight: '700',
    fontSize: 14,
  },
});