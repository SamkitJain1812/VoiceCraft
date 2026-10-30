export default function Topbar() {
  return (
    <header className="fixed left-[195px] right-0 top-0 z-30 flex h-12 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-space-lg">
      <div className="flex items-center gap-space-sm">
        <span className="text-headline-md font-semibold">Studio</span>
        <span className="text-body-sm text-outline">/</span>
        <span className="text-body-sm text-on-surface-variant">Workspace</span>
      </div>
      <label className="flex w-full max-w-md items-center gap-space-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md py-1 focus-within:border-primary">
        <span className="material-symbols-outlined text-lg text-outline">search</span>
        <input
          className="w-full bg-transparent text-body-sm outline-none placeholder:text-outline"
          placeholder="Search agents, voices, tests..."
          aria-label="Search"
        />
      </label>
      <div className="flex items-center gap-space-lg">
        <a
          href="https://github.com/SamkitJain1812/VoiceCraft"
          target="_blank"
          rel="noreferrer"
          className="text-label-md text-on-surface-variant hover:text-on-surface"
        >
          Docs
        </a>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">help</span>
        <div className="border-l border-outline-variant pl-space-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label-md font-semibold text-on-primary">
            S
          </div>
        </div>
      </div>
    </header>
  );
}
