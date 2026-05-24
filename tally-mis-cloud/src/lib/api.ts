import { sampleState } from "./sampleData";
import type { AppState, AuditEvent, User } from "./types";

export type LoginResponse = {
  user: User;
  token: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(body.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function fetchState(token: string): Promise<AppState> {
  try {
    return await request<AppState>("/state", {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    return sampleState;
  }
}

export async function saveState(token: string, state: AppState): Promise<AppState> {
  return request<AppState>("/state", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(state)
  });
}

export async function fetchAuditLog(token: string): Promise<AuditEvent[]> {
  try {
    return await request<AuditEvent[]>("/audit", {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    return [];
  }
}
