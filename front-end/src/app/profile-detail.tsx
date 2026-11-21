import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Reminder } from '@/components/reminderTypes';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useSavedReminders } from '@/services/profileReminders';
import { useProfileVault } from '@/services/vaultStore';
import { overviewCounts } from '@/utils/medicine';
import ProfileAvatar from '../components/ProfileAvatar';
import { useProfile } from '../context/ProfileContext';

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
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { profiles, deleteProfileWithUndo } = useProfile();
  const { medicines = [], error: vaultError, ready: vaultReady } = useProfileVault(profileId);
  const {
    reminders: allReminders,
    error: reminderError,
    ready: remindersReady,
  } = useSavedReminders();

  const [menuVisible, setMenuVisible] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderItem | null>(null);
  const profile = profiles.find((p) => p.profile_id.toString() === profileId);

  if (!profile) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.topBar,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.notFoundCenter}>
          <Text style={{ color: colors.textMuted }}>Profile not found.</Text>
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

  const targetTag = memberName === 'Self' ? 'Me' : memberName;

  const memberReminders: ReminderItem[] = allReminders
    .filter((reminder: Reminder) =>
      (reminder.members ?? []).some((m) => m.toLowerCase() === targetTag.toLowerCase()),
    )
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
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >

      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>
          {profile.profile_fullname}
        </Text>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.menuButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={[
              styles.dropdownMenu,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity style={styles.dropdownItem} onPress={handleDeletePress}>
              <Ionicons
                name="trash-outline"
                size={18}
                color={colors.danger}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.dropdownTextDelete, { color: colors.danger }]}>
                Delete Profile
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.userCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ProfileAvatar icon={profile.profile_icon || 1} size={52} />
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {profile.profile_fullname}
            </Text>
            <Text style={[styles.userRel, { color: colors.textMuted }]}>
              {memberName}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.editBtnOutline,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
            onPress={handleEdit}
          >
            <Text style={[styles.editBtnOutlineText, { color: colors.text }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderNoViewAll}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Medicine Overview
          </Text>
        </View>
        {vaultError ? (
          <Text style={[styles.dataError, { color: colors.danger }]}>{vaultError}</Text>
        ) : null}
        {!vaultReady && !vaultError ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}

        <View
          style={[
            styles.overviewCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('all')}
          >
            <View style={[styles.statIconBadge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="medical" size={18} color={colors.statusSuccess} />
            </View>
            <Text style={[styles.statNum, { color: colors.text }]}>{totalCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
          </TouchableOpacity>

          <View style={[styles.colDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('verified')}
          >
            <View style={[styles.statIconBadge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.statusSuccess} />
            </View>
            <Text style={[styles.statNum, { color: colors.statusSuccess }]}>
              {verifiedCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Verified</Text>
          </TouchableOpacity>

          <View style={[styles.colDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('needs_verification')}
          >
            <View
              style={[
                styles.statIconBadge,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Ionicons name="warning" size={18} color={colors.statusWarning} />
            </View>
            <Text style={[styles.statNum, { color: colors.statusWarning }]}>
              {needsVerifCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Needs Verif.
            </Text>
          </TouchableOpacity>

          <View style={[styles.colDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.overviewCol}
            activeOpacity={0.7}
            onPress={() => handleStatPress('expiring')}
          >
            <View
              style={[
                styles.statIconBadge,
                { backgroundColor: colors.statusDangerSoft },
              ]}
            >
              <Ionicons name="calendar" size={18} color={colors.statusDanger} />
            </View>
            <Text style={[styles.statNum, { color: colors.statusDanger }]}>
              {expiringCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Expiring</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Upcoming Reminders
          </Text>
          <TouchableOpacity onPress={handleViewAllReminders}>
            <Text style={[styles.viewAllText, { color: colors.statusSuccess }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {reminderError ? (
          <View
            style={[
              styles.emptyReminderCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyReminderText, { color: colors.textMuted }]}>
              Could not load reminders: {reminderError}
            </Text>
          </View>
        ) : !remindersReady ? (
          <ActivityIndicator color={colors.primary} />
        ) : memberReminders.length === 0 ? (
          <View
            style={[
              styles.emptyReminderCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyReminderText, { color: colors.textMuted }]}>
              No upcoming reminders for {memberName}.
            </Text>
          </View>
        ) : (
          memberReminders.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.reminderCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              activeOpacity={0.7}
              onPress={() => setSelectedReminder(item)}
            >
              <View style={[styles.medThumb, { backgroundColor: colors.primarySoft }]}>
                <Ionicons
                  name={item.type === 'Capsule' ? 'ellipse-outline' : 'medkit-outline'}
                  size={22}
                  color={colors.statusSuccess}
                />
              </View>
              <View style={styles.reminderInfo}>
                <Text style={[styles.medName, { color: colors.text }]}>
                  {item.medicineName}
                </Text>
                <Text style={[styles.medSub, { color: colors.textSecondary }]}>
                  {item.type} • {item.dosage}
                </Text>
                <Text style={[styles.medExpiry, { color: colors.textMuted }]}>
                  Expiration: {item.expiry}
                </Text>
              </View>
              <View style={[styles.timeTag, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.timeText, { color: colors.statusSuccess }]}>
                  {item.time}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                  style={{ marginLeft: 4 }}
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={selectedReminder !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.detailSheet,
              { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.detailHeader}>
              <Text style={[styles.detailTitle, { color: colors.text }]}>
                Reminder Details
              </Text>
              <TouchableOpacity onPress={() => setSelectedReminder(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedReminder && (
              <View style={styles.detailBody}>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Medicine
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedReminder.medicineName}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Type & Dosage
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedReminder.type} ({selectedReminder.dosage})
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Intake Time
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedReminder.time}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Frequency
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedReminder.frequency}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Expiration
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedReminder.expiry}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                    Notes
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedReminder.notes || 'No notes added.'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.closeDetailBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setSelectedReminder(null)}
                >
                  <Text style={[styles.closeDetailBtnText, { color: colors.onAction }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <View style={[styles.trashCircle, { backgroundColor: colors.statusDangerSoft }]}>
              <Ionicons name="trash-outline" size={28} color={colors.danger} />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Remove this profile?
            </Text>
            <Text style={[styles.dialogMsg, { color: colors.textMuted }]}>
              Are you sure you want to delete {profile.profile_fullname}&apos;s profile? Their medicines, alerts and reminders will also be deleted.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.danger }]}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 6 },
  topBarTitle: { fontSize: 18, fontWeight: '700' },
  menuButton: { padding: 6 },
  content: { padding: 16 },
  notFoundCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '700' },
  userRel: { fontSize: 13, marginTop: 2 },
  editBtnOutline: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  editBtnOutlineText: { fontSize: 13, fontWeight: '600' },
  sectionHeaderNoViewAll: { marginBottom: 10, marginTop: 4 },
  dataError: { fontSize: 13, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 18,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  viewAllText: { fontSize: 13, fontWeight: '600' },
  overviewCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
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
  statNum: { fontSize: 17, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  colDivider: { width: 1, height: 36 },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderInfo: { flex: 1, marginLeft: 12 },
  medName: { fontSize: 14, fontWeight: '700' },
  medSub: { fontSize: 12, marginTop: 1 },
  medExpiry: { fontSize: 11, marginTop: 2 },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  timeText: { fontSize: 12, fontWeight: '600' },
  emptyReminderCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyReminderText: { fontSize: 14, fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center' },
  dropdownMenu: {
    position: 'absolute',
    top: 55,
    right: 16,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    minWidth: 160,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
  dropdownTextDelete: { fontSize: 14, fontWeight: '600' },
  detailSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    marginTop: 'auto',
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 18, fontWeight: '700' },
  detailBody: { marginTop: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  detailLabel: { fontSize: 13, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  closeDetailBtn: {
    marginTop: 20,
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeDetailBtnText: { fontWeight: '700', fontSize: 15 },
  dialog: { width: '85%', borderRadius: 16, padding: 24, alignSelf: 'center' },
  trashCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  dialogMsg: { fontSize: 13, textAlign: 'center', marginVertical: 12, lineHeight: 18 },
  dialogActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '700' },
});