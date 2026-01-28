import { API_BASE_URL } from "../config/api";

export const API_BASE = API_BASE_URL;

export interface PipelineStep {
  step_name: string;
  params: Record<string, any>;
}

export interface PipelineRequest {
  pipeline_id: string;
  task_name?: string;
  steps: PipelineStep[];
}

export interface PlaylistItem {
  index: number;
  title: string;
  url: string;
  duration?: number;
}

export interface AnalyzeResult {
  type: "single" | "playlist";
  id?: string;
  title?: string;
  url?: string;
  direct_src?: string; // Direct video source (sniffed by backend)
  thumbnail?: string;
  duration?: number;
  count?: number;
  uploader?: string;
  items?: PlaylistItem[];
  extra_info?: Record<string, any>; // Flexible field for cookies etc
}

export const apiClient = {
  checkHealth: async () => {
    try {
      // Use base URL from config (strip /api/v1 for health endpoint)
      const baseUrl = API_BASE.replace("/api/v1", "");
      const res = await fetch(`${baseUrl}/health`);
      return await res.json();
    } catch (e) {
      console.error("Health check failed:", e);
      throw e;
    }
  },

  analyzeUrl: async (url: string): Promise<AnalyzeResult> => {
    const res = await fetch(`${API_BASE}/analyze/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Analysis failed: ${err}`);
    }
    return await res.json();
  },

  runPipeline: async (req: PipelineRequest) => {
    const res = await fetch(`${API_BASE}/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pipeline failed: ${err}`);
    }
    return await res.json();
  },

  cancelAllTasks: async () => {
    const res = await fetch(`${API_BASE}/tasks/cancel-all`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error("Failed to cancel all tasks");
    }
    return await res.json();
  },

  resumeTask: async (taskId: string) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/resume`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error("Failed to resume task");
    }
    return await res.json();
  },

  deleteTask: async (taskId: string) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error("Failed to delete task");
    }
    return await res.json();
  },

  deleteAllTasks: async () => {
    const res = await fetch(`${API_BASE}/tasks/`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error("Failed to delete all tasks");
    }
    return await res.json();
  },

  // Cookie management
  saveCookies: async (domain: string, cookies: any[]) => {
    const res = await fetch(`${API_BASE}/cookies/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, cookies }),
    });
    if (!res.ok) {
      throw new Error("Failed to save cookies");
    }
    return await res.json();
  },

  checkCookieStatus: async (domain: string) => {
    const res = await fetch(`${API_BASE}/cookies/status/${domain}`);
    if (!res.ok) {
      throw new Error("Failed to check cookie status");
    }
    return await res.json();
  },
};
