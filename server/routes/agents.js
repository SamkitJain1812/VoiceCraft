import { randomUUID } from "node:crypto";
import multer from "multer";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createAgent,
  createKnowledgeBaseFromFile,
  createKnowledgeBaseFromUrl,
  deleteAgent as deleteElevenLabsAgent,
  ensureVoiceId,
  findVoiceForLanguage,
  getConversation,
  getSignedUrl,
  importTwilioPhoneNumber,
  listConversations,
  listVoices,
  placeTwilioOutboundCall,
  updateAgent,
  transcribeAudio,
  synthesizeHindiPreview,
} from "../services/elevenlabs.js";
import { generateSpec, generateTestScenarios, refineSpec, scoreTestTranscript } from "../services/llm.js";
import { simulateConversation } from "../services/elevenlabs.js";
import {
  addVersion,
  deleteAgent,
  getAgent,
  listAgents,
  saveAgent,
} from "../services/db.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many generation requests. Please try again later." },
});
const refinementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many refinement requests. Please try again later." },
});
const testLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many test runs. Please try again later." },
});
const transcriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many transcription requests. Please try again later." },
});

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireAgent(agent) {
  if (!agent) {
    throw requestError("Agent not found", 404);
  }
  return agent;
}

function validateText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw requestError(`${field} is required`);
  }
  if (value.length > maxLength) {
    throw requestError(`${field} must be ${maxLength} characters or fewer`);
  }
  return value.trim();
}

function validateSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw requestError("spec is required");
  }
  for (const field of ["name", "system_prompt", "first_message", "language", "voice_id"]) {
    validateText(spec[field], field, field === "system_prompt" ? 8000 : 1000);
  }
  if (!Array.isArray(spec.guardrails) || spec.guardrails.length > 20) {
    throw requestError("guardrails must be an array with at most 20 items");
  }
  if (!Array.isArray(spec.flow_steps) || spec.flow_steps.length > 20) {
    throw requestError("flow_steps must be an array with at most 20 items");
  }
  spec.guardrails.forEach((rule, index) => validateText(rule, `guardrails[${index}]`, 500));
  spec.flow_steps.forEach((step, index) => {
    if (!step || typeof step !== "object") throw requestError(`flow_steps[${index}] is invalid`);
    validateText(step.title, `flow_steps[${index}].title`, 200);
    validateText(step.instruction, `flow_steps[${index}].instruction`, 2000);
  });
  if (typeof spec.temperature !== "number" || spec.temperature < 0 || spec.temperature > 1) {
    throw requestError("temperature must be a number between 0 and 1");
  }
  return spec;
}

function validateUrl(value) {
  const url = validateText(value, "url", 2048);
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    throw requestError("url must be a valid HTTP or HTTPS URL");
  }
  return url;
}

function validatePhone(value, field) {
  const phone = validateText(value, field, 32);
  if (!/^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s().-]/g, ""))) {
    throw requestError(`${field} must be a valid phone number`);
  }
  return phone;
}

function currentSpec(agent) {
  return agent.versions.at(-1)?.spec;
}

function conversationItems(response) {
  return response?.conversations || response?.items || response || [];
}

function conversationId(conversation) {
  return conversation.conversationId || conversation.conversation_id || conversation.id;
}

function conversationStart(conversation) {
  const value =
    conversation.startTimeUnixSecs ??
    conversation.start_time_unix_secs ??
    conversation.startTime ??
    conversation.start_time;
  return typeof value === "number" && value < 100000000000
    ? new Date(value * 1000).toISOString()
    : value || null;
}

function conversationDuration(conversation) {
  return Number(
    conversation.callDurationSecs ??
      conversation.call_duration_secs ??
      conversation.durationSecs ??
      conversation.duration_secs ??
      0,
  );
}

function transcriptText(transcript = []) {
  return transcript
    .map((turn) => turn.message || turn.text || "")
    .filter(Boolean)
    .join(" ");
}

