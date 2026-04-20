// lib/security/otp.js — Geração e validação de OTP
import { updateStudent } from '../supabase.js';
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

export async function setOTP(phone, otp) {
  await updateStudent(phone, { otp_code: otp, otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), otp_attempts: 0 });
}

export function validateOTP(student, inputOtp) {
  if ((student.otp_attempts || 0) >= MAX_ATTEMPTS) return 'blocked';
  const expired = !student.otp_expires_at || new Date(student.otp_expires_at) < new Date();
  if (expired) return 'expired';
  return student.otp_code === inputOtp.toString().trim() ? 'valid' : 'invalid';
}

export async function markOTPVerified(phone) {
  await updateStudent(phone, { otp_verified: true, otp_code: null, otp_expires_at: null, otp_attempts: 0 });
}

export async function incrementOTPAttempt(phone, currentAttempts) {
  await updateStudent(phone, { otp_attempts: (currentAttempts || 0) + 1 });
}
