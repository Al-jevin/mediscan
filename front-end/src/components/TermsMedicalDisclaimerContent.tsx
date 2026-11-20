import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#164F43';
const BG = '#F8FAFB';
const TEXT = '#18312F';
const BORDER = '#E0E5E5';

// Save this with the user's account when they accept (Profile team, sign-up popup)
export const TERMS_VERSION = '1.0';
export const TERMS_LAST_UPDATED = 'November 16, 2026';

type LegalSection = {
  title: string;
  body?: string[];
  bullets?: string[];
};

const INTRO =
  'These Terms, Conditions and Medical Disclaimer ("Terms") explain how MediScan works, how we handle your information, and the limits of what the app can do. By creating an account or using MediScan, you agree to these Terms. If you do not agree, please do not create an account.';

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    title: '1. What MediScan Is',
    body: [
      'MediScan helps you scan medicine packaging, keep a record of your medicines in the Vault, track expiration dates, and set medication reminders for yourself and your family members.',
      'MediScan is an informational and organizational tool only.',
    ],
  },
  {
    title: '2. Medical Disclaimer',
    bullets: [
      'For information only: MediScan does not diagnose, treat or prevent any condition, and does not give medical advice.',
      'Verify scan results: Text recognition (OCR) can make mistakes. Always double-check the medicine name, dosage and expiration date on the actual package before using any medicine.',
      'Consult a professional: Ask your doctor or pharmacist before starting, stopping or changing any medicine.',
      'Reminders are a convenience: Notifications can be delayed or missed because of phone settings, battery saving or connection problems. Do not rely on MediScan as your only way to remember a dose.',
      'Emergencies: In case of a medical emergency or suspected overdose, call 911 or go to the nearest hospital immediately.',
    ],
  },
  {
    title: '3. Data Privacy (Republic Act No. 10173)',
    body: [
      'We process your personal information in accordance with the Data Privacy Act of 2012 (RA 10173) and its Implementing Rules and Regulations.',
      'Information we collect:',
    ],
    bullets: [
      'Account details, such as your name and email address.',
      'Profiles you create, including profiles for family members and dependents.',
      'Photos of medicine packaging and the text read from them.',
      'Medicines saved to your Vault, including expiration dates and notes.',
      'Medication reminders and schedules.',
    ],
  },
  {
    title: 'Sensitive personal information',
    body: [
      'Your medicines and prescriptions can reveal information about your health, which the Data Privacy Act treats as sensitive personal information. We collect and process it only with your consent, and only to provide MediScan\'s features: identifying medicines, storing your Vault, showing expiry alerts and sending reminders. We do not sell your data.',
      'If you add profiles for other people, you confirm that you have their permission, or that you are their parent or legal guardian.',
      'We use reasonable organizational, physical and technical measures to protect your data, and keep it only while your account is active or as required by law.',
      'Under RA 10173, you have the right to be informed, to access your data, to object, to correct inaccurate data, to have your data erased or blocked, to data portability, to claim damages, and to file a complaint with the National Privacy Commission (NPC).',
    ],
  },
  {
    title: '4. Drug Information and the FDA (Republic Act No. 9711)',
    bullets: [
      'MediScan matches scanned medicines against drug product records registered with the Philippine Food and Drug Administration (FDA), as strengthened by the FDA Act of 2009 (RA 9711).',
      'Scan results and medicine details shown in the app do not replace the official FDA-approved label, the package insert, or the FDA\'s own records.',
      'A product\'s registration status can change. For official verification, check the FDA Philippines website.',
      'MediScan is not affiliated with or endorsed by the FDA.',
    ],
  },
  {
    title: '5. Not a Pharmacy (Republic Act No. 10918)',
    bullets: [
      'MediScan is not a pharmacy. It does not dispense, sell, compound or deliver medicines.',
      'Under the Philippine Pharmacy Act (RA 10918), dispensing medicines and giving pharmaceutical advice are done only by licensed pharmacists. MediScan does not replace licensed pharmacists or physicians.',
      'Always follow the prescription and instructions given by your doctor or pharmacist.',
    ],
  },
  {
    title: '6. Generic and Brand Names (Republic Act No. 6675)',
    bullets: [
      'Under the Generics Act of 1988 (RA 6675), medicines are identified by their generic name, which is the name of the active ingredient. MediScan shows the generic name and, when available, the brand name.',
      'Medicines with the same generic name contain the same active ingredient, but their strength, form and inactive ingredients may differ. Ask your pharmacist before switching brands.',
      'MediScan does not recommend or promote any brand.',
    ],
  },
  {
    title: '7. Consumer Safety and Liability (Republic Act No. 7394)',
    bullets: [
      'Do not take medicines that are expired, damaged or unlabeled. Store medicines as instructed on the label, and keep them out of reach of children.',
      'Report suspected side effects to your doctor and to the FDA.',
      'MediScan is provided "as is". To the extent allowed by law, the MediScan team is not liable for harm caused by relying on scan results, reminders or other information in the app without verifying it.',
      'Nothing in these Terms limits your rights as a consumer under the Consumer Act of the Philippines (RA 7394).',
    ],
  },
  {
    title: '8. Your Responsibilities',
    bullets: [
      'Give accurate information when creating your account and profiles.',
      'Keep your login details private.',
      'Use MediScan only for lawful personal and family use.',
    ],
  },
  {
    title: '9. Changes to These Terms',
    body: [
      'We may update these Terms. When we do, we will change the "Last updated" date and may ask you to accept the new version.',
      'Questions about these Terms or your data? Contact the MediScan team at mediscan2627@gmail.com.',
    ],
  },
];

// The legal text only (no header or buttons), so the sign-up popup can reuse it
export function TermsLegalText() {
  return (
    <View>
      <Text style={styles.lastUpdated}>Last updated: {TERMS_LAST_UPDATED}</Text>
      <Text style={[styles.legalBody, styles.intro]}>{INTRO}</Text>
      {LEGAL_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.legalHeading}>{section.title}</Text>
          {section.body?.map((paragraph) => (
            <Text key={paragraph} style={[styles.legalBody, styles.paragraph]}>
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={[styles.legalBody, styles.bulletText]}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function TermsMedicalDisclaimerContent({
  onBack,
  onHome,
}: {
  onBack?: () => void;
  onHome?: () => void;
}) {
  return (
    <View style={styles.container}>
      
      {/* Terms, Conditions and Medical Disclaimer */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.legalPageContent}
        showsVerticalScrollIndicator={false}
      >
        <TermsLegalText />

        {onHome ? (
          <Pressable
            onPress={onHome}
            style={({ pressed }) => [styles.homeButton, { opacity: pressed ? 0.86 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Return to Home"
            testID="terms-return-home"
          >
            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
            <Text style={styles.homeButtonText}>Return to Home</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 16,
    backgroundColor: BG,
  },

  backButton: {
    width: 36,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },

  headerTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 28,
  },

  headerSpacer: {
    width: 36,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
  },

  scroll: {
    flex: 1,
  },

  legalPageContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 40,
  },

  lastUpdated: {
    color: '#7C8986',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'left',
  },

  intro: {
    marginBottom: 20,
  },

  section: {
    width: '100%',
    marginBottom: 20,
  },

  legalHeading: {
    color: '#243B38',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'left',
  },

  legalBody: {
    color: '#687875',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'left',
  },

  paragraph: {
    marginBottom: 6,
  },

  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingRight: 4,
  },

  bulletDot: {
    color: '#687875',
    fontSize: 13,
    lineHeight: 19,
    width: 14,
  },

  bulletText: {
    flex: 1,
  },

  homeButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },

  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});