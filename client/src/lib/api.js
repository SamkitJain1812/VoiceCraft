import { showToast } from "./toast";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const request = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      headers: options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch {
    const error = new Error("Unable to reach the VoiceCraft server.");
    showToast(error.message);
    throw error;
  }
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(raw);
    } catch {
      const error = new Error(`Invalid JSON response from ${path} (${response.status})`);
      showToast(error.message);
      throw error;
    }
  } else {
    const error = new Error(`API returned ${response.status} ${response.statusText} for ${path}.`);
    showToast(error.message);
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    showToast(error.message);
    throw error;
  }
  return data;
};

export const generateAgent = (prompt) =>
  request("/agents/generate", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });

export const listAgents = () => request("/agents");

export const getAgent = (id) => request(`/agents/${id}`);

export const listAgentKnowledge = (id) => request(`/agents/${id}/knowledge`);

export const addAgentKnowledge = (id, body) => {
  const options = { method: "POST" };
  if (body instanceof FormData) {
    options.body = body;
    return request(`/agents/${id}/knowledge`, options);
  }
  options.body = JSON.stringify(body);
  return request(`/agents/${id}/knowledge`, options);
};

export const refineAgent = (id, instruction) =>
  request(`/agents/${id}/refine`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });

export const updateAgent = (id, spec) =>
  request(`/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ spec }),
  });

export const restoreAgentVersion = (id, version) =>
  request(`/agents/${id}/restore`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });

export const getAgentSignedUrl = (id) => request(`/agents/${id}/signed-url`);

export const getPublicAgentSignedUrl = (id) => request(`/public/${id}/signed-url`);

export const listVoices = () => request("/voices");

export const transcribeAudio = (blob) => {
  const body = new FormData();
  body.append("audio", blob, "voicecraft-recording.webm");
  return request("/speech-to-text", { method: "POST", body });
};

export const getHindiVoicePreview = (voiceId) =>
  `${API_URL}/api/voices/${encodeURIComponent(voiceId)}/hindi-preview`;

export const listConversations = () => request("/conversations");

export const getConversation = (id) => request(`/conversations/${id}`);

export const runAgentTests = (id) =>
  request(`/agents/${id}/tests/run`, { method: "POST" });

export const connectAgentPhone = (id, phoneNumber) =>
  request(`/agents/${id}/phone/connect`, {
    method: "POST",
    body: JSON.stringify(phoneNumber ? { phoneNumber } : {}),
  });

export const callAgentPhone = (id, to) =>
  request(`/agents/${id}/phone/call`, {
    method: "POST",
    body: JSON.stringify({ to }),
  });
