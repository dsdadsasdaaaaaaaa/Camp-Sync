import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useData } from "@/contexts/DataContext";
import { useColors } from "@/hooks/useColors";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";
import type { Camper } from "@/types";

// ─── Shared Types ─────────────────────────────────────────────────────────────

interface CabinRecord {
  id: string;
  name: string;
  createdAt: string;
}

// ─── Camper Card ─────────────────────────────────────────────────────────────

function CamperCard({
  camper,
  isCheckedIn,
  hasPendingUpdate,
  onPress,
  onDelete,
}: {
  camper: Camper;
  isCheckedIn: boolean;
  hasPendingUpdate: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  return (
    <View style={[styles.camperCard, { backgroundColor: colors.surface }]}>
      <Pressable
        style={({ pressed }) => [styles.camperCardContent, { opacity: pressed ? 0.85 : 1 }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${camper.firstName} ${camper.lastName}`}
        testID={`camper-card-${camper.id}`}
      >
        <View style={[styles.camperAvatar, { backgroundColor: Colors.primary + "20" }]}>
          {camper.photoData ? (
            <Image source={{ uri: camper.photoData }} style={styles.camperAvatarImg} />
          ) : (
            <Text style={[styles.camperInitial, { color: Colors.primary }]}>
              {camper.firstName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.camperNameRow}>
            <Text style={[styles.camperName, { color: colors.text }]}>
              {camper.firstName} {camper.lastName}
            </Text>
            {hasPendingUpdate && <Ionicons name="warning" size={14} color={Colors.warning} />}
          </View>
          <Text style={[styles.camperCabin, { color: colors.textSecondary }]}>
            {camper.cabinGroup || "No cabin assigned"}
          </Text>
          <View style={styles.camperTags}>
            <View style={[styles.tag, { backgroundColor: isCheckedIn ? Colors.success + "20" : colors.surfaceSecondary }]}>
              <View style={[styles.tagDot, { backgroundColor: isCheckedIn ? Colors.success : colors.textMuted }]} />
              <Text style={[styles.tagText, { color: isCheckedIn ? Colors.success : colors.textSecondary }]}>
                {isCheckedIn ? "Checked In" : "Not Present"}
              </Text>
            </View>
            {camper.wristbandId && (
              <View style={[styles.tag, { backgroundColor: Colors.primary + "15" }]}>
                <Ionicons name="radio" size={10} color={Colors.primary} />
                <Text style={[styles.tagText, { color: Colors.primary }]}>{camper.wristbandId}</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${camper.firstName} ${camper.lastName}`}
        hitSlop={4}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
      </Pressable>
    </View>
  );
}

// ─── Cabin Card ───────────────────────────────────────────────────────────────

function CabinCard({
  cabin,
  totalCampers,
  checkedInCount,
  onDelete,
}: {
  cabin: CabinRecord;
  totalCampers: number;
  checkedInCount: number;
  onDelete: () => void;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  const progress = totalCampers > 0 ? checkedInCount / totalCampers : 0;

  return (
    <View style={[styles.cabinCard, { backgroundColor: colors.surface }]}>
      <Pressable
        style={({ pressed }) => [styles.cabinCardContent, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push(`/(management)/cabin/${encodeURIComponent(cabin.name)}`)}
      >
        <View style={[styles.cabinIconWrap, { backgroundColor: Colors.primary + "15" }]}>
          <Ionicons name="home" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cabinName, { color: colors.text }]}>{cabin.name}</Text>
          <Text style={[styles.cabinStat, { color: colors.textSecondary }]}>
            {checkedInCount} / {totalCampers} checked in
          </Text>
          <View style={[styles.progressBg, { backgroundColor: colors.surfaceSecondary }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%` as any,
                  backgroundColor: progress === 1 ? Colors.success : Colors.primary,
                },
              ]}
            />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.7 : 1 }]}
        hitSlop={4}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
      </Pressable>
    </View>
  );
}

// ─── Create Cabin Modal ───────────────────────────────────────────────────────

function CreateCabinModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const colors = useColors();
  const styles = getStyles(colors);
  const { campers, updateCamper } = useData();
  const [cabinName, setCabinName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () =>
      campers.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
      ),
    [campers, search]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!cabinName.trim()) {
      Alert.alert("Name Required", "Please enter a cabin name.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/cabins", { name: cabinName.trim() });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert("Error", err.message || "Failed to create cabin.");
        return;
      }
      for (const id of selectedIds) {
        const camper = campers.find((c) => c.id === id);
        if (camper) await updateCamper({ ...camper, cabinGroup: cabinName.trim() });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCabinName("");
      setSearch("");
      setSelectedIds([]);
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create cabin.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCabinName("");
    setSearch("");
    setSelectedIds([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Cabin</Text>
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View style={styles.modalSection}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Cabin Name</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                value={cabinName}
                onChangeText={setCabinName}
                placeholder="e.g. Cabin A, Blue Jay, Pines..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.modalSection}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                Assign Campers{selectedIds.length > 0 ? ` (${selectedIds.length} selected)` : " (optional)"}
              </Text>
              <View style={[styles.searchRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInputSm, { color: colors.text }]}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search campers..."
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {filtered.map((camper) => (
                <Pressable
                  key={camper.id}
                  style={[styles.camperRow, selectedIds.includes(camper.id) && { backgroundColor: Colors.primary + "10" }]}
                  onPress={() => toggle(camper.id)}
                >
                  <View style={[styles.checkboxOuter, selectedIds.includes(camper.id) && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                    {selectedIds.includes(camper.id) && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <View style={[styles.miniAvatar, { backgroundColor: Colors.primary + "20" }]}>
                    <Text style={[styles.miniInitial, { color: Colors.primary }]}>
                      {camper.firstName.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.camperRowName, { color: colors.text }]}>
                      {camper.firstName} {camper.lastName}
                    </Text>
                    {camper.cabinGroup ? (
                      <Text style={[styles.camperRowSub, { color: colors.textSecondary }]}>
                        Currently: {camper.cabinGroup}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
              {filtered.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No campers found</Text>
              )}
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <Pressable style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]} onPress={handleClose}>
              <Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.btnText, { color: "#fff" }]}>Create Cabin</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CampersAndCabinsScreen() {
  const { campers, checkIns, pendingUpdates, deleteCamper, isLoading, refresh } = useData();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = getStyles(colors);

  const [activeTab, setActiveTab] = useState<"campers" | "cabins">("campers");
  const [search, setSearch] = useState("");
  const [cabins, setCabins] = useState<CabinRecord[]>([]);
  const [cabinsLoading, setCabinsLoading] = useState(false);
  const [showCreateCabin, setShowCreateCabin] = useState(false);

  const fetchCabins = useCallback(async () => {
    setCabinsLoading(true);
    try {
      const res = await apiRequest("GET", "/api/cabins");
      const data = await res.json();
      setCabins(Array.isArray(data) ? data : []);
    } catch {
      setCabins([]);
    } finally {
      setCabinsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "cabins") fetchCabins();
  }, [activeTab, fetchCabins]);

  const filteredCampers = useMemo(
    () =>
      campers.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          (c.cabinGroup?.toLowerCase() || "").includes(search.toLowerCase())
      ),
    [campers, search]
  );

  const cabinStats = useMemo(() => {
    const map: Record<string, { total: number; checkedIn: number }> = {};
    campers.forEach((c) => {
      const n = c.cabinGroup?.trim();
      if (!n) return;
      if (!map[n]) map[n] = { total: 0, checkedIn: 0 };
      map[n].total++;
      if (checkIns.some((ci) => ci.camperId === c.id && !ci.checkedOutAt)) map[n].checkedIn++;
    });
    return map;
  }, [campers, checkIns]);

  const filteredCabins = useMemo(
    () => cabins.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [cabins, search]
  );

  const getActiveCheckIn = (camperId: string) =>
    checkIns.find((ci) => ci.camperId === camperId && !ci.checkedOutAt);

  const hasPendingUpdate = (camperId: string) =>
    pendingUpdates.some((p) => p.camperId === camperId && !p.resolved);

  const handleDeleteCamper = useCallback(
    (camper: Camper) => {
      Alert.alert(
        "Delete Camper",
        `Remove ${camper.firstName} ${camper.lastName} from the system? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await deleteCamper(camper.id);
            },
          },
        ]
      );
    },
    [deleteCamper]
  );

  const handleDeleteCabin = (cabin: CabinRecord) => {
    Alert.alert(
      "Delete Cabin",
      `Delete "${cabin.name}"? Campers assigned to this cabin will remain but lose their cabin assignment.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await apiRequest("DELETE", `/api/cabins/${cabin.id}`);
            fetchCabins();
          },
        },
      ]
    );
  };

  const paddingTop = Platform.OS === "web" ? insets.top + 67 : insets.top + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {activeTab === "campers" ? "Campers" : "Cabins"}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              {activeTab === "campers"
                ? `${campers.length} registered`
                : `${cabins.length} cabin${cabins.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          {activeTab === "campers" ? (
            <Pressable
              style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.push("/(management)/camper/new")}
            >
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.addButton, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => setShowCreateCabin(true)}
            >
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.addButtonText}>New</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.tabBar, { backgroundColor: colors.surfaceSecondary }]}>
          <Pressable
            style={[styles.tabItem, activeTab === "campers" && [styles.tabItemActive, { backgroundColor: colors.surface }]]}
            onPress={() => { setActiveTab("campers"); setSearch(""); }}
          >
            <Ionicons
              name={activeTab === "campers" ? "people" : "people-outline"}
              size={16}
              color={activeTab === "campers" ? Colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === "campers" && styles.tabItemTextActive]}>
              Campers
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabItem, activeTab === "cabins" && [styles.tabItemActive, { backgroundColor: colors.surface }]]}
            onPress={() => { setActiveTab("cabins"); setSearch(""); }}
          >
            <Ionicons
              name={activeTab === "cabins" ? "home" : "home-outline"}
              size={16}
              color={activeTab === "cabins" ? Colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabItemText, activeTab === "cabins" && styles.tabItemTextActive]}>
              Cabins
            </Text>
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={activeTab === "campers" ? "Search campers..." : "Search cabins..."}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {activeTab === "campers" ? (
        <FlatList
          data={filteredCampers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          scrollEnabled={!!filteredCampers.length}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <CamperCard
              camper={item}
              isCheckedIn={!!getActiveCheckIn(item.id)}
              hasPendingUpdate={hasPendingUpdate(item.id)}
              onPress={() => router.push(`/(management)/camper/${item.id}`)}
              onDelete={() => handleDeleteCamper(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {search ? "No campers found" : "No campers yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {search ? "Try a different search" : "Add campers using the button above"}
              </Text>
            </View>
          }
        />
      ) : cabinsLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredCabins}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={cabinsLoading} onRefresh={fetchCabins} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <CabinCard
              cabin={item}
              totalCampers={cabinStats[item.name]?.total ?? 0}
              checkedInCount={cabinStats[item.name]?.checkedIn ?? 0}
              onDelete={() => handleDeleteCabin(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="home-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {search ? "No cabins found" : "No cabins yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {search ? "Try a different search" : 'Tap "New" to create your first cabin'}
              </Text>
            </View>
          }
        />
      )}

      <CreateCabinModal
        visible={showCreateCabin}
        onClose={() => setShowCreateCabin(false)}
        onCreated={fetchCabins}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    headerTitle: { fontSize: 28, fontFamily: "Outfit_700Bold" },
    headerSub: { fontSize: 14, fontFamily: "Outfit_400Regular", marginTop: 2 },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: Colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
    },
    addButtonText: { color: "#fff", fontSize: 14, fontFamily: "Outfit_600SemiBold" },
    tabBar: {
      flexDirection: "row",
      borderRadius: 12,
      padding: 4,
    },
    tabItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
    },
    tabItemActive: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    tabItemText: { fontSize: 14, fontFamily: "Outfit_500Medium", color: colors.textMuted },
    tabItemTextActive: { color: Colors.primary, fontFamily: "Outfit_600SemiBold" },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 46,
      borderWidth: 1,
    },
    searchInput: { flex: 1, fontFamily: "Outfit_400Regular", fontSize: 15 },
    list: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
    camperCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      paddingRight: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
      marginBottom: 8,
    },
    camperCardContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 12,
      borderRadius: 16,
    },
    camperAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    camperAvatarImg: { width: 48, height: 48, borderRadius: 24 },
    camperInitial: { fontSize: 20, fontFamily: "Outfit_700Bold" },
    camperNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    camperName: { fontSize: 16, fontFamily: "Outfit_600SemiBold" },
    camperCabin: { fontSize: 13, fontFamily: "Outfit_400Regular", marginTop: 2 },
    camperTags: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
    tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    tagDot: { width: 6, height: 6, borderRadius: 3 },
    tagText: { fontSize: 11, fontFamily: "Outfit_600SemiBold" },
    deleteButton: { padding: 10, borderRadius: 10 },
    cabinCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      paddingRight: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
      marginBottom: 8,
    },
    cabinCardContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 12,
      borderRadius: 16,
    },
    cabinIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    cabinName: { fontSize: 16, fontFamily: "Outfit_600SemiBold" },
    cabinStat: { fontSize: 13, fontFamily: "Outfit_400Regular", marginTop: 2, marginBottom: 8 },
    progressBg: { height: 6, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 3 },
    empty: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 18, fontFamily: "Outfit_600SemiBold" },
    emptyText: { fontSize: 14, fontFamily: "Outfit_400Regular", textAlign: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", flex: 1 },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    modalTitle: { fontSize: 20, fontFamily: "Outfit_700Bold" },
    modalSection: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
    fieldLabel: { fontSize: 13, fontFamily: "Outfit_600SemiBold" },
    textInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Outfit_400Regular",
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      gap: 8,
    },
    searchInputSm: { flex: 1, fontSize: 14, fontFamily: "Outfit_400Regular" },
    camperRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderRadius: 10,
      paddingHorizontal: 6,
    },
    checkboxOuter: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    miniAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    miniInitial: { fontSize: 16, fontFamily: "Outfit_700Bold" },
    camperRowName: { fontSize: 14, fontFamily: "Outfit_600SemiBold" },
    camperRowSub: { fontSize: 12, fontFamily: "Outfit_400Regular", marginTop: 1 },
    modalFooter: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
    },
    btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    btnPrimary: { backgroundColor: Colors.primary },
    btnSecondary: { borderWidth: 1 },
    btnText: { fontSize: 15, fontFamily: "Outfit_600SemiBold" },
  });
