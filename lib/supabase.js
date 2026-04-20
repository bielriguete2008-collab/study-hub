// lib/supabase.js — Cliente Supabase centralizado
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { ...headers, ...(options.headers || {}) }, ...options });
  if (!res.ok && res.status !== 404) { const err = await res.text(); throw new Error(`Supabase ${res.status}: ${err}`); }
  if (res.status === 204) return null;
  return res.json();
}

export async function getStudent(phone) { const rows = await sbFetch(`students?phone=eq.${encodeURIComponent(phone)}&limit=1`); return rows?.[0] || null; }
export async function createStudent(phone) { const rows = await sbFetch('students', { method: 'POST', body: JSON.stringify({ phone, onboarded: false, otp_verified: false }) }); return rows?.[0] || null; }
export async function updateStudent(phone, data) { await sbFetch(`students?phone=eq.${encodeURIComponent(phone)}`, { method: 'PATCH', body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }) }); }

export async function saveConversation(studentId, role, content, meta = {}) { const rows = await sbFetch('conversations', { method: 'POST', body: JSON.stringify({ student_id: studentId, role, content, ...meta }) }); return rows?.[0] || null; }
export async function getRecentConversations(studentId, limit = 10) { return sbFetch(`conversations?student_id=eq.${studentId}&order=created_at.desc&limit=${limit}`); }

export async function saveMemory(studentId, memoryType, content, subject = null, importance = 0.5, embedding = null, expiresAt = null) {
  await sbFetch('student_memory', { method: 'POST', body: JSON.stringify({ student_id: studentId, memory_type: memoryType, content, subject, importance, embedding, expires_at: expiresAt }) });
}
export async function searchMemory(studentId, embedding, limit = 5, subject = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_student_memory`, { method: 'POST', headers, body: JSON.stringify({ p_student_id: studentId, p_embedding: embedding, p_limit: limit, p_subject: subject }) });
  return res.json();
}
export async function getRecentMemories(studentId, limit = 8) { return sbFetch(`student_memory?student_id=eq.${studentId}&order=accessed_at.desc&limit=${limit}`); }

export async function getProgress(studentId, subject) { const rows = await sbFetch(`student_progress?student_id=eq.${studentId}&subject=eq.${encodeURIComponent(subject)}&limit=1`); return rows?.[0] || null; }
export async function upsertProgress(studentId, subject, subjectLabel, delta = {}) {
  const existing = await getProgress(studentId, subject);
  if (existing) {
    await sbFetch(`student_progress?student_id=eq.${studentId}&subject=eq.${encodeURIComponent(subject)}`, { method: 'PATCH', body: JSON.stringify({ questions_asked: (existing.questions_asked || 0) + (delta.questions || 0), correct_answers: (existing.correct_answers || 0) + (delta.correct || 0), wrong_answers: (existing.wrong_answers || 0) + (delta.wrong || 0), last_interaction: new Date().toISOString() }) });
  } else {
    await sbFetch('student_progress', { method: 'POST', body: JSON.stringify({ student_id: studentId, subject, subject_label: subjectLabel, questions_asked: delta.questions || 0, correct_answers: delta.correct || 0, wrong_answers: delta.wrong || 0 }) });
  }
}
export async function logTokenTransaction(studentId, type, amount, balanceAfter, meta = {}) {
  await sbFetch('token_transactions', { method: 'POST', body: JSON.stringify({ student_id: studentId, type, amount, balance_after: balanceAfter, ...meta }) });
}
