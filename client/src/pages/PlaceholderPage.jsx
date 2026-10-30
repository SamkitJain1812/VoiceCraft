import Card from "../components/Card";

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="mx-auto max-w-7xl p-space-xl">
      <div className="mb-space-xl">
        <p className="mb-space-sm text-label-sm uppercase text-outline">VoiceCraft</p>
        <h1 className="text-display-sm font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-space-sm max-w-xl text-body-lg text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      <Card className="flex min-h-56 items-center justify-center border-dashed">
        <p className="text-body-md text-on-surface-variant">Content coming soon.</p>
      </Card>
    </div>
  );
}

