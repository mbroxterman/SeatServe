import type { ReactNode } from "react";
import "./ui.css";

export default function StatusBadge({ tone = "neutral", children }: { tone?: "success" | "warning" | "danger" | "info" | "neutral"; children: ReactNode }) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
