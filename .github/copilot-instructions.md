# VoiceCraft: project context

## What we are building
VoiceCraft is a no-code voice AI agent builder. A user describes a voice assistant in plain language (typed or spoken); the platform generates the agent, lets them talk to it live, refine it by chat, deploy it, and review calls. It is a solo hackathon project with a 2-3 day deadline, so simple and working beats clever.

## Stack
- Client: Vite + React + Tailwind + React Router, in /client
- Server: Node + Express (ES modules), in /server
- Voice layer: ElevenLabs Agents. Server uses @elevenlabs/elevenlabs-js, client uses @elevenlabs/react
- Spec-generation LLM: Google Gemini free tier (@google/genai) in JSON mode
- Storage: local JSON file at server/data/db.json

## Core data model: the "agent spec" (single source of truth)
{ name, system_prompt, first_message, language, voice_id, guardrails: string[], flow_steps: [{title, instruction}], temperature }
The server compiles system_prompt + flow_steps + guardrails into one final prompt for ElevenLabs.

## db.json shape
{ agents: [{ id, elevenAgentId, versions: [{ n, spec, createdAt }] }] }

## Rules
- API keys live only in server .env. Never send them to the client.
- Write minimal, readable code. No extra abstractions, no filler comments.
- Only show or change the files needed for the task.
- Before using any ElevenLabs endpoint, check the official docs; if unsure, say so instead of guessing.
- Match the Stitch designs in client/design when building UI.