import React from 'react';import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TermsLegalText } from './TermsMedicalDisclaimerContent';

interface TermsConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export default function TermsConsentModal({
  visible,
  onAccept,
  onReject,
}: TermsConsentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-text-outline" size={24} color="#0E3326" />
            </View>
            <Text style={styles.title}>Terms & Conditions</Text>
            <Text style={styles.subtitle}>
              Please review and accept our PH-compliant terms, privacy policy, and medical disclaimer to create your account.
            </Text>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollInner}
          >
            <TermsLegalText />
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {/* Reject Button (Blocks Registration) */}
            <TouchableOpacity
              style={styles.rejectBtn}
              activeOpacity={0.8}
              onPress={onReject}
            >
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={styles.acceptBtn}
              activeOpacity={0.8}
              onPress={onAccept}
            >
              <Text style={styles.acceptBtnText}>I Agree & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0E3326',
  },
  subtitle: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  scrollArea: {
    maxHeight: 340,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginVertical: 12,
    backgroundColor: '#F8FAF9',
  },
  scrollInner: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  rejectBtnText: {
    color: '#E53E3E',
    fontWeight: '700',
    fontSize: 15,
  },
  acceptBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#0E3326',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});