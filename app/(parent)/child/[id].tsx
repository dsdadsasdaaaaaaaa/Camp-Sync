import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "@/contexts/DataContext";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

function InfoRow({ label, value }: { label: string; value: string | string[] }) {
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

export default function ParentChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campers, checkIns, pendingUpdates, getActiveCheckIn } = useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);
  const [section, setSection] = useState<"info" | "medical" | "history">("info");

  const camper = campers.find((c) => c.id === id);
  const activeCheckIn = camper ? getActiveCheckIn(camper.id) : undefined;
  const hasPending = pendingUpdates.some((p) => p.camperId === id && !p.resolved);

  if (!camper) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Outfit_400Regular", color: colors.textSecondary }}>
          Child not found
        </Text>
      </View>
    );
  }

  const medical = camper.medical;

  const camperHistory = checkIns
    .filter((ci) => ci.camperId === camper.id)
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          <Text style={styles.headerTitle}>{camper.firstName} {camper.lastName}</Text>
          <View style={[
            styles.statusPill,
            { backgroundColor: activeCheckIn ? Colors.success + "20" : colors.surfaceSecondary }
          ]}>
            <View style={[styles.statusDot, { backgroundColor: activeCheckIn ? Colors.success : colors.textMuted }]} />
            <Text style={[styles.statusText, { color: activeCheckIn ? Colors.success : colors.textSecondary }]}>
              {activeCheckIn ? "At Camp" : "Not Present"}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {hasPending && (
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
            <View style={styles.bloodHighlight}>
              <Ionicons name="water" size={18} color={Colors.danger} />
              <Text style={styles.bloodLabel}>Blood Type</Text>
              <Text style={styles.bloodValue}>{medical.bloodType}</Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={[styles.infoLabel, { marginBottom: 4 }]}>Emergency Contacts</Text>
              {(medical.emergencyContacts?.length ? medical.emergencyContacts : []).map((ec, i) => (
                <View key={i} style={[styles.contactCard, i > 0 && { marginTop: 8 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="person" size={14} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{ec.name || "—"}</Text>
                      {ec.relationship ? (
                        <Text style={styles.contactDetail}>{ec.relationship}</Text>
                      ) : null}
                    </View>
                  </View>
                  {ec.phone ? (
                    <View style={styles.contactDetailRow}>
                      <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.contactDetail}>{ec.phone}</Text>
                    </View>
                  ) : null}
                  {ec.email ? (
                    <View style={styles.contactDetailRow}>
                      <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.contactDetail}>{ec.email}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
              {!medical.emergencyContacts?.length && (
                <Text style={styles.infoValue}>—</Text>
              )}
            </View>

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
                      { backgroundColor: ci.checkedOutAt ? colors.surfaceSecondary : Colors.success + "20" }
                    ]}>
                      <Ionicons
                        name={ci.checkedOutAt ? "checkmark-done" : "enter"}
                        size={16}
                        color={ci.checkedOutAt ? colors.textSecondary : Colors.success}
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
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    gap: 10,
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
    fontSize: 17,
    fontFamily: "Outfit_700Bold",
    color: colors.text,
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
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    color: colors.textSecondary,
    flex: 1,
  },
  bloodValue: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: Colors.danger,
  },
  contactCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  contactName: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  contactDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactDetail: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
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
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  historyDate: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  historyTime: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyStaff: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: colors.textMuted,
    marginTop: 2,
  },
});