function isFlagged(status, transcript) {
  return status === "failed" || /\b(human|manager|angry|complaint)\b/i.test(transcript);
}

function normalizeConversation(conversation, agent) {
  const transcript = conversation.transcript || conversation.messages || [];
  const text = transcriptText(transcript);
  const status = conversation.status || (conversation.callSuccessful === "success" ? "success" : "completed");
  return {
    id: conversationId(conversation),
    agentId: agent.id,
    agentName: currentSpec(agent)?.name || "Unknown agent",
    startTime: conversationStart(conversation),
    duration: conversationDuration(conversation),
    status,
    flagged: isFlagged(status, text),
  };
}

router.post(
  "/agents/generate",
  generationLimiter,
  asyncHandler(async (req, res) => {
    const prompt = validateText(req.body?.prompt, "prompt", 500);

    const spec = validateSpec(await ensureVoiceId(await generateSpec(prompt)));
    const elevenAgentId = await createAgent(spec);
    const agent = await saveAgent({
      id: randomUUID(),
      elevenAgentId,
      updatedAt: new Date().toISOString(),
      versions: [
        {
          n: 1,
          spec,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    res.status(201).json({ id: agent.id, spec });
  }),
);

router.get(
  "/agents",
  asyncHandler(async (_req, res) => {
    const agents = await listAgents();
    res.json(
      agents.map(({ id, versions, updatedAt }) => ({
        id,
        name: versions.at(-1)?.spec.name,
        language: versions.at(-1)?.spec.language,
        updatedAt,
      })),
    );
  }),
);

router.get(
  "/agents/:id",
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    res.json({ ...agent, currentSpec: currentSpec(agent) });
  }),
);

router.post(
  "/agents/:id/refine",
  refinementLimiter,
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    const instruction = validateText(req.body?.instruction, "instruction", 1000);

    const spec = validateSpec({
      ...(await refineSpec(currentSpec(agent), instruction)),
      knowledge_base: currentSpec(agent).knowledge_base || [],
    });
    await updateAgent(agent.elevenAgentId, spec);
    const updatedAgent = await addVersion(agent.id, spec);
    res.json({ spec, version: updatedAgent.versions.at(-1) });
  }),
);

router.post(
  "/agents/:id/tests/run",
  testLimiter,
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    const spec = currentSpec(agent);
    const { scenarios } = await generateTestScenarios(spec);
    if (!Array.isArray(scenarios) || scenarios.length !== 4) {
      throw requestError("Gemini did not return four test scenarios", 502);
    }

    const results = await Promise.all(
      scenarios.map(async (scenario) => {
        const simulation = await simulateConversation(agent.elevenAgentId, scenario);
        const transcript = simulation.simulatedConversation || simulation.transcript || [];
        const score = await scoreTestTranscript(spec, scenario, transcript);
        const normalizedScore = Math.max(0, Math.min(10, Number(score.score)));
        return {
          scenario,
          transcript,
          score: normalizedScore,
          result: normalizedScore >= 7 ? "pass" : "fail",
          failures: Array.isArray(score.failures) ? score.failures : [],
          suggestedFix: score.suggested_fix || "",
        };
      }),
    );

    router.post(
      "/agents/:id/phone/connect",
      asyncHandler(async (req, res) => {
        const agent = requireAgent(await getAgent(req.params.id));
        const hasTwilioConfig =
          process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN &&
          process.env.TWILIO_PHONE_NUMBER;
        if (!hasTwilioConfig) {
          const simulated = {
            simulated: true,
            status: "simulated",
            phoneNumber: req.body?.phoneNumber || process.env.TWILIO_PHONE_NUMBER || "Simulated Twilio number",
            message: "Twilio credentials are not configured. Phone deployment is simulated.",
          };
          await saveAgent({ ...agent, phone: simulated });
          return res.json(simulated);
        }
        const phoneNumber = validatePhone(req.body?.phoneNumber || process.env.TWILIO_PHONE_NUMBER, "phoneNumber");

        const imported = await importTwilioPhoneNumber({
          phoneNumber,
          label: currentSpec(agent)?.name || "VoiceCraft agent",
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          agentId: agent.elevenAgentId,
        });
        const connected = {
          simulated: false,
          status: "connected",
          phoneNumber,
          phoneNumberId: imported.phoneNumberId,
        };
        await saveAgent({ ...agent, phone: connected });
        res.json(connected);
      }),
    );

    router.post(
      "/agents/:id/phone/call",
      asyncHandler(async (req, res) => {
        const agent = requireAgent(await getAgent(req.params.id));
        const to = validatePhone(req.body?.to, "to");

        const hasTwilioConfig =
          process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN &&
          process.env.TWILIO_PHONE_NUMBER;
        if (!hasTwilioConfig) {
          return res.json({
            simulated: true,
            status: "simulated",
            to,
            message: "Twilio credentials are not configured. No call was placed.",
          });
        }
        if (!agent.phone?.phoneNumberId) {
          throw requestError("Connect a Twilio phone number before placing a call", 409);
        }

        const result = await placeTwilioOutboundCall({
          agentId: agent.elevenAgentId,
          phoneNumberId: agent.phone.phoneNumberId,
          toNumber: to,
        });
        res.json({ simulated: false, status: "calling", to, ...result });
      }),
    );
    const overallAverage = results.length
      ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(1))
      : 0;
    res.json({ results, overallAverage });
  }),
);

