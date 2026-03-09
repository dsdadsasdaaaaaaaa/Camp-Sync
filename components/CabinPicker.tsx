import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "@/lib/query-client";
import { useColors } from "@/hooks/useColors";
import Colors from "@/constants/colors";

interface CabinOption {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  placeholder?: string;
}

export default function CabinPicker({ value, onChange, label = "Cabin / Group", placeholder = "Select a cabin" }: Props) {
  const colors = useColors();
  const styles = getStyles(colors);
  const [open, setOpen] = useState(false);
  const [cabins, setCabins] = useState<CabinOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchCabins = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/cabins");
      const data = await res.json();
      setCabins(Array.isArray(data) ? data : []);
    } catch {
      setCabins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCabins();
      setSearch("");
    } else {
      Keyboard.dismiss();
    }
  }, [open]);

  const filtered = useMemo(
    () => cabins.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [cabins, search]
  );

  const select = (name: string) => {
    Keyboard.dismiss();
    onChange(name);
    setOpen(false);
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.field, { opacity: pressed ? 0.8 : 1 }]}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
      >
        <Text style={[styles.fieldText, !value && { color: colors.textMuted }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "position" : "height"}
            keyboardVerticalOffset={0}
          >
            <Pressable
              style={[styles.sheet, { backgroundColor: colors.surface }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Cabin</Text>
                <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={[styles.searchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search cabins..."
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
              </View>

              {loading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  ListHeaderComponent={
                    <Pressable
                      style={[styles.optionRow, !value && styles.optionRowSelected]}
                      onPress={() => select("")}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: colors.background }]}>
                        <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                      </View>
                      <Text style={[styles.optionText, { color: colors.textSecondary }]}>None (unassigned)</Text>
                      {!value && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                    </Pressable>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.optionRow, value === item.name && styles.optionRowSelected]}
                      onPress={() => select(item.name)}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: Colors.primary + "15" }]}>
                        <Ionicons name="home-outline" size={18} color={Colors.primary} />
                      </View>
                      <Text style={[styles.optionText, { color: colors.text }]}>{item.name}</Text>
                      {value === item.name && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name="home-outline" size={32} color={colors.textMuted} />
                      <Text style={[styles.empty, { color: colors.textMuted }]}>
                        {search ? "No cabins match your search" : "No cabins created yet"}
                      </Text>
                    </View>
                  }
                  contentContainerStyle={{ paddingBottom: 20 }}
                />
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  group: { gap: 6 },
  label: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: colors.text,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldText: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: colors.text,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    minHeight: 300,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  list: { paddingHorizontal: 16 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginVertical: 2,
  },
  optionRowSelected: {
    backgroundColor: Colors.primary + "12",
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  empty: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
  },
});
