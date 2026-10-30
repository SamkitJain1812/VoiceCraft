import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Card from "../components/Card";
import DeployModal from "../components/DeployModal";
import TestConsole from "../components/TestConsole";
import VoicePicker from "../components/VoicePicker";
import {
  addAgentKnowledge,
  getAgent,
  listAgentKnowledge,
  refineAgent,
  restoreAgentVersion,
  updateAgent,
} from "../lib/api";

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function EditableCard({ title, icon, value, onChange, onSave, saved, children }) {
  return (
    <Card className="p-space-md">
      <div className="mb-space-sm flex items-center justify-between">
        <h2 className="flex items-center gap-1 font-semibold">
          <Icon className="text-[16px]">{icon}</Icon>
          {title}
        </h2>
        <span className="text-label-sm text-on-tertiary-container">{saved ? "Saved" : ""}</span>
      </div>
      {children || (
        <textarea
          className="min-h-24 w-full resize-y rounded-lg bg-surface-container p-space-md text-body-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary"
          onBlur={onSave}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </Card>
  );
}

function formatVersionDate(date) {
  if (!date) return "Unknown time";
  const timestamp = new Date(date);
  if (Number.isNaN(timestamp.getTime())) return "Unknown time";
  return timestamp.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SortableFlowStep({ index, step, onChange, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `flow-step-${index}` });

  return (
    <Card
      className="p-space-md"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="flex items-start gap-space-md">
        <button
          aria-label={`Drag step ${index + 1}`}
          className="mt-1 cursor-grab text-outline active:cursor-grabbing"
          type="button"
          {...attributes}
          {...listeners}
        >
          <Icon>drag_indicator</Icon>
        </button>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-semibold text-on-primary">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1 space-y-space-sm">
          <input
            className="w-full rounded-lg bg-surface-container px-space-md py-space-sm text-body-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="Step title"
            value={step.title}
          />
          <textarea
            className="min-h-24 w-full resize-y rounded-lg bg-surface-container-low p-space-md text-body-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary"
            onChange={(event) => onChange("instruction", event.target.value)}
            placeholder="Describe what the agent should do in this step..."
            value={step.instruction}
          />
        </div>
        <button
          aria-label={`Delete step ${index + 1}`}
          className="text-outline hover:text-error"
          onClick={onDelete}
          type="button"
        >
          <Icon>delete</Icon>
        </button>
      </div>
    </Card>
  );
}

export default function AgentWorkspacePage() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [savedField, setSavedField] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [showDeploy, setShowDeploy] = useState(false);
  const [guardrailInput, setGuardrailInput] = useState("");
  const [knowledge, setKnowledge] = useState([]);
  const [knowledgeUrl, setKnowledgeUrl] = useState("");
  const [knowledgeBusy, setKnowledgeBusy] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [languageMode, setLanguageMode] = useState("en");
  const flowSaveTimer = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadAgent = async () => {
    const data = await getAgent(id);
    setAgent(data);
    setDraft(data.currentSpec || data.versions?.at(-1)?.spec || null);
    if (!draft) {
      setLanguageMode(data.currentSpec?.language === "hi" ? "hi" : "en");
    }
    const documents = await listAgentKnowledge(id);
    setKnowledge(documents);
  };

  useEffect(() => {
    loadAgent().catch((loadError) => setError(loadError.message));
    return () => window.clearTimeout(flowSaveTimer.current);
  }, [id]);

  const versions = agent?.versions || [];
  const currentSpec = draft || {};
  const tabs = ["Overview", "Flow", "Knowledge", "Voice", "Settings"];

  const saveDraft = async (field, nextDraft = draft) => {
    if (!nextDraft) return;
    setBusy(field);
    setError("");
    try {
      await updateAgent(id, nextDraft);
      setSavedField(field);
      await loadAgent();
      window.setTimeout(() => setSavedField(""), 1600);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy("");
    }
  };

  const changeField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const scheduleFlowSave = (nextSteps) => {
    setDraft((current) => ({ ...current, flow_steps: nextSteps }));
    window.clearTimeout(flowSaveTimer.current);
    flowSaveTimer.current = window.setTimeout(() => {
      saveDraft("flow_steps", { ...draft, flow_steps: nextSteps });
    }, 600);
  };

  const updateFlowStep = (index, field, value) => {
    const nextSteps = (draft.flow_steps || []).map((step, stepIndex) =>
      stepIndex === index ? { ...step, [field]: value } : step,
    );
    scheduleFlowSave(nextSteps);
  };

  const deleteFlowStep = (index) => {
    scheduleFlowSave((draft.flow_steps || []).filter((_, stepIndex) => stepIndex !== index));
  };

  const addFlowStep = () => {
    scheduleFlowSave([
      ...(draft.flow_steps || []),
      { title: "New step", instruction: "Describe what the agent should do." },
    ]);
  };

  const reorderFlowSteps = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const activeIndex = Number(active.id.replace("flow-step-", ""));
    const overIndex = Number(over.id.replace("flow-step-", ""));
    scheduleFlowSave(arrayMove(draft.flow_steps || [], activeIndex, overIndex));
  };

  const sendRefinement = async (event) => {
    event.preventDefault();
    const instruction = chatInput.trim();
    if (!instruction || busy) return;
    setBusy("refine");
    setError("");
    setMessages((current) => [...current, { role: "user", text: instruction }]);
    setChatInput("");
    try {
      const result = await refineAgent(id, instruction);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: "Updated: shorter welcome message" },
      ]);
      setDraft(result.spec);
      await loadAgent();
    } catch (refineError) {
      setError(refineError.message);
    } finally {
      setBusy("");
    }
  };

  const restoreVersion = async (version) => {
    setBusy(`restore-${version.n}`);
    setError("");
    try {
      await restoreAgentVersion(id, version.n);
      await loadAgent();
    } catch (restoreError) {
      setError(restoreError.message);
    } finally {
      setBusy("");
    }
  };

  const addGuardrail = async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = guardrailInput.trim();
    if (!value) return;
    const nextDraft = {
      ...draft,
      guardrails: [...(draft.guardrails || []), value],
    };
    setGuardrailInput("");
    setDraft(nextDraft);
    await saveDraft("guardrails", nextDraft);
  };

  const removeGuardrail = async (index) => {
    const nextDraft = {
      ...draft,
      guardrails: draft.guardrails.filter((_, itemIndex) => itemIndex !== index),
    };
    setDraft(nextDraft);
    await saveDraft("guardrails", nextDraft);
  };

  const selectVoice = async (voice) => {
    const nextDraft = { ...draft, voice_id: voice.voice_id };
    setDraft(nextDraft);
    await saveDraft("voice_id", nextDraft);
  };

  const addKnowledgeFile = async (file) => {
    if (!file) return;
    setKnowledgeBusy(true);
    setKnowledgeError("");
    try {
      const body = new FormData();
      body.append("file", file);
      await addAgentKnowledge(id, body);
      await loadAgent();
    } catch (knowledgeLoadError) {
      setKnowledgeError(knowledgeLoadError.message);
    } finally {
      setKnowledgeBusy(false);
    }
  };

  const addKnowledgeUrl = async (event) => {
    event.preventDefault();
    if (!knowledgeUrl.trim()) return;
    setKnowledgeBusy(true);
    setKnowledgeError("");
    try {
      await addAgentKnowledge(id, { url: knowledgeUrl.trim() });
      setKnowledgeUrl("");
      await loadAgent();
    } catch (knowledgeLoadError) {
      setKnowledgeError(knowledgeLoadError.message);
    } finally {
      setKnowledgeBusy(false);
    }
  };

  const changeLanguage = async (value) => {
    setLanguageMode(value);
    const nextDraft = { ...draft, language: value };
    setDraft(nextDraft);
    await saveDraft("language", nextDraft);
  };

  const hasAgent = Boolean(agent && draft);
  const chatMessages = useMemo(
    () =>
      messages.length
        ? messages
        : [
            { role: "system", text: "Session started · v2 restored" },
            { role: "assistant", text: "Updated: welcome message is now 1 concise sentence. Added empathetic phrasing and saved as v3." },
          ],
    [messages],
  );

  if (!hasAgent) {
    return (
      <div className="mx-auto max-w-6xl px-space-xl py-space-xl">
        <Card className="p-space-xl text-body-sm text-on-surface-variant">
          {error || "Loading agent workspace..."}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-space-lg py-space-lg">
      <div className="mb-space-md flex items-center gap-1 text-label-sm text-on-surface-variant">
        <Link to="/agents">Agents</Link>
        <span>/</span>
        <span>{currentSpec.name}</span>
      </div>

      <div className="mb-space-lg flex items-start justify-between gap-space-lg">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container">
              <Icon className="text-[17px]">smart_toy</Icon>
            </span>
            <h1 className="text-headline-xl font-semibold tracking-tight">{currentSpec.name}</h1>
            <Badge tone="success">● Live</Badge>
            <Badge>v{versions.at(-1)?.n || 1}</Badge>
          </div>
          <p className="mt-1 pl-10 text-body-sm text-on-surface-variant">
            Inbound voice agent handles appointments, general inquiry, and triage routing.
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <Button variant="secondary">
            <Icon>science</Icon>Run auto-tests
          </Button>
          <Button onClick={() => setShowDeploy(true)}>
            <Icon>rocket_launch</Icon>Deploy
          </Button>
          <Button variant="secondary">
            <Icon>more_vert</Icon>
          </Button>
        </div>
      </div>

      {error && <p className="mb-space-md rounded-lg bg-error/5 p-space-md text-body-sm text-error">{error}</p>}

      <div className="grid gap-space-lg lg:grid-cols-[1fr_1.15fr_1fr]">
        <Card className="p-space-md">
          <div className="mb-space-md flex items-center justify-between">
            <h2 className="font-semibold"><Icon className="mr-1 text-[16px]">auto_awesome</Icon>Refine in chat</h2>
            <span className="text-label-sm text-on-tertiary-container">● Claude 3.5 Sonnet</span>
          </div>
          <div className="max-h-64 space-y-space-md overflow-y-auto border-b border-outline-variant pb-space-md">
            {chatMessages.map((message, index) => (
              <div
                className={message.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-primary p-space-md text-body-sm text-on-primary" : "max-w-[90%] rounded-lg bg-surface-container p-space-md text-body-sm"}
                key={`${message.role}-${index}`}
              >
                {message.text}
              </div>
            ))}
          </div>
          <p className="my-space-md text-label-sm uppercase text-outline">Quick adjustments</p>
          {["Escalate emergency dental pain", "Add Spanish and Hindi handling"].map((item) => (
            <button className="mb-1 block w-full rounded bg-surface-container-low px-space-md py-1 text-left text-body-sm" key={item} onClick={() => setChatInput(item)} type="button">↗ {item}</button>
          ))}
          <form className="mt-space-md flex items-center rounded-lg border border-outline-variant p-space-sm" onSubmit={sendRefinement}>
            <input className="min-w-0 flex-1 bg-transparent px-1 text-body-sm outline-none" onChange={(event) => setChatInput(event.target.value)} placeholder="Make it friendlier, add Hindi, escalate angry callers..." value={chatInput} />
            <button className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary" disabled={busy === "refine"} type="submit">↑</button>
          </form>
          <h3 className="mt-space-lg border-b border-outline-variant pb-space-sm font-semibold">⟳ Version history</h3>
          {versions
            .slice()
            .reverse()
            .map((version) => (
              <div className="flex items-center justify-between gap-space-sm py-space-sm text-body-sm" key={`${version.n}-${version.createdAt}`}>
                <span>v{version.n} <span className="text-label-sm text-outline">{formatVersionDate(version.createdAt)}</span></span>
                {version.n === versions.at(-1)?.n ? <Badge tone="success">Active</Badge> : <button className="text-label-sm text-outline hover:text-on-surface" disabled={busy === `restore-${version.n}`} onClick={() => restoreVersion(version)} type="button">Restore</button>}
              </div>
            ))}
        </Card>

        <div>
          <div className="mb-space-md flex gap-space-lg overflow-x-auto border-b border-outline-variant">
            {tabs.map((tab) => (
              <button className={`whitespace-nowrap pb-space-sm text-body-sm ${activeTab === tab ? "rounded-full bg-primary px-space-md text-on-primary" : "text-on-surface-variant"}`} key={tab} onClick={() => setActiveTab(tab)} type="button">
                {tab}{tab === "Flow" && <sup className="ml-1">Beta</sup>}
              </button>
            ))}
          </div>
          {activeTab === "Overview" ? (
            <div className="space-y-space-lg">
              <EditableCard title="System prompt" icon="tune" value={currentSpec.system_prompt || ""} onChange={(value) => changeField("system_prompt", value)} onSave={() => saveDraft("system_prompt")} saved={savedField === "system_prompt"} />
              <EditableCard title="Welcome message" icon="waving_hand" value={currentSpec.first_message || ""} onChange={(value) => changeField("first_message", value)} onSave={() => saveDraft("first_message")} saved={savedField === "first_message"} />
              <EditableCard title="Language" icon="language" saved={savedField === "language"}>
                <input className="w-full rounded-lg bg-surface-container p-space-md text-body-sm outline-none focus:ring-1 focus:ring-primary" onBlur={() => saveDraft("language")} onChange={(event) => changeField("language", event.target.value)} value={currentSpec.language || ""} />
              </EditableCard>
              <EditableCard title="Guardrails" icon="shield" saved={savedField === "guardrails"}>
                <div className="flex flex-wrap gap-space-sm">
                  {(currentSpec.guardrails || []).map((guardrail, index) => (
                    <span className="rounded-full bg-surface-container px-space-md py-space-sm text-body-sm" key={`${guardrail}-${index}`}>
                      {guardrail} <button className="ml-1 text-outline hover:text-error" onClick={() => removeGuardrail(index)} type="button">×</button>
                    </span>
                  ))}
                </div>
                <input className="mt-space-md w-full rounded-lg border border-outline-variant px-space-md py-space-sm text-body-sm outline-none focus:ring-1 focus:ring-primary" onChange={(event) => setGuardrailInput(event.target.value)} onKeyDown={addGuardrail} placeholder="Add a guardrail and press Enter" value={guardrailInput} />
              </EditableCard>
            </div>
          ) : activeTab === "Flow" ? (
            <div>
              <div className="mb-space-lg flex items-start justify-between gap-space-md">
                <div>
                  <h2 className="font-semibold">Conversation flow</h2>
                  <p className="mt-1 text-body-sm text-on-surface-variant">Define the sequence your agent follows during each conversation.</p>
                </div>
                <span className="text-label-sm text-on-tertiary-container">{savedField === "flow_steps" ? "Saved" : ""}</span>
              </div>
              <DndContext collisionDetection={closestCenter} onDragEnd={reorderFlowSteps} sensors={sensors}>
                <SortableContext
                  items={(currentSpec.flow_steps || []).map((_, index) => `flow-step-${index}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-space-md">
                    {(currentSpec.flow_steps || []).map((step, index) => (
                      <SortableFlowStep
                        index={index}
                        key={`flow-step-${index}`}
                        onChange={(field, value) => updateFlowStep(index, field, value)}
                        onDelete={() => deleteFlowStep(index)}
                        step={step}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button className="mt-space-lg" onClick={addFlowStep} variant="secondary">
                <Icon>add</Icon>Add step
              </Button>
            </div>
          ) : activeTab === "Knowledge" ? (
            <div className="space-y-space-lg">
              <div>
                <h2 className="font-semibold">Knowledge base</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">Give your agent trusted documents and web pages to reference during calls.</p>
              </div>
              {knowledgeError && <p className="rounded-lg bg-error/5 p-space-md text-body-sm text-error">{knowledgeError}</p>}
              <label
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-space-lg text-center hover:border-primary"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  addKnowledgeFile(event.dataTransfer.files?.[0]);
                }}
              >
                <Icon className="text-3xl text-outline">upload_file</Icon>
                <span className="mt-space-sm font-semibold">{knowledgeBusy ? "Adding document..." : "Drop a PDF here or browse"}</span>
                <span className="mt-1 text-label-sm text-on-surface-variant">PDF files up to 10 MB</span>
                <input accept="application/pdf,.pdf" className="hidden" disabled={knowledgeBusy} onChange={(event) => addKnowledgeFile(event.target.files?.[0])} type="file" />
              </label>
              <form className="flex gap-space-sm" onSubmit={addKnowledgeUrl}>
                <input className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm text-body-sm outline-none focus:border-primary" onChange={(event) => setKnowledgeUrl(event.target.value)} placeholder="https://example.com/help" type="url" value={knowledgeUrl} />
                <Button disabled={knowledgeBusy || !knowledgeUrl.trim()} type="submit">Add URL</Button>
              </form>
              <div className="space-y-space-sm">
                {knowledge.length === 0 ? <Card className="p-space-lg text-center text-body-sm text-on-surface-variant">No knowledge documents attached yet.</Card> : knowledge.map((document) => (
                  <Card className="flex items-center justify-between gap-space-md p-space-md" key={document.id}>
                    <div className="flex min-w-0 items-center gap-space-md"><Icon className="text-outline">{document.type === "url" ? "language" : "description"}</Icon><div className="min-w-0"><p className="truncate text-body-sm font-semibold">{document.name}</p><p className="text-label-sm capitalize text-on-surface-variant">{document.type} · {document.status || "attached"}</p></div></div>
                    <Badge tone={document.status === "failed" ? "danger" : "success"}>{document.status || "Attached"}</Badge>
                  </Card>
                ))}
              </div>
            </div>
          ) : activeTab === "Voice" ? (
            <div>
              <div className="mb-space-md flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Choose a voice</h2>
                  <p className="mt-1 text-body-sm text-on-surface-variant">Preview and select the voice used by this agent.</p>
                </div>
                <span className="text-label-sm text-on-tertiary-container">{savedField === "voice_id" ? "Saved" : ""}</span>
              </div>
              <VoicePicker onSelect={selectVoice} selectable selectedVoiceId={currentSpec.voice_id} />
            </div>
          ) : activeTab === "Settings" ? (
            <Card className="p-space-lg">
              <div className="mb-space-md">
                <h2 className="font-semibold">Language</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">Choose the language model and speech profile used for this agent.</p>
              </div>
              <select className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md text-body-sm outline-none focus:border-primary" onChange={(event) => changeLanguage(event.target.value)} value={languageMode}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish (multi-language)</option>
              </select>
              <p className="mt-space-md text-label-sm text-on-surface-variant">Hindi and Hinglish use ElevenLabs&apos; supported <code>hi</code> language code with a multilingual-capable LLM and a Hindi-capable voice when available.</p>
              <div className="mt-space-lg flex items-center justify-between border-t border-outline-variant pt-space-md">
                <span className="text-body-sm">Configuration status</span>
                <span className="text-label-sm text-on-tertiary-container">{savedField === "language" ? "Saved" : "Ready"}</span>
              </div>
            </Card>
          ) : (
            <Card className="flex min-h-64 items-center justify-center p-space-xl text-body-sm text-on-surface-variant">
              {activeTab} settings will be available here soon.
            </Card>
          )}
        </div>

        <TestConsole agentId={id} />
      </div>

      {showDeploy && <DeployModal agentId={id} agentName={currentSpec.name} phone={agent.phone} onClose={() => setShowDeploy(false)} />}
    </div>
  );
}