router.post(
  "/agents/:id/knowledge",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    const url = req.body?.url ? validateUrl(req.body.url) : "";
    if (!req.file && !url) {
      throw requestError("Provide a PDF file or URL");
    }
    if (req.file && req.file.mimetype !== "application/pdf") {
      throw requestError("Only PDF files are supported");
    }
    if (req.file && url) {
      throw requestError("Provide either a PDF file or URL, not both");
    }

    const document = req.file
      ? await createKnowledgeBaseFromFile({
          data: req.file.buffer,
          filename: req.file.originalname,
          contentType: req.file.mimetype,
        })
      : await createKnowledgeBaseFromUrl(url);
    const spec = currentSpec(agent);
    const nextSpec = {
      ...spec,
      knowledge_base: [
        ...(spec.knowledge_base || []),
        {
          id: document.id,
          name: document.name || req.file?.originalname || url,
          type: req.file ? "file" : "url",
          status: "processing",
          ...(url ? { url } : {}),
        },
      ],
    };
    await updateAgent(agent.elevenAgentId, nextSpec);
    const updatedAgent = await addVersion(agent.id, nextSpec);
    res.status(201).json({
      document: nextSpec.knowledge_base.at(-1),
      version: updatedAgent.versions.at(-1),
    });
  }),
);

router.get(
  "/agents/:id/knowledge",
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    res.json(currentSpec(agent).knowledge_base || []);
  }),
);

router.patch(
  "/agents/:id",
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    const spec = validateSpec(req.body?.spec);

    const language = spec.language;
    let nextSpec = { ...spec };
    if (language === "hi" || language === "hinglish") {
      nextSpec = { ...nextSpec, language: "hi", llm: "gemini-2.5-flash" };
      const voice = await findVoiceForLanguage(language);
      if (voice?.voiceId || voice?.voice_id) {
        nextSpec.voice_id = voice.voiceId || voice.voice_id;
      }
    } else if (language === "en") {
      nextSpec = { ...nextSpec, language: "en", llm: undefined };
    }

    await updateAgent(agent.elevenAgentId, nextSpec);
    const updatedAgent = await addVersion(agent.id, nextSpec);
    res.json({ spec: nextSpec, version: updatedAgent.versions.at(-1) });
  }),
);

router.delete(
  "/agents/:id",
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    await deleteElevenLabsAgent(agent.elevenAgentId);
    await deleteAgent(agent.id);
    res.status(204).end();
  }),
);

