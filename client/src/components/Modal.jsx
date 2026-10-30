export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/25 p-space-lg">
      <div className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-space-xl shadow-xl">
        <div className="mb-space-lg flex items-start justify-between gap-space-lg">
          <h2 className="text-headline-xl font-semibold">{title}</h2>
          <button
            type="button"
            className="text-2xl leading-none text-on-surface-variant hover:text-on-surface"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

