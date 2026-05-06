import path from "path";
import { productionLikeDeployment } from "@/lib/deploy-env";

export function getSqlitePath(): string {
  const p = process.env.SQLITE_PATH?.trim();
  if (p) return p;
  if (productionLikeDeployment()) return "/data/app.db";
  return path.join(process.cwd(), "data", "app.db");
}

export function getAudioStoragePath(): string {
  const p = process.env.AUDIO_STORAGE_PATH?.trim();
  if (p) return p;
  if (productionLikeDeployment()) return "/data/audio";
  return path.join(process.cwd(), "storage", "audio");
}
