// Set VITE_API_URL in production (e.g. on Vercel). Falls back to local dev.
const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export interface PredictionResponse {
  url: string;
  label: "phishing" | "legitimate";
  probability: number;
  reasons: string[];
}

export async function checkUrl(url: string): Promise<PredictionResponse> {
  const response = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Unable to analyze this URL.",
    );
  }

  return data;
}
