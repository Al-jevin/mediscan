import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Camera } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useProfile } from '@/context/ProfileContext';
import {
  useAppTheme,
  type AppearanceMode,
  type AppLanguage,
} from '@/context/ThemeContext';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

type Screen =
  | 'Settings'
  | 'Display'
  | 'Language'
  | 'Notifications'
  | 'Offline Database'
  | 'Privacy'
  | 'FAQs'
  | 'About MediScan'
  | 'Privacy Policy'
  | 'Terms of Service'
  | 'Open Source Licenses';

const SELECTED_LIGHT = '#8DB29B';
const SELECTED_DARK = '#2E5C4E';

const FAQS = [
  {
    question: 'How do I scan a medicine?',
    answer: 'Tap the button at the bottom of the screen, choose "Scan with Camera", then place the medicine label inside the frame and tap the shutter. MediScan will read the name and expiration date for you.',
  },
  {
    question: "What if the app can't read the label?",
    answer: "If the app can't read the label, it will display a message indicating that the photo is blurry or unreadable. Mediscan will then give you the option to rescan, choose a different photo, or enter the medicine details manually.",
  },
  {
    question: 'How do I add a medicine manually?',
    answer: 'To add a medicine manually, press the plus (+) button in the middle of the footer. Two options will appear: scan and enter manually. Select Enter Manually to input the medicine details yourself.',
  },
  {
    question: 'How do reminders work?',
    answer: 'Reminders allow you to select a medicine from the vault, set its start date, reminder time, frequency, and assigned family member. Mediscan can then notify you through notifications, vibration, or sound to help you keep track of your medicines.',
  },
  {
    question: 'How do I add a family member?',
    answer: 'To add a family member, go to the Profile button in the footer and select Add a Profile. You can then create a profile for the family member you want to manage.',
  },
  {
    question: 'How does syncing work?',
    answer: 'Syncing works by comparing the data stored on your device with the data on the server to determine which version is the most up-to-date. If your device has the latest data, it will update the server. If the server has the latest data, your device will sync with the server to retrieve the updated information.',
  },
  {
    question: 'Is my data private?',
    answer: 'Yes, Mediscan is designed to protect your personal information by limiting access to authorized users and securely handling your data. Your information is stored and managed to help maintain its confidentiality and prevent unauthorized access.',
  },
];

