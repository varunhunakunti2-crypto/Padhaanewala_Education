"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AdmissionEnquiry, MockTestResult, NotificationItem, Review, StudentProfile } from "@/lib/types";
import {
  clearAuth,
  fetchMyRoles,
  getAccessToken,
  hasAdminRole,
} from "@/lib/api";
import {
  fetchSavedColleges,
  saveCollegeRemote,
  unsaveCollegeRemote,
  type SavedCollegeRecord,
} from "@/lib/api";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant?: "success" | "error" | "info" | "warning";
}

export interface NotificationPrefs {
  admissionDeadlines: boolean;
  scholarshipAlerts: boolean;
  applicationUpdates: boolean;
  featuredRecommendations: boolean;
  emailDigest: boolean;
}

interface AppContextValue {
  savedColleges: string[];
  savedCourses: string[];
  savedScholarships: string[];
  compareList: string[];
  recentViews: string[];
  recentSearches: string[];
  recentLocations: string[];
  compareHistory: string[][];
  prefs: NotificationPrefs;
  toasts: ToastItem[];
  profile: StudentProfile | null;
  enquiries: AdmissionEnquiry[];
  testHistory: MockTestResult[];
  notifications: NotificationItem[];
  reviews: Review[];
  darkMode: boolean;
  toggleDarkMode: () => void;

  isAuthenticated: boolean;
  authReady: boolean;
  roles: string[];
  rolesReady: boolean;
  isAdmin: boolean;
  refreshRoles: () => Promise<void>;
  setAuthenticated: (v: boolean) => void;
  logout: () => void;

  isSaved: (id: string) => boolean;
  toggleSave: (id: string, name?: string) => void;

  /** Real saved-college records from the backend, plus how the load went. */
  savedCollegeRecords: SavedCollegeRecord[];
  savedSync: "idle" | "loading" | "synced" | "no-profile" | "error";
  savedSyncMessage: string | null;
  refreshSavedColleges: () => Promise<void>;

  isCourseSaved: (slug: string) => boolean;
  toggleCourseSave: (slug: string, name?: string) => void;

  isScholarshipSaved: (id: string) => boolean;
  toggleScholarshipSave: (id: string, name?: string) => void;

  isComparing: (id: string) => boolean;
  compareFull: boolean;
  toggleCompare: (id: string, name?: string) => void;
  clearCompare: () => void;
  recordComparison: (ids: string[]) => void;

  addRecentView: (id: string) => void;
  addRecentSearch: (query: string) => void;
  addRecentLocation: (loc: string) => void;
  clearRecentSearches: () => void;
  clearRecentLocations: () => void;

  setPrefs: (p: Partial<NotificationPrefs>) => void;

  setProfile: (p: StudentProfile) => void;
  addEnquiry: (e: Omit<AdmissionEnquiry, "id" | "date" | "status">) => void;
  addTestResult: (r: MockTestResult) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addReview: (r: Review) => void;

  showToast: (t: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const MAX_COMPARE = 4;

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [savedColleges, setSavedColleges] = useState<string[]>([]);
  const [savedCollegeRecords, setSavedCollegeRecords] = useState<SavedCollegeRecord[]>([]);
  const [savedSync, setSavedSync] = useState<
    "idle" | "loading" | "synced" | "no-profile" | "error"
  >("idle");
  const [savedSyncMessage, setSavedSyncMessage] = useState<string | null>(null);
  const [savedCourses, setSavedCourses] = useState<string[]>([]);
  const [savedScholarships, setSavedScholarships] = useState<string[]>([]);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [recentViews, setRecentViews] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const [compareHistory, setCompareHistory] = useState<string[][]>([]);
  const [profile, setProfileState] = useState<StudentProfile | null>(null);
  const [enquiries, setEnquiries] = useState<AdmissionEnquiry[]>([]);
  const [testHistory, setTestHistory] = useState<MockTestResult[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesReady, setRolesReady] = useState<boolean>(false);
  const [prefs, setPrefsState] = useState<NotificationPrefs>({
    admissionDeadlines: true,
    scholarshipAlerts: true,
    applicationUpdates: true,
    featuredRecommendations: true,
    emailDigest: false,
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const hydrated = useRef(false);

  const isAdmin = useMemo(() => hasAdminRole(roles), [roles]);

  const refreshRoles = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem("cp_access_token")) {
      setRoles([]);
      setRolesReady(true);
      return;
    }
    setRoles(await fetchMyRoles());
    setRolesReady(true);
  }, []);

