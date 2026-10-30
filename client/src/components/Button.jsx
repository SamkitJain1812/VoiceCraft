export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  const styles =
    variant === "secondary"
      ? "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container"
      : "bg-primary text-on-primary hover:bg-primary-container shadow-soft";

  return (
    <button
      className={`inline-flex items-center justify-center gap-space-sm rounded-full px-space-lg py-space-sm font-semibold text-label-md transition-colors ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

