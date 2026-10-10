import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  signInWithUniversal,
  signInWithGmailScope,
  logout,
  initAuth,
  getAccessToken,
  requestGmailScope,
  SignInResult,
} from './auth';
import {
  Sparkles,
  Inbox,
  AlertTriangle,
  ListTodo,
  Clock,
  Send,
  Copy,
  Check,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  Calendar,
  Zap,
  Info,
  X,
  FileText,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Lock,
  PlusCircle,
  FileCode,
  AlertCircle,
  UploadCloud,
  Share2,
  ArrowUpDown,
  SlidersHorizontal,
  HelpCircle,
  Key,
  Globe,
  Tag,
  CheckCheck,
  Eye,
  EyeOff,
  Bookmark,
  Trash2,
  Bot,
  Moon,
  Sun,
  BarChart2,
  Bell,
  Download,
  Printer,
  Filter,
  MessageSquare,
  CheckSquare,
  Square,
} from 'lucide-react';

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

interface KeyEntities {
  dates: string[];
  links: string[];
  people: string[];
}

export interface EmailTag {
  name: string;
  color: string; // 'purple' | 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan'
}

interface EmailItem {
  id: string;
  sender: string;
  subject: string;
  date: string;
  raw_body: string;
  summary: string;
  action_required: boolean;
  tasks: TaskItem[];
  urgency: 'High' | 'Medium' | 'Low' | 'FYI';
  deadline: string | null;
  key_entities: KeyEntities;
  suggested_reply: string;
  is_read?: boolean;
  category?: string;
  sentiment?: string;
  tags?: EmailTag[];
  created_at: string;
}

interface Stats {
  total_emails: number;
  high_urgency: number;
  action_required: number;
  pending_tasks: number;
  total_tasks: number;
  unread_count?: number;
}

// ==============================================================================
// Error Boundary
// ==============================================================================
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
          <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-md max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred in the application.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Fast evaluation presets
