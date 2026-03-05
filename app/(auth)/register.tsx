import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { isValidEmail } from "@/lib/validation";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

const DEMO_CODES = [
  { code: "DEMO-ADMIN", role: "Management", color: Colors.primary },
  { code: "DEMO-STAFF", role: "Staff", color: Colors.accent },
  { code: "DEMO-PARENT", role: "Parent", color: "#8B5CF6" },
];

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize,
  rightElement,
  testID,
  error,
}: {
  label: string;
  icon: any;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  rightElement?: React.ReactNode;
  testID?: string;
  error?: string;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        <Ionicons
          name={icon}
          size={18}
          color={error ? Colors.danger : colors.textMuted}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChange}
          secureTextEntry={secure}
          keyboardType={keyboardType || "default"}
          autoCapitalize={autoCapitalize || "words"}
          autoCorrect={false}
          testID={testID}
          accessibilityLabel={label}
        />
        {rightElement}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError && (text.trim() === "" || isValidEmail(text))) {
      setEmailError("");
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !authCode.trim()) {
      if (!email.trim()) setEmailError("Email is required");
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      await register(name.trim(), email.trim(), password, authCode.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Registration Failed", err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
            paddingBottom: insets.bottom + 34,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            You'll need an auth code from camp management
          </Text>
        </View>

        <View style={styles.card}>
          <Field
            label="Full Name"
            icon="person-outline"
            value={name}
            onChange={setName}
            placeholder="Jane Smith"
            testID="register-name"
          />
          <Field
            label="Email Address"
            icon="mail-outline"
            value={email}
            onChange={handleEmailChange}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="register-email"
            error={emailError}
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChange={setPassword}
            placeholder="Min. 6 characters"
            secure={!showPassword}
            autoCapitalize="none"
            testID="register-password"
            rightElement={
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            }
          />
          <Field
            label="Confirm Password"
            icon="lock-closed-outline"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Re-enter password"
            secure={!showPassword}
            autoCapitalize="none"
            testID="register-confirm-password"
          />

          <View style={styles.divider} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Auth Code</Text>
            <Text style={styles.codeHint}>
              Provided by camp management. Determines your role.
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="key-outline"
                size={18}
                color={Colors.accent}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your auth code"
                placeholderTextColor={colors.textMuted}
                value={authCode}
                onChangeText={setAuthCode}
                autoCapitalize="characters"
                autoCorrect={false}
                testID="register-auth-code"
                accessibilityLabel="Auth Code"
              />
            </View>
          </View>

          <View style={styles.demoSection}>
            <View style={styles.demoHeader}>
              <Ionicons name="flask-outline" size={16} color={colors.textMuted} />
              <Text style={styles.demoTitle}>Demo Codes (tap to use)</Text>
            </View>
            <View style={styles.demoCodesRow}>
              {DEMO_CODES.map((demo) => (
                <Pressable
                  key={demo.code}
                  style={({ pressed }) => [
                    styles.demoCodeChip,
                    {
                      borderColor: demo.color + "50",
                      backgroundColor: demo.color + "10",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  testID={`demo-code-${demo.role.toLowerCase()}`}
                  onPress={() => {
                    setAuthCode(demo.code);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons
                    name={
                      demo.role === "Management"
                        ? "shield-checkmark"
                        : demo.role === "Staff"
                        ? "people"
                        : "person"
                    }
                    size={13}
                    color={demo.color}
                  />
                  <View>
                    <Text style={[styles.demoCodeText, { color: demo.color }]}>
                      {demo.code}
                    </Text>
                    <Text style={styles.demoRoleText}>{demo.role} (Infinite)</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.registerButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.footerLink}> Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  codeHint: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: colors.text,
  },
  eyeButton: {
    padding: 4,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.danger,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  demoSection: {
    gap: 10,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  demoTitle: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textMuted,
  },
  demoCodesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  demoCodeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  demoCodeText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 0.5,
  },
  demoRoleText: {
    fontSize: 10,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  registerButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
});
