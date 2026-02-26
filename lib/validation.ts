export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  const re = /^[\d\s\-\(\)\+\.]+$/;
  return re.test(phone.trim());
}

export function isValidDate(date: string, format: "MM/DD/YYYY" | "YYYY-MM-DD" = "MM/DD/YYYY"): boolean {
  if (!date.trim()) return false;
  if (format === "MM/DD/YYYY") {
    const re = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
    if (!re.test(date.trim())) return false;
    const [m, d, y] = date.trim().split("/").map(Number);
    const parsed = new Date(y, m - 1, d);
    return parsed.getMonth() === m - 1 && parsed.getDate() === d;
  }
  if (format === "YYYY-MM-DD") {
    const re = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!re.test(date.trim())) return false;
    const [y, m, d] = date.trim().split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    return parsed.getMonth() === m - 1 && parsed.getDate() === d;
  }
  return false;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
