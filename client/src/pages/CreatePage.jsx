import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { generateAgent, transcribeAudio } from "../lib/api";

const chips = [
  ["Lead Generation", "person_add", "Build a friendly lead generation agent that qualifies prospects by asking about their needs, budget, and timeline, then books a meeting."],
  ["Appointments", "calendar_today", "Build a warm appointment booking agent that answers questions, checks availability, schedules appointments, and sends confirmations."],
  ["Support", "support_agent", "Build a patient customer support agent that troubleshoots common issues and escalates unresolved problems to a human."],
  ["Negotiation", "handshake", "Build a thoughtful negotiation agent that understands customer goals, presents flexible options, and stays helpful."],
  ["Collections", "credit_card", "Build a respectful collections agent that confirms account details and discusses payment options with empathy."],
];

const examples = [
  ["medical_services", "Dental clinic receptionist", "Books cleanings, reschedules appointments, and answers pricing FAQs.", "Appointments", "Build a warm and friendly dental receptionist for SmileCare Clinic that schedules cleaning appointments, conducts initial intake, and confirms dental insurance policies."],
  ["real_estate_agent", "Real estate lead qualifier", "Screens buyer budget, preferred locations, and pre-approval status.", "Lead Gen", "Build an assertive but polite real-estate lead qualifier that asks about budget, timeline, preferred neighborhoods, and financing before booking a call."],
  ["restaurant", "Restaurant reservations", "Manages table bookings, party sizes, and dietary preferences.", "Host Concierge", "Build a charming restaurant host that books, changes, and cancels reservations, answers menu questions, and records dietary requests."],
];

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

