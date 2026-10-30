import { useEffect, useMemo, useRef, useState } from "react";
import Badge from "./Badge";
import Button from "./Button";
import Card from "./Card";
import Skeleton from "./Skeleton";
import { getHindiVoicePreview, listVoices } from "../lib/api";

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function labelValue(voice, key) {
  return voice?.labels?.[key] || voice?.[key] || "";
}

const languageNames = {
  ar: "Arabic",
  cs: "Czech",
  de: "German",
  en: "English",
  es: "Spanish",
  fil: "Filipino",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sv: "Swedish",
  tr: "Turkish",
  zh: "Chinese",
};

function displayLanguage(value) {
  return languageNames[value] || value.toUpperCase();
}

function normalizeVoice(voice) {
  const labels = voice.labels || {};
  const tags = Object.values(labels).filter(Boolean).map(String);
  const languages = [
    labelValue(voice, "language"),
    ...(voice.verifiedLanguages || []).map((item) => item.language),
  ].filter(Boolean);
  const language = languages[0] || labelValue(voice, "accent");
  const gender = labelValue(voice, "gender");
  const useCase = labelValue(voice, "use_case") || labelValue(voice, "useCase") || labelValue(voice, "category");
  const tone = labelValue(voice, "descriptive") || labelValue(voice, "tone");
  const communication = useCase || labelValue(voice, "communication");
  const accent = labelValue(voice, "accent");
  const age = labelValue(voice, "age");

  return {
    ...voice,
    voice_id: voice.voice_id || voice.voiceId,
    preview_url: voice.preview_url || voice.previewUrl,
    languages: [...new Set(languages.map((item) => String(item).toLowerCase()))],
    supportsHindi: languages.some((item) => String(item).toLowerCase() === "hi"),
    tags: [...new Set([useCase, language, gender, tone, communication, ...tags].filter(Boolean))],
    language: String(language).toLowerCase(),
    gender: String(gender).toLowerCase(),
    useCase: String(useCase).toLowerCase(),
    tone: String(tone).toLowerCase(),
    communication: String(communication).toLowerCase(),
    accent: String(accent).toLowerCase(),
    age: String(age).toLowerCase(),
  };
}

