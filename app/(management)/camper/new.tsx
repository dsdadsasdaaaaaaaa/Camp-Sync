import React, { useState, useRef } from "react";
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
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useData } from "@/contexts/DataContext";
import { isValidPhone } from "@/lib/validation";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import DatePicker from "@/components/DatePicker";
import CabinPicker from "@/components/CabinPicker";
import type { MedicalInfo, EmergencyContact } from "@/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  return `${MONTHS_SHORT[month]} ${day}, ${year}`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function BirthdayPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const [showNative, setShowNative] = useState(false);

  const parsedDate = value
    ? (() => {
        const [y, m, d] = value.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        return isNaN(date.getTime()) ? new Date(2010, 0, 1) : date;
      })()
    : new Date(2010, 0, 1);

  if (Platform.OS === "web") {
    return (
      <DatePicker
        mode="single"
        label="Date of Birth"
        value={value}
        onChange={onChange}
        placeholder="Select date of birth"
        maxDate={new Date().toISOString().split("T")[0]}
      />
    );
  }

  if (Platform.OS === "android") {
    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Date of Birth</Text>
        <Pressable
          style={[styles.fieldInput, styles.datePickerBtn]}
          onPress={() => setShowNative(true)}
        >
          <Text style={[{ fontFamily: "Outfit_400Regular", fontSize: 15 }, value ? { color: colors.text } : { color: colors.textMuted }]}>
            {value ? formatDateDisplay(value) : "Select date of birth"}
          </Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </Pressable>
        {showNative && (
          <DateTimePicker
            value={parsedDate}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowNative(false);
              if (selected) onChange(toDateString(selected));
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Date of Birth</Text>
      <Pressable
        style={[styles.fieldInput, styles.datePickerBtn]}
        onPress={() => setShowNative(true)}
      >
        <Text style={[{ fontFamily: "Outfit_400Regular", fontSize: 15 }, value ? { color: colors.text } : { color: colors.textMuted }]}>
          {value ? formatDateDisplay(value) : "Select date of birth"}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={showNative} transparent animationType="slide">
        <View style={styles.dateModalOverlay}>
          <View style={[styles.dateModalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.dateModalHeader}>
              <Pressable onPress={() => setShowNative(false)}>
                <Text style={[styles.dateModalBtn, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.dateModalTitle, { color: colors.text }]}>Date of Birth</Text>
              <Pressable onPress={() => setShowNative(false)}>
                <Text style={[styles.dateModalBtn, { color: Colors.primary }]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={parsedDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              textColor={colors.text}
              onChange={(_, selected) => {
                if (selected) onChange(toDateString(selected));
              }}
              style={{ height: 200 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  required?: boolean;
  error?: string;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={{ color: Colors.danger }}> *</Text>}
      </Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.multilineInput, error ? styles.fieldInputError : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={keyboardType === "email-address" || keyboardType === "phone-pad" ? "none" : "words"}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function TagInput({ label, values, onChange, placeholder }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<TextInput>(null);

  const addTag = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputVal("");
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.tagContainer}>
        {values.map((tag, i) => (
          <View key={i} style={styles.tagChip}>
            <Text style={styles.tagChipText}>{tag}</Text>
            <Pressable onPress={() => removeTag(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.primary} />
            </Pressable>
          </View>
        ))}
        <View style={styles.tagInputRow}>
          <TextInput
            ref={inputRef}
            style={styles.tagInput}
            value={inputVal}
            onChangeText={setInputVal}
            placeholder={placeholder || `Add ${label.toLowerCase()}`}
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={addTag}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          {inputVal.trim().length > 0 && (
            <Pressable onPress={addTag} style={styles.tagAddBtn}>
              <Ionicons name="add-circle" size={22} color={Colors.primary} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const emptyContact = (): EmergencyContact => ({ name: "", relationship: "", phone: "", email: "" });

export default function NewCamperScreen() {
  const { addCamper } = useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [isLoading, setIsLoading] = useState(false);
  const [section, setSection] = useState<"basic" | "medical">("basic");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [cabinGroup, setCabinGroup] = useState("");
  const [medical, setMedical] = useState<MedicalInfo>({
    allergies: [],
    medications: [],
    conditions: [],
    emergencyContacts: [emptyContact()],
    doctorName: "",
    doctorPhone: "",
    insuranceProvider: "",
    bloodType: "Unknown",
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateMedical = (key: keyof MedicalInfo, value: any) => {
    setMedical((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key as string]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n; });
    }
  };

  const updateContact = (i: number, field: keyof EmergencyContact, value: string) => {
    setMedical(prev => {
      const updated = [...prev.emergencyContacts];
      updated[i] = { ...updated[i], [field]: value };
      return { ...prev, emergencyContacts: updated };
    });
    const key = `${field}_${i}`;
    if (fieldErrors[key]) setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const addContact = () => setMedical(prev => ({
    ...prev,
    emergencyContacts: [...prev.emergencyContacts, emptyContact()],
  }));

  const removeContact = (i: number) => setMedical(prev => {
    const updated = [...prev.emergencyContacts];
    updated.splice(i, 1);
    return { ...prev, emergencyContacts: updated };
  });

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Info", "First name and last name are required.");
      return;
    }
    const contacts = medical.emergencyContacts || [];
    if (contacts.length === 0 || !contacts[0]?.name?.trim()) {
      Alert.alert("Missing Emergency Contact", "At least one emergency contact with a name is required.");
      return;
    }
    contacts.forEach((ec, i) => {
      if (ec.phone?.trim() && !isValidPhone(ec.phone)) {
        errors[`phone_${i}`] = "Please enter a valid phone number";
      }
    });
    if (medical.doctorPhone.trim() && !isValidPhone(medical.doctorPhone)) {
      errors.doctorPhone = "Please enter a valid phone number";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSection("medical");
      return;
    }
    setFieldErrors({});

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
      style={{ flex: 1, backgroundColor: colors.background }}
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
          <Ionicons name="arrow-back" size={22} color={colors.text} />
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
            color={section === "basic" ? Colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, section === "basic" && styles.activeTabText]}>
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
            color={section === "medical" ? Colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, section === "medical" && styles.activeTabText]}>
            Medical Info
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {section === "basic" ? (
          <View style={styles.card}>
            <InputField label="First Name" value={firstName} onChange={setFirstName} placeholder="Jane" required />
            <InputField label="Last Name" value={lastName} onChange={setLastName} placeholder="Smith" required />
            <BirthdayPicker value={dateOfBirth} onChange={setDateOfBirth} />
            <CabinPicker value={cabinGroup} onChange={setCabinGroup} />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="call-outline" size={16} color={Colors.danger} />
              <Text style={styles.sectionHeaderText}>Emergency Contacts</Text>
            </View>

            {medical.emergencyContacts.map((ec, i) => (
              <View key={i} style={{ gap: 10 }}>
                {i > 0 && <View style={styles.divider} />}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {i === 0 ? "Primary Contact" : `Contact ${i + 1}`}
                  </Text>
                  {i > 0 && (
                    <Pressable onPress={() => removeContact(i)}>
                      <Ionicons name="close-circle" size={20} color={Colors.danger} />
                    </Pressable>
                  )}
                </View>
                <InputField
                  label="Name"
                  value={ec.name}
                  onChange={(v) => updateContact(i, "name", v)}
                  placeholder="Full name"
                  required={i === 0}
                />
                <InputField
                  label="Relationship"
                  value={ec.relationship}
                  onChange={(v) => updateContact(i, "relationship", v)}
                  placeholder="e.g. Parent, Guardian, Aunt"
                />
                <InputField
                  label="Phone"
                  value={ec.phone}
                  onChange={(v) => updateContact(i, "phone", v)}
                  placeholder="(555) 000-0000"
                  keyboardType="phone-pad"
                  error={fieldErrors[`phone_${i}`]}
                />
                <InputField
                  label="Email"
                  value={ec.email}
                  onChange={(v) => updateContact(i, "email", v)}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                />
              </View>
            ))}

            <Pressable
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
              onPress={addContact}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: Colors.primary }}>
                Add Another Contact
              </Text>
            </Pressable>

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
                    style={[styles.bloodTypeOption, medical.bloodType === bt && styles.bloodTypeSelected]}
                    onPress={() => updateMedical("bloodType", bt)}
                  >
                    <Text style={[styles.bloodTypeText, medical.bloodType === bt && styles.bloodTypeSelectedText]}>
                      {bt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <TagInput
              label="Allergies"
              values={medical.allergies as string[]}
              onChange={(v) => updateMedical("allergies", v)}
              placeholder="Type and press return to add"
            />
            <TagInput
              label="Medications"
              values={medical.medications as string[]}
              onChange={(v) => updateMedical("medications", v)}
              placeholder="Type and press return to add"
            />
            <TagInput
              label="Medical Conditions"
              values={medical.conditions as string[]}
              onChange={(v) => updateMedical("conditions", v)}
              placeholder="Type and press return to add"
            />

            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Ionicons name="business-outline" size={16} color={Colors.primary} />
              <Text style={styles.sectionHeaderText}>Doctor & Insurance</Text>
            </View>
            <InputField label="Doctor Name" value={medical.doctorName} onChange={(v) => updateMedical("doctorName", v)} placeholder="Dr. Name" />
            <InputField label="Doctor Phone" value={medical.doctorPhone} onChange={(v) => updateMedical("doctorPhone", v)} placeholder="(555) 000-0000" keyboardType="phone-pad" error={fieldErrors.doctorPhone} />
            <InputField label="Insurance Provider" value={medical.insuranceProvider} onChange={(v) => updateMedical("insuranceProvider", v)} placeholder="e.g. BlueCross BlueShield" />
            <InputField label="Additional Notes" value={medical.notes} onChange={(v) => updateMedical("notes", v)} placeholder="Any other important medical information..." multiline />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
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
    backgroundColor: colors.surfaceSecondary,
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
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: colors.textMuted,
  },
  activeTabText: {
    color: Colors.primary,
    fontFamily: "Outfit_600SemiBold",
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  fieldInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: colors.text,
  },
  fieldInputError: {
    borderColor: Colors.danger,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.danger,
    marginTop: 2,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  bloodTypeSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bloodTypeText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textSecondary,
  },
  bloodTypeSelectedText: {
    color: "#fff",
  },
  tagContainer: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    minHeight: 48,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "18",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.primary,
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 120,
  },
  tagInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
    paddingVertical: 2,
    minHeight: 28,
  },
  tagAddBtn: {
    paddingLeft: 6,
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  dateModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  dateModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  dateModalTitle: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  dateModalBtn: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
});