export default function CreatePage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserFrameRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const hasSpeechRef = useRef(false);
  const promptRef = useRef("");

  useEffect(() => () => {
    window.cancelAnimationFrame(analyserFrameRef.current);
    window.clearTimeout(silenceTimerRef.current);
    audioContextRef.current?.close();
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  const setValue = (value) => {
    const nextValue = value.slice(0, 500);
    promptRef.current = nextValue;
    setPrompt(nextValue);
    setError("");
  };
  const toggleDictation = async () => {
    if (listening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Audio recording is not supported in this browser. Use a current Chrome, Edge, or Safari browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        window.cancelAnimationFrame(analyserFrameRef.current);
        window.clearTimeout(silenceTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        setError("Audio recording failed. Please check your microphone and try again.");
      };
      recorder.onstop = async () => {
        window.cancelAnimationFrame(analyserFrameRef.current);
        window.clearTimeout(silenceTimerRef.current);
        await audioContextRef.current?.close();
        audioContextRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!audio.size) {
          setError("No audio was recorded. Speak clearly and try again.");
          return;
        }
        setTranscribing(true);
        setError("");
        try {
          const result = await transcribeAudio(audio);
          const transcript = result.text?.trim();
          if (!transcript) throw new Error("No speech was detected. Speak clearly and try again.");
          const current = promptRef.current;
          setValue(`${current}${current && !current.endsWith(" ") ? " " : ""}${transcript}`);
        } catch (transcriptionError) {
          setError(transcriptionError.message || "Voice transcription failed. Please try again.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const levels = new Uint8Array(analyser.fftSize);
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      hasSpeechRef.current = false;
      const startedAt = Date.now();
      const monitorSilence = () => {
        if (recorder.state !== "recording") return;
        analyser.getByteTimeDomainData(levels);
        const volume = Math.sqrt(
          levels.reduce((sum, level) => sum + ((level - 128) / 128) ** 2, 0) / levels.length,
        );
        if (volume > 0.035) {
          hasSpeechRef.current = true;
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        } else if (hasSpeechRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = window.setTimeout(() => {
            silenceTimerRef.current = null;
            if (recorder.state === "recording") recorder.stop();
          }, 1200);
        }
        if (Date.now() - startedAt >= 20000) {
          recorder.stop();
          return;
        }
        analyserFrameRef.current = window.requestAnimationFrame(monitorSilence);
      };
      analyserFrameRef.current = window.requestAnimationFrame(monitorSilence);
      setError("");
      setListening(true);
    } catch (recordingError) {
      const message = recordingError.name === "NotAllowedError"
        ? "Microphone access was blocked. Allow microphone access for VoiceCraft and try again."
        : recordingError.name === "NotFoundError"
          ? "No microphone was found. Connect a microphone and try again."
          : "Unable to access your microphone. Check browser permissions and try again.";
      setError(message);
    }
  };
  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    try { const result = await generateAgent(prompt.trim()); navigate(`/agents/${result.id}`); }
    catch (generationError) { setError(generationError.message || "Unable to build your agent."); setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-4xl px-space-xl py-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="mb-space-md rounded-full bg-surface-container-low px-space-md py-1 text-label-sm"><span className="mr-1 text-primary">●</span>AI Voice Composer <span className="ml-1 text-outline">v2.4</span></div>
        <h1 className="text-display-sm font-semibold tracking-tight">What voice agent do you want to build?</h1>
        <p className="mt-space-sm text-body-lg text-on-surface-variant">Describe it in plain words. Type or speak your idea.</p>
        <div className="mt-space-xl w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg text-left shadow-soft">
          <textarea aria-label="Describe your voice agent" className="min-h-32 w-full resize-none border-0 bg-transparent text-body-md outline-none placeholder:text-outline/70" maxLength={500} onChange={(event) => setValue(event.target.value)} placeholder="A friendly receptionist for my dental clinic who books appointments in English and Hindi..." value={prompt} />
          <div className="mt-space-md flex items-center justify-between border-t border-outline-variant pt-space-md">
            <button aria-label="Record voice dictation" className={`rounded-full px-space-md py-1 text-label-md ${listening ? "bg-primary text-on-primary" : "bg-surface-container"}`} disabled={transcribing} onClick={toggleDictation} type="button"><Icon className="mr-1 text-[14px]">mic</Icon>{transcribing ? "Transcribing..." : listening ? "Listening..." : "Dictate"}</button>
            <div className="flex items-center gap-space-md"><span className="font-mono text-label-sm text-outline">{prompt.length} / 500</span><Button disabled={!prompt.trim() || loading} onClick={handleGenerate}><Icon className="text-[16px]">auto_awesome</Icon>{loading ? "Building your agent..." : "Generate agent"}</Button></div>
          </div>
          {error && <p className="mt-space-sm text-body-sm text-error">{error}</p>}
        </div>
        <div className="mt-space-lg flex flex-wrap justify-center gap-2">
          {chips.map(([label, icon, value], index) => <button className={`flex items-center gap-1.5 rounded-full px-space-md py-1.5 text-label-md ${index === 1 ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant shadow-soft"}`} key={label} onClick={() => setValue(value)} type="button"><Icon className="text-[14px]">{icon}</Icon>{label}</button>)}
        </div>
      </div>
      <div className="mb-space-md mt-8 flex items-center justify-between px-1 text-label-sm uppercase text-outline"><span>Try an example</span><span className="normal-case">Click card to insert</span></div>
      <div className="grid gap-space-md md:grid-cols-3">
        {examples.map(([icon, title, description, type, value]) => <button className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg text-left transition-shadow hover:shadow-md" key={title} onClick={() => setValue(value)} type="button"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container"><Icon className="text-[16px]">{icon}</Icon></span><h2 className="mt-space-md font-semibold">{title}</h2><p className="mt-1 min-h-12 text-body-sm text-on-surface-variant">{description}</p><div className="mt-space-lg flex justify-between text-label-sm text-outline"><span>{type}</span><span>→</span></div></button>)}
      </div>
      <div className="mt-space-xl flex items-center justify-between rounded-xl bg-surface-container-low p-space-lg"><div className="flex items-center gap-space-md"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container"><Icon>graphic_eq</Icon></span><div><h2 className="text-body-sm font-semibold">Need a specific voice or persona?</h2><p className="text-body-sm text-on-surface-variant">Clone your brand voice or pick from 85+ ultra-low latency studio voices.</p></div></div><Button variant="secondary">Browse voices</Button></div>
    </div>
  );
}
