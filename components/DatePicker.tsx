import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface DatePickerSingleProps {
  mode: "single";
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
}

interface DatePickerMultiProps {
  mode: "multi";
  value: string[];
  onChange: (dates: string[]) => void;
  label?: string;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
}

type DatePickerProps = DatePickerSingleProps | DatePickerMultiProps;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateStr(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseDateStr(dateStr: string): { year: number; month: number; day: number } | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

function formatDisplay(dateStr: string): string {
  const p = parseDateStr(dateStr);
  if (!p) return dateStr;
  return `${MONTHS_SHORT[p.month]} ${p.day}, ${p.year}`;
}

function isDateInRange(dateStr: string, minDate?: string, maxDate?: string): boolean {
  if (!minDate && !maxDate) return true;
  const d = new Date(dateStr + "T12:00:00");
  if (minDate) {
    const min = new Date(minDate + "T12:00:00");
    if (d < min) return false;
  }
  if (maxDate) {
    const max = new Date(maxDate + "T12:00:00");
    if (d > max) return false;
  }
  return true;
}

function CalendarModal({
  visible,
  onClose,
  mode,
  selectedDates,
  onSelect,
  minDate,
  maxDate,
}: {
  visible: boolean;
  onClose: () => void;
  mode: "single" | "multi";
  selectedDates: string[];
  onSelect: (dates: string[]) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [localSelected, setLocalSelected] = useState<string[]>(selectedDates);

  useEffect(() => {
    if (visible) {
      setLocalSelected(selectedDates);
      if (selectedDates.length > 0) {
        const p = parseDateStr(selectedDates[0]);
        if (p) {
          setViewYear(p.year);
          setViewMonth(p.month);
        }
      }
    }
  }, [visible]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const toggleDate = (dateStr: string) => {
    if (!isDateInRange(dateStr, minDate, maxDate)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (mode === "single") {
      setLocalSelected([dateStr]);
      onSelect([dateStr]);
      onClose();
      return;
    }

    setLocalSelected((prev) => {
      if (prev.includes(dateStr)) {
        return prev.filter((d) => d !== dateStr);
      }
      return [...prev, dateStr].sort();
    });
  };

  const handleDone = () => {
    onSelect(localSelected);
    onClose();
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={calStyles.overlay}>
        <View style={calStyles.sheet}>
          <View style={calStyles.handle} />

          <View style={calStyles.monthNav}>
            <Pressable onPress={prevMonth} style={calStyles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.light.text} />
            </Pressable>
            <Text style={calStyles.monthLabel}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={nextMonth} style={calStyles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.light.text} />
            </Pressable>
          </View>

          <View style={calStyles.weekRow}>
            {WEEKDAYS.map((w) => (
              <View key={w} style={calStyles.weekCell}>
                <Text style={calStyles.weekText}>{w}</Text>
              </View>
            ))}
          </View>

          <View style={calStyles.grid}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={`empty-${idx}`} style={calStyles.dayCell} />;
              }
              const dateStr = formatDateStr(viewYear, viewMonth, day);
              const isSelected = localSelected.includes(dateStr);
              const isToday = dateStr === todayStr;
              const inRange = isDateInRange(dateStr, minDate, maxDate);

              return (
                <Pressable
                  key={dateStr}
                  style={[
                    calStyles.dayCell,
                    isSelected && calStyles.dayCellSelected,
                    isToday && !isSelected && calStyles.dayCellToday,
                  ]}
                  onPress={() => toggleDate(dateStr)}
                  disabled={!inRange}
                >
                  <Text
                    style={[
                      calStyles.dayText,
                      isSelected && calStyles.dayTextSelected,
                      !inRange && calStyles.dayTextDisabled,
                      isToday && !isSelected && calStyles.dayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === "multi" && (
            <View style={calStyles.multiFooter}>
              <Text style={calStyles.selectedCount}>
                {localSelected.length} date{localSelected.length !== 1 ? "s" : ""} selected
              </Text>
              <Pressable
                style={({ pressed }) => [calStyles.doneBtn, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleDone}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={calStyles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [calStyles.cancelBtn, { opacity: pressed ? 0.8 : 1 }]}
            onPress={onClose}
          >
            <Text style={calStyles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function WebDateInput({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={minDate}
      max={maxDate}
      style={{
        width: "100%",
        height: 44,
        borderRadius: 10,
        border: `1px solid ${Colors.light.border}`,
        backgroundColor: Colors.light.surfaceSecondary,
        paddingLeft: 14,
        paddingRight: 14,
        fontFamily: "Outfit_400Regular, sans-serif",
        fontSize: 15,
        color: Colors.light.text,
        outline: "none",
        boxSizing: "border-box" as const,
      }}
    />
  );
}

export default function DatePicker(props: DatePickerProps) {
  const { mode, label, placeholder, minDate, maxDate } = props;
  const [showCalendar, setShowCalendar] = useState(false);

  const isSingle = mode === "single";
  const singleValue = isSingle ? (props as DatePickerSingleProps).value : "";
  const multiValue = !isSingle ? (props as DatePickerMultiProps).value : [];

  const handleCalendarSelect = (dates: string[]) => {
    if (isSingle) {
      (props as DatePickerSingleProps).onChange(dates[0] || "");
    } else {
      (props as DatePickerMultiProps).onChange(dates);
    }
  };

  const removeMultiDate = (dateStr: string) => {
    if (!isSingle) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = multiValue.filter((d) => d !== dateStr);
      (props as DatePickerMultiProps).onChange(updated);
    }
  };

  if (Platform.OS === "web" && isSingle) {
    return (
      <View style={dpStyles.container}>
        {label && <Text style={dpStyles.label}>{label}</Text>}
        <WebDateInput
          value={singleValue}
          onChange={(props as DatePickerSingleProps).onChange}
          minDate={minDate}
          maxDate={maxDate}
        />
      </View>
    );
  }

  return (
    <View style={dpStyles.container}>
      {label && <Text style={dpStyles.label}>{label}</Text>}

      <Pressable
        style={({ pressed }) => [dpStyles.trigger, { opacity: pressed ? 0.9 : 1 }]}
        onPress={() => setShowCalendar(true)}
      >
        <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
        <Text
          style={[
            dpStyles.triggerText,
            !singleValue && !multiValue.length && dpStyles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {isSingle
            ? singleValue
              ? formatDisplay(singleValue)
              : placeholder || "Select date"
            : multiValue.length > 0
            ? `${multiValue.length} date${multiValue.length !== 1 ? "s" : ""} selected`
            : placeholder || "Select dates"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.light.textMuted} />
      </Pressable>

      {!isSingle && multiValue.length > 0 && (
        <View style={dpStyles.chipsWrap}>
          {multiValue.map((d) => (
            <View key={d} style={dpStyles.chip}>
              <Text style={dpStyles.chipText}>{formatDisplay(d)}</Text>
              <Pressable onPress={() => removeMultiDate(d)} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={Colors.light.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        mode={mode}
        selectedDates={isSingle ? (singleValue ? [singleValue] : []) : multiValue}
        onSelect={handleCalendarSelect}
        minDate={minDate}
        maxDate={maxDate}
      />
    </View>
  );
}

const dpStyles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.text,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    height: 46,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: Colors.light.text,
  },
  placeholderText: {
    color: Colors.light.textMuted,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "18",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.accent + "30",
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Outfit_500Medium",
    color: Colors.primary,
  },
});

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 48,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.light.border,
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: Colors.light.text,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekText: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    backgroundColor: Colors.accent + "20",
  },
  dayText: {
    fontSize: 15,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.text,
  },
  dayTextSelected: {
    color: "#fff",
    fontFamily: "Outfit_700Bold",
  },
  dayTextDisabled: {
    color: Colors.light.textMuted,
    opacity: 0.4,
  },
  dayTextToday: {
    color: Colors.primary,
    fontFamily: "Outfit_700Bold",
  },
  multiFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  selectedCount: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: Colors.light.textSecondary,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  doneBtnText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#fff",
  },
  cancelBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: Colors.light.textSecondary,
  },
});
