import type { Difficulty, Domain } from "./api";

export interface DomainMeta {
  id: Domain;
  channel: string; // CH1
  label: string; // VLSI
  fill: string; // CSS var, the channel colour as a fill
  text: string; // CSS var, the channel colour as readable text on the current theme
}

export const DOMAINS: Record<Domain, DomainMeta> = {
  vlsi: { id: "vlsi", channel: "CH1", label: "VLSI", fill: "var(--ch1)", text: "var(--ch1-text)" },
  embedded: { id: "embedded", channel: "CH2", label: "Embedded", fill: "var(--ch2)", text: "var(--ch2-text)" },
  communication: { id: "communication", channel: "CH3", label: "Communication", fill: "var(--ch3)", text: "var(--ch3-text)" },
  others: { id: "others", channel: "CH4", label: "Others", fill: "var(--ch4)", text: "var(--ch4-text)" },
};

export const DOMAIN_ORDER: Domain[] = ["vlsi", "embedded", "communication", "others"];

export const DIFFICULTY_LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

export const LANGUAGE_LABEL: Record<string, string> = { sv: "SV", v: "V" };
export const LANGUAGE_NAME: Record<string, string> = { sv: "SystemVerilog", v: "Verilog" };
export const LANGUAGE_EXT: Record<string, string> = { sv: "sv", v: "v" };

export function padNumber(n: number): string {
  return String(n).padStart(4, "0");
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
