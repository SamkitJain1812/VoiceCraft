export default function Card({ children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-outline-variant bg-surface-container-lowest ${className}`}
    >
      {children}
    </section>
  );
}

