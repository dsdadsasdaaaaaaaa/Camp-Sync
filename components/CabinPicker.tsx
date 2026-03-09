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
    }
  }, [open]);

  const filtered = useMemo(
    () => cabins.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [cabins, search]
  );

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.field, { opacity: pressed ? 0.8 : 1 }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.fieldText, !value && { color: colors.textMuted }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Cabin</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={[styles.searchRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search cabins..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>

            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                style={styles.list}
                ListHeaderComponent={
                  <Pressable
                    style={[styles.optionRow, !value && styles.optionRowSelected]}
                    onPress={() => select("")}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                    <Text style={[styles.optionText, { color: colors.textSecondary }]}>None (unassigned)</Text>
                    {!value && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </Pressable>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.optionRow, value === item.name && styles.optionRowSelected]}
                    onPress={() => select(item.name)}
                  >
                    <Ionicons name="home-outline" size={18} color={Colors.primary} />
                    <Text style={[styles.optionText, { color: colors.text }]}>{item.name}</Text>
                    {value === item.name && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: colors.textMuted }]}>
                    {search ? "No cabins match your search" : "No cabins created yet"}
                  </Text>
                }
              />
            )}
          </View>
        </View>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  list: { paddingHorizontal: 20 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionRowSelected: {
    backgroundColor: Colors.primary + "10",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
  },
  empty: {
    textAlign: "center",
    paddingVertical: 32,
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
  },
});
