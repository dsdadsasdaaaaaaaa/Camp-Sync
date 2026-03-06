import React, { useState, useEffect, useRef } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { isValidPhone, formatPhone } from "@/lib/validation";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import NFCScanner from "@/components/NFCScanner";
import DatePicker from "@/components/DatePicker";
import type { Camper, MedicalInfo, EmergencyContact, WristbandPayload, User } from "@/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDOBDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const m = parseInt(parts[1], 10) - 1;
    return `${MONTHS_SHORT[m] || parts[1]} ${parseInt(parts[2], 10)}, ${parts[0]}`;
  }
  return dateStr;
}

function InfoField({ label, value }: { label: string; value: string | string[] }) {
  const colors = useColors();
  const styles = getStyles(colors);
  const displayValue = Array.isArray(value) ? value.join(", ") || "—" : value || "—";
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {Array.isArray(value) && value.length > 0 ? (
        <View style={styles.chipRow}>
          {value.map((item, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.infoValue}>{displayValue}</Text>
      )}
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

function EditField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  error,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  error?: string;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.multilineInput, error ? styles.fieldInputError : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={keyboardType === "phone-pad" ? "none" : "words"}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function CamperDetailScreen() {
  const { id, autoProgram } = useLocalSearchParams<{ id: string; autoProgram?: string }>();
  const { campers, checkIns, sessions, pendingUpdates, users, updateCamper, updateUser, programWristband, createAuthCode, getActiveCheckIn, checkInCamper, checkOutCamper, resolvePendingUpdate } = useData();
  const [showParentPicker, setShowParentPicker] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [section, setSection] = useState<"basic" | "medical" | "status" | "history">("basic");
  const [isEditing, setIsEditing] = useState(false);
  const [nfcScanVisible, setNfcScanVisible] = useState(false);
  const [nfcWritePayload, setNfcWritePayload] = useState<WristbandPayload | null>(null);

  const camper = campers.find((c) => c.id === id);
  const activeCheckIn = camper ? getActiveCheckIn(camper.id) : undefined;

  useEffect(() => {
    if (autoProgram === "true" && camper && !nfcScanVisible) {
      handleProgramWristband();
    }
  }, [autoProgram, camper]);

  const hasPending = pendingUpdates.some((p) => p.camperId === id && !p.resolved);
  const canEdit = user?.role === "management";

  const [firstName, setFirstName] = useState(camper?.firstName || "");
  const [lastName, setLastName] = useState(camper?.lastName || "");
  const [dateOfBirth, setDateOfBirth] = useState(camper?.dateOfBirth || "");
  const [cabinGroup, setCabinGroup] = useState(camper?.cabinGroup || "");
  const [medical, setMedical] = useState<MedicalInfo>(
    camper?.medical || {
      allergies: [],
      medications: [],
      conditions: [],
      emergencyContacts: [{ name: "", relationship: "", phone: "", email: "" }],
      doctorName: "",
      doctorPhone: "",
      insuranceProvider: "",
      bloodType: "Unknown",
      notes: "",
    }
  );

  useEffect(() => {
    if (camper) {
      setFirstName(camper.firstName);
      setLastName(camper.lastName);
      setDateOfBirth(camper.dateOfBirth || "");
      setCabinGroup(camper.cabinGroup || "");
      setMedical(camper.medical);
    }
  }, [camper]);

  if (!camper) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Outfit_400Regular" }}>Camper not found</Text>
      </View>
    );
  }

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateMedical = (key: keyof MedicalInfo, value: any) => {
    setMedical((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Info", "First and last name are required.");
      return;
    }
    const errors: Record<string, string> = {};
    (medical.emergencyContacts || []).forEach((ec, i) => {
      if (ec.phone?.trim() && !isValidPhone(ec.phone)) {
        errors[`emergencyPhone_${i}`] = "Please enter a valid phone number";
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
    setIsSaving(true);
    try {
      await updateCamper(camper.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth.trim(),
        cabinGroup: cabinGroup.trim(),
        medical,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update camper.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProgramWristband = () => {
    const payload: WristbandPayload = {
      camperId: camper.id,
      firstName: camper.firstName,
      lastName: camper.lastName,
      dateOfBirth: camper.dateOfBirth,
      medical: camper.medical,
      programmedAt: new Date().toISOString(),
      appVersion: "1.0",
    };
    setNfcWritePayload(payload);
    setNfcScanVisible(true);
  };

  const handleNFCWriteSuccess = async () => {
    setNfcScanVisible(false);
    setNfcWritePayload(null);
    try {
      const wbId = await programWristband(camper.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Wristband Programmed",
        `${camper.firstName} ${camper.lastName}'s wristband is now programmed.\n\nID: ${wbId}\n\nAll data is encrypted and accessible offline.`
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save wristband record.");
    }
  };

  const handleCreateParentCode = async () => {
    Alert.alert(
      "Generate Parent Code",
      `Create an auth code that a parent can use to register and view ${camper.firstName}'s information?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: async () => {
            try {
              const code = await createAuthCode("parent", 1, camper.id);
              Alert.alert(
                "Parent Auth Code",
                `Share this code with ${camper.firstName}'s parent:\n\n${code}\n\nThey can use it to register in the app.`,
                [{ text: "OK" }]
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to generate code.");
            }
          },
        },
      ]
    );
  };

  const camperHistory = checkIns
    .filter((ci) => ci.camperId === camper.id)
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {camper.firstName} {camper.lastName}
          </Text>
        </View>
        {canEdit && (
          isEditing ? (
            <Pressable
              style={({ pressed }) => [styles.editButton, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.editButtonText}>Save</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.editButton, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => setIsEditing(true)}
            >
              <Text style={[styles.editButtonText, { color: colors.text }]}>Edit</Text>
            </Pressable>
          )
        )}
      </View>

      <View style={styles.tabs}>
        {(["basic", "medical", "status", "history"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.tab, section === s && styles.activeTab]}
            onPress={() => setSection(s)}
          >
            <Text style={[styles.tabText, section === s && styles.activeTabText]}>
              {s === "basic" ? "Info" : s === "medical" ? "Medical" : s === "status" ? "Status" : "History"}
            </Text>
            {s === "status" && hasPending && (
              <View style={styles.tabBadge} />
            )}
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {section === "basic" && (
          <View style={styles.card}>
            {isEditing ? (
              <>
                <EditField label="First Name" value={firstName} onChange={setFirstName} placeholder="First Name" />
                <EditField label="Last Name" value={lastName} onChange={setLastName} placeholder="Last Name" />
                <DatePicker
                  mode="single"
                  label="Date of Birth"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  placeholder="Select date of birth"
                  maxDate={new Date().toISOString().split("T")[0]}
                />
                <EditField label="Cabin / Group" value={cabinGroup} onChange={setCabinGroup} placeholder="Cabin name" />
              </>
            ) : (
              <>
                <InfoField label="First Name" value={camper.firstName} />
                <InfoField label="Last Name" value={camper.lastName} />
                <InfoField label="Date of Birth" value={formatDOBDisplay(camper.dateOfBirth)} />
                <InfoField label="Cabin / Group" value={camper.cabinGroup} />
              </>
            )}

            {canEdit && (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={({ pressed }) => [
                    styles.actionRow,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={handleProgramWristband}
                  disabled={isLoading}
                >
                  <View style={[styles.actionIcon, { backgroundColor: Colors.primary + "20" }]}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Ionicons name="radio" size={20} color={Colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>
                      {camper.wristbandId ? "Re-program Wristband" : "Program Wristband"}
                    </Text>
                    <Text style={styles.actionSub}>
                      {camper.wristbandId
                        ? `ID: ${camper.wristbandId}`
                        : "No wristband assigned yet"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionRow,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={handleCreateParentCode}
                >
                  <View style={[styles.actionIcon, { backgroundColor: "#8B5CF620" }]}>
                    <Ionicons name="key" size={20} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Generate Parent Code</Text>
                    <Text style={styles.actionSub}>Create code for parent registration</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                <View style={styles.divider} />
                {(() => {
                  const linkedParents = users.filter(
                    (u) => u.role === "parent" && Array.isArray(u.linkedCamperIds) && u.linkedCamperIds.includes(camper.id)
                  );
                  const unlinkParent = async (parentUser: User) => {
                    try {
                      await updateUser(parentUser.id, { linkedCamperIds: parentUser.linkedCamperIds.filter((cid) => cid !== camper.id) });
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (err: any) {
                      Alert.alert("Error", err.message || "Failed to unlink parent.");
                    }
                  };
                  const linkParent = async (parentUser: User) => {
                    try {
                      const existing = Array.isArray(parentUser.linkedCamperIds) ? parentUser.linkedCamperIds : [];
                      if (!existing.includes(camper.id)) {
                        await updateUser(parentUser.id, { linkedCamperIds: [...existing, camper.id] });
                      }
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setShowParentPicker(false);
                    } catch (err: any) {
                      Alert.alert("Error", err.message || "Failed to link parent.");
                    }
                  };
                  const availableParents = users.filter(
                    (u) => u.role === "parent" && !(Array.isArray(u.linkedCamperIds) && u.linkedCamperIds.includes(camper.id))
                  );
                  return (
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Linked Parent Accounts</Text>
                        <Pressable
                          onPress={() => setShowParentPicker((v) => !v)}
                          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                        >
                          <Ionicons name={showParentPicker ? "close-circle-outline" : "person-add-outline"} size={18} color={Colors.primary} />
                          <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: Colors.primary }}>
                            {showParentPicker ? "Cancel" : "Link Parent"}
                          </Text>
                        </Pressable>
                      </View>
                      {linkedParents.length === 0 && !showParentPicker && (
                        <Text style={[styles.infoValue, { fontSize: 13 }]}>No parent accounts linked yet</Text>
                      )}
                      {linkedParents.map((p) => (
                        <View key={p.id} style={[styles.actionRow, { paddingVertical: 10 }]}>
                          <View style={[styles.actionIcon, { backgroundColor: Colors.primary + "15" }]}>
                            <Ionicons name="person" size={18} color={Colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.actionTitle}>{p.name}</Text>
                            <Text style={styles.actionSub}>{p.email}</Text>
                          </View>
                          <Pressable
                            onPress={() => Alert.alert("Unlink Parent", `Remove ${p.name}'s access to ${camper.firstName}?`, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Unlink", style: "destructive", onPress: () => unlinkParent(p) },
                            ])}
                            hitSlop={8}
                          >
                            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                          </Pressable>
                        </View>
                      ))}
                      {showParentPicker && (
                        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, marginTop: 4 }]}>
                          {availableParents.length === 0 ? (
                            <Text style={[styles.infoValue, { textAlign: "center", paddingVertical: 8 }]}>No other parent accounts available</Text>
                          ) : (
                            availableParents.map((p) => (
                              <Pressable
                                key={p.id}
                                style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.8 : 1, paddingVertical: 10 }]}
                                onPress={() => linkParent(p)}
                              >
                                <View style={[styles.actionIcon, { backgroundColor: Colors.accent + "20" }]}>
                                  <Ionicons name="person-add" size={18} color={Colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.actionTitle}>{p.name}</Text>
                                  <Text style={styles.actionSub}>{p.email}</Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
                              </Pressable>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                })()}
              </>
            )}
          </View>
        )}

        {section === "medical" && (
          <View style={styles.card}>
            {isEditing ? (
              <>
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
                        <Text style={[styles.bloodTypeText, medical.bloodType === bt && styles.bloodTypeSelectedText]}>
                          {bt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {(medical.emergencyContacts?.length ? medical.emergencyContacts : [{ name: "", relationship: "", phone: "", email: "" }]).map((ec, i) => (
                  <View key={i} style={{ gap: 8 }}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        {i === 0 ? "Primary Contact" : `Contact ${i + 1}`}
                      </Text>
                      {i > 0 && (
                        <Pressable onPress={() => {
                          const updated = [...(medical.emergencyContacts || [])];
                          updated.splice(i, 1);
                          setMedical(prev => ({ ...prev, emergencyContacts: updated }));
                        }}>
                          <Ionicons name="close-circle" size={20} color={Colors.danger} />
                        </Pressable>
                      )}
                    </View>
                    <EditField label="Name" value={ec.name} onChange={(v: string) => {
                      const updated = [...(medical.emergencyContacts || [])];
                      updated[i] = { ...updated[i], name: v };
                      setMedical(prev => ({ ...prev, emergencyContacts: updated }));
                    }} placeholder="Contact name" />
                    <EditField label="Relationship" value={ec.relationship} onChange={(v: string) => {
                      const updated = [...(medical.emergencyContacts || [])];
                      updated[i] = { ...updated[i], relationship: v };
                      setMedical(prev => ({ ...prev, emergencyContacts: updated }));
                    }} placeholder="e.g. Parent, Guardian" />
                    <EditField label="Phone" value={ec.phone} onChange={(v: string) => {
                      const updated = [...(medical.emergencyContacts || [])];
                      updated[i] = { ...updated[i], phone: v };
                      setMedical(prev => ({ ...prev, emergencyContacts: updated }));
                    }} placeholder="(555) 000-0000" keyboardType="phone-pad" error={fieldErrors[`emergencyPhone_${i}`]} />
                    <EditField label="Email" value={ec.email} onChange={(v: string) => {
                      const updated = [...(medical.emergencyContacts || [])];
                      updated[i] = { ...updated[i], email: v };
                      setMedical(prev => ({ ...prev, emergencyContacts: updated }));
                    }} placeholder="email@example.com" keyboardType="email-address" />
                  </View>
                ))}
                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
                  onPress={() => setMedical(prev => ({
                    ...prev,
                    emergencyContacts: [...(prev.emergencyContacts || []), { name: "", relationship: "", phone: "", email: "" }],
                  }))}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_600SemiBold", color: Colors.primary }}>Add Another Contact</Text>
                </Pressable>
                <TagInput label="Allergies" values={Array.isArray(medical.allergies) ? medical.allergies : []} onChange={(v) => updateMedical("allergies", v)} placeholder="Type and press return to add" />
                <TagInput label="Medications" values={Array.isArray(medical.medications) ? medical.medications : []} onChange={(v) => updateMedical("medications", v)} placeholder="Type and press return to add" />
                <TagInput label="Medical Conditions" values={Array.isArray(medical.conditions) ? medical.conditions : []} onChange={(v) => updateMedical("conditions", v)} placeholder="Type and press return to add" />
                <EditField label="Doctor Name" value={medical.doctorName} onChange={(v: string) => updateMedical("doctorName", v)} placeholder="Doctor" />
                <EditField label="Doctor Phone" value={medical.doctorPhone} onChange={(v: string) => updateMedical("doctorPhone", v)} placeholder="Phone" keyboardType="phone-pad" error={fieldErrors.doctorPhone} />
                <EditField label="Insurance Provider" value={medical.insuranceProvider} onChange={(v: string) => updateMedical("insuranceProvider", v)} placeholder="Provider" />
                <EditField label="Notes" value={medical.notes} onChange={(v: string) => updateMedical("notes", v)} placeholder="Additional notes" multiline />
              </>
            ) : (
              <>
                <View style={styles.medicalHighlight}>
                  <Ionicons name="water" size={16} color={Colors.danger} />
                  <Text style={styles.medicalHighlightLabel}>Blood Type</Text>
                  <Text style={styles.medicalHighlightValue}>{medical.bloodType}</Text>
                </View>
                {(medical.emergencyContacts?.length ? medical.emergencyContacts : []).map((ec, i) => (
                  <View key={i} style={{ gap: 4 }}>
                    {i > 0 && <View style={styles.divider} />}
                    <InfoField label={i === 0 ? "Emergency Contact" : `Contact ${i + 1}`} value={ec.name} />
                    {ec.relationship ? <InfoField label="Relationship" value={ec.relationship} /> : null}
                    <InfoField label="Phone" value={ec.phone} />
                    {ec.email ? <InfoField label="Email" value={ec.email} /> : null}
                  </View>
                ))}
                {!medical.emergencyContacts?.length && (
                  <InfoField label="Emergency Contact" value="—" />
                )}
                <View style={styles.divider} />
                <InfoField label="Allergies" value={medical.allergies} />
                <InfoField label="Medications" value={medical.medications} />
                <InfoField label="Conditions" value={medical.conditions} />
                <View style={styles.divider} />
                <InfoField label="Doctor" value={medical.doctorName} />
                <InfoField label="Doctor Phone" value={medical.doctorPhone} />
                <InfoField label="Insurance" value={medical.insuranceProvider} />
                {medical.notes ? (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.infoLabel}>Notes</Text>
                    <Text style={styles.infoValue}>{medical.notes}</Text>
                  </>
                ) : null}
              </>
            )}
          </View>
        )}

        {section === "history" && (
          <>
            <Text style={styles.sectionTitle}>Attendance History</Text>
            <View style={styles.card}>
              {camperHistory.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                  <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
                  <Text style={[styles.infoLabel, { textAlign: "center" }]}>No attendance history yet</Text>
                  <Text style={[styles.infoValue, { textAlign: "center", fontSize: 13 }]}>Check-ins will appear here once recorded</Text>
                </View>
              ) : (
                camperHistory.map((ci, idx) => {
                  const session = sessions.find((s) => s.id === ci.sessionId);
                  return (
                    <View key={ci.id}>
                      <View style={styles.historyRow}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.historySessionName}>
                            {session?.name ?? "Unknown Session"}
                          </Text>
                          <Text style={styles.historyDate}>
                            {new Date(ci.checkedInAt).toLocaleDateString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                          <Text style={styles.historyTime}>
                            In: {new Date(ci.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {ci.checkedOutAt
                              ? ` · Out: ${new Date(ci.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              : ""}
                          </Text>
                          <Text style={styles.historyBy}>By {ci.checkedInByName}</Text>
                        </View>
                        <View style={[
                          styles.historyBadge,
                          { backgroundColor: ci.checkedOutAt ? colors.surfaceSecondary : Colors.success + "20" },
                        ]}>
                          <Text style={[
                            styles.historyBadgeText,
                            { color: ci.checkedOutAt ? colors.textSecondary : Colors.success },
                          ]}>
                            {ci.checkedOutAt ? "Complete" : "Active"}
                          </Text>
                        </View>
                      </View>
                      {idx < camperHistory.length - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {section === "status" && (
          <>
            {hasPending && (
              <View style={styles.pendingBanner}>
                <Ionicons name="warning" size={18} color={Colors.warning} />
                <Text style={styles.pendingText}>
                  Wristband data is outdated — needs reprogramming
                </Text>
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: activeCheckIn ? Colors.success : colors.textMuted }]} />
                <Text style={styles.statusLabel}>
                  {activeCheckIn ? "Currently Checked In" : "Not at Camp"}
                </Text>
              </View>
              {activeCheckIn && (
                <>
                  <InfoField
                    label="Checked In"
                    value={new Date(activeCheckIn.checkedInAt).toLocaleString()}
                  />
                  <InfoField label="Checked In By" value={activeCheckIn.checkedInByName} />
                </>
              )}
              {activeCheckIn ? (
                <Pressable
                  style={({ pressed }) => [styles.checkOutBtn, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => {
                    Alert.alert(
                      "Check Out",
                      `Check out ${camper.firstName} ${camper.lastName}?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Check Out",
                          onPress: async () => {
                            try {
                              await checkOutCamper(activeCheckIn.id);
                              if (camper.wristbandId) {
                                await updateCamper(camper.id, {
                                  wristbandId: null as any,
                                  wristbandEncryptedData: null as any,
                                  wristbandLastProgrammed: null as any,
                                });
                              }
                              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } catch (err: any) {
                              Alert.alert("Error", err.message);
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="log-out-outline" size={18} color="#fff" />
                  <Text style={styles.checkOutBtnText}>Check Out Now</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.checkInBtn, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => {
                    const todaySession = sessions.find((s) => {
                      const today = new Date().toISOString().split("T")[0];
                      return s.isActive && s.authorizedDates.includes(today);
                    });
                    const sessionId = todaySession?.id || "MANAGEMENT_OVERRIDE";
                    Alert.alert(
                      "Check In",
                      `Check in ${camper.firstName} ${camper.lastName}?${!todaySession ? "\n\nNo session is scheduled today. Management override will be used." : ""}`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Check In",
                          onPress: async () => {
                            try {
                              await checkInCamper(camper.id, sessionId);
                              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } catch (err: any) {
                              Alert.alert("Error", err.message);
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.checkInBtnText}>Check In Now</Text>
                </Pressable>
              )}
              <View style={styles.mgmtNote}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.accent} />
                <Text style={styles.mgmtNoteText}>Management can check in at any time</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Check-in History</Text>
            <View style={styles.card}>
              {camperHistory.length === 0 ? (
                <Text style={[styles.infoValue, { textAlign: "center", paddingVertical: 20 }]}>
                  No check-in history yet
                </Text>
              ) : (
                camperHistory.map((ci, idx) => (
                  <View key={ci.id}>
                    <View style={styles.historyRow}>
                      <View>
                        <Text style={styles.historyDate}>
                          {new Date(ci.checkedInAt).toLocaleDateString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                        <Text style={styles.historyTime}>
                          In: {new Date(ci.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {ci.checkedOutAt
                            ? ` · Out: ${new Date(ci.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.historyBadge,
                          { backgroundColor: ci.checkedOutAt ? colors.surfaceSecondary : Colors.success + "20" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyBadgeText,
                            { color: ci.checkedOutAt ? colors.textSecondary : Colors.success },
                          ]}
                        >
                          {ci.checkedOutAt ? "Complete" : "Active"}
                        </Text>
                      </View>
                    </View>
                    {idx < camperHistory.length - 1 && (
                      <View style={styles.divider} />
                    )}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {nfcScanVisible && nfcWritePayload && camper && (
        <NFCScanner
          visible={nfcScanVisible}
          mode="write"
          writePayload={nfcWritePayload}
          writeCamper={camper}
          onWriteSuccess={handleNFCWriteSuccess}
          onError={(msg) => {
            setNfcScanVisible(false);
            setNfcWritePayload(null);
            Alert.alert("NFC Error", msg);
          }}
          onCancel={() => {
            setNfcScanVisible(false);
            setNfcWritePayload(null);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    gap: 12,
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
  editButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 60,
    alignItems: "center",
  },
  editButtonText: {
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
    gap: 4,
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
  tabBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: colors.text,
    flex: 2,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  fieldGroup: { gap: 6 },
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 2,
    justifyContent: "flex-end",
  },
  chip: {
    backgroundColor: Colors.primary + "20",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.primary,
  },
  tagContainer: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "20",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    gap: 4,
  },
  tagInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: colors.text,
    paddingVertical: 2,
  },
  tagAddBtn: {
    padding: 2,
  },
  bloodTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bloodTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: colors.textSecondary,
  },
  bloodTypeSelectedText: { color: "#fff" },
  medicalHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.danger + "10",
    borderRadius: 12,
    padding: 12,
  },
  medicalHighlightLabel: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: colors.textSecondary,
    flex: 1,
  },
  medicalHighlightValue: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.danger,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  actionSub: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.warning + "20",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.warning + "40",
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.warning,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  checkInBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: 12,
    height: 48,
    marginTop: 4,
  },
  checkInBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
  checkOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.danger,
    borderRadius: 12,
    height: 48,
    marginTop: 4,
  },
  checkOutBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
  },
  mgmtNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  mgmtNoteText: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.accent,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  historySessionName: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  historyDate: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  historyTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
  },
  historyBy: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
  historyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyBadgeText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
});
