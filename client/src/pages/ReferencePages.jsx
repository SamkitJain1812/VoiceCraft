import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import TestConsole from "../components/TestConsole";
import DeployModal from "../components/DeployModal";
import Modal from "../components/Modal";
import { deleteAgent, getAgent, getConversation, listAgents, listConversations, refineAgent, runAgentTests, updateAgent } from "../lib/api";
import VoicePicker from "../components/VoicePicker";
import Skeleton from "../components/Skeleton";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function PageHeader({ eyebrow, title, description, actions, titleClassName = "text-display-sm" }) {
  return (
    <div className="mb-space-lg flex items-start justify-between gap-space-lg">
      <div>
        {eyebrow && <p className="mb-1 text-label-sm uppercase text-outline">{eyebrow}</p>}
        <h1 className={`${titleClassName} font-semibold tracking-tight`}>{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-space-sm">{actions}</div>}
    </div>
  );
}

const EmptyState = ({ icon, title, text, action }) => (
  <Card className="flex min-h-64 flex-col items-center justify-center p-space-xl text-center">
    <Icon className="mb-space-md text-3xl text-outline">{icon}</Icon>
    <h2 className="text-headline-lg font-semibold">{title}</h2>
    <p className="mt-space-sm max-w-sm text-body-sm text-on-surface-variant">{text}</p>
    {action && <Link className="mt-space-lg" to="/create"><Button>{action}</Button></Link>}
  </Card>
);

export function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-6xl px-space-xl py-10">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="voice-orb mb-space-xl"><Icon className="text-3xl">graphic_eq</Icon><span>● READY</span></div>
        <h1 className="text-display-lg font-semibold tracking-tight">Build your first voice agent</h1>
        <p className="mt-space-sm text-body-lg text-on-surface-variant">Describe a voice assistant and ship it in minutes</p>
        <div className="mt-space-lg flex gap-space-md">
          <Button onClick={() => navigate("/create")}><Icon className="text-[16px]">auto_awesome</Icon>Create agent</Button>
          <Button variant="secondary"><Icon className="text-[16px]">play_circle</Icon>Explore playground</Button>
        </div>
      </div>
      <div className="mt-16">
        <div className="mb-space-md flex justify-between text-label-sm uppercase text-outline"><span>Or start with a verified template</span><span className="normal-case">View all templates →</span></div>
        <div className="grid gap-space-lg md:grid-cols-3">
          {["Customer Support Agent", "Outbound Sales SDR", "Appointment Booking"].map((item, index) => (
            <Card className="p-space-lg" key={item}>
              <div className="mb-space-lg"><span className="rounded-lg bg-surface-container p-space-sm"><Icon>{["call", "trending_up", "calendar_today"][index]}</Icon></span></div>
              <h2 className="font-semibold">{item}</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">{["Fast, empathetic phone support with FAQ grounding, order resolution, and live call transfer.", "Friendly, natural conversational qualifier with smart objection handling and low latency.", "Integrated calendar assistant for real-time scheduling, reschedules, and SMS confirmations."][index]}</p>
              <div className="mt-space-lg flex justify-between text-label-sm text-outline"><span>{["380ms avg latency", "Adaptive tone", "Cal & Google sync"][index]}</span><span>→</span></div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuAgentId, setMenuAgentId] = useState(null);
  const [renameAgent, setRenameAgent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [agentName, setAgentName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { listAgents().then(setAgents).catch(() => setAgents([])).finally(() => setLoading(false)); }, []);

  const openRename = (agent) => {
    setMenuAgentId(null);
    setRenameAgent(agent);
    setAgentName(agent.name || "");
  };

  const rename = async (event) => {
    event.preventDefault();
    const name = agentName.trim();
    if (!renameAgent || !name || busy) return;
    setBusy(true);
    try {
      const fullAgent = await getAgent(renameAgent.id);
      await updateAgent(renameAgent.id, { ...fullAgent.currentSpec, name });
      setAgents((items) => items.map((agent) => agent.id === renameAgent.id ? { ...agent, name } : agent));
      setRenameAgent(null);
    } catch {
      // The shared API helper displays request errors.
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await deleteAgent(deleteTarget.id);
      setAgents((items) => items.filter((agent) => agent.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // The shared API helper displays request errors.
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-6xl px-space-xl py-space-xl">
      <PageHeader title="Agents" description="Build, test, and manage your voice assistants." actions={<Link to="/create"><Button><Icon>add</Icon>Create agent</Button></Link>} />
      {loading ? <div className="grid gap-space-lg md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <Card className="space-y-4 p-space-lg" key={item}><Skeleton className="h-9 w-9" /><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /></Card>)}</div> : agents.length === 0 ? <EmptyState icon="smart_toy" title="No agents yet" text="Create your first voice agent from a plain-language description." action="Create an agent" /> : (
        <div className="grid gap-space-lg md:grid-cols-2 lg:grid-cols-3">{agents.map((agent) => (
          <Link to={`/agents/${agent.id}`} key={agent.id}><Card className="relative p-space-lg transition-shadow hover:shadow-md"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container"><Icon>smart_toy</Icon></span><div className="flex items-center gap-space-sm"><Badge>Live</Badge><button type="button" aria-label={`More options for ${agent.name}`} aria-expanded={menuAgentId === agent.id} className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface" onClick={(event) => { event.preventDefault(); setMenuAgentId((id) => id === agent.id ? null : agent.id); }}><Icon>more_vert</Icon></button></div></div>{menuAgentId === agent.id && <div className="absolute right-space-lg top-14 z-10 w-32 rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"><button type="button" className="flex w-full items-center gap-space-sm px-space-md py-2 text-left text-body-sm hover:bg-surface-container" onClick={(event) => { event.preventDefault(); openRename(agent); }}><Icon className="text-[16px]">edit</Icon>Rename</button><button type="button" className="flex w-full items-center gap-space-sm px-space-md py-2 text-left text-body-sm text-error hover:bg-error/5" onClick={(event) => { event.preventDefault(); setMenuAgentId(null); setDeleteTarget(agent); }}><Icon className="text-[16px]">delete</Icon>Delete</button></div>}<h2 className="mt-space-lg font-semibold">{agent.name}</h2><p className="mt-1 text-body-sm text-on-surface-variant">{agent.language || "English"} · Updated recently</p><div className="mt-space-lg text-label-sm text-outline">Open workspace →</div></Card></Link>
        ))}</div>
      )}
      <Modal open={Boolean(renameAgent)} title="Rename agent" onClose={() => !busy && setRenameAgent(null)}>
        <form className="space-y-space-lg" onSubmit={rename}>
          <label className="block text-body-sm font-semibold" htmlFor="agent-name">Agent name</label>
          <input autoFocus className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm outline-none focus:border-primary" id="agent-name" maxLength={120} onChange={(event) => setAgentName(event.target.value)} value={agentName} />
          <div className="flex justify-end gap-space-sm"><Button disabled={busy} onClick={() => setRenameAgent(null)} type="button" variant="secondary">Cancel</Button><Button disabled={busy || !agentName.trim()} type="submit">{busy ? "Saving..." : "Save name"}</Button></div>
        </form>
      </Modal>
      <Modal open={Boolean(deleteTarget)} title="Delete agent" onClose={() => !busy && setDeleteTarget(null)}>
        <div className="space-y-space-lg"><p className="text-body-sm text-on-surface-variant">Delete <span className="font-semibold text-on-surface">{deleteTarget?.name}</span>? This permanently removes the agent and its saved versions.</p><div className="flex justify-end gap-space-sm"><Button disabled={busy} onClick={() => setDeleteTarget(null)} variant="secondary">Cancel</Button><Button className="bg-error hover:bg-error/90" disabled={busy} onClick={remove}>{busy ? "Deleting..." : "Delete agent"}</Button></div></div>
      </Modal>
    </div>
  );
}

export function AgentWorkspacePage() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getAgent(id).then(setAgent).catch(() => setAgent(null)).finally(() => setLoading(false)); }, [id]);
  const spec = agent?.versions?.[agent.versions.length - 1]?.spec;
  if (loading) return <div className="mx-auto max-w-6xl space-y-6 px-space-lg py-space-lg"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-1/2" /><div className="grid gap-space-lg lg:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton className="h-80" key={item} />)}</div></div>;
  return (
    <div className="mx-auto max-w-6xl px-space-lg py-space-lg">
      <div className="mb-space-md flex items-center gap-1 text-label-sm text-on-surface-variant"><Link to="/agents">Agents</Link><span>/</span><span>{spec?.name || "Agent workspace"}</span></div>
      <PageHeader titleClassName="text-headline-xl" title={spec?.name || "Dental Clinic Receptionist"} description="Inbound voice agent handles appointments, general inquiry, and triage routing." actions={<><Button variant="secondary"><Icon>science</Icon>Run auto-tests</Button><Button onClick={() => setShowDeploy(true)}><Icon>rocket_launch</Icon>Deploy</Button><Button variant="secondary"><Icon>more_vert</Icon></Button></>} />
      <div className="grid gap-space-lg lg:grid-cols-[1fr_1.15fr_1fr]">
        <Card className="p-space-md"><div className="mb-space-md flex justify-between"><h2 className="font-semibold"><Icon className="mr-1 text-[16px]">auto_awesome</Icon>Refine in chat</h2><span className="text-label-sm text-outline">Claude 3.5 Sonnet</span></div><div className="space-y-space-md border-b border-outline-variant pb-space-md"><div className="ml-auto max-w-[85%] rounded-lg bg-primary p-space-md text-body-sm text-on-primary">Make the welcome message shorter and warmer</div><div className="rounded-lg bg-surface-container p-space-md text-body-sm">Updated: welcome message is now 1 concise sentence. Added empathetic phrasing and saved as v3.</div></div><p className="my-space-md text-label-sm uppercase text-outline">Quick adjustments</p>{["Escalate emergency dental pain", "Add Spanish and Hindi handling"].map((item) => <div className="mb-1 rounded bg-surface-container-low px-space-md py-1 text-body-sm" key={item}>↗ {item}</div>)}<div className="mt-space-md rounded-lg border border-outline-variant p-space-sm text-body-sm text-outline">Make it friendlier, add Hindi, escalate angry callers... <span className="float-right rounded-full bg-primary px-2 text-on-primary">↑</span></div><h3 className="mt-space-lg border-b border-outline-variant pb-space-sm font-semibold">⟳ Version history</h3>{["v3  Just now", "v2  2 hours ago", "v1  Yesterday"].map((version, index) => <div className="flex justify-between py-space-sm text-body-sm" key={version}><span>{version}</span>{index === 0 ? <Badge>Active</Badge> : <span className="text-label-sm text-outline">Restore</span>}</div>)}</Card>
        <Card className="p-space-md"><div className="mb-space-md flex gap-space-lg border-b border-outline-variant pb-space-sm"><span className="rounded-full bg-primary px-space-md py-1 text-label-md text-on-primary">Overview</span><span className="text-body-sm text-on-surface-variant">Flow</span><span className="text-body-sm text-on-surface-variant">Knowledge</span></div><h2 className="font-semibold">System prompt</h2><p className="mt-space-md rounded-lg bg-surface-container p-space-md text-body-sm leading-relaxed">{spec?.system_prompt || "You are an empathetic, articulate receptionist for Smile Dental Clinic. Your primary role is to schedule cleanings, verify dental insurance, answer common clinic queries, and triage urgent dental pain with care."}</p><h2 className="mt-space-lg font-semibold">Welcome message</h2><p className="mt-space-sm rounded-lg border border-outline-variant p-space-md text-body-sm">{spec?.first_message || "Hi! Thanks for calling Smile Dental. How can I help you today?"}</p></Card>
        <TestConsole agentId={agent?.elevenAgentId || id} />
      </div>
      <div className="mt-space-lg grid gap-space-lg md:grid-cols-2"><Card className="p-space-lg"><h2 className="font-semibold">Language <Badge>Auto-switch enabled</Badge></h2><div className="mt-space-md flex gap-space-sm"><span className="rounded-lg bg-surface-container px-space-md py-space-sm text-body-sm">English + Hindi</span><span className="rounded-lg bg-surface-container px-space-md py-space-sm text-body-sm">Natural Warmth</span></div></Card><Card className="p-space-lg"><h2 className="font-semibold">Guardrails <Badge>3 active</Badge></h2><div className="mt-space-md flex flex-wrap gap-space-sm">{["Never give medical advice", "Transfer to human if patient reports pain", "Don't quote unlisted prices"].map((item) => <span className="rounded-full bg-surface-container px-space-md py-space-sm text-body-sm" key={item}>{item} ×</span>)}</div></Card></div>
      {showDeploy && <DeployModal agentName={spec?.name || "Dental Clinic Receptionist"} onClose={() => setShowDeploy(false)} />}
    </div>
  );
}

