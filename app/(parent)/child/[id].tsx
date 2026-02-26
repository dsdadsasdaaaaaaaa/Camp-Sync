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
import type { MedicalInfo } from "@/types";

export default function ParentChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campers, checkIns, pendingUpdates, updateCamper, getActiveCheckIn } = useData();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [section, setSection] = useState<"info" | "medical" | "history">("info");

  const camper = campers.find((c) => c.id === id);
  const activeCheckIn = camper ? getActiveCheckIn(camper.id) : undefined;
  const hasPending = pendingUpdates.some((p) => p.camperId === id && !p.resolved);

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
    if (camper) setMedical(camper.medical);
  }, [camper]);

  if (!camper) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Outfit_400Regular", color: Colors.light.textSecondary }}>
          Child not found
        </Text>
      </View>
    );
  }

  const camperHistory = checkIns
    .filter((ci) => ci.camperId === camper.id)
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());

  const updateMedical = (key: keyof MedicalInfo, value: string) =>
    setMedical((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!medical.emergencyContact.trim() || !medical.emergencyPhone.trim()) {
      Alert.alert("Required", "Emergency contact information is required.");
      return;
    }
    setIsSaving(true);
    try {
      await updateCamper(camper.id, { medical });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (activeCheckIn) {
        Alert.alert(
          "Info Updated",
          `${camper.firstName}'s information has been updated. Since they are currently checked in, a wristband update request has been sent to camp management.`
        );
      }
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const EditField = ({ label, value, onChange, placeholder, keyboardType, multiline }: any) => (
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

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );

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
          <Text style={styles.headerTitle}>{camper.firstName} {camper.lastName}</Text>
          <View style={[
            styles.statusPill,
            { backgroundColor: activeCheckIn ? Colors.success + "20" : Colors.light.surfaceSecondary }
          ]}>
            <View style={[styles.statusDot, { backgroundColor: activeCheckIn ? Colors.success : Colors.light.textMuted }]} />
            <Text style={[styles.statusText, { color: activeCheckIn ? Colors.success : Colors.light.textSecondary }]}>
              {activeCheckIn ? "At Camp" : "Not Present"}
            </Text>
          </View>
        </View>
        {isEditing ? (
          <Pressable
            style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.saveBtn, { backgroundColor: Colors.light.surfaceSecondary }]}
            onPress={() => setIsEditing(true)}
          >
            <Text style={[styles.saveBtnText, { color: Colors.light.text }]}>Edit</Text>
          </Pressable>
        )}
      </View>

      {hasPending && !isEditing && (
        <View style={styles.pendingBanner}>
          <Ionicons name="warning" size={16} color={Colors.warning} />
          <Text style={styles.pendingText}>
            Wristband update pending — management will reprogram at next opportunity
          </Text>
        </View>
      )}

      <View style={styles.tabs}>
        {(["info", "medical", "history"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.tab, section === s && styles.activeTab]}
            onPress={() => setSection(s)}
          >
            <Text style={[styles.tabText, section === s && styles.activeTabText]}>
              {s === "info" ? "Info" : s === "medical" ? "Medical" : "History"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {section === "info" && (
          <View style={styles.card}>
            <InfoRow label="First Name" value={camper.firstName} />
            <InfoRow label="Last Name" value={camper.lastName} />
            <InfoRow label="Date of Birth" value={camper.dateOfBirth} />
            <InfoRow label="Cabin / Group" value={camper.cabinGroup} />
            <View style={styles.divider} />
            <InfoRow label="Wristband ID" value={camper.wristbandId || "Not programmed"} />
            {camper.wristbandLastProgrammed && (
              <InfoRow
                label="Last Programmed"
                value={new Date(camper.wristbandLastProgrammed).toLocaleDateString()}
              />
            )}
          </View>
        )}

        {section === "medical" && (
          <View style={styles.card}>
            {isEditing ? (
              <>
                <EditField label="Emergency Contact Name" value={medical.emergencyContact} onChange={(v: string) => updateMedical("emergencyContact", v)} placeholder="Name" />
                <EditField label="Emergency Phone" value={medical.emergencyPhone} onChange={(v: string) => updateMedical("emergencyPhone", v)} placeholder="Phone" keyboardType="phone-pad" />
                <View style={styles.divider} />
                <EditField label="Allergies" value={medical.allergies} onChange={(v: string) => updateMedical("allergies", v)} placeholder="Allergies (or None)" multiline />
                <EditField label="Medications" value={medical.medications} onChange={(v: string) => updateMedical("medications", v)} placeholder="Medications (or None)" multiline />
                <EditField label="Medical Conditions" value={medical.conditions} onChange={(v: string) => updateMedical("conditions", v)} placeholder="Conditions (or None)" multiline />
                <View style={styles.divider} />
                <EditField label="Doctor Name" value={medical.doctorName} onChange={(v: string) => updateMedical("doctorName", v)} placeholder="Doctor name" />
                <EditField label="Doctor Phone" value={medical.doctorPhone} onChange={(v: string) => updateMedical("doctorPhone", v)} placeholder="Phone" keyboardType="phone-pad" />
                <EditField label="Insurance Provider" value={medical.insuranceProvider} onChange={(v: string) => updateMedical("insuranceProvider", v)} placeholder="Provider" />
                <EditField label="Additional Notes" value={medical.notes} onChange={(v: string) => updateMedical("notes", v)} placeholder="Any other notes" multiline />
              </>
            ) : (
              <>
                <View style={styles.bloodHighlight}>
                  <Ionicons name="water" size={18} color={Colors.danger} />
                  <Text style={styles.bloodLabel}>Blood Type</Text>
                  <Text style={styles.bloodValue}>{medical.bloodType}</Text>
                </View>
                <InfoRow label="Emergency Contact" value={medical.emergencyContact} />
                <InfoRow label="Emergency Phone" value={medical.emergencyPhone} />
                <View style={styles.divider} />
                <InfoRow label="Allergies" value={medical.allergies} />
                <InfoRow label="Medications" value={medical.medications} />
                <InfoRow label="Conditions" value={medical.conditions} />
                <View style={styles.divider} />
                <InfoRow label="Doctor" value={medical.doctorName} />
                <InfoRow label="Doctor Phone" value={medical.doctorPhone} />
                <InfoRow label="Insurance" value={medical.insuranceProvider} />
                {medical.notes && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.infoLabel}>Notes</Text>
                    <Text style={[styles.infoValue, { textAlign: "left" }]}>{medical.notes}</Text>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {section === "history" && (
          <View style={styles.card}>
            {camperHistory.length === 0 ? (
              <Text style={[styles.infoValue, { textAlign: "center", paddingVertical: 24 }]}>
                No check-in history yet
              </Text>
            ) : (
              camperHistory.map((ci, idx) => (
                <View key={ci.id}>
                  <View style={styles.historyRow}>
                    <View style={[
                      styles.historyIcon,
                      { backgroundColor: ci.checkedOutAt ? Colors.light.surfaceSecondary : Colors.success + "20" }
                    ]}>
                      <Ionicons
                        name={ci.checkedOutAt ? "checkmark-done" : "enter"}
                        size={16}
                        color={ci.checkedOutAt ? Colors.light.textSecondary : Colors.success}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyDate}>
                        {new Date(ci.checkedInAt).toLocaleDateString([], {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </Text>
                      <Text style={styles.historyTime}>
                        In: {new Date(ci.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {ci.checkedOutAt
                          ? ` • Out: ${new Date(ci.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : " • Still at camp"}
                      </Text>
                      <Text style={styles.historyStaff}>
                        Checked in by {ci.checkedInByName}
                        {ci.checkedOutByName ? ` • Out by ${ci.checkedOutByName}` : ""}
                      </Text>
                    </View>
                  </View>
                  {idx < camperHistory.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            )}
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.light.background,
    gap: 10,
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
    fontSize: 17,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: Colors.warning + "15",
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.warning + "30",
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    color: Colors.warning,
    lineHeight: 18,
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
    alignItems: "center",
    justifyContent: "center",
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
  },
  bloodHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.danger + "10",
    borderRadius: 12,
    padding: 12,
  },
  bloodLabel: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textSecondary,
    flex: 1,
  },
  bloodValue: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.danger,
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
  historyRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  historyDate: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  historyTime: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  historyStaff: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.textMuted,
    marginTop: 2,
  },
});
