import React, { useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { overviewCounts } from '@/utils/medicine'; 
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../context/ProfileContext';
import { useProfileVault } from '@/services/vaultStore';
import { useSavedReminders } from '@/services/profileReminders';
import type { Reminder } from '@/components/reminderTypes';
import ProfileAvatar from '../components/ProfileAvatar';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useAppTheme } from '@/context/ThemeContext';

interface ReminderItem {
  id: string;
  medicineName: string;
  type: string;
  dosage: string;
  time: string;
  frequency: string;
  expiry: string;
  notes?: string;
}

export default function ProfileDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const { colorScheme } = useAppTheme();
  const styles = makeStyles(colors);
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { profiles, deleteProfileWithUndo } = useProfile();
  const { medicines = [], error: vaultError, ready: vaultReady } = useProfileVault(profileId);
  const {
    reminders: allReminders,
    error: reminderError,
    ready: remindersReady,
  } = useSavedReminders();

  // All Hooks declared at top before any early returns
  const [menuVisible, setMenuVisible] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
  // Find the selected profile
  const profile = profiles.find((p) => p.profile_id.toString() === profileId);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.notFoundCenter}>
          <Text style={{ color: colors.textSecondary }}>Profile not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

    const counts = overviewCounts(medicines);

  const totalCount = counts.total;
  const verifiedCount = counts.verified;
  const needsVerifCount = counts.needsVerification;
  const expiringCount = counts.expiring;
  
  const memberName =
    (profile as any)?.profile_display_name ||
    (profile as any)?.profile_relationship ||
    profile?.profile_fullname ||
    '';

  // Filter dynamic reminders for this member
  const targetTag = memberName === 'Self' ? 'Me' : memberName;

  const memberReminders: ReminderItem[] = allReminders
    .filter((reminder: Reminder) => reminder.member.toLowerCase() === targetTag.toLowerCase())
    .map((reminder) => ({
      id: reminder.id,
      medicineName: reminder.medicine,
      type: reminder.category,
      dosage: reminder.instructions,
      time: reminder.time,
      frequency: reminder.frequency,
      expiry: 'Not tracked',
      notes: reminder.notes,
    }));

  const handleDeletePress = () => {
    setMenuVisible(false);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    setShowConfirmModal(false);
    deleteProfileWithUndo(profile.profile_id);
    router.back();
  };

  const handleEdit = () => {
    router.push({
      pathname: '/add-edit-profile' as any,
      params: { mode: 'edit', profileId: profile.profile_id },
    });
  };

  const handleStatPress = (filterType: string) => {
    router.push({
      pathname: '/(tabs)/vault' as any,
      params: { filter: filterType },
    });
  };

  const handleViewAllReminders = () => {
    router.push({
      pathname: '/(tabs)/reminders' as any,
      params: { member: memberName },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{profile.profile_fullname}</Text>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.menuButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 3-Dots Dropdown with ONLY Delete Profile */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleDeletePress}>
              <Ionicons name="trash-outline" size={18} color={colors.statusDanger} style={{ marginRight: 10 }} />
              <Text style={styles.dropdownTextDelete}>Delete Profile</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.userCard}>
          <ProfileAvatar icon={profile.profile_icon || 1} size={52} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile.profile_fullname}</Text>
            <Text style={styles.userRel}>{memberName}</Text>
          </View>
          <TouchableOpacity style={styles.editBtnOutline} onPress={handleEdit}>
            <Text style={styles.editBtnOutlineText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Medicine Overview (Unified Card matching Home UI) */}
        <View style={styles.sectionHeaderNoViewAll}>
          <Text style={styles.sectionTitle}>Medicine Overview</Text>
        </View>
        {vaultError ? <Text style={styles.dataError}>{vaultError}</Text> : null}
        {!vaultReady && !vaultError ? <ActivityIndicator color={colors.actionPrimary} /> : null}

        <View style={styles.overviewCard}>
          {/* Total */}
          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('all')}
          >
            <View style={[styles.statIconBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="medical" size={18} color={colors.actionPrimary} />
            </View>
            <Text style={styles.statNum}>{totalCount}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </TouchableOpacity>

          <View style={styles.colDivider} />

          {/* Verified */}
          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('verified')}
          >
            <View style={[styles.statIconBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.actionPrimary} />
            </View>
            <Text style={[styles.statNum, { color: colors.statusSuccess }]}>{verifiedCount}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </TouchableOpacity>

          <View style={styles.colDivider} />

          {/* Needs Verification */}
          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('needs_verification')}
          >
            <View style={[styles.statIconBadge, { backgroundColor: colors.statusWarningSoft }]}>
              <Ionicons name="warning" size={18} color={colors.statusWarning} />
            </View>
            <Text style={[styles.statNum, { color: colors.statusWarning }]}>{needsVerifCount}</Text>
            <Text style={styles.statLabel}>Needs Verif.</Text>
          </TouchableOpacity>

          <View style={styles.colDivider} />

          {/* Expiring */}
          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('expiring')}
          >
            <View style={[styles.statIconBadge, { backgroundColor: colors.statusDangerSoft }]}>
              <Ionicons name="calendar" size={18} color={colors.statusDanger} />
            </View>
            <Text style={[styles.statNum, { color: colors.statusDanger }]}>{expiringCount}</Text>
            <Text style={styles.statLabel}>Expiring</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Reminders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Reminders</Text>
          <TouchableOpacity onPress={handleViewAllReminders}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {reminderError ? (
          <View style={styles.emptyReminderCard}>
            <Text style={styles.emptyReminderText}>Could not load reminders: {reminderError}</Text>
          </View>
        ) : !remindersReady ? (
          <ActivityIndicator color={colors.actionPrimary} />
        ) : memberReminders.length === 0 ? (
          <View style={styles.emptyReminderCard}>
            <Text style={styles.emptyReminderText}>
              No upcoming reminders for {memberName}.
            </Text>
          </View>
        ) : (
          memberReminders.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.reminderCard}
              activeOpacity={0.7}
              onPress={() => setSelectedReminder(item)}
            >
              <View style={styles.medThumb}>
                <Ionicons
                  name={item.type === 'Capsule' ? 'ellipse-outline' : 'medkit-outline'}
                  size={22}
                  color={colors.actionPrimary}
                />
              </View>
              <View style={styles.reminderInfo}>
                <Text style={styles.medName}>{item.medicineName}</Text>
                <Text style={styles.medSub}>
                  {item.type} • {item.dosage}
                </Text>
                <Text style={styles.medExpiry}>Expiration: {item.expiry}</Text>
              </View>
              <View style={styles.timeTag}>
                <Text style={styles.timeText}>{item.time}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Inline Reminder Details Modal */}
      <Modal visible={selectedReminder !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Reminder Details</Text>
              <TouchableOpacity onPress={() => setSelectedReminder(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedReminder && (
              <View style={styles.detailBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Medicine</Text>
                  <Text style={styles.detailValue}>{selectedReminder.medicineName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type & Dosage</Text>
                  <Text style={styles.detailValue}>
                    {selectedReminder.type} ({selectedReminder.dosage})
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Intake Time</Text>
                  <Text style={styles.detailValue}>{selectedReminder.time}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Frequency</Text>
                  <Text style={styles.detailValue}>{selectedReminder.frequency}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Expiration</Text>
                  <Text style={styles.detailValue}>{selectedReminder.expiry}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>
                    {selectedReminder.notes || 'No notes added.'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.closeDetailBtn}
                  onPress={() => setSelectedReminder(null)}
                >
                  <Text style={styles.closeDetailBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal Before Delete */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.dialog}>
            <View style={styles.trashCircle}>
              <Ionicons name="trash-outline" size={28} color={colors.statusDanger} />
            </View>
            <Text style={styles.dialogTitle}>Remove this profile?</Text>
            <Text style={styles.dialogMsg}>
              Are you sure you want to delete {profile.profile_fullname}&apos;s profile? Their medicines, alerts and reminders will also be deleted.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.confirmBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfacePrimary },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: { padding: 6 },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  menuButton: { padding: 6 },
  content: { padding: 16 },
  notFoundCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 14,
    marginBottom: 20,
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  userRel: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  editBtnOutline: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.surfacePrimary,
  },
  editBtnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },

  /* Unified Medicine Overview Card */
  sectionHeaderNoViewAll: { marginBottom: 10, marginTop: 4 },
  dataError: { color: colors.statusDanger, fontSize: 13, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 18,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  viewAllText: { fontSize: 13, color: colors.actionPrimary, fontWeight: '600' },
  overviewCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  overviewCol: { flex: 1, alignItems: 'center' },
  statIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNum: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  colDivider: { width: 1, height: 36, backgroundColor: colors.borderDefault },

  /* Formatted Upcoming Reminders Card */
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfacePrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  medThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderInfo: { flex: 1, marginLeft: 12 },
  medName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  medSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  medExpiry: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  timeText: { fontSize: 12, fontWeight: '600', color: colors.actionPrimary },
  emptyReminderCard: {
    backgroundColor: colors.surfacePrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyReminderText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },

  /* Modals */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center' },
  dropdownMenu: {
    position: 'absolute',
    top: 55,
    right: 16,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
    paddingVertical: 6,
    minWidth: 160,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
  dropdownTextDelete: { fontSize: 14, fontWeight: '600', color: colors.statusDanger },
  detailSheet: {
    backgroundColor: colors.surfacePrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    marginTop: 'auto',
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  detailBody: { marginTop: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  detailLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  closeDetailBtn: {
    marginTop: 20,
    height: 46,
    backgroundColor: colors.actionPrimary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeDetailBtnText: { color: colors.onAction, fontWeight: '700', fontSize: 15 },
  dialog: { width: '85%', backgroundColor: colors.surfacePrimary, borderRadius: 16, padding: 24, alignSelf: 'center' },
  trashCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.statusDangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  dialogMsg: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginVertical: 12, lineHeight: 18 },
  dialogActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.statusDanger,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: { color: colors.onAction, fontWeight: '700' },
});
}