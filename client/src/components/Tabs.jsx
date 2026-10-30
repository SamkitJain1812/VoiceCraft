export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-space-lg border-b border-outline-variant">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange?.(tab.value)}
          className={`border-b-2 px-space-xs pb-space-md text-label-md transition-colors ${
            activeTab === tab.value
              ? "border-primary text-on-surface"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