function CategorySelect({ className = "", title, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedLabel = value
    ? title === "Language"
      ? displayLanguage(value)
      : value.replaceAll("_", " ")
    : "All";

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`voice-category-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="voice-category-label">{title}</span>
        <span className="truncate">{selectedLabel}</span>
        <Icon className="text-[18px]">keyboard_arrow_down</Icon>
      </button>
      {open && (
        <div className="voice-category-menu" role="listbox" aria-label={title}>
          <button
            aria-selected={!value}
            className={`voice-category-option ${!value ? "is-selected" : ""}`}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            role="option"
            type="button"
          >
            All
          </button>
          {options.map((option) => (
            <button
              aria-selected={value === option}
              className={`voice-category-option ${value === option ? "is-selected" : ""}`}
              key={option}
              onClick={() => {
                onChange(value === option ? "" : option);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              {title === "Language" ? displayLanguage(option) : option.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VoicePicker({ selectedVoiceId = "", onSelect, selectable = false }) {
  const audioRef = useRef(null);
  const [voices, setVoices] = useState([]);
  const [playingId, setPlayingId] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    useCase: "",
    language: "",
    gender: "",
    tone: "",
    communication: "",
    accent: "",
    age: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    listVoices()
      .then((data) => setVoices((data.voices || data || []).map(normalizeVoice)))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const options = useMemo(() => ({
    useCase: [...new Set(voices.map((voice) => voice.useCase).filter(Boolean))],
    language: [...new Set(voices.flatMap((voice) => voice.languages).filter(Boolean))],
    gender: [...new Set(voices.map((voice) => voice.gender).filter(Boolean))],
    tone: [...new Set(voices.map((voice) => voice.tone).filter(Boolean))],
    communication: [...new Set(voices.map((voice) => voice.communication).filter(Boolean))],
    accent: [...new Set(voices.map((voice) => voice.accent).filter(Boolean))],
    age: [...new Set(voices.map((voice) => voice.age).filter(Boolean))],
  }), [voices]);

  const filteredVoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return voices.filter((voice) => {
      const searchable = `${voice.name} ${voice.tags.join(" ")}`.toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (!filters.useCase || voice.useCase === filters.useCase) &&
        (!filters.language || voice.languages.includes(filters.language)) &&
        (!filters.gender || voice.gender === filters.gender) &&
        (!filters.tone || voice.tone === filters.tone) &&
        (!filters.communication || voice.communication === filters.communication) &&
        (!filters.accent || voice.accent === filters.accent) &&
        (!filters.age || voice.age === filters.age)
      );
    });
  }, [filters, search, voices]);

  const stopPreview = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlayingId("");
  };

  const togglePreview = (voice) => {
    const previewUrl = voice.supportsHindi
      ? getHindiVoicePreview(voice.voice_id)
      : voice.preview_url;
    if (!previewUrl) return;
    if (playingId === voice.voice_id) {
      stopPreview();
      return;
    }

    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.pause();
    audioRef.current.src = previewUrl;
    audioRef.current.onended = () => setPlayingId("");
    audioRef.current.play().then(() => setPlayingId(voice.voice_id)).catch(() => setError("Voice preview could not be played"));
  };

  useEffect(() => () => stopPreview(), []);

  return (
    <div>
      <div className="mb-space-lg flex flex-col gap-space-md">
        <div className="relative">
          <Icon className="pointer-events-none absolute left-space-md top-1/2 -translate-y-1/2 text-[18px] text-outline">search</Icon>
          <input
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-space-md pl-10 pr-space-md text-body-sm outline-none focus:border-primary"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search voices..."
            value={search}
          />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[
            ["Gender", "gender", options.gender],
            ["Tone", "tone", options.tone],
            ["Communication skill", "communication", options.communication],
            ["Accent", "accent", options.accent],
            ["Age", "age", options.age],
            ["Language", "language", options.language],
            ["Use case", "useCase", options.useCase],
          ].map(([title, key, values]) => (
            <CategorySelect
              className="min-w-0"
              key={key}
              onChange={(value) => setFilters((current) => ({ ...current, [key]: value }))}
              options={values}
              title={title}
              value={filters[key]}
            />
          ))}
        </div>
      </div>

      {error && <p className="mb-space-md rounded-lg bg-error/5 p-space-md text-body-sm text-error">{error}</p>}
      {!error && !voices.length && <div className="grid gap-space-lg md:grid-cols-2">{[1, 2, 3, 4].map((item) => <Card className="space-y-4 p-space-lg" key={item}><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24 w-full" /><Skeleton className="h-4 w-2/3" /></Card>)}</div>}
      {voices.length > 0 && !filteredVoices.length && <Card className="p-space-xl text-center text-body-sm text-on-surface-variant">No voices match these filters.</Card>}
      <div className="grid gap-space-lg md:grid-cols-2">
        {filteredVoices.map((voice) => {
          const selected = voice.voice_id === selectedVoiceId;
          return (
            <Card className={`p-space-lg transition-colors ${selected ? "border-2 border-primary" : ""}`} key={voice.voice_id}>
              <div className="flex items-start justify-between gap-space-md">
                <div className="flex min-w-0 items-center gap-space-md">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"><Icon>record_voice_over</Icon></div>
                  <div className="min-w-0"><h2 className="truncate font-semibold">{voice.name}</h2><p className="mt-1 text-body-sm capitalize text-on-surface-variant">{voice.gender || "Voice"} · {voice.languages.length ? voice.languages.map(displayLanguage).join(", ") : "Multilingual"}</p></div>
                </div>
                {selected && <Badge tone="success">Selected</Badge>}
              </div>
              <div className="mt-space-lg rounded-lg bg-surface-container-low p-space-md">
                <div className="flex items-center justify-between gap-space-sm text-label-sm">
                  <button className="flex items-center gap-space-sm font-semibold" disabled={!voice.preview_url && !voice.supportsHindi} onClick={() => togglePreview(voice)} type="button">
                    <Icon className="text-[18px]">{playingId === voice.voice_id ? "pause_circle" : "play_circle"}</Icon>
                    {playingId === voice.voice_id ? "Playing preview" : voice.supportsHindi ? "Play Hindi preview" : "Play preview"}
                  </button>
                  <span className="text-outline">{voice.supportsHindi ? "Hindi sample" : voice.preview_url ? "Sample" : "No preview"}</span>
                </div>
                <div
                  aria-label={playingId === voice.voice_id ? "Voice waveform playing" : "Voice waveform"}
                  className={`voice-preview-wave mt-space-md ${playingId === voice.voice_id ? "is-playing" : ""}`}
                  role="img"
                >
                  {[0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.55, 0.8, 0.4, 0.65, 0.95, 0.5, 0.7, 0.35, 0.85, 0.55, 0.75, 0.45, 0.9, 0.6].map((scale, index) => (
                    <span
                      key={index}
                      style={{
                        "--wave-height": `${Math.max(5, Math.round(scale * 20))}px`,
                        "--wave-delay": `${index * 45}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-space-md flex min-h-7 flex-wrap items-center gap-space-sm">
                {voice.tags.slice(0, 3).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                {selectable && (
                  <Button className="ml-auto px-space-md py-1" disabled={selected} onClick={() => onSelect?.(voice)} variant={selected ? "primary" : "secondary"}>
                    {selected ? "Selected" : "Select"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
