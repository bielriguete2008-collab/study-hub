-- STUDY HUB v2 — Schema Completo
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT, email TEXT, course TEXT, semester INTEGER DEFAULT 1, institution TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
  tokens_balance INTEGER DEFAULT 150, tokens_monthly_cap INTEGER DEFAULT 150,
  tokens_reset_date DATE DEFAULT CURRENT_DATE, tokens_used_month INTEGER DEFAULT 0,
  stripe_customer_id TEXT, stripe_subscription_id TEXT, subscription_status TEXT DEFAULT 'active',
  onboarded BOOLEAN DEFAULT false, onboard_step INTEGER DEFAULT 0,
  otp_verified BOOLEAN DEFAULT false, otp_code TEXT, otp_expires_at TIMESTAMPTZ, otp_attempts INTEGER DEFAULT 0,
  preferred_style TEXT DEFAULT 'balanced' CHECK (preferred_style IN ('socratic','direct','balanced')),
  study_pace TEXT DEFAULT 'normal' CHECK (study_pace IN ('slow','normal','fast')),
  main_struggle TEXT, allowed_subjects TEXT[] DEFAULT '{}',
  points INTEGER DEFAULT 0, streak_days INTEGER DEFAULT 0, badges JSONB DEFAULT '[]', last_activity DATE,
  last_agent TEXT, active_orchestrator TEXT, pending_quiz JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), last_active TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone);
CREATE INDEX IF NOT EXISTS idx_students_plan ON students(plan);

CREATE TABLE IF NOT EXISTS student_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact','preference','weakness','achievement','goal','context')),
  subject TEXT, content TEXT NOT NULL, importance FLOAT DEFAULT 0.5 CHECK (importance BETWEEN 0.0 AND 1.0),
  embedding vector(384), access_count INTEGER DEFAULT 0,
  accessed_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_memory_student ON student_memory(student_id);
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON student_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL, agent_id TEXT, orchestrator_id TEXT,
  tokens_consumed INTEGER DEFAULT 0, complexity_level INTEGER DEFAULT 1 CHECK (complexity_level BETWEEN 1 AND 4),
  complexity_label TEXT, groq_model TEXT DEFAULT 'llama-3.3-70b-versatile',
  latency_ms INTEGER, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conv_student ON conversations(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL, subject_label TEXT, proficiency FLOAT DEFAULT 0.0,
  questions_asked INTEGER DEFAULT 0, correct_answers INTEGER DEFAULT 0, wrong_answers INTEGER DEFAULT 0,
  mastered_topics TEXT[] DEFAULT '{}', struggling_topics TEXT[] DEFAULT '{}',
  last_interaction TIMESTAMPTZ DEFAULT NOW(), UNIQUE(student_id, subject)
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('debit','credit','reset','bonus')),
  amount INTEGER NOT NULL, balance_after INTEGER NOT NULL,
  reason TEXT, complexity_level INTEGER, agent_id TEXT,
  conversation_id UUID REFERENCES conversations(id),
  stripe_payment_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_self" ON students FOR ALL USING (false);
CREATE POLICY "memory_self" ON student_memory FOR ALL USING (false);
CREATE POLICY "conv_self" ON conversations FOR ALL USING (false);
CREATE POLICY "progress_self" ON student_progress FOR ALL USING (false);
CREATE POLICY "tokens_self" ON token_transactions FOR ALL USING (false);

CREATE OR REPLACE FUNCTION reset_monthly_tokens() RETURNS INTEGER AS $$
DECLARE updated_count INTEGER;
BEGIN
  UPDATE students SET tokens_balance = tokens_monthly_cap, tokens_used_month = 0, tokens_reset_date = CURRENT_DATE
  WHERE tokens_reset_date < DATE_TRUNC('month', CURRENT_DATE) OR tokens_reset_date IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT; RETURN updated_count;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION search_student_memory(p_student_id UUID, p_embedding vector(384), p_limit INTEGER DEFAULT 5, p_subject TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, memory_type TEXT, subject TEXT, content TEXT, importance FLOAT, similarity FLOAT) AS $$
BEGIN
  RETURN QUERY SELECT m.id, m.memory_type, m.subject, m.content, m.importance, 1 - (m.embedding <=> p_embedding) AS similarity
  FROM student_memory m
  WHERE m.student_id = p_student_id AND m.embedding IS NOT NULL
    AND (p_subject IS NULL OR m.subject = p_subject OR m.subject IS NULL)
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY m.embedding <=> p_embedding LIMIT p_limit;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
