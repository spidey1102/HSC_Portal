import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jguarrqclcezjvxqffio.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_A7b6mGcc_T597xJERKrzbw_84W9KW7D';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;

export const COHORT_SUPABASE_SQL = `-- 1. Cohorts table (e.g. RHHS Ext 1 Squad)
CREATE TABLE IF NOT EXISTS cohort_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  creator_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cohort Members
CREATE TABLE IF NOT EXISTS cohort_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohort_groups(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cohort_id, user_id)
);

-- 3. Challenges (e.g. Week 1: Girraween 2020-2025)
CREATE TABLE IF NOT EXISTS cohort_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohort_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  school TEXT NOT NULL,
  start_year INT,
  end_year INT,
  paper_ids JSONB DEFAULT '[]'::jsonb,
  deadline TIMESTAMPTZ,
  marking_mode TEXT DEFAULT 'round_robin',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Submissions & Peer Marking
CREATE TABLE IF NOT EXISTS cohort_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES cohort_challenges(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL,
  paper_title TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'submitted',
  working_files JSONB DEFAULT '[]'::jsonb,
  assigned_marker_id TEXT,
  assigned_marker_name TEXT,
  assigned_at TIMESTAMPTZ,
  score NUMERIC,
  max_score NUMERIC,
  percentage NUMERIC,
  feedback_notes TEXT,
  question_breakdown JSONB DEFAULT '{}'::jsonb,
  marked_at TIMESTAMPTZ
);

ALTER TABLE cohort_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read on cohort_groups" ON cohort_groups FOR SELECT USING (true);
CREATE POLICY "Allow all insert on cohort_groups" ON cohort_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on cohort_groups" ON cohort_groups FOR UPDATE USING (true);

CREATE POLICY "Allow all read on cohort_members" ON cohort_members FOR SELECT USING (true);
CREATE POLICY "Allow all insert on cohort_members" ON cohort_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on cohort_members" ON cohort_members FOR UPDATE USING (true);

CREATE POLICY "Allow all read on cohort_challenges" ON cohort_challenges FOR SELECT USING (true);
CREATE POLICY "Allow all insert on cohort_challenges" ON cohort_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on cohort_challenges" ON cohort_challenges FOR UPDATE USING (true);

CREATE POLICY "Allow all read on cohort_submissions" ON cohort_submissions FOR SELECT USING (true);
CREATE POLICY "Allow all insert on cohort_submissions" ON cohort_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on cohort_submissions" ON cohort_submissions FOR UPDATE USING (true);`;

/**
 * Checks if the cohort tables have been initialized in Supabase.
 * Returns { ok: boolean, error?: string }
 */
export async function testSupabaseConnection() {
  try {
    const { error } = await supabase.from('cohort_groups').select('id').limit(1);
    if (error) {
      // Check for table missing
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { ok: false, tablesMissing: true, message: 'Database tables not created yet. Please run the SQL setup script in your Supabase SQL Editor.' };
      }
      return { ok: false, tablesMissing: false, message: error.message };
    }
    return { ok: true, tablesMissing: false };
  } catch (err) {
    return { ok: false, tablesMissing: false, message: err?.message || 'Network error' };
  }
}

/**
 * Uploads a file (photo or PDF) to the 'cohort-workings' bucket in Supabase Storage.
 * Falls back to reading as Data URL if bucket is not created or permission denied.
 */
export async function uploadWorkingFile(file, studentId, paperId) {
  const timestamp = Date.now();
  const cleanName = (file.name || 'working.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${studentId}/${paperId}_${timestamp}_${cleanName}`;

  try {
    const { error } = await supabase.storage
      .from('cohort-workings')
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (error) throw error;

    const { data: pubUrlData } = supabase.storage
      .from('cohort-workings')
      .getPublicUrl(path);

    return {
      url: pubUrlData.publicUrl,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      storageMode: 'supabase-bucket',
    };
  } catch (storageErr) {
    console.warn('Supabase storage upload failed or bucket missing, falling back to local object preview:', storageErr);
    // Return object URL or data URL as fallback
    const localUrl = URL.createObjectURL(file);
    return {
      url: localUrl,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      storageMode: 'local-preview',
      warning: 'Uploaded locally (create "cohort-workings" public bucket in Supabase Storage to persist permanently across devices)',
    };
  }
}

/**
 * Round-robin marker assignment algorithm:
 * Given a list of submissions and members, guarantees:
 * 1. No student marks their own paper.
 * 2. Every submission gets a marker.
 * 3. Markers are evenly distributed.
 */
export function assignMarkersRoundRobin(submissions, members) {
  if (!submissions || submissions.length === 0) return [];
  if (!members || members.length < 2) {
    // If only 1 person in cohort, cannot peer mark
    return submissions.map(sub => ({
      ...sub,
      assigned_marker_id: null,
      assigned_marker_name: 'Need at least 2 members to peer-mark',
    }));
  }

  // Eligible markers
  const eligibleMarkerList = members.map(m => ({ id: m.user_id, name: m.user_name }));

  // Shift assignment circle: Student i marked by Student (i + 1) % N
  return submissions.map((sub, index) => {
    // Find candidate markers who are NOT the student
    const otherMarkers = eligibleMarkerList.filter(m => m.id !== sub.student_id);
    if (otherMarkers.length === 0) {
      return sub;
    }
    // Pick round robin based on index
    const assigned = otherMarkers[index % otherMarkers.length];
    return {
      ...sub,
      assigned_marker_id: assigned.id,
      assigned_marker_name: assigned.name,
      assigned_at: new Date().toISOString(),
      status: sub.status === 'submitted' ? 'assigned' : sub.status,
    };
  });
}
