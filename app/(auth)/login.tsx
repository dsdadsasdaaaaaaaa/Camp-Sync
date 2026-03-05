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
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { isValidEmail } from "@/lib/validation";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/campsync-logo.png");

export default function LoginScreen() {
  const { login, resetPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotAuthCode, setForgotAuthCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState<"authcode" | "resetcode">("authcode");
  const [resetCode, setResetCode] = useState("");
  const [resetCodeNewPwd, setResetCodeNewPwd] = useState("");
  const [resetCodeConfirmPwd, setResetCodeConfirmPwd] = useState("");

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setLoginError("");
    if (emailError) setEmailError("");
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setLoginError("");
    if (passwordError) setPasswordError("");
  };

  const handleLogin = async () => {
    let valid = true;
    if (!email.trim()) {
      setEmailError("Email is required");
      valid = false;
    } else if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      valid = false;
    } else {
      setEmailError("");
    }
    if (!password.trim()) {
      setPasswordError("Password is required");
      valid = false;
    } else {
      setPasswordError("");
    }
    if (!valid) return;

    setLoginError("");
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoginError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setEmailError("");
    setPasswordError("");
    setLoginError("");
    setIsLoading(true);
    try {
      await login(demoEmail, demoPassword);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoginError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotEmail.trim() || !forgotAuthCode.trim() || !forgotNewPassword.trim()) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }
    if (forgotNewPassword.trim().length < 4) {
      Alert.alert("Too Short", "Password must be at least 4 characters.");
      return;
    }
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail, forgotAuthCode, forgotNewPassword);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Your password has been reset. You can now sign in.", [
        { text: "OK", onPress: () => {
          setShowForgot(false);
          setForgotEmail("");
          setForgotAuthCode("");
          setForgotNewPassword("");
          setForgotConfirmPassword("");
        }},
      ]);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Reset Failed", err.message || "Something went wrong.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleUseResetCode = async () => {
    if (!resetCode.trim()) { Alert.alert("Required", "Please enter the reset code."); return; }
    if (!resetCodeNewPwd.trim() || resetCodeNewPwd.length < 6) { Alert.alert("Invalid", "Password must be at least 6 characters."); return; }
    if (resetCodeNewPwd !== resetCodeConfirmPwd) { Alert.alert("Mismatch", "Passwords do not match."); return; }
    setForgotLoading(true);
    try {
      const { apiRequest } = await import("@/lib/query-client");
      const res = await apiRequest("POST", "/api/auth/use-reset-code", { code: resetCode.trim().toUpperCase(), newPassword: resetCodeNewPwd });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Invalid code");
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Password Reset", "Your password has been updated. Please log in.", [
        { text: "OK", onPress: () => {
          setShowForgot(false);
          setResetCode("");
          setResetCodeNewPwd("");
          setResetCodeConfirmPwd("");
        }},
      ]);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Failed", err.message || "Could not use reset code.");
    } finally {
      setForgotLoading(false);
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
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 60),
            paddingBottom: insets.bottom + 34,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={logo}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.tagline}>Camp Management System</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={[styles.inputContainer, emailError ? styles.inputError : null]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={emailError ? Colors.danger : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                testID="login-email"
                accessibilityLabel="Email Address"
              />
            </View>
            {emailError ? <Text style={styles.errorText} testID="email-error" accessibilityRole="alert">{emailError}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={passwordError ? Colors.danger : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                testID="login-password"
                accessibilityLabel="Password"
              />
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
            </View>
            {passwordError ? <Text style={styles.errorText} testID="password-error" accessibilityRole="alert">{passwordError}</Text> : null}
          </View>

          <Pressable
            onPress={() => {
              setForgotEmail(email);
              setShowForgot(true);
            }}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>

          {loginError ? (
            <View testID="login-error" accessibilityRole="alert">
              <View style={styles.loginErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.loginErrorText}>{loginError}</Text>
              </View>
              {loginError.toLowerCase().includes("no account") ? (
                <Pressable
                  style={styles.registerNowBtn}
                  onPress={() => router.push("/(auth)/register")}
                >
                  <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
                  <Text style={styles.registerNowText}>Create an account</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.demoSection}>
          <View style={styles.demoSeparator}>
            <View style={styles.demoLine} />
            <Text style={styles.demoSeparatorText}>Try a demo account</Text>
            <View style={styles.demoLine} />
          </View>
          <View style={styles.demoButtons}>
            <Pressable
              style={({ pressed }) => [styles.demoBtn, styles.demoBtnManagement, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => handleDemoLogin("admin@demo.com", "demo1234")}
              disabled={isLoading}
            >
              <Ionicons name="shield-checkmark-outline" size={15} color="#fff" />
              <Text style={styles.demoBtnText}>Management</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.demoBtn, styles.demoBtnStaff, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => handleDemoLogin("staff@demo.com", "demo1234")}
              disabled={isLoading}
            >
              <Ionicons name="people-outline" size={15} color="#fff" />
              <Text style={styles.demoBtnText}>Staff</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.demoBtn, styles.demoBtnParent, { opacity: pressed ? 0.8 : 1 }]}
              onPress={() => handleDemoLogin("parent@demo.com", "demo1234")}
              disabled={isLoading}
            >
              <Ionicons name="heart-outline" size={15} color="#fff" />
              <Text style={styles.demoBtnText}>Parent</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New staff or parent?</Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.footerLink}> Register with code</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={showForgot}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForgot(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ justifyContent: "flex-end", flex: 1 }}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Reset Password</Text>

              <View style={styles.modeSwitcher}>
                <Pressable
                  style={[styles.modeBtn, forgotMode === "authcode" && styles.modeBtnActive]}
                  onPress={() => setForgotMode("authcode")}
                >
                  <Text style={[styles.modeBtnText, forgotMode === "authcode" && styles.modeBtnTextActive]}>Auth Code</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeBtn, forgotMode === "resetcode" && styles.modeBtnActive]}
                  onPress={() => setForgotMode("resetcode")}
                >
                  <Text style={[styles.modeBtnText, forgotMode === "resetcode" && styles.modeBtnTextActive]}>Admin Code</Text>
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {forgotMode === "authcode" ? (
                  <>
                    <Text style={[styles.modalSub, { marginBottom: 12 }]}>
                      Enter your email and the auth code you used to register
                    </Text>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <View style={styles.modalInputRow}>
                      <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modalFieldInput}
                        value={forgotEmail}
                        onChangeText={setForgotEmail}
                        placeholder="your@email.com"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                      />
                    </View>
                    <Text style={styles.fieldLabel}>Auth Code</Text>
                    <View style={styles.modalInputRow}>
                      <Ionicons name="key-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modalFieldInput}
                        value={forgotAuthCode}
                        onChangeText={setForgotAuthCode}
                        placeholder="Code used during registration"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                    </View>
                    <Text style={styles.fieldLabel}>New Password</Text>
                    <View style={styles.modalInputRow}>
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modalFieldInput}
                        value={forgotNewPassword}
                        onChangeText={setForgotNewPassword}
                        placeholder="New password"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showForgotPassword}
                        autoCapitalize="none"
                      />
                      <Pressable onPress={() => setShowForgotPassword(!showForgotPassword)} style={styles.eyeButton}>
                        <Ionicons name={showForgotPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <View style={styles.modalInputRow}>
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modalFieldInput}
                        value={forgotConfirmPassword}
                        onChangeText={setForgotConfirmPassword}
                        placeholder="Confirm new password"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showForgotPassword}
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={styles.modalButtons}>
                      <Pressable
                        style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                        onPress={() => { setShowForgot(false); setForgotEmail(""); setForgotAuthCode(""); setForgotNewPassword(""); setForgotConfirmPassword(""); }}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                        onPress={handleResetPassword}
                        disabled={forgotLoading}
                      >
                        {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Reset Password</Text>}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.modalSub, { marginBottom: 12 }]}>
                      Enter the one-time code provided by your camp administrator
                    </Text>
                    <Text style={styles.fieldLabel}>Reset Code</Text>
                    <View style={styles.modalInputRow}>
                      <Ionicons name="key-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.modalFieldInput, { letterSpacing: 3, fontFamily: "Outfit_700Bold" }]}
                        value={resetCode}
                        onChangeText={(t) => setResetCode(t.toUpperCase())}
                        placeholder="XXXXXXXX"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={8}
                      />
                    </View>
                    <Text style={styles.fieldLabel}>New Password</Text>
                    <View style={styles.modalInputRow}>
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modalFieldInput}
                        value={resetCodeNewPwd}
                        onChangeText={setResetCodeNewPwd}
                        placeholder="New password (min 6 chars)"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>
                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <View style={styles.modalInputRow}>
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.modalFieldInput}
                        value={resetCodeConfirmPwd}
                        onChangeText={setResetCodeConfirmPwd}
                        placeholder="Confirm new password"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={styles.modalButtons}>
                      <Pressable
                        style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
                        onPress={() => { setShowForgot(false); setResetCode(""); setResetCodeNewPwd(""); setResetCodeConfirmPwd(""); }}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                        onPress={handleUseResetCode}
                        disabled={forgotLoading}
                      >
                        {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Set New Password</Text>}
                      </Pressable>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: -12,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
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
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.danger,
    marginTop: 4,
  },
  loginErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.danger + "15",
    borderWidth: 1,
    borderColor: Colors.danger + "40",
    borderRadius: 10,
    padding: 12,
  },
  loginErrorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.danger,
  },
  registerNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary + "15",
    borderWidth: 1,
    borderColor: Colors.primary + "40",
  },
  registerNowText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.primary,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  loginButtonText: {
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
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -8,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  modalSub: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
    marginBottom: 8,
  },
  modalInputRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
  },
  modalFieldInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: "row" as const,
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    height: 50,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  demoSection: {
    gap: 12,
    marginTop: 4,
  },
  demoSeparator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  demoLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  demoSeparatorText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
  },
  demoButtons: {
    flexDirection: "row",
    gap: 8,
  },
  demoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 40,
    borderRadius: 10,
  },
  demoBtnManagement: {
    backgroundColor: Colors.primary,
  },
  demoBtnStaff: {
    backgroundColor: "#34C759",
  },
  demoBtnParent: {
    backgroundColor: "#FF9500",
  },
  demoBtnText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 3,
    marginVertical: 12,
  },
  modeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  modeBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: colors.textMuted,
  },
  modeBtnTextActive: {
    color: Colors.primary,
    fontFamily: "Outfit_600SemiBold",
  },
});