const PRESET_SAMPLES = [
  {
    label: '🚨 Production Outage (High Urgency)',
    sender: 'Sarah Jenkins <sarah.jenkins@acmecloud.io>',
    subject: 'CRITICAL: Production API Gateway 502 Outage - Immediate Client Impact',
    body: `Hi Team,\n\nWe are seeing a 42% spike in 502 Bad Gateway responses on our main US-East cluster since 09:45 AM. Enterprise clients including Apex Financial are currently unable to authenticate their webhooks.\n\nAction Required Immediately:\n1. DevOps must roll back release v2.4.1 deployment on Kubernetes cluster east-1.\n2. Engineering leads must join the incident bridge at https://meet.google.com/xyz-incident-bridge.\n3. Draft initial status page update for executive review by 11:00 AM.\n\nPlease acknowledge receipt ASAP.\n\nSarah Jenkins\nDirector of Infrastructure, Acme Cloud`,
  },
  {
    label: '🛡️ SOC2 Security Audit (Action Required)',
    sender: 'Marcus Vance <ciso-audits@cybervanguard.io>',
    subject: 'Security Notice: Annual SOC2 Type II Audit & Access Key Rotation',
    body: `Dear Engineering Leads,\n\nOur annual SOC2 Type II compliance audit begins on October 14, 2026. The independent security review team requires evidence of key access policy enforcement.\n\nPlease complete the following compliance steps before October 12, 2026 EOD:\n- Rotate all production API tokens and database credentials older than 90 days.\n- Confirm multi-factor authentication enforcement across all developer workstations.\n- Acknowledge zero-trust policy guidelines at https://security.cybervanguard.io/compliance.\n\nThank you for maintaining our security posture.\n\nMarcus Vance\nChief Information Security Officer`,
  },
  {
    label: '📅 Executive Board Sync (Medium Urgency)',
    sender: 'David Chen <d.chen@venturebridge.vc>',
    subject: 'Reschedule: Seed Round Discussion & Technical Architecture Deep Dive',
    body: `Hi Team,\n\nDue to an urgent board meeting on Thursday morning, I need to reschedule our 30-minute sync regarding your enterprise AI product. Could we move the meeting to Friday, October 10 at 3:30 PM PST or Monday, October 13 at 11:00 AM PST?\n\nPlease confirm if either slot works for your calendar. Also, please attach your updated unit economics sheet if ready.\n\nLooking forward to catching up,\nDavid Chen\nPartner, VentureBridge`,
  },
  {
    label: '💳 Cloud Billing & Quota Warning (High Urgency)',
    sender: 'GCP Cloud Billing Alert <billing-alerts@google.com>',
    subject: 'URGENT: Cloud Billing Account Spending Anomaly - 90% Quota Exceeded',
    body: `Dear Project Administrator,\n\nYour Google Cloud Project "gen-lang-client-0007418410" has consumed 93.4% of its allocated monthly compute and API credits due to increased throughput on Gemini 3.8 Flash model inference.\n\nRequired Actions:\n1. Audit active API client keys and rate limit allocations.\n2. Review and acknowledge billing ceiling adjustment before October 10, 2026.\n3. Verify webhook endpoints in GCP Console at https://console.cloud.google.com/billing.\n\nSincerely,\nGoogle Cloud Platform Team`,
  },
  {
    label: '📊 Infrastructure Architecture Review (Medium Urgency)',
    sender: 'Dr. Ananya Roy <vp.engineering@acmecloud.io>',
    subject: 'Agenda & Review: Q4 Infrastructure Architecture & AI Evaluation Matrix',
    body: `Hello Team Leads,\n\nPlease review the attached architecture evaluation matrix for the upcoming executive steering call this Friday at 4:00 PM.\n\nPreparation checklist:\n- Ensure latency benchmarks are recorded (<350ms p95 response time).\n- Confirm zero-trust OAuth 2.0 verification status across all client modules.\n- Share slide decks by Thursday 5:00 PM.\n\nWarm regards,\nDr. Ananya Roy`,
  },
];

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hasGmailScope, setHasGmailScope] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_emails: 0,
    high_urgency: 0,
    action_required: 0,
    pending_tasks: 0,
    total_tasks: 0,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'All' | 'High' | 'Action Required' | 'FYI' | 'Unread'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'urgency' | 'newest' | 'action' | 'unread'>('urgency');

  // Select Multiple & Bulk Operations
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('inboxpulse_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('inboxpulse_theme', next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  };

  // Analytics Suite Modal
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);

  // Copilot AI Assistant
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [copilotMessages, setCopilotMessages] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; text: string; time: string }>
  >([
    {
      id: 'welcome',
      role: 'assistant',
      text: "👋 Hi! I'm your **Inbox Copilot**. I analyze your synchronized Gmail messages, prioritize action items, and draft replies.\n\nTry asking me:\n- *\"Summarize my high urgency bills\"*\n- *\"What tasks are due this week?\"*\n- *\"Draft a reply to David Chen\"*",
      time: 'Just now',
    },
  ]);
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);

  // Toast notification system
  const [toasts, setToasts] = useState<
    Array<{ id: string; type: 'success' | 'error' | 'info' | 'warning'; message: string }>
  >([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Notification center
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; time: string; title: string; desc: string; type: 'urgent' | 'sync' | 'task' | 'cal' }>
  >([
    {
      id: 'notif_welcome',
      time: 'Just now',
      title: 'InboxPulse Agent Active',
      desc: 'Autonomous intelligence engine ready with Gemini.',
      type: 'sync',
    },
  ]);

  const addNotification = (notif: { title: string; desc: string; type: 'urgent' | 'sync' | 'task' | 'cal' }) => {
    setNotifications((prev) => [
      {
        id: `notif_${Date.now()}`,
        time: 'Just now',
        ...notif,
      },
      ...prev.slice(0, 19),
    ]);
  };

  // Action states
  const [sendingGmail, setSendingGmail] = useState<boolean>(false);
  const [addingToCalendar, setAddingToCalendar] = useState<string | null>(null);

  // Tag Management State
  const [taggingEmail, setTaggingEmail] = useState<EmailItem | null>(null);
  const [newTagName, setNewTagName] = useState<string>('');
  const [newTagColor, setNewTagColor] = useState<string>('indigo');

  // Modals state
  const [selectedReplyEmail, setSelectedReplyEmail] = useState<EmailItem | null>(null);
  const [customReplyText, setCustomReplyText] = useState<string>('');
  const [replyTone, setReplyTone] = useState<string>('professional');
  const [regeneratingReply, setRegeneratingReply] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedRawIds, setExpandedRawIds] = useState<string[]>([]);
  const [briefingCopied, setBriefingCopied] = useState<boolean>(false);

  // Manual Email Ingestion Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualSender, setManualSender] = useState<string>(PRESET_SAMPLES[0].sender);
  const [manualSubject, setManualSubject] = useState<string>(PRESET_SAMPLES[0].subject);
  const [manualBody, setManualBody] = useState<string>(PRESET_SAMPLES[0].body);
  const [processingManual, setProcessingManual] = useState<boolean>(false);

  // Fetch cached emails
  const fetchCachedEmails = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/emails');
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
      }
      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to load emails:', err);
    } finally {
      setLoading(false);
    }
  };

  // Clear messages from current view
  const handleClearInbox = async () => {
    try {
      setLoading(true);
      await fetch('/api/emails/clear', { method: 'POST' });
      setEmails([]);
      setStats({
        total_emails: 0,
        high_urgency: 0,
        action_required: 0,
        pending_tasks: 0,
        total_tasks: 0,
      });
      addToast('Inbox view reset successfully', 'info');
    } catch (err) {
      console.error('Failed to clear inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync real inbox messages using Google OAuth Bearer token
  const syncGmailInbox = useCallback(async (authToken: string) => {
    try {
      setSyncing(true);
      setSyncError(null);

      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: authToken,
          clear_demo: true,
          max_results: 35,
          q: 'in:inbox',
        }),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (parseErr) {
        console.error('Failed to parse Gmail sync response:', resText);
        throw new Error(
          res.status === 401
            ? 'Gmail OAuth session expired. Please re-authenticate.'
            : `Sync error (${res.status}): Server returned unexpected content.`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync Gmail inbox');
      }

      setEmails(data.emails || []);

      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        try {
          const statsData = await statsRes.json();
          if (statsData.success) {
            setStats(statsData);
          }
        } catch {}
      }

      addToast(`Synchronized ${data.new_analyzed ?? data.count ?? 0} messages from your mailbox!`, 'success');
      addNotification({
        title: 'Gmail Inbox Synced',
        desc: `Retrieved ${data.count ?? 0} messages with AI summaries`,
        type: 'sync',
      });
    } catch (err: any) {
      console.error('Sync Gmail error:', err);
      setSyncError(err.message || 'Unable to sync live Gmail inbox.');
    } finally {
      setSyncing(false);
    }
  }, []);

  // Sync user-mapped sample messages if live Gmail restricted
  const syncUserSampleData = async (userEmail?: string, userName?: string) => {
    try {
      setSyncing(true);
      setSyncError(null);

      const res = await fetch('/api/user/sync-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: userEmail || user?.email || 'user@gmail.com',
          user_name: userName || user?.displayName || 'Lead',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData);
        }
      }
    } catch (err: any) {
      console.error('User sample sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (authUser, authToken, hasGmail) => {
        setUser(authUser);
        setAuthLoading(false);
        if (authToken) {
          setToken(authToken);
          setHasGmailScope(hasGmail);
          await syncGmailInbox(authToken);
        } else {
          setHasGmailScope(false);
          await fetchCachedEmails();
        }
      },
      () => {
        setUser(null);
        setToken(null);
        setHasGmailScope(false);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, [syncGmailInbox]);

  // Universal Google Sign-In (Guaranteed to work for ANY Google account without verification barriers)
  const handleUniversalSignIn = async () => {
    try {
      setIsLoggingIn(true);
      setSyncError(null);
      setAuthNotice(null);

      const result: SignInResult | null = await signInWithUniversal();
      if (result) {
        setUser(result.user);
        setToken(null);
        setHasGmailScope(false);

        // Auto-load personalized inbox intelligence for their actual account!
        await syncUserSampleData(result.user.email || undefined, result.user.displayName || undefined);
      }
    } catch (err: any) {
      console.error('Universal Sign-in error:', err);
      setSyncError(err?.message || 'Failed to authenticate with Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Live Gmail Scope Sign-In (Attempts direct Gmail read-only access)
  const handleLiveGmailSignIn = async () => {
    try {
      setIsLoggingIn(true);
      setSyncError(null);
      setAuthNotice(null);

      const result: SignInResult | null = await signInWithGmailScope();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setHasGmailScope(result.hasGmailScope);

        if (result.notice) {
          setAuthNotice(result.notice);
        }

        if (result.accessToken) {
          await syncGmailInbox(result.accessToken);
        } else {
          // If Gmail scope was restricted by Google, load their personalized workspace
          await syncUserSampleData(result.user.email || undefined, result.user.displayName || undefined);
        }
      }
    } catch (err: any) {
      console.error('Gmail Sign-in error:', err);
      setSyncError(
        'Direct Gmail access was not granted by Google. You can sign in using Universal Google Auth below.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Standard Google Sign-In: Requests live Gmail read/send scopes for full inbox synchronization
  const handleGoogleSignIn = handleLiveGmailSignIn;

  // Explicitly prompt for Gmail scope if user wants to upgrade permissions
  const handleUpgradeGmailScope = async () => {
    try {
      setSyncing(true);
      setSyncError(null);
      const newToken = await requestGmailScope();
      if (newToken) {
        setToken(newToken);
        setHasGmailScope(true);
        setAuthNotice(null);
        await syncGmailInbox(newToken);
      }
    } catch (err: any) {
      console.warn('Upgrade Gmail Scope rejected or restricted:', err);
      setShowVerificationModal(true);
    } finally {
      setSyncing(false);
    }
  };

  // Sign Out
  const handleSignOut = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setHasGmailScope(false);
      setAuthNotice(null);
      setEmails([]);
      setStats({
        total_emails: 0,
        high_urgency: 0,
        action_required: 0,
        pending_tasks: 0,
        total_tasks: 0,
      });
      await fetch('/api/emails/clear', { method: 'POST' });
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Sync button handler
  const handleSyncClick = async () => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = await getAccessToken();
    }
    if (currentToken) {
      await syncGmailInbox(currentToken);
    } else if (user) {
      await handleUpgradeGmailScope();
    } else {
      await syncUserSampleData();
    }
  };

  // Manual Email Analysis with Gemini
  const handleManualEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBody.trim()) return;

    try {
      setProcessingManual(true);
      setSyncError(null);

      const res = await fetch('/api/email/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: manualSender,
          subject: manualSubject,
          body: manualBody,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowManualModal(false);
        if (data.emails) {
          setEmails(data.emails);
        } else {
          await fetchCachedEmails();
        }
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData);
        }
      } else {
        setSyncError(data.error || 'Failed to process email with Gemini.');
      }
    } catch (err: any) {
      console.error('Manual process error:', err);
      setSyncError(err.message || 'Error communicating with Gemini processing server.');
    } finally {
      setProcessingManual(false);
    }
  };

  // Handle file drop / upload (.eml or .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setManualBody(content);
        setManualSubject(file.name.replace(/\.[^/.]+$/, ''));
        setShowManualModal(true);
      }
    };
    reader.readAsText(file);
  };

  const loadPreset = (preset: typeof PRESET_SAMPLES[0]) => {
    setManualSender(preset.sender);
    setManualSubject(preset.subject);
    setManualBody(preset.body);
  };

  const toggleTask = async (emailId: string, taskId: string, completed: boolean) => {
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id === emailId) {
          return {
            ...e,
            tasks: e.tasks.map((t) => (t.id === taskId || t.text === taskId ? { ...t, completed } : t)),
          };
        }
        return e;
      })
    );

    setStats((prev) => ({
      ...prev,
      pending_tasks: completed ? Math.max(0, prev.pending_tasks - 1) : prev.pending_tasks + 1,
    }));

    addToast(completed ? 'Task completed! Checklist progress updated.' : 'Task marked pending.', 'success');

    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed, email_id: emailId }),
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Task patch error:', err);
      fetchCachedEmails();
    }
  };

  // Direct Calendar Event Creation with Google Calendar API / Link
  const handleAddToCalendar = async (email: EmailItem) => {
    try {
      setAddingToCalendar(email.id);
      const res = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email_id: email.id,
          title: `[InboxPulse] ${email.subject}`,
          summary: email.summary,
          deadline: email.deadline,
          access_token: token,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast(data.message || 'Event added to Google Calendar!', 'success');
        addNotification({
          title: 'Calendar Event Created',
          desc: `Scheduled for: ${email.subject}`,
          type: 'cal',
        });
        if (data.html_link) {
          window.open(data.html_link, '_blank');
        }
      } else {
        window.open(getCalendarLink(email), '_blank');
      }
    } catch (err) {
      window.open(getCalendarLink(email), '_blank');
    } finally {
      setAddingToCalendar(null);
    }
  };

  // Direct Send via Gmail API
  const handleSendViaGmail = async () => {
    if (!selectedReplyEmail) return;
    const recipient = selectedReplyEmail.sender.replace(/.*<(.+?)>/, '$1');
    try {
      setSendingGmail(true);
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: recipient,
          subject: selectedReplyEmail.subject.startsWith('Re:')
            ? selectedReplyEmail.subject
            : `Re: ${selectedReplyEmail.subject}`,
          body: customReplyText,
          in_reply_to: selectedReplyEmail.id,
          access_token: token,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast(`Reply dispatched to ${recipient} via Gmail API!`, 'success');
        addNotification({
          title: 'Reply Sent via Gmail',
          desc: `Sent to ${recipient} for "${selectedReplyEmail.subject}"`,
          type: 'sync',
        });
        setSelectedReplyEmail(null);
      } else {
        addToast(data.error || 'Failed to send email via Gmail. Copying draft instead.', 'warning');
        handleCopyReply();
      }
    } catch (err: any) {
      addToast(err.message || 'Error sending via Gmail API. Draft copied to clipboard.', 'warning');
      handleCopyReply();
    } finally {
      setSendingGmail(false);
    }
  };

  // Export CSV Executive Briefing
  const handleExportCSV = () => {
    if (emails.length === 0) return;
    const headers = ['ID', 'Urgency', 'Category', 'Sender', 'Subject', 'Date', 'Action Required', 'Deadline', 'Summary', 'Tasks'];
    const rows = emails.map((e) => [
      `"${e.id}"`,
      `"${e.urgency}"`,
      `"${e.category || 'General'}"`,
      `"${e.sender.replace(/"/g, '""')}"`,
      `"${e.subject.replace(/"/g, '""')}"`,
      `"${e.date}"`,
      `"${e.action_required ? 'Yes' : 'No'}"`,
      `"${e.deadline || 'None'}"`,
      `"${e.summary.replace(/"/g, '""')}"`,
      `"${e.tasks.map((t) => (t.completed ? '[DONE] ' : '[OPEN] ') + t.text).join('; ').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `InboxPulse_Executive_Briefing_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('CSV Executive Briefing downloaded!', 'success');
  };

  // Print Executive Briefing
  const handlePrintBriefing = () => {
    window.print();
  };

  // Toggle multi-select mode
  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedEmailIds([]);
      }
      return !prev;
    });
  };

  // Toggle single email selection
  const toggleSelectEmail = (id: string) => {
    setSelectedEmailIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all visible emails
  const handleSelectAll = () => {
    const allFilteredIds = filteredEmails.map((e) => e.id);
    setSelectedEmailIds(allFilteredIds);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedEmailIds([]);
  };

  // Bulk Mark as Read
  const handleBulkMarkRead = async () => {
    if (selectedEmailIds.length === 0) return;
    const targetIds = [...selectedEmailIds];
    try {
      setBulkLoading(true);
      const res = await fetch('/api/emails/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: targetIds, action: 'mark_read' }),
      });
      const data = await res.json();
      if (data.success) {
        setEmails((prev) =>
          prev.map((e) => (targetIds.includes(e.id) ? { ...e, is_read: true } : e))
        );
        if (data.stats) setStats(data.stats);
        addToast(`Marked ${targetIds.length} emails as Read`, 'success');
        setSelectedEmailIds([]);
      } else {
        addToast(data.error || 'Failed to update emails', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error executing bulk action', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk Mark as Unread
  const handleBulkMarkUnread = async () => {
    if (selectedEmailIds.length === 0) return;
    const targetIds = [...selectedEmailIds];
    try {
      setBulkLoading(true);
      const res = await fetch('/api/emails/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: targetIds, action: 'mark_unread' }),
      });
      const data = await res.json();
      if (data.success) {
        setEmails((prev) =>
          prev.map((e) => (targetIds.includes(e.id) ? { ...e, is_read: false } : e))
        );
        if (data.stats) setStats(data.stats);
        addToast(`Marked ${targetIds.length} emails as Unread`, 'info');
        setSelectedEmailIds([]);
      } else {
        addToast(data.error || 'Failed to update emails', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error executing bulk action', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk Clear from Inbox
  const handleBulkClear = async () => {
    if (selectedEmailIds.length === 0) return;
    const targetIds = [...selectedEmailIds];
    const count = targetIds.length;
    try {
      setBulkLoading(true);
      const res = await fetch('/api/emails/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: targetIds, action: 'delete' }),
      });
      const data = await res.json();
      if (data.success) {
        setEmails((prev) => prev.filter((e) => !targetIds.includes(e.id)));
        if (data.stats) setStats(data.stats);
        addToast(`Cleared ${count} emails from inbox`, 'success');
        addNotification({
          title: 'Bulk Messages Cleared',
          desc: `Removed ${count} messages from inbox view`,
          type: 'sync',
        });
        setSelectedEmailIds([]);
      } else {
        addToast(data.error || 'Failed to clear emails', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error clearing emails', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk Export CSV
  const handleBulkExportCSV = () => {
    const targetEmails = emails.filter((e) => selectedEmailIds.includes(e.id));
    if (targetEmails.length === 0) return;

    const headers = ['ID', 'Date', 'Sender', 'Subject', 'Urgency', 'Category', 'Deadline', 'Summary', 'Tasks'];
    const rows = targetEmails.map((e) => [
      `"${e.id}"`,
      `"${e.date}"`,
      `"${(e.sender || '').replace(/"/g, '""')}"`,
      `"${(e.subject || '').replace(/"/g, '""')}"`,
      `"${e.urgency}"`,
      `"${e.category || 'General'}"`,
      `"${e.deadline || 'None'}"`,
      `"${(e.summary || '').replace(/"/g, '""')}"`,
      `"${e.tasks.map((t) => (t.completed ? '[x] ' : '[ ] ') + t.text).join('; ').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `InboxPulse_Selected_${targetEmails.length}_Emails.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${targetEmails.length} selected emails as CSV!`, 'success');
  };

  // Fetch Analytics & Velocity Suite
  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      setShowAnalyticsModal(true);
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Send Copilot AI Assistant message
  const sendCopilotMessage = async (customQuery?: string) => {
    const queryToSend = customQuery || copilotInput;
    if (!queryToSend.trim()) return;

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      text: queryToSend.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setCopilotMessages((prev) => [...prev, userMsg]);
    if (!customQuery) setCopilotInput('');
    setCopilotLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text }),
      });
      const data = await res.json();
      const assistantMsg = {
        id: `bot_${Date.now()}`,
        role: 'assistant' as const,
        text: data.reply || 'I analyzed your active emails, but no additional details were found.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setCopilotMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          role: 'assistant',
          text: 'Sorry, I encountered a temporary network glitch while consulting Gemini. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const toggleRawBody = (id: string) => {
    setExpandedRawIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle Read / Unread Status
  const toggleReadStatus = async (emailId: string, currentReadStatus?: boolean) => {
    const nextStatus = !currentReadStatus;
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, is_read: nextStatus } : e))
    );

    setStats((prev) => ({
      ...prev,
      unread_count: nextStatus
        ? Math.max(0, (prev.unread_count || 1) - 1)
        : (prev.unread_count || 0) + 1,
    }));

    try {
      await fetch('/api/emails/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId, is_read: nextStatus }),
      });
    } catch (err) {
      console.error('Toggle read status error:', err);
      fetchCachedEmails();
    }
  };

  // Mark All Emails as Read
  const handleMarkAllRead = async () => {
    setEmails((prev) => prev.map((e) => ({ ...e, is_read: true })));
    setStats((prev) => ({ ...prev, unread_count: 0 }));
    try {
      await fetch('/api/emails/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });
    } catch (err) {
      console.error('Mark all read error:', err);
      fetchCachedEmails();
    }
  };

  // Add Tag to Email
  const handleAddTag = async (emailId: string, tagName: string, tagColor: string) => {
    if (!tagName.trim()) return;
    const cleanName = tagName.trim();
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id === emailId) {
          const currentTags = e.tags || [];
          const exists = currentTags.findIndex((t) => t.name.toLowerCase() === cleanName.toLowerCase());
          let updatedTags;
          if (exists >= 0) {
            updatedTags = currentTags.map((t, idx) => (idx === exists ? { ...t, color: tagColor } : t));
          } else {
            updatedTags = [...currentTags, { name: cleanName, color: tagColor }];
          }
          return { ...e, tags: updatedTags };
        }
        return e;
      })
    );

    try {
      await fetch('/api/emails/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId, tag_name: cleanName, color: tagColor }),
      });
    } catch (err) {
      console.error('Add tag error:', err);
      fetchCachedEmails();
    }
  };

  // Remove Tag from Email
  const handleRemoveTag = async (emailId: string, tagName: string) => {
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id === emailId && e.tags) {
          return {
            ...e,
            tags: e.tags.filter((t) => t.name.toLowerCase() !== tagName.toLowerCase()),
          };
        }
        return e;
      })
    );

    try {
      await fetch('/api/emails/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId, tag_name: tagName }),
      });
    } catch (err) {
      console.error('Remove tag error:', err);
      fetchCachedEmails();
    }
  };

  const openReplyModal = (email: EmailItem) => {
    setSelectedReplyEmail(email);
    setCustomReplyText(email.suggested_reply || '');
    setReplyTone('professional');
    setCopied(false);
  };

  const handleToneChange = async (newTone: string) => {
    if (!selectedReplyEmail) return;
    setReplyTone(newTone);
    try {
      setRegeneratingReply(true);
      const res = await fetch('/api/email/regenerate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: selectedReplyEmail.id, tone: newTone }),
      });
      const data = await res.json();
      if (data.success && data.suggested_reply) {
        setCustomReplyText(data.suggested_reply);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingReply(false);
    }
  };

  const handleCopyReply = () => {
    navigator.clipboard.writeText(customReplyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Copy Executive Briefing to clipboard
  const handleExportBriefing = () => {
    if (emails.length === 0) return;

    let briefing = `# 📬 InboxPulse AI — Executive Intelligence Briefing\n`;
    briefing += `**Generated:** ${new Date().toLocaleString()} | **Team:** KITSW WARRIOR (SaaSsum AI)\n\n`;
    briefing += `### Overview Metrics\n`;
    briefing += `- **Total Ingested:** ${stats.total_emails}\n`;
    briefing += `- **High Urgency:** ${stats.high_urgency}\n`;
    briefing += `- **Pending Action Items:** ${stats.pending_tasks}/${stats.total_tasks}\n\n`;
    briefing += `### Priority Communications\n\n`;

    emails.forEach((e, idx) => {
      briefing += `#### ${idx + 1}. [${e.urgency}] ${e.subject}\n`;
      briefing += `- **Sender:** ${e.sender}\n`;
      briefing += `- **Summary:** ${e.summary}\n`;
      if (e.deadline) briefing += `- **Deadline:** ${e.deadline}\n`;
      if (e.tasks.length > 0) {
        briefing += `- **Tasks:**\n`;
        e.tasks.forEach((t) => {
          briefing += `  - [${t.completed ? 'x' : ' '}] ${t.text}\n`;
        });
      }
      briefing += `\n`;
    });

    navigator.clipboard.writeText(briefing);
    setBriefingCopied(true);
    setTimeout(() => setBriefingCopied(false), 2500);
  };

  // Google Calendar URL generator
  const getCalendarLink = (email: EmailItem) => {
    const title = encodeURIComponent(`[InboxPulse] ${email.subject}`);
    const details = encodeURIComponent(
      `Summary: ${email.summary}\n\nTasks:\n${email.tasks.map((t) => '- ' + t.text).join('\n')}\n\nFrom: ${email.sender}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
  };

  // Helper: Tag Color Mapping for Badge Styling
  const getTagBadgeClasses = (color: string) => {
    switch (color) {
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100';
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
      case 'amber':
        return 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100';
      case 'cyan':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100';
      case 'indigo':
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100';
    }
  };

  // Extract all unique tags across emails
  const allUniqueTags = Array.from(
    new Set(
      emails.flatMap((e) => (e.tags || []).map((t) => t.name))
    )
  );

  // Filtered & Sorted emails
  let filteredEmails = emails.filter((item) => {
    if (filter === 'High' && item.urgency !== 'High') return false;
    if (filter === 'Action Required' && !item.action_required) return false;
    if (filter === 'FYI' && item.urgency !== 'FYI') return false;
    if (filter === 'Unread' && item.is_read) return false;

    // Custom Tag Filter
    if (selectedTagFilter !== 'All') {
      if (!item.tags || !item.tags.some((t) => t.name.toLowerCase() === selectedTagFilter.toLowerCase())) {
        return false;
      }
    }

    // Smart Auto-Categorization Filter
    if (categoryFilter !== 'All') {
      const itemCat = (item.category || 'General').toLowerCase();
      if (itemCat !== categoryFilter.toLowerCase()) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const tagsText = (item.tags || []).map((t) => t.name).join(' ');
      const haystack = (
        item.subject +
        ' ' +
        item.sender +
        ' ' +
        item.summary +
        ' ' +
        (item.category || '') +
        ' ' +
        tagsText +
        ' ' +
        item.tasks.map((t) => t.text).join(' ')
      ).toLowerCase();
      return haystack.includes(q);
    }
    return true;
  });

  // Sorting
  filteredEmails.sort((a, b) => {
    if (sortBy === 'urgency') {
      const order = { High: 0, Medium: 1, Low: 2, FYI: 3 };
      return order[a.urgency] - order[b.urgency];
    }
    if (sortBy === 'action') {
      return (b.action_required ? 1 : 0) - (a.action_required ? 1 : 0);
    }
    if (sortBy === 'unread') {
      return (a.is_read ? 1 : 0) - (b.is_read ? 1 : 0);
    }
    return 0; // default order
  });

  // Task completion calculation
  const taskCompletionRate =
    stats.total_tasks > 0
      ? Math.round(((stats.total_tasks - stats.pending_tasks) / stats.total_tasks) * 100)
      : 0;

  return (
    <div
      className={`min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200 ${
        darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white text-xs py-2 px-4 border-b border-indigo-800/40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Zap className="w-3.5 h-3.5 mr-1 text-indigo-400" /> LIVE GMAIL AGENT v2.0
            </span>
            <span className="text-slate-300">
              Team: <strong className="text-white">KITSW WARRIOR</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">
              Track: <strong className="text-indigo-300">SaaSsum AI (IT & AI)</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Google Gemini 3.8 Flash Engine
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" /> Universal OAuth Flow
            </span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    InboxPulse <span className="text-indigo-600">AI</span>
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                    Universal Auth
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Autonomous Gmail Intelligence, Task Checklist & Reply Agent
                </p>
              </div>
            </div>

            {/* Auth Actions in Top Header */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  darkMode
                    ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-750'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Notification Center Trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className={`p-2 rounded-xl border transition cursor-pointer relative ${
                    darkMode
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                  title="Notification Center & Live Alerts"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div
                    className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-xl border z-50 p-3 animate-in fade-in ${
                      darkMode ? 'bg-slate-900 border-slate-750 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Bell className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Live Notifications & Alerts</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                        {notifications.length}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2 rounded-xl text-xs border ${
                            darkMode
                              ? 'bg-slate-800/80 border-slate-700'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                            {n.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Analytics Suite Trigger */}
              <button
                onClick={fetchAnalytics}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition cursor-pointer"
                title="View Analytics & Real-Time Performance Charts"
              >
                <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Analytics</span>
              </button>

              {/* OAuth Verification Guide Modal Trigger */}
              <button
                onClick={() => setShowVerificationModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 transition cursor-pointer"
                title="Google OAuth Verification Status & Instructions"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Guide</span>
              </button>

              {/* Paste / Ingest Email Button */}
              <button
                onClick={() => setShowManualModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Paste Email</span>
                <span className="sm:hidden">Ingest</span>
              </button>

              {authLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-3 py-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Initializing...
                </div>
              ) : user ? (
                /* Authenticated User Status */
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 shadow-xs">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-7 h-7 rounded-full border border-slate-300 object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                      {user.displayName || 'Connected User'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[120px]">
                      {user.email}
                    </p>
                  </div>

                  {/* Gmail Scope Status Badge */}
                  {hasGmailScope ? (
                    <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-md border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Real Gmail Live
                    </span>
                  ) : (
                    <button
                      onClick={handleUpgradeGmailScope}
                      className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold rounded-md border border-indigo-200 transition cursor-pointer"
                      title="Grant Gmail Read Scope"
                    >
                      <Mail className="w-3 h-3 text-indigo-600" />
                      Connect Gmail
                    </button>
                  )}

                  {/* Clear View if messages exist */}
                  {emails.length > 0 && (
                    <button
                      onClick={handleClearInbox}
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg text-[11px] font-medium border border-slate-200 transition cursor-pointer"
                      title="Clear messages from current view"
                    >
                      <Trash2 className="w-3 h-3 text-slate-400" />
                      <span>Clear View</span>
                    </button>
                  )}

                  <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block"></div>

                  <button
                    onClick={handleSyncClick}
                    disabled={syncing}
                    title="Sync Inbox via Gmail API"
                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleSignOut}
                    title="Sign Out"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Unauthenticated: Clean Sign in with Google */
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingIn}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                    title="Sign in with Google to sync your live inbox"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Helpful Authentication Notice Banner */}
      {authNotice && (
        <div className="bg-indigo-50/90 border-b border-indigo-200 text-indigo-950 py-3 px-4 text-xs animate-in fade-in">
          <div className="max-w-7xl mx-auto flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-900">Signed In Successfully as {user?.email}!</p>
                <p className="mt-0.5 text-indigo-800 leading-relaxed">{authNotice}</p>
                {!hasGmailScope && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={handleUpgradeGmailScope}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-semibold transition"
                    >
                      Authorize Direct Gmail Reading
                    </button>
                    <button
                      onClick={() => syncUserSampleData()}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[11px] font-semibold transition"
                    >
                      Sync Real-World Inbox Sample
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setAuthNotice(null)}
              className="text-indigo-700 hover:text-indigo-900 font-semibold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Synchronizing live spinner banner */}
      {syncing && (
        <div className="bg-indigo-600 text-white py-2.5 px-4 shadow-sm animate-in fade-in">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2.5 text-xs font-semibold">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
            <span>Reading inbox messages and generating AI insights with Gemini 3.8 Flash...</span>
          </div>
        </div>
      )}

      {/* Sync error alert */}
      {syncError && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 py-2.5 px-4 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{syncError}</span>
            </div>
            <button
              onClick={() => setSyncError(null)}
              className="text-rose-600 hover:text-rose-800 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Controls & Metrics Toolbar (Active when emails are loaded or user is authenticated) */}
      {(emails.length > 0 || user) && (
        <>
          <section className={`py-3 border-b transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2.5">
              {/* Category Pills Row (Smart Auto-Categorization) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-500" /> Categories:
                </span>
                {[
                  { id: 'All', label: 'All Categories' },
                  { id: 'Financial', label: '💳 Financial' },
                  { id: 'Security', label: '🛡️ Security' },
                  { id: 'DevOps', label: '⚡ DevOps' },
                  { id: 'Engineering', label: '💻 Engineering' },
                  { id: 'Academic', label: '🎓 Academic' },
                  { id: 'Social', label: '💬 Social' },
                  { id: 'Newsletters', label: '📰 Newsletters' },
                  { id: 'Promotions', label: '🏷️ Promotions' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition shrink-0 cursor-pointer ${
                      categoryFilter === cat.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => {
                      setFilter('All');
                      setSelectedTagFilter('All');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      filter === 'All' && selectedTagFilter === 'All'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Inbox className="w-3.5 h-3.5" /> All Messages ({stats.total_emails})
                  </button>

                  <button
                    onClick={() => setFilter('Unread')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      filter === 'Unread'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-blue-900/30 hover:text-blue-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" /> Unread ({stats.unread_count ?? emails.filter((e) => !e.is_read).length})
                  </button>

                  <button
                    onClick={() => setFilter('High')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      filter === 'High'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-rose-900/30 hover:text-rose-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> High Urgency ({stats.high_urgency})
                  </button>

                  <button
                    onClick={() => setFilter('Action Required')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      filter === 'Action Required'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-amber-900/30 hover:text-amber-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    <ListTodo className="w-3.5 h-3.5 text-amber-500" /> Needs Action ({stats.action_required})
                  </button>

                  <button
                    onClick={() => setFilter('FYI')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      filter === 'FYI'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 text-slate-400" /> FYI Only
                  </button>

                  {/* Dynamic Tag Filter Pills */}
                  {allUniqueTags.length > 0 && (
                    <div className="flex items-center gap-1 pl-1 ml-1 border-l border-slate-200 dark:border-slate-700">
                      <Tag className="w-3 h-3 text-slate-400 mr-0.5" />
                      {allUniqueTags.slice(0, 4).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            setSelectedTagFilter(selectedTagFilter === tag ? 'All' : tag);
                          }}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition flex items-center gap-1 cursor-pointer ${
                            selectedTagFilter === tag
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : darkMode
                              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-purple-400'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-700'
                          }`}
                        >
                          <span>#{tag}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search, Sort & Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search sender, tag, category..."
                      className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:bg-slate-750'
                          : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400 focus:bg-white'
                      }`}
                    />
                  </div>

                  {/* Sort dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-200'
                        : 'bg-slate-50 border-slate-300 text-slate-700'
                    }`}
                  >
                    <option value="urgency">Sort: Urgency (Highest first)</option>
                    <option value="unread">Sort: Unread first</option>
                    <option value="action">Sort: Action Required first</option>
                    <option value="newest">Sort: Ingested order</option>
                  </select>

                  {/* Mark All Read Button */}
                  {emails.some((e) => !e.is_read) && (
                    <button
                      onClick={handleMarkAllRead}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition flex items-center gap-1 cursor-pointer"
                      title="Mark all emails as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Mark Read</span>
                    </button>
                  )}

                  {/* Select Multiple Mode Toggle */}
                  <button
                    onClick={toggleSelectionMode}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                      selectionMode
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-400/40'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                    title="Toggle bulk select mode"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{selectionMode ? 'Exit Select' : 'Select Multiple'}</span>
                    {selectedEmailIds.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 font-extrabold">
                        {selectedEmailIds.length}
                      </span>
                    )}
                  </button>

                  {/* Export CSV Button */}
                  <button
                    onClick={handleExportCSV}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                      darkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                    title="Download structured CSV dataset"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-500" />
                    <span>CSV</span>
                  </button>

                  {/* Print Executive Briefing */}
                  <button
                    onClick={handlePrintBriefing}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                      darkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                    title="Print executive briefing report"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Print</span>
                  </button>

                  {/* Export Executive Briefing Markdown */}
                  <button
                    onClick={handleExportBriefing}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                      darkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                    title="Copy executive briefing markdown to clipboard"
                  >
                    <Share2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{briefingCopied ? 'Copied!' : 'Briefing'}</span>
                  </button>

                  <button
                    onClick={handleSyncClick}
                    disabled={syncing}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>Sync Inbox</span>
                  </button>
                </div>
              </div>

              {/* Select Multiple Sub-bar */}
              {selectionMode && (
                <div
                  className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border text-xs animate-in fade-in duration-150 ${
                    darkMode
                      ? 'bg-indigo-950/40 border-indigo-900/60 text-indigo-200'
                      : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        {selectedEmailIds.length} of {filteredEmails.length} selected
                      </span>
                    </span>
                    <button
                      onClick={handleSelectAll}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] transition cursor-pointer"
                    >
                      Select All Visible ({filteredEmails.length})
                    </button>
                    {selectedEmailIds.length > 0 && (
                      <button
                        onClick={handleDeselectAll}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px] transition cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedEmailIds([]);
                    }}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Productivity & Metrics Cards */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Analyzed Emails
                </p>
                <p className="text-xl font-bold text-slate-800">{stats.total_emails}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs">
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                  Unread
                </p>
                <p className="text-xl font-bold text-blue-700">
                  {stats.unread_count ?? emails.filter((e) => !e.is_read).length}
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-xs">
                <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
                  High Urgency
                </p>
                <p className="text-xl font-bold text-rose-700">{stats.high_urgency}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-xs">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                  Action Required
                </p>
                <p className="text-xl font-bold text-amber-700">{stats.action_required}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                  Open Tasks
                </p>
                <p className="text-xl font-bold text-emerald-700">{stats.pending_tasks}</p>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-xl border border-indigo-100 shadow-xs flex flex-col justify-center">
                <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                  <span>Task Progress</span>
                  <span>{taskCompletionRate}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${taskCompletionRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!user && emails.length === 0 ? (
          /* Unauthenticated Landing State */
          <div className="max-w-2xl mx-auto my-8 bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xs">
              <Mail className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Autonomous Email Intelligence & Actionable Insights
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
              Sign in with any Google account or paste any email directly to extract 2-sentence executive summaries, detect urgency, cross off checklists, and generate context-calibrated response drafts with Google Gemini.
            </p>

            {/* Action Buttons: Sign in with Google or Paste Email */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google & Sync Inbox'}</span>
              </button>

              <button
                onClick={() => setShowManualModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-2xl border border-slate-200 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <span>Paste Email for Analysis</span>
              </button>
            </div>

            {/* Google Verification Status Badge */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <button
                onClick={() => setShowVerificationModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200 transition font-medium cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google OAuth Configured • How Verification Works for All Accounts</span>
              </button>
            </div>

            {/* Feature Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-left">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Universal Login</p>
                  <p className="text-[11px] text-slate-500">
                    Works for any personal or organizational Google account without access barriers.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Gemini 3.8 Flash</p>
                  <p className="text-[11px] text-slate-500">
                    Extracts TL;DR summaries, key dates, deadlines & tone-shifted drafts.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">1-Click Calendar Add</p>
                  <p className="text-[11px] text-slate-500">
                    Add extracted deadlines directly to Google Calendar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : loading && emails.length === 0 ? (
          /* Loading */
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm font-medium">Fetching emails...</p>
          </div>
        ) : filteredEmails.length === 0 ? (
          /* Empty inbox or no matching filters */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-14 h-14 mx-auto mb-4 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {emails.length === 0 ? 'No emails analyzed yet' : 'No matching emails'}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              {emails.length === 0
                ? 'Click below to paste any email or load a high-signal real-world test inbox for your account.'
                : 'No emails match your active urgency filter or search keywords.'}
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Paste Email for Analysis</span>
              </button>
              <button
                onClick={() => syncUserSampleData()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Sync Sample Inbox</span>
              </button>
            </div>
          </div>
        ) : (
          /* Analyzed Real Email Cards Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredEmails.map((email) => {
              const isHigh = email.urgency === 'High';
              const isMedium = email.urgency === 'Medium';
              const isLow = email.urgency === 'Low';
              const isExpanded = expandedRawIds.includes(email.id);
              const isUnread = !email.is_read;
              const isSelected = selectedEmailIds.includes(email.id);

              return (
                <div
                  key={email.id}
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelectEmail(email.id);
                    }
                  }}
                  className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all duration-150 relative ${
                    selectionMode ? 'cursor-pointer' : ''
                  } ${
                    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                  } ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md'
                      : isUnread
                      ? 'ring-2 ring-blue-500/30'
                      : 'opacity-95'
                  } ${
                    isHigh
                      ? 'border-l-[6px] border-l-rose-500 hover:border-l-rose-600 shadow-rose-500/5'
                      : isMedium
                      ? 'border-l-[6px] border-l-amber-500 hover:border-l-amber-600 shadow-amber-500/5'
                      : isLow
                      ? 'border-l-[6px] border-l-emerald-500 hover:border-l-emerald-600 shadow-emerald-500/5'
                      : 'border-l-[6px] border-l-slate-400 hover:border-l-slate-500'
                  }`}
                >
                  <div>
                    {/* Header: Select Checkbox, Priority badge, Read status, Deadline, Calendar link, Date */}
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Select Checkbox (Visible when Select Multiple is toggled) */}
                        {selectionMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectEmail(email.id);
                            }}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition cursor-pointer shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                : darkMode
                                ? 'bg-slate-800 border-slate-650 text-transparent hover:border-indigo-400'
                                : 'bg-white border-slate-300 text-transparent hover:border-indigo-500'
                            }`}
                            title={isSelected ? 'Deselect this message' : 'Select this message'}
                          >
                            <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                          </button>
                        )}

                        {/* Visual Priority Badge (High, Medium, Low) Color-Coded based on urgency */}
                        {isHigh ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Priority: High</span>
                          </span>
                        ) : isMedium ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Priority: Medium</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Priority: Low</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-xs">
                            <Info className="w-3.5 h-3.5 text-slate-500" />
                            <span>Priority: FYI</span>
                          </span>
                        )}

                        {email.deadline && (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <Calendar className="w-3 h-3 text-rose-500" /> Due: {email.deadline}
                            </span>
                            <button
                              onClick={() => handleAddToCalendar(email)}
                              disabled={addingToCalendar === email.id}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                              title="1-Click Direct Google Calendar Sync"
                            >
                              <Calendar className={`w-2.5 h-2.5 ${addingToCalendar === email.id ? 'animate-spin' : ''}`} />
                              <span>{addingToCalendar === email.id ? 'Adding...' : '+ Cal'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">{email.date}</span>
                    </div>

                    {/* Auto-Category & Sentiment Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {email.category && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                          #{email.category}
                        </span>
                      )}
                      {email.sentiment && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          Tone: {email.sentiment}
                        </span>
                      )}
                    </div>

                    {/* Subject & Sender */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3
                          className={`text-sm leading-snug line-clamp-2 ${
                            isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                          }`}
                          title={email.subject}
                        >
                          {email.subject}
                        </h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          From: <span className="font-medium text-slate-700">{email.sender}</span>
                        </p>
                      </div>
                    </div>

                    {/* Color-Coded Tags Row */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {email.tags && email.tags.length > 0 && (
                        <>
                          {email.tags.map((tag) => (
                            <span
                              key={tag.name}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${getTagBadgeClasses(
                                tag.color
                              )}`}
                            >
                              <Tag className="w-2.5 h-2.5" />
                              <span>{tag.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTag(email.id, tag.name);
                                }}
                                className="text-slate-400 hover:text-rose-600 ml-0.5 transition"
                                title={`Remove ${tag.name}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </>
                      )}

                      {/* Add Tag Button */}
                      <button
                        onClick={() => {
                          setTaggingEmail(email);
                          setNewTagName('');
                          setNewTagColor('indigo');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition"
                        title="Add custom label / tag"
                      >
                        <Tag className="w-2.5 h-2.5 text-slate-400" />
                        <span>+ Tag</span>
                      </button>
                    </div>

                    {/* 2-Sentence TL;DR Box */}
                    <div className="mt-3.5 bg-gradient-to-r from-indigo-50/70 via-indigo-50/40 to-slate-50 rounded-xl p-3 border border-indigo-100">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>AI Executive Summary (TL;DR)</span>
                      </div>
                      <p className="text-xs text-indigo-950/85 leading-relaxed">
                        {email.summary || 'Summary generated by InboxPulse AI.'}
                      </p>
                    </div>

                    {/* Actionable Tasks Checklist */}
                    {email.tasks && email.tasks.length > 0 && (
                      <div className="mt-3.5 bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ListTodo className="w-3.5 h-3.5 text-indigo-600" /> Actionable Checklist (
                            {email.tasks.length})
                          </span>
                          <span className="text-[10px] text-slate-400">Click to cross-off</span>
                        </div>
                        <div className="space-y-1.5">
                          {email.tasks.map((task) => (
                            <label
                              key={task.id}
                              className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900 select-none group"
                            >
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={(e) => toggleTask(email.id, task.id, e.target.checked)}
                                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                              />
                              <span
                                className={`${
                                  task.completed
                                    ? 'line-through text-slate-400'
                                    : 'group-hover:text-slate-900'
                                }`}
                              >
                                {task.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extracted Key Entities */}
                    {email.key_entities &&
                      (email.key_entities.links?.length > 0 ||
                        email.key_entities.people?.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                          {email.key_entities.links?.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[200px] transition"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                              <span className="truncate">{link}</span>
                            </a>
                          ))}
                          {email.key_entities.people?.map((person, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-medium"
                            >
                              <UserIcon className="w-2.5 h-2.5 text-purple-400" />
                              <span>{person}</span>
                            </span>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Footer Action Row */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRawBody(email.id)}
                        className="text-xs text-slate-500 hover:text-slate-800 transition flex items-center gap-1 font-medium"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{isExpanded ? 'Hide Raw Body' : 'View Raw Body'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => toggleReadStatus(email.id, email.is_read)}
                        className="text-xs text-slate-500 hover:text-blue-600 transition flex items-center gap-1 font-medium"
                        title={email.is_read ? 'Mark as Unread' : 'Mark as Read'}
                      >
                        {email.is_read ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500" />
                            <span>Mark Unread</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-blue-600">Mark Read</span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => openReplyModal(email)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3 h-3 text-indigo-600" />
                      <span>Quick Reply Draft</span>
                    </button>
                  </div>

                  {/* Collapsible Raw Email Drawer */}
                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-800">
                      {email.raw_body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-4 text-xs mt-auto transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>InboxPulse AI</strong> — Enterprise Email Intelligence & Executive Productivity Suite
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Google Identity Services</span>
            <span>•</span>
            <span>Gemini AI Engine</span>
            <span>•</span>
            <span>Real-time Calendar & Priority Insights</span>
          </div>
        </div>
      </footer>

      {/* Manual / Fallback Email Ingestion Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ingest Real Email for Gemini Analysis</h3>
                  <p className="text-xs text-slate-500">Paste text, load a preset, or upload an .eml/.txt file</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Prefill Presets & File Upload */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Quick-Fill Test Presets:
                </label>
                <label className="text-[11px] text-indigo-600 hover:text-indigo-800 cursor-pointer font-semibold flex items-center gap-1">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload .eml / .txt</span>
                  <input
                    type="file"
                    accept=".eml,.txt,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SAMPLES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg border border-slate-200 transition font-medium text-left"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleManualEmailSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sender (Name & Email):
                </label>
                <input
                  type="text"
                  required
                  value={manualSender}
                  onChange={(e) => setManualSender(e.target.value)}
                  placeholder="Sarah Jenkins <sarah@acmecloud.io>"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Line:
                </label>
                <input
                  type="text"
                  required
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  placeholder="CRITICAL: Outage Alert"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Body:
                </label>
                <textarea
                  required
                  rows={6}
                  value={manualBody}
                  onChange={(e) => setManualBody(e.target.value)}
                  placeholder="Paste email content here with action items, deadlines, links..."
                  className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingManual}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${processingManual ? 'animate-spin' : ''}`} />
                  <span>{processingManual ? 'Extracting with Gemini...' : 'Analyze with Gemini'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Reply Draft Modal with Tone Adjustment */}
      {selectedReplyEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">AI Suggested Reply Draft</h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs">
                    To: {selectedReplyEmail.sender}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReplyEmail(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI Tone Shifter */}
            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Adjust Response Tone with Gemini:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'professional', label: '💼 Professional' },
                  { id: 'concise', label: '⚡ Concise' },
                  { id: 'assertive', label: '🎯 Assertive' },
                  { id: 'friendly', label: '😊 Friendly' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={regeneratingReply}
                    onClick={() => handleToneChange(t.id)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition ${
                      replyTone === t.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Context-Aware Response Draft:
                </label>
                {regeneratingReply && (
                  <span className="text-[11px] text-indigo-600 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Rewriting tone...
                  </span>
                )}
              </div>
              <textarea
                rows={6}
                value={customReplyText}
                onChange={(e) => setCustomReplyText(e.target.value)}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span
                className={`text-xs text-emerald-600 font-semibold flex items-center gap-1 transition-opacity ${
                  copied ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <Check className="w-3.5 h-3.5" /> Copied to clipboard!
              </span>
              <div className="flex gap-2">
                <a
                  href={`mailto:${encodeURIComponent(
                    selectedReplyEmail.sender.replace(/.*<(.+?)>/, '$1')
                  )}?subject=${encodeURIComponent(
                    'Re: ' + selectedReplyEmail.subject
                  )}&body=${encodeURIComponent(customReplyText)}`}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center gap-1 transition"
                  title="Open draft directly in email client"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Mail</span>
                </a>
                <button
                  onClick={handleCopyReply}
                  className="px-3.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Draft</span>
                </button>
                <button
                  onClick={handleSendViaGmail}
                  disabled={sendingGmail}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  title="Send response directly through Gmail API"
                >
                  <Send className={`w-3.5 h-3.5 ${sendingGmail ? 'animate-spin' : ''}`} />
                  <span>{sendingGmail ? 'Sending via Gmail...' : 'Send via Gmail'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Tag / Label Assignment Modal */}
      {taggingEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Custom Tags & Labels</h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                    {taggingEmail.subject}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTaggingEmail(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Applied Tags */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Current Tags:
              </label>
              {taggingEmail.tags && taggingEmail.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {taggingEmail.tags.map((tag) => (
                    <span
                      key={tag.name}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${getTagBadgeClasses(
                        tag.color
                      )}`}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{tag.name}</span>
                      <button
                        onClick={() => {
                          handleRemoveTag(taggingEmail.id, tag.name);
                          setTaggingEmail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  tags: (prev.tags || []).filter((t) => t.name !== tag.name),
                                }
                              : null
                          );
                        }}
                        className="ml-1 text-slate-400 hover:text-rose-600 transition"
                        title={`Remove ${tag.name}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No tags attached to this email yet.</p>
              )}
            </div>

            {/* Suggested / Common Labels Quick Add */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Quick Preset Labels:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'Project Alpha', color: 'indigo' },
                  { name: 'Urgent-Personal', color: 'rose' },
                  { name: 'Client Review', color: 'purple' },
                  { name: 'Financial/Billing', color: 'amber' },
                  { name: 'Engineering', color: 'cyan' },
                  { name: 'Executive Priority', color: 'emerald' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      handleAddTag(taggingEmail.id, preset.name, preset.color);
                      setTaggingEmail((prev) => {
                        if (!prev) return null;
                        const existing = (prev.tags || []).filter((t) => t.name !== preset.name);
                        return { ...prev, tags: [...existing, { name: preset.name, color: preset.color }] };
                      });
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1 ${getTagBadgeClasses(
                      preset.color
                    )}`}
                  >
                    <span>+ {preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Add Custom Tag Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTagName.trim()) return;
                handleAddTag(taggingEmail.id, newTagName, newTagColor);
                setTaggingEmail((prev) => {
                  if (!prev) return null;
                  const existing = (prev.tags || []).filter(
                    (t) => t.name.toLowerCase() !== newTagName.trim().toLowerCase()
                  );
                  return {
                    ...prev,
                    tags: [...existing, { name: newTagName.trim(), color: newTagColor }],
                  };
                });
                setNewTagName('');
              }}
              className="space-y-3 pt-3 border-t border-slate-100"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Custom Tag Name:
                </label>
                <input
                  type="text"
                  required
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g. Project Alpha, Urgent-Personal, Q4 Review"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tag Badge Color:
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
                    { id: 'rose', label: 'Rose', bg: 'bg-rose-500' },
                    { id: 'purple', label: 'Purple', bg: 'bg-purple-500' },
                    { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
                    { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
                    { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
                    { id: 'blue', label: 'Blue', bg: 'bg-blue-500' },
                  ].map((colorOpt) => (
                    <button
                      key={colorOpt.id}
                      type="button"
                      onClick={() => setNewTagColor(colorOpt.id)}
                      className={`w-6 h-6 rounded-full ${colorOpt.bg} transition-transform ${
                        newTagColor === colorOpt.id
                          ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title={colorOpt.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTaggingEmail(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Done
                </button>
                <button
                  type="submit"
                  disabled={!newTagName.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Tag</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google OAuth Verification & Access Guide Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Google OAuth Verification & Access Guide
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enterprise Workspace & Multi-Account Access Overview
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Architecture & Scope Status Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-5 text-xs text-slate-600 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-600" /> GCP Project ID:
                </span>
                <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-mono text-[11px]">
                  gen-lang-client-0007418410
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" /> OAuth Client:
                </span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active & Registered
                </span>
              </div>
            </div>

            {/* Two Tier Explanation */}
            <div className="space-y-4 text-xs text-slate-600">
              {/* Tier 1 */}
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Tier 1: Universal Sign-In (Open to ALL Accounts Worldwide)
                    </h4>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      Standard Google identity scopes (<code className="text-slate-800">openid</code>,{' '}
                      <code className="text-slate-800">email</code>,{' '}
                      <code className="text-slate-800">profile</code>) do <strong>not</strong> require
                      Google app verification. Any Google account (personal @gmail.com, Google Workspace, corporate @company.com) signs in instantly with <strong>100% success</strong> and zero warning screens.
                    </p>
                    <button
                      onClick={() => {
                        setShowVerificationModal(false);
                        handleUniversalSignIn();
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                    >
                      <span>Sign in with Universal Google</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tier 2 */}
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Tier 2: Live Gmail API Reading (Sensitive Scope)
                    </h4>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      Google classifies <code className="text-slate-800">gmail.readonly</code> as a restricted permission. During prototype development:
                    </p>
                    <ul className="mt-2 space-y-1.5 list-disc list-inside text-slate-600">
                      <li>
                        <strong>If Google displays "Google hasn't verified this app":</strong> Click{' '}
                        <strong className="text-slate-800">"Advanced"</strong> at the bottom-left, then click{' '}
                        <strong className="text-slate-800">"Go to InboxPulse AI (unsafe)"</strong>, and click{' '}
                        <strong className="text-slate-800">"Allow"</strong>.
                      </li>
                      <li>
                        <strong>If Google displays "Access Blocked (Testing Mode)":</strong> The account must be added to the GCP OAuth Test Users list in Cloud Console.
                      </li>
                    </ul>
                    <button
                      onClick={() => {
                        setShowVerificationModal(false);
                        handleLiveGmailSignIn();
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Connect Live Gmail (Full Sync)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* How Developer Whitelists Accounts */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" /> How to Add Test Users in Google Cloud Console
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed text-[11px]">
                  <li>
                    Open <strong>Google Cloud Console</strong> &rarr; <strong>APIs & Services</strong> &rarr;{' '}
                    <strong>OAuth consent screen</strong>.
                  </li>
                  <li>
                    Under <strong>Test users</strong>, click <strong>+ ADD USERS</strong>.
                  </li>
                  <li>
                    Enter any Google account (e.g.{' '}
                    <code className="text-slate-800">rupireddyrithwikreddy28@gmail.com</code>) and click{' '}
                    <strong>Save</strong>.
                  </li>
                  <li>
                    The authorized user can now authenticate directly with full live Gmail ingestion!
                  </li>
                </ol>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowVerificationModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Toolbar */}
      {selectedEmailIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200 max-w-xl w-[92%] sm:w-auto">
          <div className="bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl px-3.5 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{selectedEmailIds.length} Selected</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={handleBulkMarkRead}
                disabled={bulkLoading}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="Mark all selected as read"
              >
                <Check className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden xs:inline">Mark Read</span>
              </button>

              <button
                onClick={handleBulkMarkUnread}
                disabled={bulkLoading}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="Mark all selected as unread"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Mark Unread</span>
              </button>

              <button
                onClick={handleBulkClear}
                disabled={bulkLoading}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-rose-800/60 disabled:opacity-50"
                title="Clear selected from inbox"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear from Inbox</span>
              </button>

              <button
                onClick={handleBulkExportCSV}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer"
                title="Export selected emails to CSV"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>CSV</span>
              </button>

              <div className="h-4 w-px bg-slate-700 mx-0.5 hidden sm:block"></div>

              <button
                onClick={handleDeselectAll}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Deselect All"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3 rounded-2xl shadow-lg border text-xs flex items-center justify-between gap-2.5 animate-in slide-in-from-top-2 transition ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
                : toast.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-900/20'
                : toast.type === 'warning'
                ? 'bg-amber-600 text-white border-amber-500 shadow-amber-900/20'
                : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-900/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {toast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
              <span className="font-medium leading-tight">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/80 hover:text-white transition p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Floating Expandable AI Chatbot Assistant ("Inbox Copilot") */}
      <div className="fixed bottom-5 right-5 z-40">
        {!copilotOpen ? (
          <button
            onClick={() => setCopilotOpen(true)}
            className="group flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-2xl shadow-xl shadow-indigo-600/30 border border-indigo-400/30 transition transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Open Inbox Copilot AI Assistant"
          >
            <div className="relative">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <span>Inbox Copilot AI</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/20 text-white font-mono">Gemini</span>
          </button>
        ) : (
          <div
            className={`w-96 max-w-[calc(100vw-2rem)] h-[530px] rounded-3xl shadow-2xl border flex flex-col overflow-hidden animate-in zoom-in-95 transition ${
              darkMode
                ? 'bg-slate-900 border-slate-750 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900 shadow-indigo-900/15'
            }`}
          >
            {/* Copilot Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white p-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    Inbox Copilot <Sparkles className="w-3 h-3 text-amber-300" />
                  </h4>
                  <p className="text-[10px] text-indigo-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Synced with {stats.total_emails} Emails • Gemini AI
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCopilotOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Prompt Pills */}
            <div
              className={`p-2.5 border-b text-[11px] flex gap-1.5 overflow-x-auto scrollbar-none ${
                darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-100'
              }`}
            >
              {[
                { label: '💳 High Urgency Bills', query: 'Summarize my high urgency bills and invoices.' },
                { label: '📋 Tasks Due This Week', query: 'What tasks and deadlines are due this week?' },
                { label: '🚨 Critical Outages', query: 'Are there any critical outages or blockers?' },
                { label: '✍️ Draft Reply', query: 'Draft a polite, professional reply to the most urgent email.' },
              ].map((pill, i) => (
                <button
                  key={i}
                  onClick={() => sendCopilotMessage(pill.query)}
                  className={`px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Chat Message Stream */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs leading-relaxed">
              {copilotMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : darkMode
                        ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-xs'
                        : 'bg-slate-100 border border-slate-200/80 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                </div>
              ))}
              {copilotLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-500 p-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Copilot analyzing inbox context with Gemini...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendCopilotMessage();
              }}
              className={`p-2.5 border-t flex items-center gap-2 ${
                darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                placeholder="Ask Copilot about emails, tasks, bills..."
                className={`flex-1 text-xs px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                }`}
              />
              <button
                type="submit"
                disabled={!copilotInput.trim() || copilotLoading}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Analytics & Metrics Suite Modal */}
      {showAnalyticsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div
            className={`rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border max-h-[90vh] overflow-y-auto ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Analytics & Performance Suite</h3>
                  <p className="text-xs text-slate-500">
                    Real-time volume distribution, urgency spread & task velocity
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAnalytics && !analyticsData ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs">Calculating metrics...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Metric Summary Stat Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div
                    className={`p-3 rounded-2xl border ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Total Analyzed</p>
                    <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                      {analyticsData?.total_emails ?? stats.total_emails}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-2xl border ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-semibold text-rose-500">High Urgency</p>
                    <p className="text-xl font-bold mt-1 text-rose-600">
                      {analyticsData?.urgency_distribution?.High ?? stats.high_urgency}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-2xl border ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-semibold text-emerald-500">Tasks Done</p>
                    <p className="text-xl font-bold mt-1 text-emerald-600">
                      {analyticsData?.task_metrics?.completed_tasks ?? (stats.total_tasks - stats.pending_tasks)}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-2xl border ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-semibold text-indigo-500">Velocity</p>
                    <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                      {analyticsData?.task_metrics?.velocity_percentage ?? taskCompletionRate}%
                    </p>
                  </div>
                </div>

                {/* Daily Volume SVG Bar Chart */}
                <div
                  className={`p-4 rounded-2xl border ${
                    darkMode ? 'bg-slate-800/60 border-slate-750' : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                    <span>Daily Email Volume Velocity (Past 7 Days)</span>
                    <span className="text-[11px] font-normal text-indigo-500">Trend</span>
                  </h4>
                  <div className="flex items-end justify-between gap-2 h-36 pt-4 px-2">
                    {(
                      analyticsData?.daily_volume || [
                        { day: 'Mon', count: 2 },
                        { day: 'Tue', count: 4 },
                        { day: 'Wed', count: 3 },
                        { day: 'Thu', count: 5 },
                        { day: 'Fri', count: 6 },
                        { day: 'Sat', count: 1 },
                        { day: 'Sun', count: stats.total_emails || 4 },
                      ]
                    ).map((bar: any, idx: number) => {
                      const maxVal = Math.max(
                        1,
                        ...((analyticsData?.daily_volume || []).map((b: any) => b.count) || [6])
                      );
                      const heightPercent = Math.max(15, Math.round((bar.count / maxVal) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600 transition">
                            {bar.count}
                          </span>
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className="w-full max-w-[36px] bg-gradient-to-t from-indigo-600 to-indigo-400 hover:from-indigo-500 hover:to-indigo-300 rounded-t-lg transition-all duration-300"
                          ></div>
                          <span className="text-[10px] font-medium text-slate-400">{bar.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Urgency & Category Distribution Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Urgency breakdown */}
                  <div
                    className={`p-4 rounded-2xl border ${
                      darkMode ? 'bg-slate-800/60 border-slate-750' : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Urgency Breakdown
                    </h4>
                    <div className="space-y-2.5 text-xs">
                      {[
                        {
                          label: 'High Urgency',
                          color: 'bg-rose-500',
                          count: analyticsData?.urgency_distribution?.High ?? stats.high_urgency,
                        },
                        {
                          label: 'Medium',
                          color: 'bg-amber-500',
                          count:
                            analyticsData?.urgency_distribution?.Medium ??
                            Math.max(0, stats.total_emails - stats.high_urgency),
                        },
                        { label: 'Low', color: 'bg-blue-500', count: analyticsData?.urgency_distribution?.Low ?? 0 },
                        { label: 'FYI Only', color: 'bg-slate-400', count: analyticsData?.urgency_distribution?.FYI ?? 0 },
                      ].map((item, idx) => {
                        const pct =
                          stats.total_emails > 0 ? Math.round((item.count / stats.total_emails) * 100) : 0;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-[11px] mb-1 font-medium">
                              <span>{item.label}</span>
                              <span className="text-slate-400">
                                {item.count} ({pct}%)
                              </span>
                            </div>
                            <div
                              className={`w-full h-2 rounded-full overflow-hidden ${
                                darkMode ? 'bg-slate-700' : 'bg-slate-200'
                              }`}
                            >
                              <div
                                style={{ width: `${pct}%` }}
                                className={`h-full ${item.color} transition-all duration-300 rounded-full`}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto-Category Distribution */}
                  <div
                    className={`p-4 rounded-2xl border ${
                      darkMode ? 'bg-slate-800/60 border-slate-750' : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Category Breakdown
                    </h4>
                    <div className="space-y-2 text-xs">
                      {Object.entries(
                        analyticsData?.category_distribution || {
                          Financial: 1,
                          DevOps: 1,
                          Academic: 1,
                          Engineering: 1,
                        }
                      )
                        .slice(0, 5)
                        .map(([catName, count]: any) => (
                          <div
                            key={catName}
                            className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800"
                          >
                            <span className="font-semibold text-[11px] text-slate-600 dark:text-slate-300">
                              #{catName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                              {count} emails
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Metrics CSV</span>
                  </button>
                  <button
                    onClick={() => setShowAnalyticsModal(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
