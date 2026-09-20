"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileQuestion,
  Flag,
  ListChecks,
  Lock,
  Maximize2,
  Mic,
  MonitorUp,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Target,
  Timer,
  Trophy,
  User,
  Video,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { getTestQuestions, computePercentile } from "@/lib/data/mockTests";
import type { MockTest, MockTestQuestion } from "@/lib/types";
import { useApp } from "@/lib/context/AppContext";

const MAX_VIOLATIONS = 3;

type Stage = "setup" | "running" | "result";

type PermState = "pending" | "granted" | "denied";

interface PermissionStatus {
  camera: PermState;
  mic: PermState;
  screen: PermState;
  fullscreen: PermState;
}

interface Violation {
  reason: string;
  at: Date;
  remaining: number;
}

interface AnswerState {
  selected: number | null;
  marked: boolean;
}

function isWholeScreen(stream: MediaStream): boolean {
  const settings = (stream.getVideoTracks()[0]?.getSettings() ?? {}) as { displaySurface?: string };
  // Undefined surface (e.g. Firefox/Safari) means the browser can't verify → accept.
  return !settings.displaySurface || settings.displaySurface === "monitor";
}

interface BuildResult {
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
  maxScore: number;
  percentile: number;
  timeTakenSec: number;
  topicPerf: Record<string, { correct: number; total: number }>;
}

