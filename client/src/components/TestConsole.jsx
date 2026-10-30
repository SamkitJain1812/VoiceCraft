import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Badge from "./Badge";
import Button from "./Button";
import Card from "./Card";
import { getAgentSignedUrl, getPublicAgentSignedUrl } from "../lib/api";

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function ConversationPanel({ agentId, publicMode = false }) {
  const [messages, setMessages] = useState([]);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState("");
  const [hasConnected, setHasConnected] = useState(false);
  const transcriptRef = useRef(null);
  const lastUserMessageAt = useRef(null);
  const intentionalEnd = useRef(false);

  const {
    startSession,
    endSession,
    status,
    mode,
    isMuted,
    setMuted,
  } = useConversation({
    onConnect: () => {
      setHasConnected(true);
      setError("");
    },
    onDisconnect: () => {
      if (!intentionalEnd.current) {
        setError("The connection dropped. Check your network and try again.");
      }
      intentionalEnd.current = false;
    },
    onError: (message) => {
      setError(message || "The voice session encountered an error.");
    },
    onMessage: ({ message, source }) => {
      if (!message?.trim()) return;

      const receivedAt = performance.now();
      if (source === "user") {
        lastUserMessageAt.current = receivedAt;
      } else if (source === "ai" && lastUserMessageAt.current !== null) {
        setLatency(Math.round(receivedAt - lastUserMessageAt.current));
        lastUserMessageAt.current = null;
      }

      setMessages((current) => [
        ...current,
        { id: `${source}-${receivedAt}`, text: message, source },
      ]);
    },
  });

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const requestMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not available in this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  };

  const startCall = async () => {
    setError("");
    intentionalEnd.current = false;

    try {
      await requestMicrophone();
      const { signedUrl } = publicMode
        ? await getPublicAgentSignedUrl(agentId)
        : await getAgentSignedUrl(agentId);
      if (!signedUrl) throw new Error("The server returned an empty signed URL.");
      await startSession({ signedUrl });
    } catch (startError) {
      const message =
        startError?.name === "NotAllowedError"
          ? "Microphone access was denied. Allow microphone access and retry."
          : startError.message || "Unable to start the voice session.";
      setError(message);
    }
  };

  const endCall = () => {
    intentionalEnd.current = true;
    endSession();
  };

  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const orbState = mode === "speaking" ? "speaking" : "listening";

  return (
    <Card className={`flex flex-col p-space-md ${publicMode ? "min-h-[520px] w-full max-w-xl" : "min-h-[560px]"}`}>
      <div className="flex items-center justify-between border-b border-outline-variant pb-space-md">
        <h2 className="font-semibold">
          <Icon className="mr-1 text-[16px]">graphic_eq</Icon>
          {publicMode ? "Voice assistant" : "Live test console"}
        </h2>
        <Badge>{latency === null ? "Latency --" : `Latency ${latency} ms`}</Badge>
      </div>

      <div className="flex flex-1 flex-col items-center py-space-xl">
        <div className={`test-console-orb ${orbState} ${isConnected ? "active" : ""}`}>
          <Icon className="text-3xl">graphic_eq</Icon>
        </div>
        <p className="mt-space-md text-label-sm text-outline">
          {isConnecting
            ? "Connecting..."
            : isConnected
              ? mode === "speaking"
                ? "Agent is speaking"
                : "Listening for you"
              : "Ready · WebRTC Audio Stream"}
        </p>

        {error && (
          <div className="mt-space-md w-full rounded-lg border border-error/30 bg-error/5 p-space-md text-center text-body-sm text-error">
            <p>{error}</p>
            <button className="mt-1 font-semibold underline" onClick={startCall} type="button">
              Retry
            </button>
          </div>
        )}

        <div className="mt-space-md flex items-center gap-space-sm">
          {isConnected ? (
            <>
              <Button onClick={() => setMuted(!isMuted)} variant="secondary">
                <Icon>{isMuted ? "mic_off" : "mic"}</Icon>
                {isMuted ? "Unmute" : "Mute"}
              </Button>
              <Button onClick={endCall}>
                <Icon>call_end</Icon>
                End call
              </Button>
            </>
          ) : (
            <Button disabled={isConnecting} onClick={startCall}>
              <Icon>call</Icon>
              {isConnecting ? "Connecting..." : "Start call"}
            </Button>
          )}
        </div>
      </div>

      <div className="border-t border-outline-variant pt-space-md">
        <div className="flex items-center justify-between">
          <p className="text-label-sm uppercase text-outline">Session transcript</p>
          <button
            className="text-label-sm text-outline hover:text-on-surface"
            onClick={() => setMessages([])}
            type="button"
          >
            Clear
          </button>
        </div>
        <div className="mt-space-sm max-h-48 space-y-space-sm overflow-y-auto pr-1" ref={transcriptRef}>
          {messages.length === 0 ? (
            <p className="py-space-md text-center text-body-sm text-outline">
              Start a call to see the live transcript.
            </p>
          ) : (
            messages.map((message) => (
              <div
                className={`rounded-lg p-space-md text-body-sm ${
                  message.source === "user"
                    ? "ml-8 bg-surface-container-high"
                    : "mr-4 bg-surface-container"
                }`}
                key={message.id}
              >
                <p className="mb-1 text-label-sm text-outline">
                  {message.source === "user" ? "You" : "Agent"}
                </p>
                {message.text}
              </div>
            ))
          )}
        </div>
        <p className="mt-space-md text-center text-label-sm text-outline">
          You are talking to an AI assistant.
        </p>
      </div>
    </Card>
  );
}

export default function TestConsole({ agentId, publicMode = false }) {
  return (
    <ConversationProvider>
      <ConversationPanel agentId={agentId} publicMode={publicMode} />
    </ConversationProvider>
  );
}