  useEffect(() => {
    // Hydrate persisted state from localStorage on first mount only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedColleges(load("cp_saved", []));
    setSavedCourses(load("cp_saved_courses", []));
    setSavedScholarships(load("cp_saved_scholarships", []));
    setCompareList(load("cp_compare", []));
    setRecentViews(load("cp_recent_views", []));
    setRecentSearches(load("cp_recent_searches", []));
    setRecentLocations(load("cp_recent_locations", []));
    setCompareHistory(load("cp_compare_history", []));
    setProfileState(load("cp_profile", null));
    setEnquiries(load("cp_enquiries", []));
    setTestHistory(load("cp_test_history", []));
    setNotifications(load("cp_notifications", []));
    setReviews(load("cp_reviews", []));
    const hasToken = Boolean(window.localStorage.getItem("cp_access_token"));
    setIsAuthenticated(hasToken);
    setAuthReady(true);
    if (hasToken) {
      void refreshRoles();
    } else {
      setRolesReady(true);
    }

    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("cp_theme") : null;
    const isDark = savedTheme
      ? savedTheme === "dark"
      : typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    hydrated.current = true;
  }, [refreshRoles]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("cp_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("cp_theme", "light");
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_saved", savedColleges);
  }, [savedColleges]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_saved_courses", savedCourses);
  }, [savedCourses]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_saved_scholarships", savedScholarships);
  }, [savedScholarships]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_compare", compareList);
  }, [compareList]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_recent_views", recentViews);
  }, [recentViews]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_recent_searches", recentSearches);
  }, [recentSearches]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_recent_locations", recentLocations);
  }, [recentLocations]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_compare_history", compareHistory);
  }, [compareHistory]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_profile", profile);
  }, [profile]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_enquiries", enquiries);
  }, [enquiries]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_test_history", testHistory);
  }, [testHistory]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_notifications", notifications);
  }, [notifications]);
  useEffect(() => {
    if (!hydrated.current) return;
    save("cp_reviews", reviews);
  }, [reviews]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismissToast(id), 3600);
    },
    [dismissToast],
  );

  const toggleSave = useCallback(
    (id: string, name?: string) => {
      setSavedColleges((prev) => {
        const exists = prev.includes(id);
        if (exists) {
          showToast({
            variant: "info",
            title: "Removed from saved",
            description: name ? `${name} removed from your list.` : undefined,
          });
          return prev.filter((x) => x !== id);
        }
        showToast({
          variant: "success",
          title: "College saved",
          description: name ? `${name} added to your saved colleges.` : undefined,
        });
        return [id, ...prev];
      });
    },
    [showToast],
  );

  /**
   * Pull the signed-in user's saved colleges from the backend.
   *
   * The dashboard used to show a hardcoded shortlist, then a localStorage list, so
   * what it displayed was never the user's real data. The server list is now
   * authoritative: on success it replaces the local IDs, which means a save made
   * on another device shows up here. A failure is surfaced rather than silently
   * leaving the previous list on screen as if it were current.
   */
  const refreshSavedColleges = useCallback(async () => {
    if (!getAccessToken()) {
      setSavedSync("idle");
      return;
    }

    setSavedSync("loading");
    const result = await fetchSavedColleges();

    if (result.state === "ok") {
      setSavedCollegeRecords(result.records);
      setSavedColleges(result.records.map((r) => String(r.college_id)));
      setSavedSync("synced");
      setSavedSyncMessage(null);
      return;
    }

    if (result.state === "no-profile") {
      // Nothing is wrong, there is simply nowhere to attach saves yet.
      setSavedSync("no-profile");
      setSavedSyncMessage("Complete your student profile to save colleges across devices.");
      return;
    }

    setSavedSync("error");
    setSavedSyncMessage(result.message);
  }, []);

  // Re-sync whenever the signed-in user changes, and once the token is readable.
  // The call is deferred by a microtask because `refreshSavedColleges` sets the
  // "loading" state before its first await; running that inside the synchronous
  // effect body would cascade a render on every auth change.
  useEffect(() => {
    if (!authReady) return;
    void Promise.resolve().then(() => refreshSavedColleges());
  }, [authReady, isAuthenticated, refreshSavedColleges]);

  /**
   * Optimistic save/unsave that also writes through to the backend.
   *
   * The local list updates immediately so the UI stays responsive; if the server
   * rejects the write the change is rolled back and the reason is surfaced rather
   * than leaving a save that only exists in this browser.
   */
  const toggleSaveSynced = useCallback(
    (id: string, name?: string) => {
      const wasSaved = savedColleges.includes(id);
      const numericId = Number(id);

      toggleSave(id, name);

      if (!getAccessToken() || !Number.isFinite(numericId)) return;

      const call = wasSaved ? unsaveCollegeRemote(numericId) : saveCollegeRemote(numericId);
      void call
        .then(() => refreshSavedColleges())
        .catch((err: unknown) => {
          // Roll the optimistic change back.
          setSavedColleges((prev) =>
            wasSaved ? [id, ...prev] : prev.filter((x) => x !== id),
          );
          showToast({
            variant: "error",
            title: "Could not update your saved colleges",
            description:
              (err instanceof Error ? err.message : undefined) ??
              (wasSaved ? "The college was not removed." : "The college was not saved."),
          });
        });
    },
    [savedColleges, toggleSave, refreshSavedColleges, showToast],
  );

  const toggleCourseSave = useCallback(
    (slug: string, name?: string) => {
      setSavedCourses((prev) => {
        const exists = prev.includes(slug);
        if (exists) {
          showToast({ variant: "info", title: "Course removed", description: name ? `${name} removed.` : undefined });
          return prev.filter((x) => x !== slug);
        }
        showToast({ variant: "success", title: "Course saved", description: name ? `${name} saved to your dashboard.` : undefined });
        return [slug, ...prev];
      });
    },
    [showToast],
  );

  const toggleCompare = useCallback(
    (id: string, name?: string) => {
      setCompareList((prev) => {
        const exists = prev.includes(id);
        if (exists) {
          showToast({
            variant: "info",
            title: "Removed from compare",
            description: name ? `${name} removed.` : undefined,
          });
          return prev.filter((x) => x !== id);
        }
        if (prev.length >= MAX_COMPARE) {
          showToast({
            variant: "warning",
            title: "Comparison full",
            description: "You can compare up to 4 colleges at a time.",
          });
          return prev;
        }
        showToast({
          variant: "success",
          title: "Added to compare",
          description: `${name ?? ""} added. Compare up to 4 colleges.`,
        });
        return [...prev, id];
      });
    },
    [showToast],
  );

  const clearCompare = useCallback(() => {
    setCompareList([]);
    showToast({ variant: "info", title: "Comparison cleared" });
  }, [showToast]);

  const recordComparison = useCallback((ids: string[]) => {
    setCompareHistory((prev) => {
      const key = ids.join("|");
      const next = [ids, ...prev.filter((l) => l.join("|") !== key)];
      return next.slice(0, 6);
    });
  }, []);

  const addRecentView = useCallback((id: string) => {
    setRecentViews((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 12));
  }, []);

  const addRecentSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    setRecentSearches((prev) => [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8));
  }, []);

  const addRecentLocation = useCallback((loc: string) => {
    setRecentLocations((prev) => [loc, ...prev.filter((x) => x !== loc)].slice(0, 6));
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    showToast({ variant: "info", title: "Search history cleared", description: "Your recent searches are now empty." });
  }, [showToast]);

  const clearRecentLocations = useCallback(() => {
    setRecentLocations([]);
    showToast({ variant: "info", title: "Location history cleared", description: "Your recent locations are now empty." });
  }, [showToast]);

  const setPrefs = useCallback((p: Partial<NotificationPrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...p }));
  }, []);

  const toggleScholarshipSave = useCallback(
    (id: string, name?: string) => {
      setSavedScholarships((prev) => {
        const exists = prev.includes(id);
        if (exists) {
          showToast({ variant: "info", title: "Scholarship removed", description: name ? `${name} removed.` : undefined });
          return prev.filter((x) => x !== id);
        }
        showToast({ variant: "success", title: "Scholarship saved", description: name ? `${name} saved to your dashboard.` : undefined });
        return [id, ...prev];
      });
    },
    [showToast],
  );

  const setProfile = useCallback((p: StudentProfile) => {
    setProfileState(p);
    showToast({ variant: "success", title: "Profile updated", description: "Your preferences were saved." });
  }, [showToast]);

  const addEnquiry = useCallback(
    (e: Omit<AdmissionEnquiry, "id" | "date" | "status">) => {
      const enquiry: AdmissionEnquiry = {
        ...e,
        id: `enq-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        status: "new",
      };
      setEnquiries((prev) => [enquiry, ...prev].slice(0, 30));
      showToast({
        variant: "success",
        title: "Enquiry submitted",
        description: "Thank you. Our counsellor will contact you.",
      });
    },
    [showToast],
  );

  const addTestResult = useCallback((r: MockTestResult) => {
    setTestHistory((prev) => [r, ...prev].slice(0, 40));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const addReview = useCallback(
    (r: Review) => {
      setReviews((prev) => [r, ...prev].slice(0, 20));
      showToast({ variant: "success", title: "Review submitted", description: "Thank you for sharing your experience." });
    },
    [showToast],
  );

  const setAuthenticated = useCallback(
    (v: boolean) => {
      setIsAuthenticated(v);
      if (v) {
        void refreshRoles();
      } else {
        setRoles([]);
        setRolesReady(true);
      }
    },
    [refreshRoles],
  );

  const logout = useCallback(() => {
    clearAuth();
    setIsAuthenticated(false);
    setRoles([]);
    setRolesReady(true);
    setProfileState(null);
    showToast({
      variant: "info",
      title: "Signed out",
      description: "You have been logged out of your account.",
    });
  }, [showToast]);

  const value = useMemo<AppContextValue>(
    () => ({
      savedColleges,
      savedCourses,
      savedScholarships,
      compareList,
      recentViews,
      recentSearches,
      recentLocations,
      compareHistory,
      prefs,
      toasts,
      profile,
      enquiries,
      testHistory,
      notifications,
      reviews,
      darkMode,
      toggleDarkMode,
      isAuthenticated,
      authReady,
      roles,
      rolesReady,
      isAdmin,
      refreshRoles,
      setAuthenticated,
      logout,
      isSaved: (id) => savedColleges.includes(id),
      // Writes through to the backend when signed in; the local list is a cache.
      toggleSave: toggleSaveSynced,
      savedCollegeRecords,
      savedSync,
      savedSyncMessage,
      refreshSavedColleges,
      isCourseSaved: (slug) => savedCourses.includes(slug),
      toggleCourseSave,
      isScholarshipSaved: (id) => savedScholarships.includes(id),
      toggleScholarshipSave,
      isComparing: (id) => compareList.includes(id),
      compareFull: compareList.length >= MAX_COMPARE,
      toggleCompare,
      clearCompare,
      recordComparison,
      addRecentView,
      addRecentSearch,
      addRecentLocation,
      clearRecentSearches,
      clearRecentLocations,
      setPrefs,
      setProfile,
      addEnquiry,
      addTestResult,
      markNotificationRead,
      markAllNotificationsRead,
      addReview,
      showToast,
      dismissToast,
    }),
    [
      savedColleges,
      savedCollegeRecords,
      savedSync,
      savedSyncMessage,
      refreshSavedColleges,
      savedCourses,
      savedScholarships,
      compareList,
      recentViews,
      recentSearches,
      recentLocations,
      compareHistory,
      prefs,
      toasts,
      profile,
      enquiries,
      testHistory,
      notifications,
      reviews,
      darkMode,
      toggleDarkMode,
      isAuthenticated,
      authReady,
      roles,
      rolesReady,
      isAdmin,
      refreshRoles,
      setAuthenticated,
      logout,
      toggleSaveSynced,
      toggleCourseSave,
      toggleScholarshipSave,
      toggleCompare,
      clearCompare,
      recordComparison,
      addRecentView,
      addRecentSearch,
      addRecentLocation,
      clearRecentSearches,
      clearRecentLocations,
      setPrefs,
      setProfile,
      addEnquiry,
      addTestResult,
      markNotificationRead,
      markAllNotificationsRead,
      addReview,
      showToast,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}