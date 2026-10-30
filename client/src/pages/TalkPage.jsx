import { useParams } from "react-router-dom";
import TestConsole from "../components/TestConsole";

export default function TalkPage() {
  const { id } = useParams();
  return (
    <main className="min-h-screen bg-surface px-space-lg py-space-xl">
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <div className="mb-space-xl flex w-full items-center justify-between">
          <img alt="VoiceCraft" className="h-9 w-[150px] object-contain object-left" src="/voicecraft-logo.svg" />
          <span className="rounded-full bg-secondary-container px-space-md py-1 text-label-sm text-on-tertiary-container">● Ready to talk</span>
        </div>
        <h1 className="text-display-sm font-semibold">Voice assistant</h1>
        <p className="mt-space-sm text-center text-body-md text-on-surface-variant">A private, real-time conversation powered by VoiceCraft.</p>
        <div className="mt-space-xl w-full">
          <TestConsole agentId={id} publicMode />
        </div>
        <p className="mt-space-lg text-label-sm text-outline">You are talking to an AI assistant.</p>
      </div>
    </main>
  );
}
