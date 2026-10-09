"use client";
import { useState } from "react";
import { SaveStatus } from "@/components/SaveStatus";
import { OptionsMenu } from "./OptionsMenu";
import { Modal } from "./Modal";
import { useFullscreen } from "@/lib/useFullscreen";
export function WorkHeader({
  title,
  time,
  onSubmit,
}: {
  title: string;
  time: string;
  onSubmit: () => void;
}) {
  const [help, setHelp] = useState(false);
  const { isFullscreen, supported, enter } = useFullscreen();
  return (
    <>
      <header className="exam-header">
        <strong className="brand">IELTS</strong>
        <strong>{title}</strong>
        <SaveStatus />
        <span role="timer" className="ml-auto font-bold tabular-nums">
          {time}
        </span>
        <OptionsMenu
          onShowInstructions={() => setHelp(true)}
          onSubmit={onSubmit}
        />
      </header>
      {supported && !isFullscreen && (
        <div className="notice text-sm">
          You have exited full-screen mode.{" "}
          <button onClick={() => void enter()}>Start Fullscreen</button>
        </div>
      )}
      {help && (
        <Modal title="Test instructions" onClose={() => setHelp(false)}>
          <p>
            Your work saves locally. Writing uses one 60-minute timer across
            both tasks. Speaking is a practice simulator, not an official
            examiner. Mock has no pause or re-recording. Use Settings for text
            size and contrast. Alt/Option + N / P changes questions outside text
            fields; Alt/Option + F flags a Reading or Listening question.
          </p>
        </Modal>
      )}
    </>
  );
}
