export default function Badge({ children, tone = "neutral" }) {
  const styles = {
    neutral: "bg-surface-container text-on-surface-variant",
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-red-50 text-error",
  };

  return (
    <span
      className={`inline-flex rounded-full px-space-sm py-space-xs text-label-sm ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

