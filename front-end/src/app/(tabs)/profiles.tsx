import { getAvatarSource } from '@/constants/avatars';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useProfile } from '../../context/ProfileContext';
import { fromApiDate } from '../../lib/validation';
import { Profile } from '../../types/profile';

export default function FamilyProfilesTab() {
  const { colors } = useDisplayTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { profiles, pendingDeleteId, undoDelete, undoSecondsLeft } = useProfile();

  const renderItem = ({ item }: { item: Profile }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: '/profile-detail',
          params: { profileId: item.profile_id },
        });
      }}
    >
      <View style={styles.avatarCircle}>
        <Image
          source={getAvatarSource(item.profile_icon)}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          resizeMode="cover"
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{item.profile_fullname}</Text>
        <Text style={styles.relationship}>
          {item.profile_display_name} • Born {fromApiDate(item.profile_birthdate)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBanner}>
        <Text style={styles.bannerText}>Manage medicines by family member</Text>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.profile_id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity
        style={[styles.addButton, profiles.length >= 6 && styles.disabledButton]}
        disabled={profiles.length >= 6}
        onPress={() => router.push('/add-edit-profile')}
      >
        <Ionicons name="add" size={20} color={colors.onAction} style={{ marginRight: 6 }} />
        <Text style={styles.addButtonText}>
          {profiles.length >= 6 ? 'Profile Limit Reached (6 Max)' : 'Add Family Member'}
        </Text>
      </TouchableOpacity>

      {pendingDeleteId !== null && (
        <View style={styles.undoToast}>
          <Text style={styles.undoText}>
            Profile deleted. Undo in {undoSecondsLeft}s
          </Text>
          <TouchableOpacity onPress={undoDelete}>
            <Text style={styles.undoAction}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useDisplayTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surfacePrimary,
    },
    topBanner: {
      padding: 14,
      backgroundColor: colors.surfaceSecondary,
    },
    bannerText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    list: {
      padding: 16,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfacePrimary,
      borderWidth: 1,
      borderColor: colors.borderDefault,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceSecondary,
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
      color: colors.textPrimary,
    },
    relationship: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    addButton: {
      backgroundColor: colors.actionPrimary,
      flexDirection: 'row',
      height: 48,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      margin: 16,
    },
    disabledButton: {
      backgroundColor: colors.textSecondary,
      opacity: 0.55,
    },
    addButtonText: {
      color: colors.onAction,
      fontWeight: '700',
      fontSize: 15,
    },
    undoToast: {
      position: 'absolute',
      bottom: 85,
      left: 16,
      right: 16,
      backgroundColor: colors.actionPrimary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    undoText: {
      color: colors.onAction,
      fontSize: 13,
    },
    undoAction: {
      color: colors.statusSuccess,
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
