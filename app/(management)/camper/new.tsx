import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import type { MedicalInfo } from "@/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

function InputField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  required,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={{ color: Colors.danger }}> *</Text>}
      </Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textMuted}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
      />
    </View>
  );
}

export default function NewCamperScreen() {
  const { addCamper } = useData();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [section, setSection] = useState<"basic" | "medical">("basic");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [cabinGroup, setCabinGroup] = useState("");
  const [medical, setMedical] = useState<MedicalInfo>({
    allergies: "",
    medications: "",
    conditions: "",
    emergencyContact: "",
    emergencyPhone: "",
    doctorName: "",
    doctorPhone: "",
    insuranceProvider: "",
    bloodType: "Unknown",
    notes: "",
  });

  const updateMedical = (key: keyof MedicalInfo, value: string) => {
    setMedical((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Info", "First name and last name are required.");
      return;
    }
    if (!medical.emergencyContact.trim() || !medical.emergencyPhone.trim()) {
      Alert.alert(
        "Missing Emergency Contact",
        "Emergency contact information is required for safety."
      );
      return;
    }

    setIsLoading(true);
    try {
      await addCamper({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth.trim(),
        cabinGroup: cabinGroup.trim(),
        medical,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to add camper.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.light.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Camper</Text>
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, section === "basic" && styles.activeTab]}
          onPress={() => setSection("basic")}
        >
          <Ionicons
            name="person-outline"
            size={16}
            color={section === "basic" ? Colors.primary : Colors.light.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              section === "basic" && styles.activeTabText,
            ]}
          >
            Basic Info
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, section === "medical" && styles.activeTab]}
          onPress={() => setSection("medical")}
        >
          <Ionicons
            name="medical-outline"
            size={16}
            color={
              section === "medical" ? Colors.primary : Colors.light.textMuted
            }
          />
          <Text
            style={[
              styles.tabText,
              section === "medical" && styles.activeTabText,
            ]}
          >
            Medical Info
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {section === "basic" ? (
          <View style={styles.card}>
            <InputField
              label="First Name"
              value={firstName}
              onChange={setFirstName}
              placeholder="Jane"
              required
            />
            <InputField
              label="Last Name"
              value={lastName}
              onChange={setLastName}
              placeholder="Smith"
              required
            />
            <InputField
              label="Date of Birth"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              placeholder="MM/DD/YYYY"
            />
            <InputField
              label="Cabin / Group"
              value={cabinGroup}
              onChange={setCabinGroup}
              placeholder="e.g. Cabin 4 - Blue Jay"
            />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="call-outline" size={16} color={Colors.danger} />
              <Text style={styles.sectionHeaderText}>Emergency Contact</Text>
            </View>
            <InputField
              label="Contact Name"
              value={medical.emergencyContact}
              onChange={(v: string) => updateMedical("emergencyContact", v)}
              placeholder="Parent or Guardian Name"
              required
            />
            <InputField
              label="Contact Phone"
              value={medical.emergencyPhone}
              onChange={(v: string) => updateMedical("emergencyPhone", v)}
              placeholder="(555) 000-0000"
              keyboardType="phone-pad"
              required
            />

            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Ionicons name="medkit-outline" size={16} color={Colors.danger} />
              <Text style={styles.sectionHeaderText}>Health Information</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Blood Type</Text>
              <View style={styles.bloodTypeGrid}>
                {BLOOD_TYPES.map((bt) => (
                  <Pressable
                    key={bt}
                    style={[
                      styles.bloodTypeOption,
                      medical.bloodType === bt && styles.bloodTypeSelected,
                    ]}
                    onPress={() => updateMedical("bloodType", bt)}
                  >
                    <Text
                      style={[
                        styles.bloodTypeText,
                        medical.bloodType === bt && styles.bloodTypeSelectedText,
                      ]}
                    >
                      {bt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <InputField
              label="Allergies"
              value={medical.allergies}
              onChange={(v: string) => updateMedical("allergies", v)}
              placeholder="e.g. Peanuts, Penicillin (or None)"
              multiline
            />
            <InputField
              label="Medications"
              value={medical.medications}
              onChange={(v: string) => updateMedical("medications", v)}
              placeholder="e.g. EpiPen, Inhaler (or None)"
              multiline
            />
            <InputField
              label="Medical Conditions"
              value={medical.conditions}
              onChange={(v: string) => updateMedical("conditions", v)}
              placeholder="e.g. Asthma, Diabetes (or None)"
              multiline
            />

            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Ionicons name="business-outline" size={16} color={Colors.primary} />
              <Text style={styles.sectionHeaderText}>Doctor & Insurance</Text>
            </View>
            <InputField
              label="Doctor Name"
              value={medical.doctorName}
              onChange={(v: string) => updateMedical("doctorName", v)}
              placeholder="Dr. Name"
            />
            <InputField
              label="Doctor Phone"
              value={medical.doctorPhone}
              onChange={(v: string) => updateMedical("doctorPhone", v)}
              placeholder="(555) 000-0000"
              keyboardType="phone-pad"
            />
            <InputField
              label="Insurance Provider"
              value={medical.insuranceProvider}
              onChange={(v: string) => updateMedical("insuranceProvider", v)}
              placeholder="e.g. BlueCross BlueShield"
            />
            <InputField
              label="Additional Notes"
              value={medical.notes}
              onChange={(v: string) => updateMedical("notes", v)}
              placeholder="Any other important medical information..."
              multiline
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 70,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: Colors.light.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textMuted,
  },
  activeTabText: {
    color: Colors.primary,
    fontFamily: "Outfit_600SemiBold",
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  fieldInput: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: Colors.light.text,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: "top",
  },
  bloodTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bloodTypeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  bloodTypeSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bloodTypeText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
  bloodTypeSelectedText: {
    color: "#fff",
  },
});
