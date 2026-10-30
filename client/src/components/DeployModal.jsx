import { useMemo, useState } from "react";
import Card from "./Card";
import Button from "./Button";
import { callAgentPhone, connectAgentPhone } from "../lib/api";

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function CopyButton({ value, children = "Copy" }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button className="shrink-0 rounded-full bg-primary px-space-md py-1 text-label-sm text-on-primary" onClick={copy} type="button">
      {copied ? "Copied" : children}
    </button>
  );
}

export default function DeployModal({ agentId, agentName, phone, onClose }) {
  const [tab, setTab] = useState("Share link");
  const [phoneState, setPhoneState] = useState(phone || { status: "not_connected" });
  const [phoneBusy, setPhoneBusy] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [callMessage, setCallMessage] = useState("");
  const link = useMemo(() => `${window.location.origin}/talk/${agentId}`, [agentId]);
  const snippet = `<iframe src="${link}" title="${agentName || "VoiceCraft assistant"}" allow="microphone" style="width:100%;height:620px;border:0;border-radius:16px;"></iframe>`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`;

  const connectPhone = async () => {
    setPhoneBusy("connect");
    setPhoneError("");
    setCallMessage("");
    try {
      setPhoneState(await connectAgentPhone(agentId));
    } catch (error) {
      setPhoneError(error.message);
    } finally {
      setPhoneBusy("");
    }
  };

  const placeCall = async (event) => {
    event.preventDefault();
    if (!toNumber.trim()) return;
    setPhoneBusy("call");
    setPhoneError("");
    setCallMessage("");
    try {
      const result = await callAgentPhone(agentId, toNumber.trim());
      setCallMessage(result.message || "Outbound call started.");
    } catch (error) {
      setPhoneError(error.message);
    } finally {
      setPhoneBusy("");
    }
  };

  const statusLabel = phoneState.status === "connected"
    ? "Connected"
    : phoneState.simulated
      ? "Simulated"
      : "Not connected";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-[2px]">
      <Card className="w-full max-w-[560px] overflow-hidden shadow-xl">
        <div className="flex items-start justify-between border-b border-outline-variant p-space-lg">
          <div>
            <h2 className="text-headline-lg font-semibold">Deploy {agentName}</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">Distribute, embed, or connect your voice agent across channels.</p>
          </div>
          <button className="text-on-surface-variant hover:text-on-surface" onClick={onClose} type="button">
            <Icon>close</Icon>
          </button>
        </div>

        <div className="flex gap-space-lg border-b border-outline-variant px-space-lg pt-space-md text-body-sm">
          {["Share link", "Web widget", "Phone"].map((item) => (
            <button
              className={`pb-space-sm ${tab === item ? "rounded-full bg-primary px-space-md text-on-primary" : "text-on-surface-variant"}`}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="p-space-lg">
          {tab === "Share link" && (
            <section className="rounded-xl border border-outline-variant p-space-md">
              <h3 className="flex items-center gap-space-sm text-body-sm font-semibold"><Icon className="text-[16px]">link</Icon>Direct conversation link</h3>
              <p className="mt-1 text-label-sm text-on-surface-variant">Anyone with this link can talk to your agent directly in their browser.</p>
              <div className="mt-space-md flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
                <input className="min-w-0 flex-1 bg-transparent px-space-sm text-label-sm outline-none" readOnly value={link} />
                <CopyButton value={link} />
              </div>
              <div className="mt-space-md flex items-center gap-space-lg rounded-lg bg-surface-container-low p-space-md">
                <img alt="QR code for the public voice assistant" className="h-28 w-28 rounded bg-white p-1" src={qrUrl} />
                <div className="text-label-sm text-on-surface-variant">
                  <p className="font-semibold text-on-surface">Scan to open on mobile</p>
                  <p className="mt-1">Audio WebRTC active · SSL secure</p>
                </div>
              </div>
            </section>
          )}

          {tab === "Web widget" && (
            <section className="rounded-xl border border-outline-variant p-space-md">
              <div className="flex items-center justify-between gap-space-md">
                <h3 className="flex items-center gap-space-sm text-body-sm font-semibold"><Icon className="text-[16px]">code</Icon>Iframe embed</h3>
                <CopyButton value={snippet} children="Copy code" />
              </div>
              <p className="mt-1 text-label-sm text-on-surface-variant">Paste this snippet into any page to embed the public voice assistant.</p>
              <pre className="mt-space-md overflow-x-auto rounded-lg bg-surface-container-low p-space-md text-[11px] leading-relaxed text-on-surface-variant"><code>{snippet}</code></pre>
              <div className="mt-space-md overflow-hidden rounded-lg border border-outline-variant">
                <iframe className="h-48 w-full" src={link} title="VoiceCraft widget preview" />
              </div>
            </section>
          )}

          {tab === "Phone" && (
            <section className="rounded-xl border border-outline-variant p-space-md">
              <div className="flex items-center justify-between gap-space-md">
                <div>
                  <h3 className="flex items-center gap-space-sm text-body-sm font-semibold"><Icon className="text-[16px]">phone_in_talk</Icon>Phone deployment</h3>
                  <p className="mt-1 text-label-sm text-on-surface-variant">Connect the configured Twilio number to this agent.</p>
                </div>
                <span className={`rounded-full px-space-md py-1 text-label-sm ${phoneState.status === "connected" ? "bg-emerald-50 text-emerald-700" : phoneState.simulated ? "bg-amber-50 text-amber-700" : "bg-surface-container text-on-surface-variant"}`}>{statusLabel}</span>
              </div>
              <div className="mt-space-lg flex items-center justify-between rounded-lg bg-surface-container-low p-space-md">
                <div className="text-body-sm"><p className="font-semibold">{phoneState.phoneNumber || "No number connected"}</p><p className="mt-1 text-label-sm text-on-surface-variant">Twilio phone number</p></div>
                <Button disabled={phoneBusy === "connect"} onClick={connectPhone}>{phoneBusy === "connect" ? "Connecting..." : phoneState.status === "connected" ? "Reconnect" : "Connect"}</Button>
              </div>
              {(phoneState.simulated || phoneState.status === "simulated") && <p className="mt-space-md rounded-lg bg-amber-50 p-space-md text-label-sm text-amber-800">Simulated mode is active because Twilio credentials are not configured. No real calls will be placed.</p>}
              {phoneError && <p className="mt-space-md rounded-lg bg-error/5 p-space-md text-body-sm text-error">{phoneError}</p>}
              {callMessage && <p className="mt-space-md rounded-lg bg-emerald-50 p-space-md text-body-sm text-emerald-700">{callMessage}</p>}
              <form className="mt-space-lg border-t border-outline-variant pt-space-lg" onSubmit={placeCall}>
                <label className="text-label-sm uppercase text-outline" htmlFor="test-outbound-number">Test outbound call</label>
                <div className="mt-space-sm flex gap-space-sm">
                  <input className="min-w-0 flex-1 rounded-lg border border-outline-variant px-space-md py-space-sm text-body-sm outline-none focus:border-primary" id="test-outbound-number" onChange={(event) => setToNumber(event.target.value)} placeholder="+1 555 123 4567" type="tel" value={toNumber} />
                  <Button disabled={phoneBusy === "call" || !toNumber.trim()} type="submit">{phoneBusy === "call" ? "Calling..." : "Call"}</Button>
                </div>
                <p className="mt-space-sm text-label-sm text-on-surface-variant">Only call a verified number you control.</p>
              </form>
            </section>
          )}
        </div>
      </Card>
    </div>
  );
}
