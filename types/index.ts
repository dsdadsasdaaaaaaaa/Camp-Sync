export type UserRole = "management" | "staff" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  linkedCamperIds: string[];
  authCode: string;
  createdAt: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface MedicalInfo {
  allergies: string[];
  medications: string[];
  conditions: string[];
  emergencyContacts: EmergencyContact[];
  doctorName: string;
  doctorPhone: string;
  insuranceProvider: string;
  bloodType: string;
  notes: string;
}

export interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  cabinGroup: string;
  medical: MedicalInfo;
  wristbandId?: string;
  wristbandLastProgrammed?: string;
  wristbandEncryptedData?: string;
  parentAuthCode?: string;
  photoData?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckIn {
  id: string;
  camperId: string;
  sessionId: string;
  checkedInAt: string;
  checkedInBy: string;
  checkedInByName: string;
  checkedOutAt?: string;
  checkedOutBy?: string;
  checkedOutByName?: string;
  notes?: string;
}

export interface Session {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  authorizedDates: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface AuthCode {
  code: string;
  role: UserRole;
  linkedCamperId?: string;
  maxUses: number;
  usedCount: number;
  usedBy: string[];
  createdAt: string;
  createdBy: string;
}

export interface PendingWristbandUpdate {
  id: string;
  camperId: string;
  camperName: string;
  requestedAt: string;
  requestedBy: string;
  requestedByName: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
}

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  audience: "staff" | "parents" | "all";
  isEmergency: boolean;
  emergencyActive: boolean;
  sentBy: string;
  sentByName: string;
  sentAt: string;
}

export interface WristbandPayload {
  camperId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medical: MedicalInfo;
  programmedAt: string;
  appVersion: string;
}