router.post(
  "/agents/:id/restore",
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    const versionNumber = req.body?.version;
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw requestError("version must be a positive integer");
    }

    const version = agent.versions.find(({ n }) => n === versionNumber);
    if (!version) {
      throw requestError("Version not found", 404);
    }

    await updateAgent(agent.elevenAgentId, version.spec);
    const updatedAgent = await addVersion(agent.id, version.spec);
    res.json({ spec: version.spec, version: updatedAgent.versions.at(-1) });
  }),
);

router.get(
  "/public/:id/signed-url",
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    const signedUrl = await getSignedUrl(agent.elevenAgentId);
    res.json({ signedUrl });
  }),
);

router.get(
  "/agents/:id/signed-url",
  asyncHandler(async (req, res) => {
    const agent = requireAgent(await getAgent(req.params.id));
    const signedUrl = await getSignedUrl(agent.elevenAgentId);
    res.json({ signedUrl });
  }),
);

router.get(
  "/conversations",
  asyncHandler(async (_req, res) => {
    const agents = await listAgents();
    const conversations = [];
    for (const agent of agents) {
      const response = await listConversations(agent.elevenAgentId);
      conversations.push(...conversationItems(response).map((conversation) => normalizeConversation(conversation, agent)));
    }
    conversations.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
    res.json(conversations);
  }),
);

router.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const conversation = await getConversation(req.params.id);
    const agents = await listAgents();
    const agent = agents.find((item) => item.elevenAgentId === conversation.agentId || item.elevenAgentId === conversation.agent_id);
    const normalized = normalizeConversation(conversation, agent || { id: null, versions: [{ spec: { name: "Unknown agent" } }] });
    const transcript = conversation.transcript || conversation.messages || [];
    const analysis = conversation.analysis || {};
    const text = transcriptText(transcript);
    const status = conversation.status || (analysis.callSuccessful === "success" ? "success" : normalized.status);
    res.json({
      ...normalized,
      status,
      flagged: isFlagged(status, text),
      transcript: transcript.map((turn) => ({
        role: turn.role === "user" || turn.role === "user" ? "user" : "agent",
        message: turn.message || turn.text || "",
        timeInCallSecs: turn.timeInCallSecs ?? turn.time_in_call_secs ?? null,
      })).filter((turn) => turn.message),
      summary: analysis.transcriptSummary || analysis.transcript_summary || conversation.summary || "No summary is available for this conversation.",
      outcome: analysis.callSuccessful || conversation.outcome || status,
    });
  }),
);

router.get(
  "/voices",
  asyncHandler(async (_req, res) => {
    res.json(await listVoices());
  }),
);

router.post(
  "/speech-to-text",
  transcriptionLimiter,
  upload.single("audio"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw requestError("audio is required");
    if (!req.file.mimetype.startsWith("audio/")) {
      throw requestError("Only audio recordings are supported");
    }
    const result = await transcribeAudio({
      data: req.file.buffer,
      filename: req.file.originalname || "voicecraft-recording.webm",
      contentType: req.file.mimetype,
    });
    const text = typeof result?.text === "string" ? result.text.trim() : "";
    if (!text) throw requestError("No speech was detected", 422);
    res.json({ text });
  }),
);

router.get(
  "/voices/:voiceId/hindi-preview",
  asyncHandler(async (req, res) => {
    const voiceId = validateText(req.params.voiceId, "voiceId", 100);
    const audio = await synthesizeHindiPreview(voiceId);
    res.type("audio/mpeg");
    if (audio?.pipe) {
      audio.pipe(res);
      return;
    }
    if (audio?.getReader) {
      const reader = audio.getReader();
      res.on("close", () => reader.cancel().catch(() => {}));
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
      return;
    }
    throw requestError("ElevenLabs returned an invalid audio stream", 502);
  }),
);

export default router;
