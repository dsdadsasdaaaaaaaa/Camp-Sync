import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Platform,
  StyleSheet,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

interface Props {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

export default function BirthdayPickerField({
  value,
  onChange,
  label = "Date of Birth",
  placeholder = "Select date of birth",
}: Props) {
  const colors = useColors();
  const [showPicker, setShowPicker] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  const parsedDate = value
    ? (() => {
        const [y, m, d] = value.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        return isNaN(date.getTime()) ? new Date(2010, 0, 1) : date;
      })()
    : new Date(2010, 0, 1);

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
        <input
          type="date"
          value={value}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            height: 46,
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceSecondary,
            paddingLeft: 14,
            paddingRight: 14,
            fontFamily: "Outfit_400Regular, sans-serif",
            fontSize: 15,
            color: colors.text,
            outline: "none",
            boxSizing: "border-box" as const,
          }}
        />
      </View>
    );
  }

  if (Platform.OS === "android") {
    return (
      <View style={styles.container}>
        {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
        <Pressable
          style={[styles.trigger, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          onPress={() => setShowPicker(true)}
        >
          <Text
            style={[
              styles.triggerText,
              { color: value ? colors.text : colors.textMuted },
            ]}
          >
            {value ? formatDateDisplay(value) : placeholder}
          </Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </Pressable>
        {showPicker && (
          <DateTimePicker
            value={parsedDate}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowPicker(false);
              if (selected) onChange(toDateString(selected));
            }}
          />
        )}
      </View>
    );
  }

  const displayDate = pendingDate ?? parsedDate;

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
      <Pressable
        style={[styles.trigger, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        onPress={() => {
          setPendingDate(parsedDate);
          setShowPicker(true);
        }}
      >
        <Text
          style={[
            styles.triggerText,
            { color: value ? colors.text : colors.textMuted },
          ]}
        >
          {value ? formatDateDisplay(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setShowPicker(false)}>
                <Text style={[styles.headerBtn, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{label}</Text>
              <Pressable
                onPress={() => {
                  if (pendingDate) onChange(toDateString(pendingDate));
                  setShowPicker(false);
                }}
              >
                <Text style={[styles.headerBtn, { color: Colors.primary }]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={displayDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              textColor={colors.text}
              onChange={(_, selected) => {
                if (selected) setPendingDate(selected);
              }}
              style={{ height: 200 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
  },
  headerBtn: {
    fontSize: 16,
    fontFamily: "Outfit_500Medium",
  },
});
