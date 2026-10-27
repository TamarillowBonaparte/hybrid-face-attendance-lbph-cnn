import { IconSymbol } from '@/components/ui/icon-symbol';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validasi sederhana kekuatan password
  const passwordChecks = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      match: newPassword.length > 0 && newPassword === confirmPassword,
    };
  }, [newPassword, confirmPassword]);

  const isFormValid =
    currentPassword.length > 0 &&
    passwordChecks.length &&
    passwordChecks.upper &&
    passwordChecks.number &&
    passwordChecks.match;

  const handleChangePassword = () => {
    if (!isFormValid) return;
    // Handle change password logic
    console.log('Change password pressed');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoCircle}>
            <IconSymbol name="key.fill" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.welcomeText}>Buat Password Baru</Text>
          <Text style={styles.subtitleText}>
            Ini adalah login pertama Anda.{'\n'}Silakan ganti password default dari admin.
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Current / Default Password */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>PASSWORD SAAT INI (DEFAULT)</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="lock" size={18} color="#93C5FD" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Masukkan password default"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showCurrent}
              />
              <TouchableOpacity
                onPress={() => setShowCurrent(!showCurrent)}
                style={styles.eyeIcon}
              >
                <IconSymbol
                  name={showCurrent ? "eye.slash" : "eye"}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>PASSWORD BARU</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="lock.rotation" size={18} color="#93C5FD" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Buat password baru"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNew}
              />
              <TouchableOpacity
                onPress={() => setShowNew(!showNew)}
                style={styles.eyeIcon}
              >
                <IconSymbol
                  name={showNew ? "eye.slash" : "eye"}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm New Password */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>KONFIRMASI PASSWORD BARU</Text>
            <View style={styles.inputContainer}>
              <IconSymbol name="checkmark.shield" size={18} color="#93C5FD" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Ulangi password baru"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeIcon}
              >
                <IconSymbol
                  name={showConfirm ? "eye.slash" : "eye"}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Password Requirements Checklist */}
          <View style={styles.checklistContainer}>
            <ChecklistItem label="Minimal 8 karakter" checked={passwordChecks.length} />
            <ChecklistItem label="Mengandung huruf besar" checked={passwordChecks.upper} />
            <ChecklistItem label="Mengandung angka" checked={passwordChecks.number} />
            <ChecklistItem label="Password baru cocok" checked={passwordChecks.match} />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
            onPress={handleChangePassword}
            activeOpacity={0.85}
            disabled={!isFormValid}
          >
            <Text style={styles.submitButtonText}>Simpan &amp; Lanjutkan</Text>
          </TouchableOpacity>

          {/* Info note */}
          <View style={styles.infoBox}>
            <IconSymbol name="info.circle" size={16} color="#60A5FA" />
            <Text style={styles.infoText}>
              Anda tidak dapat melanjutkan ke aplikasi sebelum mengganti password default ini.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ChecklistItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={itemStyles.row}>
      <View style={[itemStyles.dot, checked && itemStyles.dotActive]}>
        {checked && <IconSymbol name="checkmark" size={10} color="#fff" />}
      </View>
      <Text style={[itemStyles.label, checked && itemStyles.labelActive]}>{label}</Text>
    </View>
  );
}

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  label: {
    fontSize: 12.5,
    color: '#94A3B8',
  },
  labelActive: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 32,
    paddingHorizontal: 30,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 13.5,
    color: '#60A5FA',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  inputWrapper: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    borderRadius: 14,
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  checklistContainer: {
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#BFDBFE',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 17,
  },
});