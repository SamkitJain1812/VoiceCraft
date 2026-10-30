import { NavLink } from "react-router-dom";
const links = [
  { label: "Agents", path: "/agents", icon: "smart_toy" },
  { label: "Voices", path: "/voices", icon: "record_voice_over" },
  { label: "Conversations", path: "/conversations", icon: "forum" },
  { label: "Tests", path: "/tests", icon: "biotech" },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[195px] flex-col justify-between border-r border-outline-variant bg-surface-container-lowest">
      <div>
        <div className="flex h-12 items-center border-b border-outline-variant px-space-lg">
          <img alt="VoiceCraft" className="h-8 w-[150px] object-contain object-left" src="/voicecraft-logo.svg" />
        </div>
        <div className="p-space-md pb-space-sm">
          <NavLink
            to="/create"
            className="flex w-full items-center gap-space-sm rounded-lg bg-surface-container px-space-md py-space-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Create
          </NavLink>
        </div>
        <nav className="flex flex-col gap-1 px-space-md">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-space-md rounded-lg px-space-md py-space-sm transition-colors ${
                  isActive
                    ? "bg-surface-container font-semibold text-on-surface"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`
              }
            >
              <span className="material-symbols-outlined text-[17px]">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="border-t border-outline-variant p-space-md">
        <div className="flex items-center gap-space-md rounded-lg px-space-md py-space-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[17px]">settings</span>
          Settings
        </div>
        <div className="mt-1 flex items-center gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-sm text-label-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-highest font-semibold">V</span>
          <span>Studio Workspace<br /><span className="text-[10px] text-outline">Free Developer Tier</span></span>
          <span className="material-symbols-outlined ml-auto text-[14px]">unfold_more</span>
        </div>
      </div>
    </aside>
  );
}
