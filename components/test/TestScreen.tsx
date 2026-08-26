"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NO_RESPONSES, useTestStore } from "@/lib/store";
import { useCountdown, formatClock } from "@/lib/useTimer";
import { useFullscreen } from "@/lib/useFullscreen";
import { answeredSet, navEntries } from "@/lib/progress";
import { GroupView } from "@/components/questions/GroupView";
import { AudioRunner, VolumeControl } from "./AudioRunner";
import { Modal } from "./Modal";
import { NavBar } from "./NavBar";
import { NotesButton, NotesPanel } from "./NotesPanel";
import { OptionsMenu } from "./OptionsMenu";
import { Passage } from "./Passage";
import { SplitPane } from "./SplitPane";

/** Seconds remaining at which the header changes colour (video 4:26). */
const WARNING_AT = 60;

export function TestScreen() {
  const router = useRouter();
  const hydrated = useTestStore((s) => s.hydrated);
  const session = useTestStore((s) => s.session);
  const phase = useTestStore((s) => s.phase);
  const submit = useTestStore((s) => s.submit);
  const setActivePart = useTestStore((s) => s.setActivePart);

  const { isFullscreen, supported, enter } = useFullscreen();

  const [showInstructions, setShowInstructions] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const questionsRef = useRef<HTMLDivElement>(null);

  const test = session?.test ?? null;

  // Fullscreen is requested from the Start click's gesture, which is still
  // live during this first mount.
  const entered = useRef(false);
  useEffect(() => {
    if (test && !entered.current) {
      entered.current = true;
      void enter();
    }
  }, [test, enter]);

  const onExpire = useCallback(() => submit("time"), [submit]);
  const remaining = useCountdown(session?.endsAt ?? null, onExpire);

  useEffect(() => {
    // Wait for the stored session to be read back, or a refresh mid-test
    // bounces home before it is recovered.
    if (!hydrated) return;
    if (phase === "finished") router.replace("/results");
    else if (phase === "idle") router.replace("/");
  }, [hydrated, phase, router]);

  const answered = useMemo(
    () => (test ? answeredSet(test, session?.responses ?? NO_RESPONSES) : new Set<number>()),
    [test, session?.responses],
  );
  const unanswered = useMemo(
    () => (test ? navEntries(test).filter((e) => !answered.has(e.n)).length : 0),
    [test, answered],
  );

  const goTo = useCallback(
    (n: number, part: number) => {
      setActivePart(part);
      // The part switch renders first; scroll on the next frame.
      requestAnimationFrame(() => {
        document.getElementById(`q-${n}`)?.scrollIntoView({ block: "center" });
      });
    },
    [setActivePart],
  );

  if (!session || !test) return null;

  const activePart =
    test.parts.find((p) => p.part === session.activePart) ?? test.parts[0];
  const warning = remaining <= WARNING_AT;

  const questionsPane = (
    <div ref={questionsRef} className="h-full overflow-y-auto px-6 py-5">
      {activePart.instructions && (
        <div className="mb-5 whitespace-pre-line border border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 py-3 font-medium leading-relaxed">
          {activePart.instructions}
        </div>
      )}
      {activePart.groups.map((group, i) => (
        <GroupView key={i} group={group} />
      ))}
      <div className="h-24" />
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* The whole top band changes colour in the last minute. */}
      <header
        className="flex shrink-0 items-center gap-4 border-b border-[var(--border-strong)] px-4 py-2.5 transition-colors"
        style={{
          background: warning ? "var(--warn-bg)" : "var(--bg-panel)",
          color: warning ? "var(--warn-fg)" : "inherit",
        }}
      >
        <h1 className="min-w-0 truncate text-sm font-semibold">{test.title}</h1>

        <div className="ml-auto flex items-center gap-3">
          <div
            role="timer"
            aria-live={warning ? "assertive" : "off"}
            className="tabular-nums"
            title="Time remaining"
          >
            <span className="text-xs uppercase tracking-wide">
              {warning ? "1 minute left" : "Time remaining"}
            </span>{" "}
            <span className="text-lg font-bold">{formatClock(remaining)}</span>
          </div>

          {test.type === "reading" && <NotesButton onClick={() => setOpenNote(openNote ?? firstNoteId())} />}

          <OptionsMenu
            onShowInstructions={() => setShowInstructions(true)}
            onSubmit={() => setConfirmSubmit(true)}
          />
        </div>
      </header>

      {supported && !isFullscreen && (
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--warn-bg)] px-4 py-2 text-sm text-[var(--warn-fg)]">
          <span>You have left fullscreen. The timer is still running.</span>
          <button
            type="button"
            onClick={() => void enter()}
            className="rounded border border-current px-3 py-1 font-semibold"
          >
            Return to fullscreen
          </button>
        </div>
      )}

      {test.type === "reading" && activePart.passage ? (
        <div className="flex min-h-0 flex-1">
          <SplitPane
            left={<Passage passage={activePart.passage} onOpenNote={setOpenNote} />}
            right={questionsPane}
          />
          <NotesPanel
            openId={openNote}
            onClose={() => setOpenNote(null)}
            onSelect={setOpenNote}
          />
        </div>
      ) : (
        <div className="mx-auto min-h-0 w-full max-w-3xl flex-1">{questionsPane}</div>
      )}

      <NavBar test={test} onGoTo={goTo} />

      {test.type === "listening" && (
        <>
          <AudioRunner test={test} />
          <div className="pointer-events-auto fixed bottom-16 right-4 z-40">
            <VolumeControl />
          </div>
        </>
      )}

      {showInstructions && (
        <Modal title="Test Instructions" onClose={() => setShowInstructions(false)}>
          <p className="whitespace-pre-line leading-relaxed">
            {test.instructions ?? "No instructions were supplied with this test file."}
          </p>
        </Modal>
      )}

      {confirmSubmit && (
        <Modal
          title="Submit test"
          onClose={() => setConfirmSubmit(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="rounded border border-[var(--border-strong)] px-4 py-2 font-medium"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={() => submit("manual")}
                className="rounded bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-fg)]"
              >
                Submit now
              </button>
            </>
          }
        >
          <p className="leading-relaxed">
            {unanswered > 0
              ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. They will be marked incorrect.`
              : "All questions are answered."}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            You will see your score and a full answer review. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

function firstNoteId(): string | null {
  return useTestStore.getState().session?.notes[0]?.id ?? null;
}
