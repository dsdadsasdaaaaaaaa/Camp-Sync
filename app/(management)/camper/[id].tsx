import React, { useState, useEffect } from "react";
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
import Colors from "@/constants/colors";
import NFCScanner from "@/components/NFCScanner";
import type { Camper, MedicalInfo, WristbandPayload } from "@/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
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
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textMuted}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={keyboardType === "phone-pad" ? "none" : "words"}
      />
    </View>
  );
}

export default function CamperDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campers, checkIns, sessions, pendingUpdates, updateCamper, programWristband, createAuthCode, getActiveCheckIn, checkInCamper, checkOutCamper } = useData();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [section, setSection] = useState<"basic" | "medical" | "status">("basic");
  const [isEditing, setIsEditing] = useState(false);
  const [nfcScanVisible, setNfcScanVisible] = useState(false);
  const [nfcWritePayload, setNfcWritePayload] = useState<WristbandPayload | null>(null);

  const camper = campers.find((c) => c.id === id);
  const activeCheckIn = camper ? getActiveCheckIn(camper.id) : undefined;
  const hasPending = pendingUpdates.some((p) => p.camperId === id && !p.resolved);
  const canEdit = user?.role === "management";

  const [firstName, setFirstName] = useState(camper?.firstName || "");
  const [lastName, setLastName] = useState(camper?.lastName || "");
  const [dateOfBirth, setDateOfBirth] = useState(camper?.dateOfBirth || "");
  const [cabinGroup, setCabinGroup] = useState(camper?.cabinGroup || "");
  const [medical, setMedical] = useState<MedicalInfo>(
    camper?.medical || {
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

  const updateMedical = (key: keyof MedicalInfo, value: string) => {
    setMedical((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Info", "First and last name are required.");
      return;
    }
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
              const code = await createAuthCode("parent", camper.id);
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
      style={{ flex: 1, backgroundColor: Colors.light.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
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
              style={[styles.editButton, { backgroundColor: Colors.light.surfaceSecondary }]}
              onPress={() => setIsEditing(true)}
            >
              <Text style={[styles.editButtonText, { color: Colors.light.text }]}>Edit</Text>
            </Pressable>
          )
        )}
      </View>

      <View style={styles.tabs}>
        {(["basic", "medical", "status"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.tab, section === s && styles.activeTab]}
            onPress={() => setSection(s)}
          >
            <Text style={[styles.tabText, section === s && styles.activeTabText]}>
              {s === "basic" ? "Info" : s === "medical" ? "Medical" : "Status"}
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
                <EditField label="Date of Birth" value={dateOfBirth} onChange={setDateOfBirth} placeholder="MM/DD/YYYY" />
                <EditField label="Cabin / Group" value={cabinGroup} onChange={setCabinGroup} placeholder="Cabin name" />
              </>
            ) : (
              <>
                <InfoField label="First Name" value={camper.firstName} />
                <InfoField label="Last Name" value={camper.lastName} />
                <InfoField label="Date of Birth" value={camper.dateOfBirth} />
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
                  <Ionicons name="chevron-forward" size={18} color={Colors.light.textMuted} />
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
                  <Ionicons name="chevron-forward" size={18} color={Colors.light.textMuted} />
                </Pressable>
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
                <EditField label="Emergency Contact" value={medical.emergencyContact} onChange={(v: string) => updateMedical("emergencyContact", v)} placeholder="Name" />
                <EditField label="Emergency Phone" value={medical.emergencyPhone} onChange={(v: string) => updateMedical("emergencyPhone", v)} placeholder="Phone" keyboardType="phone-pad" />
                <EditField label="Allergies" value={medical.allergies} onChange={(v: string) => updateMedical("allergies", v)} placeholder="Allergies" multiline />
                <EditField label="Medications" value={medical.medications} onChange={(v: string) => updateMedical("medications", v)} placeholder="Medications" multiline />
                <EditField label="Medical Conditions" value={medical.conditions} onChange={(v: string) => updateMedical("conditions", v)} placeholder="Conditions" multiline />
                <EditField label="Doctor Name" value={medical.doctorName} onChange={(v: string) => updateMedical("doctorName", v)} placeholder="Doctor" />
                <EditField label="Doctor Phone" value={medical.doctorPhone} onChange={(v: string) => updateMedical("doctorPhone", v)} placeholder="Phone" keyboardType="phone-pad" />
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
                <InfoField label="Emergency Contact" value={medical.emergencyContact} />
                <InfoField label="Emergency Phone" value={medical.emergencyPhone} />
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
                <View style={[styles.statusDot, { backgroundColor: activeCheckIn ? Colors.success : Colors.light.textMuted }]} />
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
                  <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
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
                          { backgroundColor: ci.checkedOutAt ? Colors.light.surfaceSecondary : Colors.success + "20" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyBadgeText,
                            { color: ci.checkedOutAt ? Colors.light.textSecondary : Colors.success },
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

      {nfcScanVisible && nfcWritePayload && (
        <NFCScanner
          mode="write"
          writePayload={nfcWritePayload}
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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
    gap: 12,
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
    gap: 4,
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
    backgroundColor: Colors.light.surface,
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
    color: Colors.light.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.text,
    flex: 2,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 2,
  },
  fieldGroup: { gap: 6 },
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
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
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
    color: Colors.light.textSecondary,
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
    color: Colors.light.text,
  },
  actionSub: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
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
    color: Colors.light.text,
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
    color: Colors.light.text,
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
    backgroundColor: Colors.danger + "12",
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.danger + "30",
    marginTop: 4,
  },
  checkOutBtnText: {
    color: Colors.danger,
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
  historyDate: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  historyTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
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
