import { JOBS } from "../mock-data/campus";
import type { CourierJob } from "../types";
import { delay } from "../utils";
import { apiFetch, USE_MOCKS } from "./client";

let jobs = [...JOBS];

export async function listJobs(): Promise<CourierJob[]> {
  if (USE_MOCKS) {
    await delay();
    return jobs;
  }
  return apiFetch("/courier/jobs");
}

export async function acceptJob(id: string): Promise<CourierJob | undefined> {
  if (USE_MOCKS) {
    await delay();
    jobs = jobs.map((j) => (j.id === id ? { ...j, status: "accepted" } : j));
    return jobs.find((j) => j.id === id);
  }
  return apiFetch(`/courier/jobs/${id}/accept`, { method: "POST" });
}
