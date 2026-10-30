import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 60000 },
});
const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const agentSpecSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    system_prompt: { type: "string" },
    first_message: { type: "string" },
    language: { type: "string" },
    voice_id: { type: "string" },
    guardrails: {
      type: "array",
      items: { type: "string" },
    },
    flow_steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          instruction: { type: "string" },
        },
        required: ["title", "instruction"],
      },
    },
    temperature: { type: "number" },
  },
  required: [
    "name",
    "system_prompt",
    "first_message",
    "language",
    "voice_id",
    "guardrails",
    "flow_steps",
    "temperature",
  ],
};

const generationInstruction = [
  "Create a complete voice agent specification from the user's description.",
  "Write a warm, concise first_message.",
  "Include 3 to 6 flow_steps and 3 to 5 guardrails.",
  'Set language to "hi" if the user mentions Hindi; otherwise choose the most appropriate language code.',
  "Return only the requested JSON object.",
].join(" ");

const scenarioSchema = {
  type: "object",
  properties: {
    scenarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          persona: { type: "string" },
          goal: { type: "string" },
          language: { type: "string" },
        },
        required: ["name", "persona", "goal", "language"],
      },
    },
  },
  required: ["scenarios"],
};

const scoreSchema = {
  type: "object",
  properties: {
    score: { type: "number" },
    result: { type: "string" },
    failures: { type: "array", items: { type: "string" } },
    suggested_fix: { type: "string" },
  },
  required: ["score", "result", "failures", "suggested_fix"],
};

function validateSpec(spec) {
  const requiredFields = [
    "name",
    "system_prompt",
    "first_message",
    "language",
    "voice_id",
    "guardrails",
    "flow_steps",
    "temperature",
  ];
  const missing = requiredFields.filter(
    (field) => spec?.[field] === undefined || spec?.[field] === null,
  );

  if (missing.length > 0) {
    throw new Error(`Generated agent spec is missing fields: ${missing.join(", ")}`);
  }
  if (
    !Array.isArray(spec.guardrails) ||
    !Array.isArray(spec.flow_steps) ||
    spec.flow_steps.some((step) => !step?.title || !step?.instruction)
  ) {
    throw new Error("Generated agent spec has invalid guardrails or flow_steps");
  }

  return spec;
}

async function generateJson(contents, systemInstruction) {
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: agentSpecSchema,
    },
  });

  try {
    return validateSpec(JSON.parse(response.text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Gemini returned invalid JSON for the agent spec");
    }

    async function generateStructured(contents, systemInstruction, responseSchema) {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      try {
        return JSON.parse(response.text);
      } catch {
        throw new Error("Gemini returned invalid JSON for automated testing");
      }
    }
    throw error;
  }
}

export function generateSpec(userPrompt) {
  return generateJson(userPrompt, generationInstruction);
}

export function refineSpec(currentSpec, instruction) {
  return generateJson(
    `Current specification:\n${JSON.stringify(currentSpec)}\n\nRequested change:\n${instruction}`,
    [
      "Return the full updated voice agent specification.",
      "Change only what the requested instruction asks for; preserve every other current value.",
      "Return all required fields even when they are unchanged.",
      "Return only the requested JSON object.",
    ].join(" "),
  );
}

export function generateTestScenarios(spec) {
  return generateStructured(
    `Agent specification:\n${JSON.stringify(spec)}`,
    "Write exactly four caller simulation scenarios for this voice agent: angry customer, confused elderly user, fast talker, and Hindi speaker. Each must include a realistic persona, one concrete goal, and language code. Return only JSON.",
    scenarioSchema,
  );
}

export function scoreTestTranscript(spec, scenario, transcript) {
  return generateStructured(
    `Agent specification:\n${JSON.stringify(spec)}\n\nScenario:\n${JSON.stringify(scenario)}\n\nTranscript:\n${JSON.stringify(transcript)}`,
    "Score this simulated transcript from 0 to 10 against the caller goal, the agent flow, and all guardrails. Return pass when score is 7 or higher, otherwise fail. List concrete failures and provide exactly one concise suggested prompt fix. Return only JSON.",
    scoreSchema,
  );
}