export function ProctoredMockTest({ test }: { test: MockTest }) {
  const { addTestResult } = useApp();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("setup");
  const [perms, setPerms] = useState<PermissionStatus>({
    camera: "pending",
    mic: "pending",
    screen: "pending",
    fullscreen: "pending",
  });

  const [questions, setQuestions] = useState<MockTestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [showSolutions, setShowSolutions] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [warnOpen, setWarnOpen] = useState(false);
  const [lastWarning, setLastWarning] = useState<Violation | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenSurfaceIssueRef = useRef(false);
  const fullscreenIssueRef = useRef(false);

  const stageRef = useRef<Stage>("setup");
  const timeLeftRef = useRef(0);
  const answersRef = useRef<Record<string, AnswerState>>({});
  const questionsRef = useRef<MockTestQuestion[]>([]);
  const violationsRef = useRef<Violation[]>([]);
  const finishTestRef = useRef<() => void>(() => {});
  const startedAtRef = useRef(0);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    violationsRef.current = violations;
  }, [violations]);

  const cleanupMedia = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Attach camera preview once stream changes
  useEffect(() => {
    if (videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [perms.camera, perms.mic]);
  const attachVideoNode = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && cameraStreamRef.current) el.srcObject = cameraStreamRef.current;
  }, []);

  // ---------- Face-lighting monitor ----------
  const [lightLevel, setLightLevel] = useState<"checking" | "good" | "poor">("checking");
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightingIssueRef = useRef(false);

  const stopScreenSharingEvent = useCallback(() => {
    const t = screenStreamRef.current?.getVideoTracks()[0];
    if (t) t.onended = null;
  }, []);

  // ---------- Violations ----------
  const registerViolation = useCallback((reason: string) => {
    if (stageRef.current !== "running") return;
    const remaining = timeLeftRef.current;
    const viol: Violation = { reason, at: new Date(), remaining };
    const next = [...violationsRef.current, viol];
    setViolations(next);
    setLastWarning(viol);
    if (next.length >= MAX_VIOLATIONS) {
      setWarnOpen(false);
      finishTestRef.current();
    } else {
      setWarnOpen(true);
    }
  }, []);

  // ---------- Setup: request all proctoring permissions ----------
  const requestSetup = useCallback(async () => {
    setPerms({
      camera: "pending",
      mic: "pending",
      screen: "pending",
      fullscreen: "pending",
    });

    const enterFullscreen = () =>
      Promise.resolve(
        document.documentElement.requestFullscreen
          ? document.documentElement.requestFullscreen()
          : Promise.reject(new Error("Full screen not supported")),
      );

    const fsPromise = enterFullscreen()
      .then(() => setPerms((p) => ({ ...p, fullscreen: "granted" })))
      .catch(() => setPerms((p) => ({ ...p, fullscreen: "denied" })));

    const camPromise = navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        cameraStreamRef.current = stream;
        setPerms((p) => ({ ...p, camera: "granted", mic: "granted" }));
      })
      .catch(() => setPerms((p) => ({ ...p, camera: "denied", mic: "denied" })));

    // Fired synchronously so every prompt keeps transient user activation
    const scrPromise = navigator.mediaDevices
      .getDisplayMedia({ video: true })
      .then((stream) => {
        if (!isWholeScreen(stream)) {
          stream.getTracks().forEach((t) => t.stop());
          setScreenError("You must share your ENTIRE screen, not just one window or browser tab. Please pick ‘Entire screen / Full screen’ and try again.");
          setPerms((p) => ({ ...p, screen: "denied" }));
          return;
        }
        screenStreamRef.current = stream;
        screenSurfaceIssueRef.current = false;
        setScreenError(null);
        setPerms((p) => ({ ...p, screen: "granted" }));
        stream.getVideoTracks()[0].onended = () => {
          stopScreenSharingEvent();
          if (stageRef.current === "running") {
            registerViolation("Screen sharing was stopped");
          }
        };
      })
      .catch(() => setPerms((p) => ({ ...p, screen: "denied" })));

    await Promise.all([fsPromise, camPromise, scrPromise]);
  }, [stopScreenSharingEvent, registerViolation]);

  // ---------- Timer ----------
  useEffect(() => {
    if (stage !== "running") return;
    timerRef.current = setInterval(() => {
      const screen = screenStreamRef.current;
      if (screen) {
        const surface = (screen.getVideoTracks()[0]?.getSettings() ?? {}) as { displaySurface?: string };
        if (surface.displaySurface && surface.displaySurface !== "monitor" && !screenSurfaceIssueRef.current) {
          screenSurfaceIssueRef.current = true;
          registerViolation("Screen share no longer covers the entire screen");
        }
      }
      if (!document.fullscreenElement && !fullscreenIssueRef.current) {
        fullscreenIssueRef.current = true;
        registerViolation("You exited full-screen mode");
      }
      setTimeLeft((prev) => {
        const n = prev - 1;
        if (n <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          finishTestRef.current();
          return 0;
        }
        return n;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage, registerViolation]);

  // ---------- Proctoring event listeners + cleanup ----------
  useEffect(() => {
    if (stage !== "running") return;

    const onVisibility = () => {
      if (document.hidden) registerViolation("You switched away from the test tab");
    };
    const onBlur = () => {
      registerViolation("You switched to another window or application");
      window.focus();
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onCopy = (e: ClipboardEvent) => e.preventDefault();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
    };
  }, [stage, registerViolation]);

  // Warn before leaving mid-test
  useEffect(() => {
    if (stage !== "running") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [stage]);

  // Release everything on final unmount
  useEffect(() => cleanupMedia, [cleanupMedia]);

  // ---------- Test control ----------
  function buildResult(t: MockTest, qs: MockTestQuestion[], ans: Record<string, AnswerState>, seconds: number): BuildResult {
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    const topicPerf: Record<string, { correct: number; total: number }> = {};
    qs.forEach((q) => {
      topicPerf[q.topic] ??= { correct: 0, total: 0 };
      topicPerf[q.topic].total += 1;
      const a = ans[q.id]?.selected;
      if (a === undefined || a === null) unattempted++;
      else if (a === q.correctIndex) {
        correct++;
        topicPerf[q.topic].correct += 1;
      } else incorrect++;
    });
    const score = correct * 3 - incorrect;
    const maxScore = qs.length * 3;
    const percentile = computePercentile(Math.max(0, score), maxScore);
    const timeTakenSec = t.durationMins * 60 - seconds;
    return { correct, incorrect, unattempted, score, maxScore, percentile, timeTakenSec, topicPerf };
  }

  const finishTest = useCallback(() => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const t = test;
      const qs = questionsRef.current;
      const ans = answersRef.current;
      const remaining = timeLeftRef.current;
      const res = buildResult(t, qs, ans, remaining);
      cleanupMedia();
      setResult(res);
      setStage("result");
      addTestResult({
        id: `tr-${Date.now()}`,
        testId: t.id,
        testSlug: t.slug,
        testTitle: t.title,
        exam: t.exam,
        date: new Date().toISOString().slice(0, 10),
        total: qs.length,
        correct: res.correct,
        incorrect: res.incorrect,
        unattempted: res.unattempted,
        timeTakenSec: res.timeTakenSec,
        score: Math.max(0, res.score),
        maxScore: res.maxScore,
        topicPerformance: res.topicPerf,
        percentile: res.percentile,
      });
    }, [test, addTestResult, cleanupMedia]);
  useEffect(() => {
    finishTestRef.current = finishTest;
  });

  const beginTest = useCallback(() => {
    if (!cameraStreamRef.current || !screenStreamRef.current) return;
    setQuestions(getTestQuestions(test));
    setAnswers({});
    setCurrent(0);
    setTimeLeft(test.durationMins * 60);
    setResult(null);
    setShowSolutions(false);
    setViolations([]);
    setWarnOpen(false);
    fullscreenIssueRef.current = false;
    screenSurfaceIssueRef.current = false;
    if (!document.fullscreenElement) {
      try {
        const p = document.documentElement.requestFullscreen?.();
        if (p instanceof Promise) p.catch(() => {});
      } catch {
        // full screen entry is best-effort here
      }
    }
    startedAtRef.current = Date.now();
    setStage("running");
  }, [test]);

  const retryStep = (key: keyof PermissionStatus) => {
    if (key === "fullscreen") {
      (document.documentElement.requestFullscreen
        ? document.documentElement.requestFullscreen()
        : Promise.reject(new Error("Full screen not supported"))
      )
        .then(() => setPerms((p) => ({ ...p, fullscreen: "granted" })))
        .catch(() => setPerms((p) => ({ ...p, fullscreen: "denied" })));
      return;
    }
    if (key === "camera" || key === "mic") {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          cameraStreamRef.current = stream;
          setPerms((p) => ({ ...p, camera: "granted", mic: "granted" }));
        })
        .catch(() => setPerms((p) => ({ ...p, camera: "denied", mic: "denied" })));
      return;
    }
    if (key === "screen") {
      navigator.mediaDevices
        .getDisplayMedia({ video: true })
        .then((stream) => {
          if (!isWholeScreen(stream)) {
            stream.getTracks().forEach((t) => t.stop());
            setScreenError("You must share your ENTIRE screen, not just one window or browser tab. Please pick ‘Entire screen / Full screen’ and try again.");
            setPerms((p) => ({ ...p, screen: "denied" }));
            return;
          }
          screenStreamRef.current = stream;
          screenSurfaceIssueRef.current = false;
          setScreenError(null);
          setPerms((p) => ({ ...p, screen: "granted" }));
          stream.getVideoTracks()[0].onended = () => {
            stopScreenSharingEvent();
            if (stageRef.current === "running") registerViolation("Screen sharing was stopped");
          };
        })
        .catch(() => setPerms((p) => ({ ...p, screen: "denied" })));
    }
  };

  // ---------- ANSWER HELPERS ----------
  const selectAnswer = (qi: number, optionIdx: number) => {
    const q = questions[qi];
    setAnswers((prev) => ({
      ...prev,
      [q.id]: {
        ...(prev[q.id] ?? { selected: null, marked: false }),
        selected: optionIdx === prev[q.id]?.selected ? null : optionIdx,
      },
    }));
  };

  const toggleMark = (qi: number) => {
    const q = questions[qi];
    setAnswers((prev) => {
      const cur = prev[q.id] ?? { selected: null, marked: false };
      return { ...prev, [q.id]: { ...cur, marked: !cur.marked } };
    });
  };

  const answerStatus = (qi: number): "answered" | "marked" | "unanswered" | "not-visited" => {
    const a = answers[questions[qi]?.id];
    if (a?.marked) return "marked";
    if (a?.selected !== undefined && a?.selected !== null) return "answered";
    return "not-visited";
  };

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]?.selected !== undefined && answers[q.id]?.selected !== null).length,
    [answers, questions],
  );
  const markedCount = useMemo(() => questions.filter((q) => answers[q.id]?.marked).length, [answers, questions]);

  if (stage === "setup") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950 p-4">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-10">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-400">
                <Video className="h-6 w-6" />
              </span>
              <div>
                <h1 className="font-display text-xl font-extrabold text-white sm:text-2xl">
                  Proctored Mock Test
                </h1>
                <p className="text-sm text-slate-400">{test.title}</p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-slate-300">
              This exam is monitored. You must allow the following before the test can begin. Leaving this
              tab, switching windows or exiting full screen is recorded and after{" "}
              <b className="text-white">{MAX_VIOLATIONS} violations</b> the test is auto-submitted.
            </p>

            <ul className="mt-6 space-y-3">
              {(
                [
                  { key: "camera", icon: <Eye className="h-4 w-4" />, label: "Camera access" },
                  { key: "mic", icon: <Mic className="h-4 w-4" />, label: "Microphone access" },
                  { key: "screen", icon: <MonitorUp className="h-4 w-4" />, label: "Share entire screen" },
                  { key: "fullscreen", icon: <Maximize2 className="h-4 w-4" />, label: "Full-screen mode" },
                ] as { key: keyof PermissionStatus; icon: React.ReactNode; label: string }[]
              ).map(({ key, icon, label }) => {
                const st = perms[key];
                return (
                  <li key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", st === "granted" ? "bg-emerald-500/15 text-emerald-400" : st === "denied" ? "bg-red-500/15 text-red-400" : "bg-slate-700 text-slate-300")}>
                      {st === "granted" ? <CheckCircle2 className="h-4 w-4" /> : st === "denied" ? <XCircle className="h-4 w-4" /> : icon}
                    </span>
                    <span className="flex-1 text-sm font-medium text-white">{label}</span>
                    {st === "denied" && (
                      <Button size="xs" variant="secondary" onClick={() => retryStep(key)}>
                        Retry
                      </Button>
                    )}
                    {st !== "pending" && (
                      <Badge variant={st === "granted" ? "green" : "red"}>
                        {st === "granted" ? "Allowed" : "Blocked"}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>

            {screenError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{screenError}</span>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Video className="h-4 w-4 text-red-400" /> Camera guidelines
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[170px_1fr]">
                <div className="flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black">
                  {perms.camera === "granted" ? (
                    <video
                      ref={attachVideoNode}
                      autoPlay
                      playsInline
                      muted
                      className="aspect-[3/4] w-full max-h-52 object-cover"
                    />
                  ) : (
                    <div className="grid aspect-[3/4] w-full max-h-52 place-items-center p-4 text-center text-[11px] text-slate-500">
                      <span>
                        <Video className="mx-auto h-6 w-6" />
                        Live preview appears here once camera is allowed
                      </span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    Position your face <b className="text-white">fully inside the frame</b>, centered and looking straight at the camera.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    Make sure <b className="text-white">both eyes are clearly visible</b> and your head is not turned away.
                  </li>
                  <li className="flex items-start gap-2">
                    <Sun className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    Keep <b className="text-white">good lighting on your face</b> — a light source in front of you, not behind.
                  </li>
                  <li className="flex items-start gap-2">
                    <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    Sit <b className="text-white">still and face the camera</b> while answering. Use the preview to adjust before you begin.
                  </li>
                </ul>
              </div>
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <ul className="space-y-1 text-xs text-red-300">
                  <li className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Do not cover your face, turn away, look off-frame or down at a phone during the test.
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Avoid a dark room or a bright light behind you, and do not let anyone else enter the frame.
                  </li>
                  <li className="flex items-start gap-2">
                    <MonitorUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    When asked to share your screen, choose <b className="text-white">“Entire screen”</b> — a single window or tab is not allowed.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => {
                  if (perms.camera === "pending") {
                    requestSetup();
                  } else {
                    // Re-request anything that is still denied/pending
                    if (perms.camera !== "granted") retryStep("camera");
                    if (perms.screen !== "granted") retryStep("screen");
                    if (perms.fullscreen !== "granted") retryStep("fullscreen");
                  }
                }}
              >
                <ShieldCheck className="h-4 w-4" /> {perms.camera === "pending" ? "Start secure setup" : "Retry blocked access"}
              </Button>
              <Button variant="warm" size="lg" disabled={Object.values(perms).some((p) => p !== "granted")} onClick={beginTest}>
                Begin test <Play className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4">
              <Link
                href="/mock-tests"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Back to all mock tests
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "result" && result) {
    const pct = Math.round((result.correct / questions.length) * 100);
    const timeStr = `${Math.floor(result.timeTakenSec / 60)}m ${result.timeTakenSec % 60}s`;
    const grade = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Average" : "Needs practice";
    const gradeTone: "green" | "yellow" | "amber" | "red" = pct >= 80 ? "green" : pct >= 60 ? "yellow" : pct >= 40 ? "amber" : "red";
    const stats = [
      { label: "Score", value: `${Math.max(0, result.score)}/${result.maxScore}`, tone: "text-purple-700 bg-purple-50 dark:bg-purple-950/70 dark:text-purple-300" },
      { label: "Percentage", value: `${pct}%`, tone: "text-blue-700 bg-blue-50 dark:bg-blue-950/70 dark:text-blue-300" },
      { label: "Correct", value: String(result.correct), tone: "text-green-700 bg-green-50 dark:bg-emerald-950/70 dark:text-emerald-300" },
      { label: "Incorrect", value: String(result.incorrect), tone: "text-red-700 bg-red-50 dark:bg-rose-950/70 dark:text-rose-300" },
      { label: "Unattempted", value: String(result.unattempted), tone: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
      { label: "Time taken", value: timeStr, tone: "text-orange-700 bg-orange-50 dark:bg-amber-950/70 dark:text-amber-300" },
    ];

    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-100 dark:bg-[#090d16]">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="rounded-3xl border border-purple-100 dark:border-purple-900/50 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 p-8 text-center text-white">
            <Trophy className="mx-auto h-10 w-10 text-amber-300" />
            <h2 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">
              Test completed!{pct >= 80 ? " 🎉" : ""}
            </h2>
            <p className="mt-1 text-sm text-white/75">{test.title}</p>
            <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Score</p>
                <p className="text-xl font-extrabold">
                  {Math.max(0, result.score)}
                  <span className="text-sm font-medium text-white/60">/{result.maxScore}</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Percentage</p>
                <p className="text-xl font-extrabold">{pct}%</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Percentile</p>
                <p className="text-xl font-extrabold">{result.percentile}</p>
              </div>
            </div>
            <Badge variant={gradeTone} className="mt-4">{grade}</Badge>
          </div>

          {violations.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <ShieldAlert className="h-4 w-4" /> {violations.length} proctoring violation(s) recorded during this test
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                {violations.map((v, i) => (
                  <li key={i}>• {v.reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
                <span className={cn("mx-auto grid h-9 w-9 place-items-center rounded-xl", s.tone)}>
                  <Target className="h-4 w-4" />
                </span>
                <p className="mt-2 text-lg font-extrabold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-[11px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <ListChecks className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Topic-wise performance
              </h3>
              <div className="mt-4 space-y-3">
                {Object.entries(result.topicPerf).map(([topic, perf]) => {
                  const p = Math.round((perf.correct / perf.total) * 100);
                  return (
                    <div key={topic}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{topic}</span>
                        <span className="text-slate-400">{perf.correct}/{perf.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={cn("h-full rounded-full", p >= 70 ? "bg-green-500" : p >= 40 ? "bg-amber-400" : "bg-red-400")}
                          style={{ width: `${p}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  cleanupMedia();
                  router.push(`/mock-tests/${test.slug}`);
                }}
              >
                <RefreshCw className="h-4 w-4" /> Practice again
              </Button>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setShowSolutions(!showSolutions)}>
                <BookOpen className="h-4 w-4" /> {showSolutions ? "Hide" : "View"} solutions
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => router.push("/mock-tests")}>
                <FileQuestion className="h-4 w-4" /> Back to all tests
              </Button>
            </div>
          </div>

          {showSolutions && (
            <div className="mt-6 space-y-4">
              {questions.map((q, i) => {
                const chosen = answers[q.id]?.selected;
                const isCorrect = chosen === q.correctIndex;
                return (
                  <div key={q.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-gray-900 dark:text-white">Q{i + 1}. {q.text}</p>
                      {chosen === undefined || chosen === null ? (
                        <Badge variant="amber">Unattempted</Badge>
                      ) : isCorrect ? (
                        <Badge variant="green">Correct</Badge>
                      ) : (
                        <Badge variant="red">Incorrect</Badge>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <p
                          key={oi}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition border",
                            oi === q.correctIndex && "border-green-200 bg-green-50 text-green-800 font-medium dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300",
                            oi === chosen && oi !== q.correctIndex && "border-red-200 bg-red-50 text-red-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300",
                            oi !== q.correctIndex && oi !== chosen && "border-transparent text-slate-700 dark:text-slate-300",
                          )}
                        >
                          {String.fromCharCode(65 + oi)}. {opt}
                          {oi === q.correctIndex && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-400 shrink-0 ml-auto" />}
                          {oi === chosen && oi !== q.correctIndex && <XCircle className="h-4 w-4 text-red-500 dark:text-rose-400 shrink-0 ml-auto" />}
                        </p>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="mt-3 rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-200">
                        <b className="text-purple-900 dark:text-purple-300">Explanation:</b> {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = questions[current];
  const mm = String(Math.floor((timeLeft % 3600) / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const hh = String(Math.floor(timeLeft / 3600)).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] select-none overflow-hidden bg-slate-100 dark:bg-[#090d16]">
      {/* Proctor bar */}
      <div className="flex items-center justify-between gap-3 border-b border-red-900/40 bg-slate-950 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="tracking-widest text-red-400">REC</span>
          <span className="hidden items-center gap-1 text-slate-300 sm:flex">
            <Eye className="h-3.5 w-3.5 text-emerald-400" /> Camera
          </span>
          <span className="hidden items-center gap-1 text-slate-300 sm:flex">
            <Mic className="h-3.5 w-3.5 text-emerald-400" /> Mic
          </span>
          <span className="hidden items-center gap-1 text-slate-300 sm:flex">
            <MonitorUp className="h-3.5 w-3.5 text-emerald-400" /> Screen
          </span>
          <span className="hidden items-center gap-1 text-slate-300 sm:flex">
            <Maximize2 className="h-3.5 w-3.5 text-emerald-400" /> Full screen
          </span>
        </div>
        {violations.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-400">
            <ShieldAlert className="h-3 w-3" /> {violations.length}/{MAX_VIOLATIONS} warnings
          </span>
        )}
      </div>

      <div className="mx-auto flex h-[calc(100%-40px)] max-w-6xl flex-col overflow-hidden p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{test.title}</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">
              Question {current + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 dark:border dark:border-purple-800/50 px-3 py-1.5 text-sm font-bold tabular-nums">
              <Timer className="h-4 w-4" /> {hh}:{mm}:{ss}
            </span>
            <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
              Submit
            </Button>
          </div>
        </div>

        <div className="mt-4 grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_260px]">
          {/* Question */}
          <div className="overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <Badge variant="purple">Q{current + 1} · {q.topic}</Badge>
              <button
                type="button"
                onClick={() => toggleMark(current)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                  answers[q.id]?.marked
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-600",
                )}
              >
                <Flag className="h-3.5 w-3.5" /> {answers[q.id]?.marked ? "Marked" : "Mark for review"}
              </button>
            </div>
            <p className="mt-4 text-base font-bold leading-relaxed text-gray-900 dark:text-white sm:text-lg">{q.text}</p>
            <div className="mt-5 space-y-2.5">
              {q.options.map((opt, i) => {
                const selected = answers[q.id]?.selected === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectAnswer(current, i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
                      selected
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 font-semibold"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-700",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                        selected
                          ? "border-purple-600 bg-purple-600 text-white"
                          : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))} className="dark:text-slate-300 dark:hover:bg-slate-800">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button variant="secondary" onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
                {current === questions.length - 1 ? "Review" : "Next"} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Palette */}
          <div className="overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Question palette</h3>
              <span className="text-xs text-slate-400 dark:text-slate-400">{answeredCount + markedCount}/{questions.length}</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {questions.map((qq, i) => {
                const st = answerStatus(i);
                return (
                  <button
                    key={qq.id}
                    type="button"
                    onClick={() => setCurrent(i)}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition",
                      i === current ? "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-slate-900" : "",
                      st === "answered" && "bg-green-500 text-white",
                      st === "marked" && "bg-purple-600 text-white",
                      st === "unanswered" && "bg-orange-400 text-white",
                      st === "not-visited" && "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-green-500" /> Answered</p>
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-orange-400" /> Not answered</p>
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-purple-600" /> Marked for review</p>
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" /> Not visited</p>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
              <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-gray-700 dark:text-slate-300">
                <video
                  ref={attachVideoNode}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[4/3] w-full max-w-[140px] rounded-lg border border-slate-300 dark:border-slate-700 bg-black object-cover"
                />
              </div>
              <p className="mt-2 text-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Proctoring active
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Submit confirm */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Submit test?">
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            You have answered <b>{answeredCount}</b> of <b>{questions.length}</b> questions.
          </p>
          <p>
            {answeredCount < questions.length
              ? "Unanswered questions will be treated as unattempted."
              : "All questions answered."}
          </p>
          <p className="text-xs text-slate-400">This action cannot be undone.</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Keep going</Button>
          <Button variant="danger" onClick={() => { setConfirmOpen(false); finishTest(); }}>
            Submit test
          </Button>
        </div>
      </Modal>

      {/* Violation warning */}
      <Modal open={warnOpen} onClose={() => setWarnOpen(false)} title="Proctoring violation">
        <div className="space-y-3 text-sm text-slate-600">
          <p className="flex items-center gap-2 font-semibold text-red-600">
            <ShieldAlert className="h-4 w-4" /> {lastWarning?.reason ?? "Violation detected"}
          </p>
          <p>
            Do not switch tabs or leave the full-screen exam. This is warning{" "}
            <b>{violations.length} of {MAX_VIOLATIONS}</b>. The test will be auto-submitted after{" "}
            {MAX_VIOLATIONS - violations.length} more.
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="danger" onClick={() => setWarnOpen(false)}>
            Continue exam
          </Button>
        </div>
      </Modal>
    </div>
  );
}