export function VoicesPage() {
  return <div className="mx-auto max-w-6xl px-space-xl py-space-xl"><PageHeader eyebrow="Acoustic Matrix · Latency engine active" title="Voice Library" description="Choose a hyper-realistic conversational voice for your agents." actions={<Button><Icon>add</Icon>Clone voice</Button>} /><VoicePicker /></div>;
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { listConversations().then(setConversations).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false)); }, []);
  const metrics = useMemo(() => {
    const total = conversations.length;
    const average = total ? conversations.reduce((sum, item) => sum + item.duration, 0) / total : 0;
    const successful = conversations.filter((item) => item.status === "success" || item.status === "completed").length;
    return { total, average, successRate: total ? Math.round((successful / total) * 100) : 0, flagged: conversations.filter((item) => item.flagged).length };
  }, [conversations]);
  const chartData = useMemo(() => {
    const grouped = conversations.reduce((result, item) => {
      const key = item.startTime ? new Date(item.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Unknown";
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    return Object.entries(grouped).map(([date, calls]) => ({ date, calls }));
  }, [conversations]);
  const duration = (seconds) => `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return <div className="mx-auto max-w-6xl px-space-xl py-space-xl">
    <PageHeader title="Conversations" description="Monitor agent call volumes, latency performance, customer sentiment, and flagged sessions." actions={<><Button variant="secondary">Last 14 days⌄</Button><Button variant="secondary">All agents⌄</Button><Button variant="secondary">⇩ Export CSV</Button></>} />
    {error && <p className="mb-space-md rounded-lg bg-error/5 p-space-md text-body-sm text-error">{error}</p>}
    {loading ? <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div> : conversations.length === 0 && !error ? <EmptyState icon="forum" title="No calls yet" text="Start a test call to see data here." /> : <>
      <div className="grid gap-space-md md:grid-cols-4">
        {[["Total calls", metrics.total, "Across all saved agents"], ["Avg duration", duration(metrics.average), "Average call length"], ["Success rate", `${metrics.successRate}%`, "Successful completions"], ["Flagged sessions", metrics.flagged, "Requires transcript review"]].map(([label, value, note], index) => <Card className="p-space-lg" key={label}><p className="text-label-sm text-outline">{label}</p><p className={`mt-space-lg text-display-sm font-semibold ${index === 3 ? "text-error" : ""}`}>{value}</p><p className="mt-1 text-label-sm text-outline">{note}</p></Card>)}
      </div>
      <Card className="mt-space-lg p-space-lg"><h2 className="font-semibold">Calls per day ·</h2><p className="text-body-sm text-on-surface-variant">Daily synthesis volume telemetry across active agents</p><div className="mt-space-lg h-56"><ResponsiveContainer height="100%" width="100%"><LineChart data={chartData}><CartesianGrid stroke="#e5e5e5" strokeDasharray="2 4" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Line dataKey="calls" dot={{ fill: "#000", r: 3 }} stroke="#000" strokeWidth={2} type="monotone" /></LineChart></ResponsiveContainer></div></Card>
      <Card className="mt-space-lg overflow-hidden"><div className="flex items-center justify-between p-space-lg"><h2 className="font-semibold">Recent calls log</h2><span className="text-label-sm text-outline">Showing {conversations.length} calls</span></div><div className="grid grid-cols-[1.2fr_1.2fr_0.7fr_0.7fr_0.5fr] border-y border-outline-variant bg-surface-container-low px-space-lg py-space-sm text-label-sm uppercase text-outline"><span>Date & time</span><span>Agent</span><span>Duration</span><span>Status</span><span>Action</span></div><div className="divide-y divide-outline-variant">{conversations.map((conversation) => <Link className="grid grid-cols-[1.2fr_1.2fr_0.7fr_0.7fr_0.5fr] items-center px-space-lg py-space-md text-body-sm hover:bg-surface-container-low" to={`/conversations/${conversation.id}`} key={conversation.id}><span>{conversation.startTime ? new Date(conversation.startTime).toLocaleString() : "Unknown"}</span><span>{conversation.agentName}</span><span>{duration(conversation.duration)}</span><span>      <Badge tone={conversation.flagged ? "danger" : "success"}>{conversation.flagged ? "Flagged" : conversation.status}</Badge></span><span className="text-label-sm">View →</span></Link>)}</div></Card>
    </>}
  </div>;
}

export function ConversationDetailsPage() {
  const { id } = useParams();
  const [conversation, setConversation] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getConversation(id).then(setConversation).catch((loadError) => setError(loadError.message)); }, [id]);
  if (!conversation) return <div className="mx-auto max-w-6xl space-y-4 px-space-xl py-space-xl">{error ? <Card className="p-space-xl text-body-sm text-error">{error}</Card> : <><Skeleton className="h-6 w-40" /><Skeleton className="h-96" /></>}</div>;
  const duration = `${Math.floor(conversation.duration / 60)}m ${Math.round(conversation.duration % 60)}s`;
  return <div className="mx-auto max-w-6xl px-space-xl py-space-xl"><div className="mb-space-lg text-label-sm text-on-surface-variant"><Link to="/conversations">← Conversations</Link> / {conversation.id}</div><PageHeader title={conversation.agentName} description={`${conversation.startTime ? new Date(conversation.startTime).toLocaleString() : "Unknown time"} · ${duration}`} actions={<><Button>◉ Listen to audio</Button><Button variant="secondary">⇩ Export transcript</Button></>} /><div className="grid gap-space-lg lg:grid-cols-[1.4fr_1fr]"><Card className="p-space-lg"><div className="flex items-center justify-between"><h2 className="text-headline-lg font-semibold">Call Transcript</h2><Badge tone={conversation.flagged ? "error" : "success"}>{conversation.flagged ? "Flagged" : conversation.status}</Badge></div>{conversation.transcript.length ? conversation.transcript.map((turn, index) => <div className={`mt-space-lg max-w-[85%] rounded-lg p-space-md text-body-sm ${turn.role === "user" ? "ml-auto border border-outline-variant" : "bg-surface-container"}`} key={`${turn.timeInCallSecs}-${index}`}><p className="mb-1 text-label-sm text-outline">{turn.role === "user" ? "Caller" : "VoiceCraft AI"}{turn.timeInCallSecs !== null ? ` · ${Math.round(turn.timeInCallSecs)}s` : ""}</p>{turn.message}</div>) : <p className="mt-space-lg text-body-sm text-outline">No transcript is available.</p>}</Card><div className="space-y-space-lg">{conversation.flagged && <Card className="border-error/30 bg-error/5 p-space-lg"><h2 className="font-semibold text-error">⚑ Flagged conversation</h2><p className="mt-space-sm text-body-sm">This conversation needs manual review because it failed or mentioned escalation language.</p></Card>}<Card className="p-space-lg"><h2 className="font-semibold">✦ AI Summary</h2><p className="mt-space-md text-body-sm leading-relaxed">{conversation.summary}</p></Card><Card className="p-space-lg"><h2 className="font-semibold">Outcome <Badge>{conversation.outcome}</Badge></h2><div className="mt-space-md rounded bg-surface-container px-space-md py-2 text-body-sm"><span className="text-outline">Duration</span><span className="float-right">{duration}</span></div><div className="mt-space-sm rounded bg-surface-container px-space-md py-2 text-body-sm"><span className="text-outline">Status</span><span className="float-right">{conversation.status}</span></div></Card></div></div></div>;
}

export function TestsPage() {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [testRun, setTestRun] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fixMessage, setFixMessage] = useState("");
  useEffect(() => { listAgents().then((items) => { setAgents(items); if (items[0]) setAgentId(items[0].id); }).catch((loadError) => setError(loadError.message)); }, []);

  const runTests = async () => {
    if (!agentId) return;
    setBusy("run");
    setError("");
    try { setTestRun(await runAgentTests(agentId)); } catch (runError) { setError(runError.message); } finally { setBusy(""); }
  };

  const applyFixes = async () => {
    const fixes = testRun?.results.map((item) => item.suggestedFix).filter(Boolean) || [];
    if (!fixes.length) return;
    setBusy("fix");
    setError("");
    try {
      await refineAgent(agentId, `Apply these automated test fixes:\n${fixes.map((fix, index) => `${index + 1}. ${fix}`).join("\n")}`);
      setFixMessage("Suggested fixes applied as a new agent version.");
    } catch (fixError) { setError(fixError.message); } finally { setBusy(""); }
  };

  return <div className="mx-auto max-w-6xl px-space-xl py-space-xl">
    <PageHeader title="Auto-tests" description="Automated persona test suite · 4 scenarios evaluated across speech, edge cases & tone." actions={<><select className="rounded-full border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm text-label-sm" onChange={(event) => setAgentId(event.target.value)} value={agentId}><option value="">Select an agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><Button disabled={!agentId || busy === "run"} onClick={runTests}>↻ {busy === "run" ? "Running..." : "Run tests"}</Button></>} />
    {error && <p className="mb-space-md rounded-lg bg-error/5 p-space-md text-body-sm text-error">{error}</p>}
    {fixMessage && <p className="mb-space-md rounded-lg bg-emerald-50 p-space-md text-body-sm text-emerald-700">{fixMessage}</p>}
    {!testRun ? <EmptyState icon="science" title="Ready to test" text="Choose an agent and run the four caller simulations to evaluate its goals and guardrails." /> : <>
      <Card className="mb-space-lg flex flex-wrap items-center gap-space-xl p-space-xl"><div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary text-2xl font-semibold">{testRun.overallAverage}</div><div><h2 className="text-headline-lg font-semibold">{testRun.results.filter((item) => item.result === "pass").length} of {testRun.results.length} scenarios passed</h2><p className="mt-1 text-body-sm text-on-surface-variant">Scores are based on the agent goals, flow, and guardrails.</p><Button className="mt-space-md" disabled={busy === "fix" || !testRun.results.some((item) => item.suggestedFix)} onClick={applyFixes}>{busy === "fix" ? "Applying..." : "Apply suggested fixes"}</Button></div></Card>
      <h2 className="mb-space-md font-semibold">Test scenarios <Badge>{testRun.results.length}</Badge></h2>
      <div className="grid gap-space-lg md:grid-cols-2">{testRun.results.map((item, index) => <Card className="p-space-lg" key={`${item.scenario.name}-${index}`}><div className="flex items-start justify-between gap-space-md"><div><h3 className="font-semibold">{item.scenario.name} <Badge tone={item.result === "pass" ? "success" : "danger"}>{item.result}</Badge></h3><p className="mt-1 text-body-sm text-on-surface-variant">{item.scenario.persona}</p></div><strong className="text-headline-lg">{item.score}<span className="text-label-sm font-normal">/10</span></strong></div><p className="mt-space-md text-body-sm"><strong>Goal:</strong> {item.scenario.goal}</p>{item.failures.length > 0 && <div className="mt-space-md rounded-lg bg-error/5 p-space-md text-body-sm"><p className="font-semibold text-error">Failures</p>{item.failures.map((failure) => <p className="mt-1 text-error" key={failure}>· {failure}</p>)}</div>}{item.suggestedFix && <div className="mt-space-md rounded-lg bg-surface-container-low p-space-md text-body-sm"><p className="text-label-sm uppercase text-outline">Suggested prompt fix</p><p className="mt-1">{item.suggestedFix}</p></div>}<button className="mt-space-md text-label-sm text-on-surface-variant hover:text-on-surface" onClick={() => setExpanded((current) => ({ ...current, [index]: !current[index] }))} type="button">{expanded[index] ? "Hide transcript ↑" : "View transcript →"}</button>{expanded[index] && <div className="mt-space-md max-h-56 space-y-space-sm overflow-y-auto border-t border-outline-variant pt-space-md">{item.transcript.map((turn, turnIndex) => <div className={`rounded-lg p-space-sm text-body-sm ${turn.role === "user" ? "bg-surface-container-high" : "bg-surface-container-low"}`} key={`${turnIndex}-${turn.message}`}>{turn.message}</div>)}</div>}</Card>)}</div>
    </>}
  </div>;
}
