import dotenv from "dotenv";

dotenv.config();

let clientPromise;

async function getClient() {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  clientPromise ??= import("@elevenlabs/elevenlabs-js").then(
    ({ ElevenLabsClient }) =>
      new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      }),
  );
  return clientPromise;
}

export function compileSystemPrompt(spec) {
  const flow = spec.flow_steps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.instruction}`)
    .join("\n");
  const guardrails = spec.guardrails.map((rule) => `- You must never ${rule}`).join("\n");

  return [
    spec.system_prompt,
    "Follow this conversation flow:",
    flow,
    "You must never:",
    guardrails,
  ].join("\n\n");
}

function conversationConfig(spec) {
  return {
    agent: {
      prompt: {
        prompt: compileSystemPrompt(spec),
        temperature: spec.temperature,
        ...(spec.llm ? { llm: spec.llm } : {}),
        ...(spec.knowledge_base?.length
          ? {
              knowledgeBase: spec.knowledge_base.map((document) => ({
                id: document.id,
                name: document.name,
                type: document.type,
                usageMode: document.usageMode || "auto",
              })),
            }
          : {}),
      },
      first_message: spec.first_message,
      language: spec.language,
    },
    tts: {
      voice_id: spec.voice_id,
    },
  };
}

export async function createAgent(spec) {
  const client = await getClient();
  const response = await client.conversationalAi.agents.create({
    name: spec.name,
    conversationConfig: conversationConfig(spec),
  });

  return response.agentId;
}

export async function updateAgent(elevenAgentId, spec) {
  const client = await getClient();
  return client.conversationalAi.agents.update(elevenAgentId, {
    conversationConfig: conversationConfig(spec),
  });
}

export async function getSignedUrl(elevenAgentId) {
  const client = await getClient();
  const response = await client.conversationalAi.conversations.getSignedUrl({
    agentId: elevenAgentId,
  });

  return response.signedUrl;
}

export async function listVoices() {
  const client = await getClient();
  const voices = [];
  let nextPageToken;
  let totalCount;

  do {
    const response = await client.voices.search({
      pageSize: 100,
      includeTotalCount: true,
      ...(nextPageToken ? { nextPageToken } : {}),
    });
    voices.push(...(response?.voices || []));
    totalCount = response?.totalCount ?? totalCount;
    nextPageToken = response?.nextPageToken;
  } while (nextPageToken && voices.length < 1000);

  return { voices, ...(totalCount === undefined ? {} : { totalCount }) };
}

export async function transcribeAudio({ data, filename, contentType }) {
  const client = await getClient();
  return client.speechToText.convert({
    modelId: "scribe_v2",
    file: {
      data,
      filename,
      contentType,
    },
    languageCode: "eng",
  });
}

export async function synthesizeHindiPreview(voiceId) {
  const client = await getClient();
  return client.textToSpeech.convert(voiceId, {
    modelId: "eleven_multilingual_v2",
    languageCode: "hi",
    outputFormat: "mp3_44100_128",
    text: "नमस्ते, मैं आपकी सहायता करने के लिए यहां हूं। आप कैसे हैं?",
  });
}

function voiceId(voice) {
  return voice?.voiceId || voice?.voice_id;
}

export async function ensureVoiceId(spec) {
  const response = await listVoices();
  const voices = response?.voices || response?.items || response || [];
  const currentVoice = voices.find((voice) => voiceId(voice) === spec.voice_id);
  if (currentVoice) return spec;

  const language = spec.language === "hi" || spec.language === "hinglish" ? "hi" : "en";
  const matchingVoice = voices.find((voice) => {
    const labels = voice.labels || {};
    const languages = [
      labels.language,
      ...(voice.verifiedLanguages || []).map((item) => item.language),
    ].filter(Boolean);
    return languages.includes(language);
  });

  const fallbackVoice = matchingVoice || voices[0];
  if (!fallbackVoice || !voiceId(fallbackVoice)) {
    throw new Error("ElevenLabs returned no usable voices");
  }

  return { ...spec, voice_id: voiceId(fallbackVoice) };
}

export async function listConversations(elevenAgentId) {
  const client = await getClient();
  return client.conversationalAi.conversations.list({
    agentId: elevenAgentId,
  });
}

export async function getConversation(conversationId) {
  const client = await getClient();
  return client.conversationalAi.conversations.get(conversationId);
}

export async function simulateConversation(elevenAgentId, scenario) {
  const client = await getClient();
  return client.conversationalAi.agents.simulateConversation(elevenAgentId, {
    simulationSpecification: {
      simulatedUserConfig: {
        firstMessage: `${scenario.persona}\nGoal: ${scenario.goal}`,
        language: scenario.language || "en",
        hinglishMode: scenario.language === "hi",
      },
    },
    newTurnsLimit: 12,
  });
}

export async function importTwilioPhoneNumber({
  phoneNumber,
  label,
  accountSid,
  authToken,
  agentId,
}) {
  const client = await getClient();
  return client.conversationalAi.phoneNumbers.create({
    provider: "twilio",
    phoneNumber,
    label,
    sid: accountSid,
    token: authToken,
    agentId,
  });
}

export async function placeTwilioOutboundCall({
  agentId,
  phoneNumberId,
  toNumber,
}) {
  const client = await getClient();
  return client.conversationalAi.twilio.outboundCall({
    agentId,
    agentPhoneNumberId: phoneNumberId,
    toNumber,
  });
}

export async function createKnowledgeBaseFromUrl(url) {
  return getClient().conversationalAi.knowledgeBase.documents.createFromUrl({ url });
}

export async function createKnowledgeBaseFromFile(file) {
  return getClient().conversationalAi.knowledgeBase.documents.createFromFile({ file });
}

export async function findVoiceForLanguage(language) {
  const voices = await listVoices();
  const items = voices?.voices || voices || [];
  if (language === "en") return null;

  return (
    items.find((voice) => {
      const labels = voice.labels || {};
      const languages = (voice.verifiedLanguages || []).map((item) => item.language);
      const text = `${JSON.stringify(labels)} ${languages.join(" ")}`.toLowerCase();
      return language === "hi"
        ? text.includes("hindi") || text.includes('"language":"hi"') || text.includes("india")
        : text.includes("hindi") || text.includes("india") || text.includes("multilingual");
    }) || null
  );
}
