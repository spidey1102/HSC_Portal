import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Trophy, Clock, CheckCircle2, AlertCircle, FileText,
  Upload, Eye, Send, Plus, Share2, Copy, Check,
  BookOpen, ShieldCheck, Database, RefreshCw,
  UserCheck, UserPlus, Lock, KeyRound, LogIn, EyeOff
} from 'lucide-react';
import { useAuth } from './AuthContext';

import {
  supabase,
  testSupabaseConnection,
  uploadWorkingFile,
  assignMarkersRoundRobin,
  COHORT_SUPABASE_SQL,
  SUPABASE_PROJECT_URL
} from '../lib/supabase';

const LOCAL_STORAGE_COHORT_KEY = 'hsc_active_cohort_id';
const LOCAL_STORAGE_USER_NAME_KEY = 'hsc_cohort_user_name';
const LOCAL_MOCK_COHORTS_KEY = 'hsc_local_cohorts_cache';

const getJoinedCohortIds = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`hsc_joined_cohorts_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveJoinedCohortIds = (userId, ids) => {
  if (!userId) return;
  try {
    localStorage.setItem(`hsc_joined_cohorts_${userId}`, JSON.stringify(ids));
  } catch {
    // ignore
  }
};

// Seed default cohort with valid Supabase UUID
const DEFAULT_COHORT = {
  id: 'bbb0ad06-c846-474a-b6b6-8ced8517110f',
  name: 'RHHS Ext 1 Squad',
  description: 'Weekly school sets sprint & peer marking group for Maths Extension 1',
  invite_code: 'RHHS-EXT1',
  creator_name: 'Aseem Soti',
  created_at: new Date().toISOString()
};

const DEFAULT_MEMBERS = [
  { id: 'm-1', user_name: 'Aseem Soti', user_id: 'aseem-soti', role: 'leader' },
  { id: 'm-2', user_name: 'Muaz', user_id: 'muaz-rhhs', role: 'member' },
  { id: 'm-3', user_name: 'Sakchhyam', user_id: 'sakchhyam-rhhs', role: 'member' },
  { id: 'm-4', user_name: 'Yuvi', user_id: 'yuvi-rhhs', role: 'member' },
  { id: 'm-5', user_name: 'Theo', user_id: 'theo-rhhs', role: 'member' },
];

export default function CohortChallengesView({
  subjects = [],
  schools = [],
  papers = [],
  onSelectPaper,
  onNavigateToPractice,
  currentUser = null,
}) {
  const authContext = useAuth();
  const authUser = currentUser || authContext?.user;

  const [guestName] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_USER_NAME_KEY) || 'Guest Student';
  });

  // Real logged-in user identification
  const currentUserName = useMemo(() => {
    if (authUser) {
      return authUser.displayName || authUser.email?.split('@')[0] || 'Student';
    }
    return guestName;
  }, [authUser, guestName]);

  const currentUserId = useMemo(() => {
    if (authUser) {
      return authUser.uid;
    }
    return null;
  }, [authUser]);

  // Database status
  const [dbStatus, setDbStatus] = useState({ checked: false, online: false, tablesMissing: false });
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Active Cohort & Data
  const [cohorts, setCohorts] = useState([DEFAULT_COHORT]);
  const [activeCohort, setActiveCohort] = useState(DEFAULT_COHORT);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [challenges, setChallenges] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active tab inside view: 'challenges' | 'marking' | 'leaderboard' | 'members'
  const [activeTab, setActiveTab] = useState('challenges');

  // Modals & gating state
  const [showCreateChallengeModal, setShowCreateChallengeModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(null); // paper or challenge object
  const [showMarkingModal, setShowMarkingModal] = useState(null); // submission object
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showShareInviteModal, setShowShareInviteModal] = useState(false);
  const [showRosterCode, setShowRosterCode] = useState(false);
  const [showModalCode, setShowModalCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  // Check whether current user is enrolled in the active cohort
  const isUserEnrolled = useMemo(() => {
    if (!authUser || !currentUserId) return false;
    // Check members of active cohort
    const inMemberList = members.some(m => m.user_id === currentUserId);
    if (inMemberList) return true;
    // Check stored joined cohort ids
    const joinedList = getJoinedCohortIds(currentUserId);
    if (activeCohort?.id && joinedList.includes(activeCohort.id)) return true;
    // Check if user is creator of activeCohort
    if (activeCohort?.creator_id === currentUserId) return true;
    return false;
  }, [authUser, members, currentUserId, activeCohort]);

  // Check Supabase connection and tables on mount
  const checkConnection = useCallback(async () => {
    const res = await testSupabaseConnection();
    setDbStatus({
      checked: true,
      online: res.ok,
      tablesMissing: res.tablesMissing || false,
      message: res.message
    });
    return res.ok;
  }, []);

  // Fetch cohorts and challenges
  const loadData = useCallback(async () => {
    setLoading(true);
    const isOnline = await checkConnection();

    if (isOnline) {
      try {
        // 1. Fetch Cohorts
        const { data: cData, error: cErr } = await supabase.from('cohort_groups').select('*').order('created_at', { ascending: false });
        if (!cErr && cData && cData.length > 0) {
          setCohorts(cData);
          const savedId = localStorage.getItem(LOCAL_STORAGE_COHORT_KEY);
          const matched = cData.find(c => c.id === savedId) || cData[0];
          setActiveCohort(matched);

          // 2. Fetch Members
          const { data: mData } = await supabase.from('cohort_members').select('*').eq('cohort_id', matched.id);
          if (mData && mData.length > 0) {
            setMembers(mData);
          }

          // 3. Fetch Challenges
          const { data: chData } = await supabase.from('cohort_challenges').select('*').eq('cohort_id', matched.id).order('created_at', { ascending: false });
          if (chData) {
            setChallenges(chData);
          }

          // 4. Fetch Submissions
          const { data: subData } = await supabase.from('cohort_submissions').select('*');
          if (subData) {
            setSubmissions(subData);
          }

          // 5. Fetch current user's enrolled memberships
          if (authUser?.uid) {
            try {
              const { data: myMemberships } = await supabase
                .from('cohort_members')
                .select('cohort_id')
                .eq('user_id', authUser.uid);
              if (myMemberships && myMemberships.length > 0) {
                const ids = myMemberships.map(m => m.cohort_id);
                const existing = getJoinedCohortIds(authUser.uid);
                const merged = Array.from(new Set([...existing, ...ids]));
                saveJoinedCohortIds(authUser.uid, merged);
              }
            } catch (mErr) {
              console.warn('Could not fetch user memberships from Supabase:', mErr);
            }
          }
        } else {
          // If Supabase table is empty, auto-seed default RHHS cohort
          await seedDefaultCohortToSupabase();
        }
      } catch (err) {
        console.error('Failed to load from Supabase:', err);
        loadLocalFallback();
      }
    } else {
      // Local fallback
      loadLocalFallback();
    }
    setLoading(false);
  }, [checkConnection, authUser]);

  const loadLocalFallback = () => {
    try {
      const cached = localStorage.getItem(LOCAL_MOCK_COHORTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.challenges) setChallenges(parsed.challenges);
        if (parsed.submissions) setSubmissions(parsed.submissions);
        if (parsed.members) setMembers(parsed.members);
        return;
      }
    } catch {
      // ignore
    }
    // Seed initial local challenge for Girraween 2020-2025
    const initialChallenge = {
      id: 'girraween-week1',
      cohort_id: DEFAULT_COHORT.id,
      title: 'Week 1 Sprint: Girraween High (2020–2025)',
      subject: 'Maths Ext 1',
      school: 'Girraween',
      start_year: 2020,
      end_year: 2025,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      marking_mode: 'round_robin',
      status: 'active',
      created_at: new Date().toISOString(),
      target_precision: 85
    };
    setChallenges([initialChallenge]);
  };

  const saveLocalFallback = (newChallenges, newSubmissions, newMembers) => {
    try {
      localStorage.setItem(LOCAL_MOCK_COHORTS_KEY, JSON.stringify({
        challenges: newChallenges ?? challenges,
        submissions: newSubmissions ?? submissions,
        members: newMembers ?? members,
      }));
    } catch {
      // ignore
    }
  };

  const seedDefaultCohortToSupabase = async () => {
    try {
      const { data: insertedGroup } = await supabase.from('cohort_groups').insert([{
        name: 'RHHS Ext 1 Squad',
        description: 'Weekly school sets sprint & peer marking group for Maths Extension 1',
        invite_code: 'RHHS-EXT1',
        creator_name: 'Aseem Soti'
      }]).select().single();

      if (insertedGroup) {
        setActiveCohort(insertedGroup);
        setCohorts([insertedGroup]);

        // Insert initial members
        const membersPayload = DEFAULT_MEMBERS.map(m => ({
          cohort_id: insertedGroup.id,
          user_name: m.user_name,
          user_id: m.user_id,
          role: m.role
        }));
        await supabase.from('cohort_members').insert(membersPayload);

        // Insert Girraween challenge
        const { data: insertedChallenge } = await supabase.from('cohort_challenges').insert([{
          cohort_id: insertedGroup.id,
          title: 'Week 1 Sprint: Girraween High (2020–2025)',
          subject: 'Maths Ext 1',
          school: 'Girraween',
          start_year: 2020,
          end_year: 2025,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          marking_mode: 'round_robin',
          status: 'active'
        }]).select().single();

        if (insertedChallenge) {
          setChallenges([insertedChallenge]);
        }
      }
    } catch (e) {
      console.warn('Could not seed default to Supabase:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up Supabase Realtime subscription when online
  useEffect(() => {
    if (!dbStatus.online) return;

    const channel = supabase
      .channel('cohort-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cohort_challenges' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cohort_submissions' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cohort_members' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dbStatus.online, loadData]);

  // Copy SQL script helper
  const handleCopySql = () => {
    navigator.clipboard.writeText(COHORT_SUPABASE_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(activeCohort?.invite_code || 'RHHS-EXT1');
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Find papers that match active challenge
  const getPapersForChallenge = useCallback((challenge) => {
    if (!challenge || !papers || papers.length === 0) return [];
    const subjName = challenge.subject || 'Maths Ext 1';
    const schoolQuery = (challenge.school || '').toLowerCase();
    const startY = challenge.start_year || 2020;
    const endY = challenge.end_year || 2025;

    // Find subject index
    const sIdx = subjects.findIndex(s => s?.toLowerCase() === subjName.toLowerCase());

    const filtered = papers.filter(p => {
      // check subject
      if (sIdx !== -1 && p.s !== sIdx) return false;
      // check year
      if (p.y < startY || p.y > endY) return false;
      // check school
      const schoolName = schools[p.h] || '';
      const paperName = p.n || '';
      return schoolName.toLowerCase().includes(schoolQuery) || paperName.toLowerCase().includes(schoolQuery);
    }).sort((a, b) => b.y - a.y);

    // Deduplicate by cloudflare path / url / name+year to guarantee uniqueness
    const seen = new Set();
    const uniquePapers = [];
    for (const p of filtered) {
      const uniqueKey = p.cf || p.pdfUrl || `${p.h}_${p.s}_${p.y}_${p.n}`;
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        uniquePapers.push(p);
      }
    }
    return uniquePapers;
  }, [papers, subjects, schools]);

  // Join a cohort using a private invite code
  const handleJoinSquadByCode = async (codeOverride = null) => {
    const code = (typeof codeOverride === 'string' ? codeOverride : joinCodeInput).trim().toUpperCase();
    if (!code) {
      setJoinError('Please enter a squad invite code.');
      return;
    }
    setJoinLoading(true);
    setJoinError('');

    try {
      let matched = cohorts.find(c => c.invite_code?.toUpperCase() === code);

      if (!matched && dbStatus.online) {
        const { data, error } = await supabase
          .from('cohort_groups')
          .select('*')
          .ilike('invite_code', code)
          .maybeSingle();
        if (!error && data) {
          matched = data;
          setCohorts(prev => [data, ...prev.filter(c => c.id !== data.id)]);
        }
      }

      if (!matched && code === DEFAULT_COHORT.invite_code.toUpperCase()) {
        matched = DEFAULT_COHORT;
      }

      if (!matched) {
        setJoinError('Invalid squad invite code. Please verify the code with your squad organizer.');
        setJoinLoading(false);
        return;
      }

      const newMemberRecord = {
        cohort_id: matched.id,
        user_name: currentUserName,
        user_id: currentUserId,
        role: 'member',
        joined_at: new Date().toISOString()
      };

      if (dbStatus.online) {
        try {
          const { data: mData, error: mErr } = await supabase
            .from('cohort_members')
            .upsert([newMemberRecord], { onConflict: 'cohort_id,user_id' })
            .select()
            .single();
          if (!mErr && mData) {
            setMembers(prev => [...prev.filter(m => m.user_id !== currentUserId), mData]);
          }
        } catch (e) {
          console.warn('Supabase member enrollment note:', e);
        }
      }

      const joinedList = getJoinedCohortIds(currentUserId);
      if (!joinedList.includes(matched.id)) {
        joinedList.push(matched.id);
        saveJoinedCohortIds(currentUserId, joinedList);
      }

      setMembers(prev => {
        if (prev.some(m => m.user_id === currentUserId)) return prev;
        return [...prev, newMemberRecord];
      });

      setActiveCohort(matched);
      localStorage.setItem(LOCAL_STORAGE_COHORT_KEY, matched.id);
      setShowJoinModal(false);
      setJoinCodeInput('');
      setJoinSuccess(`Welcome to ${matched.name}!`);
      setTimeout(() => setJoinSuccess(''), 3500);
    } catch (e) {
      console.error('Error joining squad:', e);
      setJoinError('Could not join squad. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  // Handle student paper submission
  const handleSubmitWork = async ({ challengeId, paper, files, notes, _estimatedScore }) => {
    // Only send columns that exist in public.cohort_submissions:
    // challenge_id, paper_id, paper_title, student_id, student_name, submitted_at,
    // status, working_files, max_score, feedback_notes
    const formattedFiles = Array.isArray(files) ? files : [];
    const paperId = paper.cf || paper.pdfUrl || `${paper.h}_${paper.s}_${paper.y}_${paper.n}`;

    const newSubmission = {
      challenge_id: challengeId,
      paper_id: paperId,
      paper_title: `${schools[paper.h] || 'School'} ${paper.y} (${subjects[paper.s] || 'HSC'})`,
      student_id: currentUserId,
      student_name: currentUserName,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
      working_files: formattedFiles,
      max_score: 70, // Standard Ext 1 HSC mark
      feedback_notes: notes ? `[Student Note]: ${notes}` : null
    };

    if (dbStatus.online) {
      try {
        const { data, error } = await supabase.from('cohort_submissions').insert([newSubmission]).select().single();
        if (error) {
          console.error('Supabase submission insert error:', error);
          alert(`Submission error: ${error.message}`);
          return;
        }
        if (data) {
          setSubmissions(prev => [data, ...prev]);
          setShowSubmitModal(null);
          return;
        }
      } catch (err) {
        console.warn('Submitting to Supabase failed, saving locally:', err);
        alert(`Submitting to Supabase failed: ${err.message || err}`);
      }
    }

    // Local fallback
    const localSub = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sub_' + Math.random().toString(36).substring(2, 9),
      ...newSubmission,
      score: null,
      percentage: null,
      question_breakdown: {}
    };
    const updated = [localSub, ...submissions];
    setSubmissions(updated);
    saveLocalFallback(challenges, updated, members);
    setShowSubmitModal(null);
  };

  // Trigger Round Robin Assignment
  const handleAssignMarkers = async (challengeId) => {
    const unassigned = submissions.filter(s => s.challenge_id === challengeId && (!s.assigned_marker_id || s.status === 'submitted'));
    if (unassigned.length === 0) {
      alert('All current submissions already have an assigned marker!');
      return;
    }

    const assigned = assignMarkersRoundRobin(unassigned, members);

    if (dbStatus.online) {
      try {
        for (const sub of assigned) {
          await supabase.from('cohort_submissions').update({
            assigned_marker_id: sub.assigned_marker_id,
            assigned_marker_name: sub.assigned_marker_name,
            assigned_at: sub.assigned_at,
            status: 'assigned'
          }).eq('id', sub.id);
        }
        loadData();
        return;
      } catch (e) {
        console.warn('Assigning markers on Supabase failed, updating local state:', e);
      }
    }

    // Local update
    const updatedSubs = submissions.map(s => {
      const match = assigned.find(a => a.id === s.id);
      return match || s;
    });
    setSubmissions(updatedSubs);
    saveLocalFallback(challenges, updatedSubs, members);
  };

  // Handle marker submitting graded marks and feedback
  const handleSaveMarks = async ({ submissionId, score, maxScore, feedbackNotes, breakdown }) => {
    const pct = Math.round((Number(score) / Number(maxScore || 70)) * 100);
    const updatePayload = {
      score: Number(score),
      max_score: Number(maxScore || 70),
      percentage: pct,
      feedback_notes: feedbackNotes,
      question_breakdown: breakdown || {},
      status: 'marked',
      marked_at: new Date().toISOString()
    };

    if (dbStatus.online) {
      try {
        await supabase.from('cohort_submissions').update(updatePayload).eq('id', submissionId);
        loadData();
        setShowMarkingModal(null);
        return;
      } catch (e) {
        console.warn('Saving marks to Supabase failed, updating local:', e);
      }
    }

    // Local update
    const updatedSubs = submissions.map(s => s.id === submissionId ? { ...s, ...updatePayload } : s);
    setSubmissions(updatedSubs);
    saveLocalFallback(challenges, updatedSubs, members);
    setShowMarkingModal(null);
  };

  // Submissions assigned to ME to mark
  const myMarkingQueue = useMemo(() => {
    return submissions.filter(s => {
      const isAssignedToMe = s.assigned_marker_id === currentUserId ||
        (s.assigned_marker_name && s.assigned_marker_name.toLowerCase() === currentUserName.toLowerCase());
      return isAssignedToMe && s.status !== 'marked';
    });
  }, [submissions, currentUserId, currentUserName]);

  // Submissions already marked by ME
  const myCompletedMarking = useMemo(() => {
    return submissions.filter(s => {
      const isAssignedToMe = s.assigned_marker_id === currentUserId ||
        (s.assigned_marker_name && s.assigned_marker_name.toLowerCase() === currentUserName.toLowerCase());
      return isAssignedToMe && s.status === 'marked';
    });
  }, [submissions, currentUserId, currentUserName]);

  // Leaderboard metrics calculation
  const leaderboardStats = useMemo(() => {
    const studentMap = {};

    // Initialize all members
    members.forEach(m => {
      studentMap[m.user_id] = {
        userId: m.user_id,
        userName: m.user_name,
        role: m.role,
        submissionsCount: 0,
        markedCount: 0,
        totalPercentage: 0,
        avgPrecision: 0,
        scores: [],
        papersMarkedForOthers: 0
      };
    });

    // Aggregate submissions
    submissions.forEach(sub => {
      if (!studentMap[sub.student_id]) {
        studentMap[sub.student_id] = {
          userId: sub.student_id,
          userName: sub.student_name,
          role: 'member',
          submissionsCount: 0,
          markedCount: 0,
          totalPercentage: 0,
          avgPrecision: 0,
          scores: [],
          papersMarkedForOthers: 0
        };
      }
      const entry = studentMap[sub.student_id];
      entry.submissionsCount += 1;
      if (sub.status === 'marked' && sub.percentage != null) {
        entry.markedCount += 1;
        entry.totalPercentage += sub.percentage;
        entry.scores.push({
          paperTitle: sub.paper_title,
          pct: sub.percentage,
          marker: sub.assigned_marker_name,
          notes: sub.feedback_notes
        });
      }

      // Track who did marking
      if (sub.status === 'marked' && sub.assigned_marker_id && studentMap[sub.assigned_marker_id]) {
        studentMap[sub.assigned_marker_id].papersMarkedForOthers += 1;
      }
    });

    return Object.values(studentMap).map(s => {
      s.avgPrecision = s.markedCount > 0 ? Math.round(s.totalPercentage / s.markedCount) : 0;
      return s;
    }).sort((a, b) => {
      // Sort primarily by avg precision, secondarily by count
      if (b.avgPrecision !== a.avgPrecision) return b.avgPrecision - a.avgPrecision;
      return b.submissionsCount - a.submissionsCount;
    });
  }, [members, submissions]);

  // GATE 1: Logged-in students only
  if (!authUser) {
    return (
      <div className="study-flow" style={{ maxWidth: '620px', margin: '48px auto', padding: '16px' }}>
        <div style={{
          background: 'var(--surface-raised)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(53,91,79,0.12)',
            color: 'var(--brand-experiment)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px'
          }}>
            <Lock size={26} />
          </div>

          <span className="pill" style={{ backgroundColor: 'rgba(53,91,79,0.12)', color: 'var(--brand-experiment)', fontWeight: 600, marginBottom: '12px' }}>
            FRIENDS ONLY
          </span>

          <h2 style={{ fontSize: '24px', margin: '12px 0 8px', color: 'var(--header-primary)', fontWeight: 700 }}>
            Paper Run &amp; Peer Marking
          </h2>

          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: '460px' }}>
            Weekly trial sets, paper runs, and peer marking boards for your study squad. Sign in with your Google account to jump in.
          </p>

          {authContext?.authError && (
            <div style={{
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              lineHeight: 1.5,
              marginBottom: '20px',
              textAlign: 'left',
              color: 'var(--text-normal)'
            }}>
              <div style={{ fontWeight: 600, color: '#d97706', marginBottom: '4px' }}>
                Sign-In Notice:
              </div>
              <div>{authContext.authError}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '14px', gap: '8px', fontWeight: 600 }}
              onClick={() => authContext?.signInWithGoogle ? authContext.signInWithGoogle() : null}
            >
              <LogIn size={16} />
              <span>Sign in with Google</span>
            </button>
          </div>

          <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ShieldCheck size={14} color="var(--brand-experiment)" />
            <span>Private study cohort hosted on your dedicated domain.</span>
          </div>
        </div>
      </div>
    );
  }

  // GATE 2: Private Squad Invite Code Gate
  if (!isUserEnrolled) {
    return (
      <div className="study-flow" style={{ maxWidth: '580px', margin: '48px auto', padding: '16px' }}>
        <div style={{
          background: 'var(--surface-raised)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          padding: '40px 32px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(53,91,79,0.12)',
            color: 'var(--brand-experiment)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <KeyRound size={26} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span className="pill" style={{ backgroundColor: 'rgba(53,91,79,0.12)', color: 'var(--brand-experiment)', fontWeight: 600, marginBottom: '8px' }}>
              FRIENDS ONLY
            </span>
            <h2 style={{ fontSize: '22px', margin: '10px 0 6px', color: 'var(--header-primary)', fontWeight: 700 }}>
              Join the Paper Run
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 10px', lineHeight: 1.5 }}>
              Signed in as <strong style={{ color: 'var(--header-primary)' }}>{currentUserName}</strong> ({authUser.email})
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
              This paper run is for your friend group. Enter your group's invite code to jump in.
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleJoinSquadByCode(); }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--header-primary)', marginBottom: '8px' }}>
                Secret Invite Code
              </label>
              <input
                type="text"
                placeholder="e.g. SQUAD-CODE"
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value.toUpperCase());
                  if (joinError) setJoinError('');
                }}
                className="search-input"
                style={{
                  width: '100%',
                  letterSpacing: '2px',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '12px 14px'
                }}
                autoFocus
              />
            </div>

            {joinError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ef4444',
                fontSize: '13px',
                marginBottom: '16px',
                background: 'rgba(239, 68, 68, 0.08)',
                padding: '10px 14px',
                borderRadius: '8px'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{joinError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!joinCodeInput.trim() || joinLoading}
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600, gap: '8px' }}
            >
              {joinLoading ? <RefreshCw size={15} className="spin" /> : <ShieldCheck size={16} />}
              <span>{joinLoading ? 'Checking Code...' : 'Hop on Paper Run'}</span>
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            Need an invite code? Ask your friend who started the paper run.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="study-flow" style={{ maxWidth: '1240px', margin: '0 auto', padding: '16px 20px 60px' }}>
      
      {/* Join Success Notification */}
      {joinSuccess && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: 'var(--status-positive)',
          borderRadius: '10px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px'
        }}>
          <CheckCircle2 size={18} />
          <span>{joinSuccess}</span>
        </div>
      )}

      {/* Top Banner: Cohort Identity & Actions */}
      <div className="mast" style={{ alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="pill" style={{ backgroundColor: 'rgba(53,91,79,0.12)', color: 'var(--brand-experiment)', fontWeight: 600 }}>
              <Users size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              PAPER RUN
            </span>
            <span className="pill" style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text-muted)', fontSize: '11px' }}>
              {members.length} Friends
            </span>
          </div>
          <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 700, color: 'var(--header-primary)' }}>
            {activeCohort?.name || 'RHHS Ext 1 Squad'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {activeCohort?.description || 'Collaborative school sets & peer marking board'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Active Student Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--surface-raised)',
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            fontSize: '13px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)'
            }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Logged in as:
            </span>
            <strong style={{ color: 'var(--header-primary)', fontWeight: 600 }}>
              {currentUserName}
            </strong>
          </div>

          {/* Share / Invite Friends Button */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', gap: '6px' }}
            onClick={() => setShowShareInviteModal(true)}
            title="Private invite code for friends"
          >
            <Share2 size={14} />
            <span>Invite Friends</span>
          </button>

          {/* Switch Squad Button */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', gap: '6px' }}
            onClick={() => setShowJoinModal(true)}
            title="Switch squad or join with another invite code"
          >
            <UserPlus size={14} />
            <span>Switch Squad</span>
          </button>

          {/* Supabase status indicator */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', gap: '6px' }}
            onClick={() => setShowSqlModal(true)}
            title="Supabase Database Status & Setup"
          >
            <Database size={14} color={dbStatus.online ? 'var(--status-positive)' : 'var(--status-warning)'} />
            <span>{dbStatus.online ? 'Supabase Sync Active' : 'Supabase SQL Setup'}</span>
          </button>

          {/* Create Challenge Button */}
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '13px', gap: '6px' }}
            onClick={() => setShowCreateChallengeModal(true)}
          >
            <Plus size={15} />
            <span>New Paper Run</span>
          </button>
        </div>
      </div>

      {/* SQL Setup Alert if tables not yet detected in Supabase */}
      {dbStatus.checked && !dbStatus.online && (
        <div style={{
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
          border: '1px solid rgba(217, 119, 6, 0.25)',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="#d97706" />
            <div>
              <strong style={{ color: '#d97706', fontSize: '13px' }}>Supabase connected, tables pending: </strong>
              <span style={{ fontSize: '13px', color: 'var(--text-normal)' }}>
                To enable live cloud synchronization between your squad members, run the table script in your Supabase SQL Editor.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={handleCopySql}
            >
              {copiedSql ? <Check size={13} color="var(--status-positive)" /> : <Copy size={13} />}
              <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '4px 12px', gap: '6px' }}
              onClick={() => loadData()}
              title="Check if tables are now live in Supabase"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Test Connection Again</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setShowSqlModal(true)}
            >
              Setup Guide
            </button>
          </div>
        </div>
      )}

      {/* Section Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('challenges')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'challenges' ? '3px solid var(--brand-experiment)' : '3px solid transparent',
            color: activeTab === 'challenges' ? 'var(--header-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'challenges' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BookOpen size={16} />
          Paper Runs ({challenges.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('marking')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'marking' ? '3px solid var(--brand-experiment)' : '3px solid transparent',
            color: activeTab === 'marking' ? 'var(--header-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'marking' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={16} />
          Peer Marking Studio
          {myMarkingQueue.length > 0 && (
            <span style={{
              background: 'var(--brand-experiment)',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '10px',
              fontWeight: 700
            }}>
              {myMarkingQueue.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'leaderboard' ? '3px solid var(--brand-experiment)' : '3px solid transparent',
            color: activeTab === 'leaderboard' ? 'var(--header-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'leaderboard' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Trophy size={16} />
          Leaderboard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'members' ? '3px solid var(--brand-experiment)' : '3px solid transparent',
            color: activeTab === 'members' ? 'var(--header-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'members' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          Squad Roster ({members.length})
        </button>
      </div>

      {/* TAB 1: CHALLENGES & SPRINT PAPERS */}
      {activeTab === 'challenges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {challenges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface-raised)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <BookOpen size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '18px', margin: '0 0 6px', color: 'var(--header-primary)' }}>No paper runs yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 16px' }}>
                Pick a school set and start a paper run with your squad! For example, set 2020–2025 Girraween High for Maths Ext 1.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCreateChallengeModal(true)}
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                Start First Paper Run
              </button>
            </div>
          ) : (
            challenges.map(challenge => {
              const matchedPapers = getPapersForChallenge(challenge);
              const challengeSubs = submissions.filter(s => s.challenge_id === challenge.id);
              const mySubs = challengeSubs.filter(s => s.student_id === currentUserId);
              const unassignedCount = challengeSubs.filter(s => !s.assigned_marker_id || s.status === 'submitted').length;

              return (
                <div
                  key={challenge.id}
                  style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Challenge Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="pill" style={{ background: 'rgba(53,91,79,0.1)', color: 'var(--brand-experiment)', fontWeight: 600 }}>
                          {challenge.subject}
                        </span>
                        <span className="pill" style={{ background: 'var(--surface-sunken)', color: 'var(--text-normal)' }}>
                          {challenge.school} ({challenge.start_year}–{challenge.end_year})
                        </span>
                        {challenge.deadline && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            Due: {new Date(challenge.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 700, color: 'var(--header-primary)' }}>
                        {challenge.title}
                      </h2>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Round Robin Marker Decider Button */}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', gap: '6px' }}
                        onClick={() => handleAssignMarkers(challenge.id)}
                        title="Run round-robin marker decider on all submissions"
                      >
                        <UserCheck size={14} color="var(--brand-experiment)" />
                        <span>Decide Markers ({unassignedCount} pending)</span>
                      </button>
                    </div>
                  </div>

                  {/* Challenge Progress Summary */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px',
                    padding: '12px 16px',
                    background: 'var(--surface-sunken)',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Papers in Set</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--header-primary)' }}>{matchedPapers.length} Papers</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Squad Submissions</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--header-primary)' }}>{challengeSubs.length} Turned In</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Completed</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-experiment)' }}>{mySubs.length} / {matchedPapers.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Marking Mode</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-normal)', marginTop: '4px' }}>
                        {challenge.marking_mode === 'round_robin' ? '🔄 Round-Robin' : '✋ First-Come Claim'}
                      </div>
                    </div>
                  </div>

                  {/* Papers in this Sprint */}
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Sprint Papers
                    </h4>

                    {matchedPapers.length === 0 ? (
                      <div style={{ padding: '16px', background: 'var(--surface-sunken)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        No specific papers found for "{challenge.school}" between {challenge.start_year}–{challenge.end_year} in the database index.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {matchedPapers.map((p, idx) => {
                          const paperId = p.cf || p.pdfUrl || `${p.h}_${p.s}_${p.y}_${p.n}_${idx}`;
                          const mySubmission = mySubs.find(s => s.paper_id === paperId || s.paper_id === p.v || s.paper_id === `${p.n}_${p.y}`);
                          const isCompleted = !!mySubmission;
                          const isMarked = mySubmission?.status === 'marked';

                          return (
                            <div
                              key={`${paperId}-${idx}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: 'var(--surface-card)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                flexWrap: 'wrap',
                                gap: '12px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: isMarked ? 'rgba(62,111,89,0.15)' : isCompleted ? 'rgba(53,91,79,0.1)' : 'var(--surface-sunken)',
                                  color: isMarked ? 'var(--status-positive)' : isCompleted ? 'var(--brand-experiment)' : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {isMarked ? <CheckCircle2 size={18} /> : isCompleted ? <Check size={18} /> : <FileText size={16} />}
                                </div>

                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--header-primary)' }}>
                                    {schools[p.h] || challenge.school} {p.y} {p.c === 'T' ? 'Trial' : 'Exam'}
                                  </div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {subjects[p.s] || challenge.subject} · {p.n}
                                  </div>
                                </div>
                              </div>

                              {/* Status & Actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {mySubmission ? (
                                  <div style={{ textAlign: 'right' }}>
                                    {isMarked ? (
                                      <div>
                                        <span className="pill" style={{ background: 'rgba(62,111,89,0.15)', color: 'var(--status-positive)', fontWeight: 700 }}>
                                          Marked: {mySubmission.score}/{mySubmission.max_score} ({mySubmission.percentage}%)
                                        </span>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                          Marked by {mySubmission.assigned_marker_name || 'Peer'}
                                        </div>
                                      </div>
                                    ) : mySubmission.assigned_marker_name ? (
                                      <div>
                                        <span className="pill" style={{ background: 'rgba(53,91,79,0.1)', color: 'var(--brand-experiment)' }}>
                                          Assigned to {mySubmission.assigned_marker_name}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="pill" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                                        Submitted · Awaiting Marker
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ fontSize: '12px', gap: '6px' }}
                                    onClick={() => setShowSubmitModal({ challenge, paper: p })}
                                  >
                                    <Upload size={13} />
                                    <span>Submit Paper</span>
                                  </button>
                                )}

                                {/* Practice Room Launch */}
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ fontSize: '12px', gap: '4px' }}
                                  onClick={() => {
                                    if (onSelectPaper) onSelectPaper(p);
                                    if (onNavigateToPractice) onNavigateToPractice();
                                  }}
                                  title="Open in Practice Room"
                                >
                                  <Eye size={13} />
                                  <span>View Paper</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: PEER MARKING STUDIO */}
      {activeTab === 'marking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header guidance */}
          <div style={{ padding: '16px 20px', background: 'var(--surface-raised)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 6px', color: 'var(--header-primary)', fontWeight: 700 }}>
              Peer Marking Queue for {currentUserName}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              When a squad mate finishes a paper, it is assigned to you to mark. Check their working, grade against official criteria, and leave advice to boost cohort precision!
            </p>
          </div>

          {/* Pending marking items */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pending Marking ({myMarkingQueue.length})
            </h4>

            {myMarkingQueue.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', background: 'var(--surface-card)', borderRadius: '10px', border: '1px dashed var(--border-subtle)' }}>
                <CheckCircle2 size={32} style={{ color: 'var(--status-positive)', margin: '0 auto 10px' }} />
                <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--header-primary)' }}>Your marking inbox is clear!</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                  No student papers currently awaiting your review. Once members turn in their work, they will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {myMarkingQueue.map(sub => (
                  <div
                    key={sub.id}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="pill" style={{ background: 'rgba(53,91,79,0.1)', color: 'var(--brand-experiment)', fontWeight: 600 }}>
                          Student: {sub.student_name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '16px', margin: '0 0 6px', color: 'var(--header-primary)', fontWeight: 700 }}>
                        {sub.paper_title}
                      </h4>

                      {sub.working_files && sub.working_files.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          📎 {sub.working_files.length} working attachment(s) (iPad PDF / photos)
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', gap: '6px', marginTop: '12px' }}
                      onClick={() => setShowMarkingModal(sub)}
                    >
                      <ShieldCheck size={15} />
                      <span>Start Peer Marking</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past marked papers */}
          {myCompletedMarking.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Completed by You ({myCompletedMarking.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {myCompletedMarking.map(sub => (
                  <div
                    key={sub.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'var(--surface-card)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--header-primary)' }}>
                        {sub.student_name}'s {sub.paper_title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Feedback: "{sub.feedback_notes || 'Marks finalized'}"
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="pill" style={{ background: 'rgba(62,111,89,0.15)', color: 'var(--status-positive)', fontWeight: 700 }}>
                        Awarded: {sub.score}/{sub.max_score} ({sub.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRECISION LEADERBOARD (The Spreadsheet Replacement) */}
      {activeTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '16px 20px', background: 'var(--surface-raised)', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', margin: '0 0 4px', color: 'var(--header-primary)', fontWeight: 700 }}>
                Squad Precision & Accountability Board
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Replaces manual Google Sheets! Ranked by peer-verified precision and sprint paper completions.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span className="pill" style={{ background: 'rgba(53,91,79,0.1)', color: 'var(--brand-experiment)', fontWeight: 600 }}>
                Target: 85%+ Precision
              </span>
            </div>
          </div>

          <div style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', width: '50px' }}>Rank</th>
                  <th style={{ padding: '12px 16px' }}>Student</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Avg Precision</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Completed</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Marked for Peers</th>
                  <th style={{ padding: '12px 16px' }}>Recent Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardStats.map((entry, idx) => {
                  const isCurrent = entry.userId === currentUserId;
                  return (
                    <tr
                      key={`${entry.userId}-${idx}`}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isCurrent ? 'rgba(53,91,79,0.05)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--header-primary)' }}>{entry.userName}</span>
                          {isCurrent && (
                            <span className="pill" style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--brand-experiment)', color: '#fff' }}>
                              You
                            </span>
                          )}
                          {entry.role === 'leader' && (
                            <span className="pill" style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--surface-sunken)' }}>
                              Organizer
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {entry.markedCount > 0 ? (
                          <span style={{
                            fontWeight: 700,
                            fontSize: '15px',
                            color: entry.avgPrecision >= 85 ? 'var(--status-positive)' : 'var(--text-normal)'
                          }}>
                            {entry.avgPrecision}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600 }}>
                        {entry.submissionsCount} papers
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {entry.papersMarkedForOthers} reviews
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                        {entry.scores.length > 0 ? (
                          <span>
                            {entry.scores[entry.scores.length - 1].pct}% on {entry.scores[entry.scores.length - 1].paperTitle}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SQUAD ROSTER */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '16px 20px', background: 'var(--surface-raised)', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', margin: '0 0 4px', color: 'var(--header-primary)', fontWeight: 700 }}>
                Squad Members ({members.length})
              </h3>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Private study squad for {activeCohort?.name}. Keep this code confidential between study group members.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Private Invite Code:</span>
                <code style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '13px',
                  background: 'var(--surface-sunken)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  letterSpacing: showRosterCode ? '1px' : '3px',
                  color: 'var(--header-primary)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {showRosterCode ? (activeCohort?.invite_code || 'RHHS-EXT1') : '••••••••'}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px', height: '28px', gap: '4px' }}
                  onClick={() => setShowRosterCode(!showRosterCode)}
                  title={showRosterCode ? 'Hide invite code' : 'Reveal invite code'}
                >
                  {showRosterCode ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showRosterCode ? 'Hide' : 'Reveal'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px', height: '28px', gap: '4px' }}
                  onClick={handleCopyInvite}
                  title="Copy secret invite code"
                >
                  {copiedInvite ? <Check size={13} color="var(--status-positive)" /> : <Copy size={13} />}
                  <span>{copiedInvite ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowShareInviteModal(true)}
                style={{ fontSize: '12px', gap: '6px' }}
              >
                <Share2 size={14} />
                <span>Invite Friends</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowJoinModal(true)}
                style={{ fontSize: '12px', gap: '6px' }}
              >
                <UserPlus size={14} />
                <span>Join Another Squad</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {members.map((m, idx) => (
              <div
                key={m.id || `${m.user_id}-${idx}`}
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--header-primary)' }}>
                    {m.user_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {m.role === 'leader' ? 'Squad Lead' : 'Cohort Member'}
                  </div>
                </div>

                {m.user_id === currentUserId ? (
                  <span className="pill" style={{ background: 'var(--brand-experiment)', color: '#fff', fontSize: '11px', fontWeight: 600 }}>
                    Active (You)
                  </span>
                ) : (
                  <span className="pill" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)', fontSize: '11px' }}>
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE CHALLENGE */}
      {showCreateChallengeModal && (
        <CreateChallengeModal
          subjects={subjects}
          schools={schools}
          onClose={() => setShowCreateChallengeModal(false)}
          onCreate={async (newCh) => {
            const chPayload = {
              cohort_id: activeCohort.id,
              title: newCh.title,
              subject: newCh.subject,
              school: newCh.school,
              start_year: Number(newCh.start_year),
              end_year: Number(newCh.end_year),
              paper_ids: newCh.paper_ids || [],
              deadline: newCh.deadline || null,
              marking_mode: newCh.marking_mode || 'round_robin',
              status: 'active'
            };

            if (dbStatus.online) {
              try {
                const { data, error } = await supabase.from('cohort_challenges').insert([chPayload]).select().single();
                if (error) {
                  console.error('Supabase challenge create error:', error);
                  alert(`Could not create challenge in Supabase: ${error.message}`);
                  return;
                }
                if (data) {
                  setChallenges(prev => [data, ...prev]);
                  setShowCreateChallengeModal(false);
                  return;
                }
              } catch (e) {
                console.error('Supabase create challenge failed:', e);
                alert(`Error creating challenge: ${e.message || e}`);
                return;
              }
            }

            const localCh = {
              id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ch_' + Math.random().toString(36).substring(2, 9),
              ...chPayload,
              created_at: new Date().toISOString()
            };
            const updated = [localCh, ...challenges];
            setChallenges(updated);
            saveLocalFallback(updated, submissions, members);
            setShowCreateChallengeModal(false);
          }}
        />
      )}

      {/* MODAL 2: SUBMIT WORK (iPad PDF / Photo Upload) */}
      {showSubmitModal && (
        <SubmitPaperModal
          challenge={showSubmitModal.challenge}
          paper={showSubmitModal.paper}
          studentId={currentUserId}
          studentName={currentUserName}
          schools={schools}
          subjects={subjects}
          onClose={() => setShowSubmitModal(null)}
          onSubmit={handleSubmitWork}
        />
      )}

      {/* MODAL 3: PEER MARKING STUDIO (Side-by-side) */}
      {showMarkingModal && (
        <PeerMarkingStudioModal
          submission={showMarkingModal}
          onClose={() => setShowMarkingModal(null)}
          onSave={handleSaveMarks}
        />
      )}

      {/* MODAL 4: SUPABASE SETUP ASSISTANT */}
      {showSqlModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface-raised)',
            borderRadius: '12px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={20} color="var(--brand-experiment)" />
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--header-primary)' }}>
                  Supabase Project & Database Setup
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setShowSqlModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-normal)', lineHeight: 1.6, marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px' }}>
                Your portal is connected to your dedicated Supabase project:
              </p>
              <div style={{ background: 'var(--surface-sunken)', padding: '8px 12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', marginBottom: '14px' }}>
                {SUPABASE_PROJECT_URL}
              </div>
              <p style={{ margin: '0 0 10px' }}>
                To enable live synchronization across your squad's phones, laptops, and iPads, execute this SQL script in your Supabase project:
              </p>
              <ol style={{ paddingLeft: '20px', margin: '0 0 14px' }}>
                <li>Open your Supabase dashboard at <strong>supabase.com</strong></li>
                <li>Go to <strong>SQL Editor</strong> on the left sidebar</li>
                <li>Click <strong>New Query</strong>, paste the script below, and click <strong>Run</strong></li>
              </ol>
            </div>

            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <pre style={{
                background: '#1a1d1e',
                color: '#e2e8f0',
                padding: '14px',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                maxHeight: '220px',
                overflowY: 'auto',
                margin: 0
              }}>
                {COHORT_SUPABASE_SQL}
              </pre>
              <button
                type="button"
                className="btn btn-primary"
                style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '11px', padding: '4px 10px' }}
                onClick={handleCopySql}
              >
                {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={checkConnection}
              >
                <RefreshCw size={13} style={{ marginRight: '6px' }} />
                Test Connection Again
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowSqlModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Squad Modal */}
      {showJoinModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface-raised)',
            borderRadius: '12px',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} color="var(--brand-experiment)" />
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--header-primary)', fontWeight: 700 }}>
                  Join a Squad
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => { setShowJoinModal(false); setJoinError(''); }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Enter the private invite code given to you by your study group organizer to join their sprint board.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleJoinSquadByCode(); }}>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Enter squad invite code..."
                  value={joinCodeInput}
                  onChange={(e) => {
                    setJoinCodeInput(e.target.value.toUpperCase());
                    if (joinError) setJoinError('');
                  }}
                  className="search-input"
                  style={{ width: '100%', letterSpacing: '2px', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center', fontSize: '16px', padding: '10px' }}
                  autoFocus
                />
              </div>
              {joinError && (
                <div style={{
                  color: '#ef4444',
                  fontSize: '13px',
                  marginBottom: '14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '8px 12px',
                  borderRadius: '6px'
                }}>
                  {joinError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowJoinModal(false); setJoinError(''); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!joinCodeInput.trim() || joinLoading}
                >
                  {joinLoading ? 'Joining...' : 'Join Squad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share / Invite Friends Modal */}
      {showShareInviteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface-raised)',
            borderRadius: '12px',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} color="var(--brand-experiment)" />
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--header-primary)', fontWeight: 700 }}>
                  Invite Friends to Squad
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setShowShareInviteModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
              This invite code grants access to <strong style={{ color: 'var(--header-primary)' }}>{activeCohort?.name}</strong>. Share it only with friends who should participate in this squad.
            </p>

            <div style={{
              background: 'var(--surface-sunken)',
              borderRadius: '8px',
              padding: '14px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Secret Invite Code
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <code style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  letterSpacing: showModalCode ? '2px' : '4px',
                  color: 'var(--header-primary)'
                }}>
                  {showModalCode ? (activeCohort?.invite_code || 'RHHS-EXT1') : '••••••••'}
                </code>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '5px 10px', height: '32px', gap: '4px' }}
                    onClick={() => setShowModalCode(!showModalCode)}
                  >
                    {showModalCode ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showModalCode ? 'Hide' : 'Reveal'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '5px 12px', height: '32px', gap: '5px' }}
                    onClick={handleCopyInvite}
                  >
                    {copiedInvite ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedInvite ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.4 }}>
              💡 When your friends visit your domain, they sign in with their Google account and enter this secret code to join the cohort.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowShareInviteModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ---------------- SUB-COMPONENTS ----------------

/**
 * Modal to create a new challenge / school set sprint
 */
function CreateChallengeModal({ subjects, schools, onClose, onCreate }) {
  const [title, setTitle] = useState('Week 1 Run: Girraween (2020–2025)');
  const [subject, setSubject] = useState('Maths Ext 1');
  const [school, setSchool] = useState('Girraween');
  const [startYear, setStartYear] = useState(2020);
  const [endYear, setEndYear] = useState(2025);
  const [markingMode, setMarkingMode] = useState('round_robin');
  const [deadlineDays, setDeadlineDays] = useState(7);

  // Quick school suggestions commonly used for Ext 1 & trial sets
  const commonSchools = ['Girraween', 'North Sydney Boys', 'Baulkham Hills', 'James Ruse', 'Sydney Boys', 'Normanhurst Boys', 'Sydney Girls', 'Hurlstone'];

  const handleSubmit = (e) => {
    e.preventDefault();
    const deadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();
    onCreate({
      title,
      subject,
      school,
      start_year: Number(startYear),
      end_year: Number(endYear),
      deadline,
      marking_mode: markingMode,
      paper_ids: []
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface-raised)',
        borderRadius: '12px',
        maxWidth: '540px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--header-primary)', fontWeight: 700 }}>
            Start a Paper Run
          </h3>
          <button type="button" className="btn btn-secondary btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Paper Run Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="search-input"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
              >
                {subjects.length > 0 ? subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                )) : (
                  <>
                    <option value="Maths Ext 1">Maths Ext 1</option>
                    <option value="Maths Ext 2">Maths Ext 2</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Physics">Physics</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Target School
              </label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                required
                className="search-input"
                style={{ width: '100%' }}
                list="school-suggestions"
              />
              <datalist id="school-suggestions">
                {Array.isArray(schools) ? schools.map((sch, i) => (
                  <option key={i} value={sch} />
                )) : null}
              </datalist>
            </div>
          </div>

          {/* Quick school chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {commonSchools.map(sch => (
              <button
                key={sch}
                type="button"
                onClick={() => {
                  setSchool(sch);
                  setTitle(`Week Sprint: ${sch} (${startYear}–${endYear})`);
                }}
                className="pill"
                style={{
                  fontSize: '11px',
                  background: school === sch ? 'var(--brand-experiment)' : 'var(--surface-sunken)',
                  color: school === sch ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {sch}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Start Year
              </label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                min={2000}
                max={2026}
                className="search-input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                End Year
              </label>
              <input
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                min={2000}
                max={2026}
                className="search-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Marking Mode
              </label>
              <select
                value={markingMode}
                onChange={(e) => setMarkingMode(e.target.value)}
                className="search-input"
                style={{ width: '100%' }}
              >
                <option value="round_robin">🔄 Round-Robin (Fair Matching)</option>
                <option value="claim">✋ First-Come Claim Pool</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Sprint Duration
              </label>
              <select
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(Number(e.target.value))}
                className="search-input"
                style={{ width: '100%' }}
              >
                <option value={3}>3 Days (Speed Sprint)</option>
                <option value={7}>1 Week (Standard)</option>
                <option value={14}>2 Weeks</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Challenge</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal to submit written work / iPad PDF / photos for peer marking
 */
function SubmitPaperModal({ challenge, paper, studentId, studentName, schools, subjects, onClose, onSubmit }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setUploading(true);
    setUploadProgress('Preparing files...');

    const uploaded = [];
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${selected.length})...`);
      const res = await uploadWorkingFile(file, studentId, paper.v || paper.n);
      uploaded.push(res);
    }

    setFiles(prev => [...prev, ...uploaded]);
    setUploading(false);
    setUploadProgress('');
  };

  const handleFinish = (e) => {
    e.preventDefault();
    onSubmit({
      challengeId: challenge.id,
      paper,
      files,
      notes,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface-raised)',
        borderRadius: '12px',
        maxWidth: '520px',
        width: '100%',
        padding: '24px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="pill" style={{ background: 'rgba(53,91,79,0.1)', color: 'var(--brand-experiment)', fontWeight: 600, marginBottom: '4px' }}>
              SUBMIT FOR PEER MARKING
            </span>
            <h3 style={{ margin: '4px 0 0', fontSize: '17px', color: 'var(--header-primary)', fontWeight: 700 }}>
              {schools[paper.h] || 'School'} {paper.y} ({subjects[paper.s] || 'HSC'})
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Submitting as: <strong>{studentName || 'Student'}</strong>
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleFinish} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* File Upload Zone */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Upload Working (iPad PDF or Photos)
            </label>
            <div style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: '8px',
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--surface-card)',
              cursor: 'pointer'
            }}>
              <Upload size={24} style={{ color: 'var(--brand-experiment)', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--header-primary)', marginBottom: '2px' }}>
                Tap or drag files to upload
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                GoodNotes PDF, Notability export, or camera photos of your written paper
              </div>
              <input
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="working-file-input"
              />
              <label htmlFor="working-file-input" className="btn btn-secondary" style={{ marginTop: '12px', display: 'inline-flex', fontSize: '12px', cursor: 'pointer' }}>
                Select PDF or Photos
              </label>
            </div>
            {uploadProgress && (
              <div style={{ fontSize: '12px', color: 'var(--brand-experiment)', marginTop: '6px' }}>
                {uploadProgress}
              </div>
            )}
          </div>

          {/* Uploaded File List */}
          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Attached Files ({files.length})
              </div>
              {files.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--surface-sunken)', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                    📎 {f.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Notes for Marker */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Notes for your Marker (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Please check Question 14 part (b) induction step, wasn't sure if I lost marks there!"
              className="search-input"
              style={{ width: '100%', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading}
            >
              <Send size={13} style={{ marginRight: '6px' }} />
              Submit Paper
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Peer Marking Studio Modal
 * Side-by-side: student working viewer + score entry & feedback
 */
function PeerMarkingStudioModal({ submission, onClose, onSave }) {
  const [score, setScore] = useState(submission.score ?? 60);
  const [maxScore, setMaxScore] = useState(submission.max_score ?? 70);
  const [feedbackNotes, setFeedbackNotes] = useState(submission.feedback_notes || '');
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const files = submission.working_files || [];
  const currentFile = files[activeFileIndex];

  const precision = Math.round((Number(score) / Number(maxScore || 70)) * 100);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      submissionId: submission.id,
      score: Number(score),
      maxScore: Number(maxScore),
      feedbackNotes,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--surface-raised)',
        borderRadius: '12px',
        maxWidth: '1100px',
        width: '100%',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        {/* Studio Topbar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-sunken)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pill" style={{ background: 'var(--brand-experiment)', color: '#fff', fontSize: '11px', fontWeight: 600 }}>
                MARKING STUDIO
              </span>
              <strong style={{ fontSize: '15px', color: 'var(--header-primary)' }}>
                {submission.student_name}'s Working — {submission.paper_title}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: precision >= 85 ? 'var(--status-positive)' : 'var(--text-normal)' }}>
              Live Precision: {precision}% ({score}/{maxScore})
            </span>
            <button type="button" className="btn btn-secondary btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Studio Split Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', flex: 1, minHeight: 0 }}>
          {/* Left Panel: Submitted Working Document Viewer */}
          <div style={{
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface-card)',
            minHeight: 0
          }}>
            {/* File Switcher Tabs if multiple */}
            {files.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                {files.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveFileIndex(i)}
                    className="pill"
                    style={{
                      fontSize: '11px',
                      background: activeFileIndex === i ? 'var(--brand-experiment)' : 'var(--surface-card)',
                      color: activeFileIndex === i ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Page {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Viewer Stage */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto', background: '#202225' }}>
              {currentFile ? (
                currentFile.fileType?.includes('pdf') || currentFile.fileName?.endsWith('.pdf') ? (
                  <iframe
                    src={currentFile.url}
                    title="Student Working PDF"
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: '6px' }}
                  />
                ) : (
                  <img
                    src={currentFile.url}
                    alt="Student Handwritten Working"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }}
                  />
                )
              ) : (
                <div style={{ color: '#aaa', textAlign: 'center' }}>
                  <FileText size={36} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                  <div>No working files attached to this submission.</div>
                  <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Marking based on direct discussion or paper handout.</div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Grading & Criteria Input */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflowY: 'auto' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: 'var(--header-primary)', fontWeight: 700 }}>
                  Mark Allocation
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Enter total score out of maximum possible marks for this paper.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Marks Awarded
                  </label>
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    min={0}
                    max={maxScore}
                    required
                    className="search-input"
                    style={{ width: '100%', fontSize: '16px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Out of Maximum
                  </label>
                  <input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    min={1}
                    required
                    className="search-input"
                    style={{ width: '100%', fontSize: '16px', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Feedback Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Marker Feedback & Constructive Critique
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  rows={6}
                  required
                  placeholder="e.g. Lost 2 marks on Q12(b) for not specifying the inductive hypothesis domain. Great algebraic steps on the circle geometry proof!"
                  className="search-input"
                  style={{ width: '100%', resize: 'none', lineHeight: 1.5 }}
                />
              </div>

              {/* Rubric Reminders */}
              <div style={{ background: 'var(--surface-sunken)', padding: '12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--header-primary)' }}>Peer Marking Tips:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                  <li>Check deduction justifications for every algebraic step.</li>
                  <li>Verify domain &amp; range restrictions on inverse functions and calculus.</li>
                  <li>Be rigorous so the student gains true HSC precision.</li>
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <CheckCircle2 size={15} />
                  <span>Submit Marks & Return to Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