export default function SettingsContent({ onBack }: { onBack?: () => void }) {
  const { activeProfile, email } = useProfile();
  const {
    appearance,
    setAppearance,
    language,
    setLanguage,
    textSize,
    setTextSize,
    t,
  } = useAppTheme();
  const { colors, isDark } = useDisplayTheme();

  const themeGreen = colors.actionPrimary;
  const themeMuted = colors.textSecondary;
  const themeBg = colors.surfacePrimary;
  const themeText = colors.textPrimary;
  const themeBorder = colors.borderDefault;
  const themeCard = isDark ? colors.surfaceSecondary : '#FFFFFF';
  const themePressed = isDark ? '#1B3D2E' : '#EDF4F1';
  const themeSelected = isDark ? SELECTED_DARK : SELECTED_LIGHT;
  const switchThumbOff = isDark ? '#CBD5E1' : '#F7F9F9';
  const switchTrackOff = isDark ? '#334155' : '#D8DEDD';
  const switchTrackOn = isDark ? '#2E5C4E' : '#8FB5A0';

  const [screen, setScreen] = useState<Screen>('Settings');
  const [pushNotifications, setPushNotifications] = useState(false);
  const [medicineReminders, setMedicineReminders] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [syncModal, setSyncModal] = useState<'closed' | 'syncing' | 'complete'>('closed');
  const [clearCacheModal, setClearCacheModal] = useState(false);
  const [lastSynced, setLastSynced] = useState('Today, 9:32 AM');

  useEffect(() => {
    let mounted = true;
    Camera.getCameraPermissionsAsync()
      .then((result) => {
        if (mounted) setCameraEnabled(result.granted);
      })
      .catch(() => {
        if (mounted) setCameraEnabled(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const goBack = () => {
    if (screen === 'Settings') {
      onBack?.();
    } else if (
      screen === 'Terms of Service' ||
      screen === 'Privacy Policy' ||
      screen === 'Open Source Licenses'
    ) {
      setScreen('About MediScan');
    } else {
      setScreen('Settings');
    }
  };
  const openScreen = (next: Screen) => setScreen(next);

  const toggleCamera = async (value: boolean) => {
    if (!value) {
      setCameraEnabled(false);
      Alert.alert(
        'Camera permission',
        'The app switch is off. To revoke device permission itself, open your phone Settings and change MediScan camera access.',
      );
      return;
    }
    try {
      const result = await Camera.requestCameraPermissionsAsync();
      setCameraEnabled(result.granted);
      if (!result.granted) {
        Alert.alert(
          'Permission needed',
          'Allow camera access in your device settings to use camera features.',
        );
      }
    } catch {
      setCameraEnabled(false);
      Alert.alert('Camera permission', 'Camera permission could not be requested on this device.');
    }
  };

  const startSync = () => {
    setSyncModal('syncing');
    setTimeout(() => {
      setLastSynced('Today, 9:41 AM');
      setSyncModal('complete');
    }, 2200);
  };

  const Header = ({ title }: { title: string }) => (
    <SafeAreaView edges={['top']} style={[styles.headerSafe, { backgroundColor: themeBg }]}>
      <View style={[styles.header, { backgroundColor: themeBg, borderBottomColor: themeBorder }]}>
        <Pressable
          onPress={goBack}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={screen === 'Settings' ? 'Open menu' : 'Go back'}
        >
          <Ionicons name="arrow-back" size={25} color={themeGreen} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: themeText }]}>{title}</Text>

        <View style={{ width: 36 }} />
      </View>
    </SafeAreaView>
  );

  const ProfileCard = () => (
    <View style={[styles.profileCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
      <ProfileAvatar icon={activeProfile?.profile_icon ?? 1} size={50} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.profileName, { color: themeText }]} numberOfLines={1}>
          {activeProfile?.profile_fullname ?? ''}
        </Text>
        <Text style={[styles.email, { color: themeMuted }]} numberOfLines={1}>
          {email ?? ''}
        </Text>
      </View>
    </View>
  );

  const SettingRow = ({
    icon,
    title,
    value,
    onPress,
    isLast = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    value?: string;
    onPress: () => void;
    isLast?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: themeBorder },
        isLast && { borderBottomWidth: 0 },
        pressed && { backgroundColor: themePressed },
      ]}
      accessibilityRole="button"
    >
      {title === 'Appearance' || title === 'Hitsura' ? (
        <View style={styles.appearanceRowIcon}>
          <Ionicons name="moon-outline" size={23} color={themeMuted} style={styles.appearanceMoonGlyph} />
          <View style={styles.appearanceSunGraphic}>
            <View style={[styles.appearanceSunCircle, { borderColor: themeMuted }]} />
            <View style={[styles.sunRayTop, { backgroundColor: themeMuted }]} />
            <View style={[styles.sunRayUpperRight, { backgroundColor: themeMuted }]} />
            <View style={[styles.sunRayRight, { backgroundColor: themeMuted }]} />
          </View>
        </View>
      ) : (
        <Ionicons name={icon} size={21} color={themeMuted} />
      )}
      <Text style={[styles.rowTitle, { fontSize: Math.max(textSize, 17), color: themeText }]}>{title}</Text>
      {value ? <Text style={[styles.rowValue, { color: themeMuted }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={21} color={themeMuted} />
    </Pressable>
  );

  const SectionTitle = ({ children }: { children: string }) => (
    <Text style={[styles.sectionTitle, { color: themeText }]}>{children}</Text>
  );

  const ToggleRow = ({
    title,
    value,
    onValueChange,
    isLast = false,
  }: {
    title: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    isLast?: boolean;
  }) => (
    <View
      style={[
        styles.toggleRow,
        { borderBottomColor: themeBorder },
        isLast && { borderBottomWidth: 0 },
      ]}
    >
      <Text style={[styles.toggleTitle, { color: themeText }]}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: switchTrackOff, true: switchTrackOn }}
        thumbColor={value ? themeGreen : switchThumbOff}
      />
    </View>
  );

  const SettingsScreen = () => (
    <>
      <Header title={t('Settings', 'Mga Setting')} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileCard />
        <SectionTitle>{t('Preferences', 'Mga Kagustuhan')}</SectionTitle>
        <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <SettingRow icon="sunny-outline" title={t('Appearance', 'Hitsura')} onPress={() => openScreen('Display')} />
          <SettingRow icon="globe-outline" title={t('Language', 'Wika')} value={language} onPress={() => openScreen('Language')} />
          <SettingRow icon="notifications-outline" title={t('Notifications', 'Mga Abiso')} onPress={() => openScreen('Notifications')} isLast />
        </View>
        <SectionTitle>{t('Data & Sync', 'Data at Sync')}</SectionTitle>
        <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <SettingRow icon="sync-outline" title="Offline Database" onPress={() => openScreen('Offline Database')} isLast />
        </View>
        <SectionTitle>Security &amp; Privacy</SectionTitle>
        <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <SettingRow icon="shield-outline" title="Privacy" onPress={() => openScreen('Privacy')} isLast />
        </View>
        <SectionTitle>Support</SectionTitle>
        <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <SettingRow icon="help-circle-outline" title="FAQs" onPress={() => openScreen('FAQs')} />
          <SettingRow icon="information-circle-outline" title="About MediScan" onPress={() => openScreen('About MediScan')} isLast />
        </View>
      </ScrollView>
    </>
  );

  const DisplayScreen = () => (
    <>
      <Header title={t('Display', 'Display')} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.displaySectionTitle, { color: themeText }]}>{t('Appearance', 'Hitsura')}</Text>
        <View style={styles.appearanceRow}>
          {[
            { title: 'Light', icon: 'sunny-outline' as const },
            { title: 'Dark', icon: 'moon-outline' as const },
            { title: 'System', icon: 'phone-portrait-outline' as const },
          ].map((option) => {
            const selected = appearance === option.title;
            return (
              <Pressable
                key={option.title}
                onPress={() => setAppearance(option.title as AppearanceMode)}
                style={[
                  styles.appearanceCard,
                  { backgroundColor: themeCard, borderColor: themeBorder },
                  selected && { backgroundColor: themeSelected, borderColor: themeSelected },
                ]}
              >
                <View style={styles.appearanceIcon}>
                  {option.title === 'System' ? (
                    <View style={styles.systemIcon}>
                      <View style={[styles.desktopMonitor, { borderColor: selected ? 'white' : themeGreen }]}>
                        <View style={[styles.monitorStand, { backgroundColor: selected ? 'white' : themeGreen }]} />
                        <View style={[styles.monitorFoot, { backgroundColor: selected ? 'white' : themeGreen }]} />
                      </View>
                      <View
                        style={[
                          styles.systemPhone,
                          {
                            borderColor: selected ? 'white' : themeGreen,
                            backgroundColor: selected ? themeSelected : themeCard,
                          },
                        ]}
                      >
                        <View style={[styles.phoneSpeaker, { backgroundColor: selected ? 'white' : themeGreen }]} />
                      </View>
                    </View>
                  ) : (
                    <Ionicons name={option.icon} size={18} color={selected ? 'white' : themeGreen} />
                  )}
                </View>
                <Text style={[styles.appearanceText, { color: themeText }, selected && styles.selectedText]}>
                  {option.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.displaySectionTitle, { color: themeText }]}>{t('Text Size', 'Laki ng Teksto')}</Text>
        <View style={[styles.sliderCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <Text style={[styles.smallA, { color: themeText }]}>A</Text>
          <View style={styles.sliderWrap}>
            <View pointerEvents="none" style={styles.sliderTicks}>
              {[0, 1, 2, 3, 4].map((tick) => {
                const active = textSize >= 12 + tick * 3;
                return (
                  <View
                    key={tick}
                    style={[
                      styles.sliderTick,
                      { backgroundColor: active ? themeGreen : themeBorder },
                      active && styles.sliderTickActive,
                    ]}
                  />
                );
              })}
            </View>
            <Slider
              style={styles.slider}
              minimumValue={12}
              maximumValue={24}
              step={3}
              value={Math.round((textSize - 12) / 3) * 3 + 12}
              onValueChange={setTextSize}
              minimumTrackTintColor={themeGreen}
              maximumTrackTintColor={themeBorder}
              thumbTintColor={isDark ? colors.textPrimary : '#FFFFFF'}
            />
          </View>
          <Text style={[styles.largeA, { color: themeText }]}>A</Text>
        </View>
        <SectionTitle>{t('Preview', 'Preview')}</SectionTitle>
        <View style={[styles.previewCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <Text style={[styles.previewTitle, { fontSize: textSize, color: themeText }]}>
            {t('Sample Reminder', 'Halimbawang Paalala')}
          </Text>
          <Text style={[styles.previewDescription, { fontSize: Math.max(11, textSize - 3), color: themeMuted }]}>
            {t(
              'This is how your medicine reminders and text will look throughout the app.',
              'Ganito magmumukha ang mga paalala at teksto sa buong app.',
            )}
          </Text>
        </View>
      </ScrollView>
    </>
  );

  const LanguageScreen = () => (
    <>
      <Header title={t('Language', 'Wika')} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SectionTitle>{t('Language', 'Wika')}</SectionTitle>
        {['English', 'Filipino'].map((item) => (
          <Pressable
            key={item}
            onPress={() => setLanguage(item as AppLanguage)}
            style={[styles.languageCard, { backgroundColor: themeCard, borderColor: themeBorder }]}
          >
            <Text style={[styles.languageText, { color: themeText }]}>{item}</Text>
            {language === item && <Ionicons name="checkmark" size={23} color={themeGreen} />}
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  const NotificationsScreen = () => (
    <>
      <Header title="Notifications" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SectionTitle>General</SectionTitle>
        <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <ToggleRow
            title="Push Notifications"
            value={pushNotifications}
            isLast
            onValueChange={(value) => {
              setPushNotifications(value);
              Alert.alert(
                'Push Notifications',
                value
                  ? 'This switch is currently an in-app preference only. Actual OS notification permission is not connected in this Expo Go version.'
                  : 'The app preference is off. This does not revoke notification permission in phone settings.',
              );
            }}
          />
        </View>
        <SectionTitle>Reminders</SectionTitle>
        <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <ToggleRow title="Medication Reminders" value={medicineReminders} onValueChange={setMedicineReminders} isLast />
        </View>
        <SectionTitle>Sound &amp; Vibration</SectionTitle>
        <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
          <ToggleRow title="Sound" value={sound} onValueChange={setSound} />
          <ToggleRow title="Vibration" value={vibration} onValueChange={setVibration} isLast />
        </View>
      </ScrollView>
    </>
  );

  const OtherScreen = () => {
    if (screen === 'Offline Database') {
      return (
        <>
          <Header title="Data & Sync" />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.syncContent}>
            <SectionTitle>Storage</SectionTitle>
            <View style={[styles.syncInfoCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
              <Text style={[styles.syncSmallLabel, { color: themeText }]}>Last Synced</Text>
              <Text style={[styles.syncTimestamp, { color: themeMuted }]}>{lastSynced}</Text>
            </View>
            <Pressable
              onPress={startSync}
              style={({ pressed }) => [
                styles.syncNowButton,
                { backgroundColor: themeGreen },
                pressed && styles.syncNowPressed,
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="sync-outline" size={15} color={colors.onAction} />
              <Text style={[styles.syncNowText, { color: colors.onAction }]}>Sync Now</Text>
            </Pressable>
            <SectionTitle>Options</SectionTitle>
            <Pressable
              onPress={() => setClearCacheModal(true)}
              style={({ pressed }) => [
                styles.clearCacheButton,
                { backgroundColor: themeCard, borderColor: themeBorder },
                pressed && { backgroundColor: themePressed },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.clearCacheText, { color: colors.statusDanger }]}>Clear Cache</Text>
              <Ionicons name="chevron-forward" size={19} color={themeMuted} />
            </Pressable>
          </ScrollView>

          <Modal
            visible={syncModal !== 'closed'}
            transparent
            animationType="fade"
            onRequestClose={() => setSyncModal('closed')}
          >
            <View style={styles.syncModalBackdrop}>
              <View style={[styles.syncModalCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                {syncModal === 'syncing' ? (
                  <>
                    <View style={[styles.syncModalIcon, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="sync-outline" size={23} color={themeGreen} />
                    </View>
                    <Text style={[styles.syncModalTitle, { color: themeText }]}>Syncing your data...</Text>
                    <Text style={[styles.syncModalDescription, { color: themeMuted }]}>
                      Uploading medicines, reminders and profiles to cloud. Please keep the app open.
                    </Text>
                    <View style={[styles.progressTrack, { backgroundColor: themeBorder }]}>
                      <View style={[styles.progressFill, { backgroundColor: themeGreen }]} />
                    </View>
                    <Text style={[styles.progressPercent, { color: themeGreen }]}>65%</Text>
                  </>
                ) : (
                  <>
                    <View style={[styles.syncModalIcon, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="cloud-outline" size={24} color={themeGreen} />
                    </View>
                    <Text style={[styles.syncModalTitle, { color: themeText }]}>Sync Complete</Text>
                    <Text style={[styles.syncModalDescription, { color: themeMuted }]}>
                      All your data is backed up. Last synced: {lastSynced}
                    </Text>
                    <Pressable
                      onPress={() => setSyncModal('closed')}
                      style={[styles.doneButton, { backgroundColor: themeGreen }]}
                    >
                      <Text style={[styles.doneButtonText, { color: colors.onAction }]}>Done</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            visible={clearCacheModal}
            transparent
            animationType="fade"
            onRequestClose={() => setClearCacheModal(false)}
          >
            <View style={styles.syncModalBackdrop}>
              <View style={[styles.clearCacheModalCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <View style={[styles.clearCacheModalIcon, { backgroundColor: colors.statusDangerSoft }]}>
                  <Ionicons name="trash-outline" size={22} color={colors.statusDanger} />
                </View>
                <Text style={[styles.clearCacheModalTitle, { color: themeText }]}>Clear cache?</Text>
                <Text style={[styles.clearCacheModalDescription, { color: themeMuted }]}>
                  Temporary files and scan images will be removed. Your medicines and reminders will not be affected.
                </Text>
                <View style={styles.clearCacheActions}>
                  <Pressable
                    onPress={() => setClearCacheModal(false)}
                    style={[
                      styles.cancelCacheButton,
                      { backgroundColor: themeBg, borderColor: themeBorder },
                    ]}
                  >
                    <Text style={[styles.cancelCacheText, { color: themeText }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setClearCacheModal(false);
                      Alert.alert(
                        'Cache cleared',
                        'Temporary cache clearing is a visual demo in this version. Your medicine records were not changed.',
                      );
                    }}
                    style={[styles.confirmCacheButton, { backgroundColor: colors.statusDanger }]}
                  >
                    <Text style={styles.confirmCacheText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </>
      );
    }

    if (screen === 'Privacy') {
      return (
        <>
          <Header title="Privacy" />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle>Data &amp; Permissions</SectionTitle>
            <View style={[styles.group, { backgroundColor: themeCard, borderColor: themeBorder }]}>
              <ToggleRow title="Camera Access" value={cameraEnabled} onValueChange={toggleCamera} isLast />
            </View>
          </ScrollView>
        </>
      );
    }

    if (screen === 'FAQs') {
      const filteredFaqs = FAQS.filter(
        (item) =>
          item.question.toLowerCase().includes(faqSearch.trim().toLowerCase()) ||
          item.answer.toLowerCase().includes(faqSearch.trim().toLowerCase()),
      );
      return (
        <>
          <Header title="FAQs" />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={[styles.searchBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
              <Ionicons name="search-outline" size={19} color={themeMuted} />
              <TextInput
                value={faqSearch}
                onChangeText={setFaqSearch}
                placeholder="Search questions..."
                placeholderTextColor={themeMuted}
                style={[styles.searchInput, { color: themeText }]}
                accessibilityLabel="Search frequently asked questions"
              />
              {faqSearch.length > 0 && (
                <Pressable onPress={() => setFaqSearch('')} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={19} color={themeMuted} />
                </Pressable>
              )}
            </View>
            {filteredFaqs.length === 0 ? (
              <View style={[styles.previewCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.faqAnswer, { color: themeMuted, marginTop: 0 }]}>
                  No matching questions. Try a different search.
                </Text>
              </View>
            ) : (
              filteredFaqs.map((item) => {
                const expanded = openFaq === item.question;
                return (
                  <Pressable
                    key={item.question}
                    onPress={() => setOpenFaq(expanded ? null : item.question)}
                    style={[styles.faqCard, { backgroundColor: themeCard, borderColor: themeBorder }]}
                    accessibilityRole="button"
                  >
                    <View style={styles.faqTitleRow}>
                      <Text style={[styles.rowTitle, { flex: 1, color: themeText }]}>{item.question}</Text>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={themeGreen} />
                    </View>
                    {expanded && item.answer.length > 0 && (
                      <Text style={[styles.faqAnswer, { color: themeMuted }]}>{item.answer}</Text>
                    )}
                  </Pressable>
                );
              })
            )}
            <Text style={[styles.faqHelp, { color: themeMuted }]}>
              Still need help? Email us at support@mediscan.app
            </Text>
          </ScrollView>
        </>
      );
    }

    if (screen === 'About MediScan') {
      return (
        <>
          <Header title="About MediScan" />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.aboutContent} showsVerticalScrollIndicator={false}>
            <View style={styles.aboutBrand}>
              <Image
                source={require('../../assets/images/logo/mediscan-icon.png')}
                style={styles.aboutLogo}
                resizeMode="contain"
              />
              <Text style={[styles.aboutName, { color: themeText }]}>MediScan</Text>
              <Text style={[styles.aboutVersion, { color: themeMuted }]}>Version 1.0.0 (Build 42)</Text>
            </View>
            <Text style={[styles.aboutSectionTitle, { color: themeText }]}>Legal</Text>
            <View style={styles.aboutLinks}>
              <Pressable
                onPress={() => openScreen('Terms of Service')}
                style={[styles.aboutLink, { backgroundColor: themeCard, borderColor: themeBorder }]}
              >
                <Text style={[styles.termsOfServiceLinkText, { color: themeText }]}>Terms of Service</Text>
                <Ionicons name="chevron-forward" size={19} color={themeMuted} />
              </Pressable>
              <Pressable
                onPress={() => openScreen('Privacy Policy')}
                style={[styles.aboutLink, { backgroundColor: themeCard, borderColor: themeBorder }]}
              >
                <Text style={[styles.aboutLinkText, { color: themeText }]}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={19} color={themeMuted} />
              </Pressable>
              <Pressable
                onPress={() => openScreen('Open Source Licenses')}
                style={[styles.aboutLink, { backgroundColor: themeCard, borderColor: themeBorder }]}
              >
                <Text style={[styles.aboutLinkText, { color: themeText }]}>Open Source Licenses</Text>
                <Ionicons name="chevron-forward" size={19} color={themeMuted} />
              </Pressable>
            </View>
          </ScrollView>
        </>
      );
    }

    if (screen === 'Privacy Policy') {
      return (
        <>
          <Header title="Privacy Policy" />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.legalPageContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.lastUpdated, { color: themeMuted }]}>Last updated: October 5, 2026</Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>Information We Collect</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              Your Google account name and email, family profiles you create, medicines you scan or enter, and reminder settings.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>Camera Access</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              The camera is used only to scan medicine labels. Photos are processed to read text and are not shared.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>How We Use Your Data</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              To show your medicine list, send expiration alerts and reminders, and sync your data across devices.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>Data Storage &amp; Sync</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              Your data is stored on your device and backed up to our servers when you tap Sync.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>Your Choices</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              You can turn off camera access in Settings &gt; Privacy or remove profiles at any time.
            </Text>
          </ScrollView>
        </>
      );
    }

    if (screen === 'Terms of Service') {
      return (
        <>
          <Header title="Terms of Service" />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.legalPageContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.lastUpdated, { color: themeMuted }]}>Last updated: October 5, 2026</Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>1. Acceptance of Terms</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              By creating an account or using MediScan, you agree to these Terms. If you do not agree, please do not use the app.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>2. Use of the App</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              MediScan helps you organize medicines, track expiration dates and set reminders for your family. It is intended for personal, non-commercial use.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>3. Your Account</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              You sign in using your Google account. You are responsible for keeping your device and account secure.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>4. Not Medical Advice</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              Scan results and reminders are for organization only and do not replace advice from a doctor or pharmacist. Always verify medication details on the package.
            </Text>
            <Text style={[styles.legalHeading, { color: themeText }]}>5. Changes to These Terms</Text>
            <Text style={[styles.legalBody, { color: themeMuted }]}>
              We may update these Terms from time to time. Continued use of MediScan means you accept the updated Terms.
            </Text>
          </ScrollView>
        </>
      );
    }

    if (screen === 'Open Source Licenses') {
      const licenses = [
        { title: 'Text Recognition / OCR Library', subtitle: 'Apache License 2.0' },
        { title: 'UI Framework', subtitle: 'MIT License' },
        { title: 'Local Database Library', subtitle: 'Public Domain' },
        { title: 'Date & Time Utilities', subtitle: 'MIT License' },
        { title: 'Icon Set', subtitle: 'ISC License' },
      ];
      return (
        <>
          <Header title="Open Source Licenses" />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.licensePageContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.licenseIntro, { color: themeMuted }]}>
              MediScan is built with the help of these open source projects.
            </Text>
            {licenses.map((item) => (
              <View
                key={item.title}
                style={[styles.licenseCard, { backgroundColor: themeCard, borderColor: themeBorder }]}
              >
                <View style={styles.licenseRow}>
                  <View style={styles.licenseLabels}>
                    <Text style={[styles.licenseTitle, { color: themeText }]}>{item.title}</Text>
                    <Text style={[styles.licenseSubtitle, { color: themeMuted }]}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={17} color={themeMuted} />
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      );
    }

    return (
      <>
        <Header title="Terms of Service" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.legalPageContent}>
          <Text style={[styles.lastUpdated, { color: themeMuted }]}>Last updated: October 5, 2026</Text>
          <Text style={[styles.legalHeading, { color: themeText }]}>4. Not Medical Advice</Text>
          <Text style={[styles.legalBody, { color: themeMuted }]}>
            Scan results and reminders are for organization only and do not replace advice from a doctor or pharmacist. Always verify medication details on the package.
          </Text>
        </ScrollView>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeBg }]}>
      <View style={styles.main}>
        {screen === 'Settings' && SettingsScreen()}
        {screen === 'Display' && DisplayScreen()}
        {screen === 'Language' && LanguageScreen()}
        {screen === 'Notifications' && NotificationsScreen()}
        {!['Settings', 'Display', 'Language', 'Notifications'].includes(screen) && OtherScreen()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  main: { flex: 1, minHeight: 0 },
  headerSafe: {},
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  backButton: { width: 36, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 21, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 30 },
  profileCard: {
    minHeight: 82,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 22,
    gap: 12,
    elevation: 1,
  },
  profileName: { fontSize: 19, fontWeight: '800' },
  email: { fontSize: 10, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 9, marginTop: 5 },
  displaySectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 9, marginTop: 5, alignSelf: 'stretch', textAlign: 'left' },
  group: { borderWidth: 1, borderRadius: 12, marginBottom: 19, overflow: 'hidden' },
  settingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 12 },
  appearanceRow: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  appearanceCard: {
    flex: 1,
    height: 82,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    elevation: 1,
  },
  appearanceIcon: { minHeight: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  systemIcon: { width: 30, height: 21, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  desktopMonitor: { position: 'absolute', width: 23, height: 15, borderWidth: 1, borderRadius: 2, left: 9, top: 3 },
  monitorStand: { position: 'absolute', width: 1, height: 3, bottom: -3, alignSelf: 'center' },
  monitorFoot: { position: 'absolute', width: 7, height: 1, bottom: -4, alignSelf: 'center', borderRadius: 1 },
  systemPhone: { position: 'absolute', width: 9, height: 19, borderWidth: 1, borderRadius: 2, left: 2, top: 2, zIndex: 2, alignItems: 'center', justifyContent: 'flex-start' },
  phoneSpeaker: { width: 3, height: 0.8, borderRadius: 1, marginTop: 2 },
  appearanceRowIcon: { width: 21, height: 29, position: 'relative', marginRight: 0, justifyContent: 'center' },
  appearanceMoonGlyph: { position: 'absolute', left: -1, top: 3, zIndex: 3 },
  appearanceSunGraphic: { position: 'absolute', left: 8, top: -4, width: 15, height: 20, zIndex: 1 },
  appearanceSunCircle: { position: 'absolute', left: 2, top: 8, width: 9, height: 9, borderWidth: 1.3, borderRadius: 4.5 },
  sunRayTop: { position: 'absolute', left: 6, top: 1, width: 1.2, height: 2.5, borderRadius: 1 },
  sunRayUpperRight: { position: 'absolute', left: 11, top: 4, width: 1.2, height: 2.5, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  sunRayRight: { position: 'absolute', left: 11, top: 12, width: 2.5, height: 1.2, borderRadius: 1 },
  syncContent: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 30 },
  syncInfoCard: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  syncSmallLabel: { fontSize: 14, fontWeight: '600' },
  syncTimestamp: { fontSize: 14, fontWeight: '500' },
  syncNowButton: {
    minHeight: 40,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 19,
  },
  syncNowPressed: { opacity: 0.82 },
  syncNowText: { fontSize: 15, fontWeight: '700' },
  clearCacheButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearCacheText: { fontSize: 14, fontWeight: '600' },
  syncModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
  },
  syncModalCard: {
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
    elevation: 8,
  },
  syncModalIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  syncModalTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  syncModalDescription: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  progressTrack: { width: '100%', height: 4, borderRadius: 3, overflow: 'hidden', marginTop: 1 },
  progressFill: { width: '65%', height: '100%', borderRadius: 3 },
  progressPercent: { fontSize: 11, marginTop: 8 },
  doneButton: { width: '100%', minHeight: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  doneButtonText: { fontSize: 13, fontWeight: '700' },
  appearanceText: { fontSize: 14, fontWeight: '500' },
  selectedText: { color: 'white', fontWeight: '600' },
  sliderCard: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 28,
    elevation: 1,
  },
  smallA: { fontSize: 18, fontWeight: '600' },
  largeA: { fontSize: 28, fontWeight: '600' },
  sliderWrap: { flex: 1, height: 54, justifyContent: 'center', marginHorizontal: 10 },
  slider: { width: '100%', height: 44, zIndex: 2 },
  sliderTicks: { position: 'absolute', left: 12, right: 12, top: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  sliderTick: { width: 8, height: 8, borderRadius: 4 },
  sliderTickActive: { width: 9, height: 9 },
  previewCard: { minHeight: 100, padding: 16, borderWidth: 1, borderRadius: 12 },
  previewTitle: { fontWeight: '700', marginBottom: 8 },
  previewDescription: { lineHeight: 20 },
  languageCard: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageText: { fontSize: 14, fontWeight: '600' },
  toggleRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    borderBottomWidth: 1,
  },
  toggleTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, minHeight: 42, fontSize: 15 },
  faqCard: { borderWidth: 1, borderRadius: 10, padding: 13, marginBottom: 9 },
  faqTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faqAnswer: { fontSize: 15, lineHeight: 23, marginTop: 10 },
  faqHelp: { fontSize: 12, lineHeight: 18, textAlign: 'center', alignSelf: 'stretch', marginTop: 8, marginBottom: 10 },
  aboutContent: { width: '100%', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 28 },
  aboutBrand: { alignItems: 'center', marginBottom: 20 },
  aboutLogo: { width: 76, height: 76, borderRadius: 38, marginBottom: 2 },
  aboutName: { fontSize: 17, fontWeight: '700', marginTop: 1 },
  aboutVersion: { fontSize: 12, marginTop: 5 },
  aboutSectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 0, marginBottom: 12 },
  aboutLinks: { gap: 10 },
  aboutLink: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutLinkText: { fontSize: 16, fontWeight: '600' },
  termsOfServiceLinkText: { fontSize: 14, fontWeight: '600' },
  legalPageContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30 },
  lastUpdated: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  legalHeading: { fontSize: 15, lineHeight: 21, fontWeight: '700', marginTop: 2, marginBottom: 6 },
  legalBody: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  licensePageContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30 },
  licenseIntro: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
  licenseCard: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 7 },
  licenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  licenseLabels: { flex: 1, paddingRight: 8 },
  licenseTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  licenseSubtitle: { fontSize: 12, lineHeight: 16, marginTop: 3 },
  clearCacheModalCard: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: 'center',
    elevation: 8,
  },
  clearCacheModalIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  clearCacheModalTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  clearCacheModalDescription: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 12 },
  clearCacheActions: { width: '100%', flexDirection: 'row', gap: 8 },
  cancelCacheButton: { flex: 1, minHeight: 36, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cancelCacheText: { fontSize: 13, fontWeight: '700' },
  confirmCacheButton: { flex: 1, minHeight: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  confirmCacheText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});