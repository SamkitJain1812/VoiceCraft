import { useEffect, useState } from "react";

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (event) => {
      const id = crypto.randomUUID();
      const toast = { id, ...event.detail };
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 4500);
    };
    window.addEventListener("voicecraft:toast", onToast);
    return () => window.removeEventListener("voicecraft:toast", onToast);
  }, []);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            key={toast.id}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
