import type { ReactNode } from "react";
import "./ui.css";

export default function PageState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <section className="page-state">
      <div className="page-state__icon" aria-hidden="true">SS</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
