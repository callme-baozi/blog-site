import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

// ffmpeg へのパス（環境変数で上書き可能）。未指定なら PATH から検索。
const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const FFMPEG_TIMEOUT_MS = Number(process.env.FFMPEG_TIMEOUT_MS) || 60_000;

let ffmpegAvailable: boolean | null = null;

// ffmpeg が使えるか確認（結果はキャッシュして毎回 spawn しない）
async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  try {
    await execFileAsync(FFMPEG_BIN, ["-version"], { timeout: 10_000 });
    ffmpegAvailable = true;
  } catch {
    ffmpegAvailable = false;
  }
  return ffmpegAvailable;
}

function isMp4(filename: string, contentType: string): boolean {
  return (
    contentType === "video/mp4" ||
    path.extname(filename).toLowerCase() === ".mp4"
  );
}

/**
 * MP4 動画を faststart（moov atom を先頭へ移動）に最適化する。
 * - ストリームコピー（-c copy）なので再エンコードは行わず高速
 * - ffmpeg が無い / 失敗した場合は元の Buffer を返す（アップロード自体は失敗しない）
 * - MP4 以外（.mov / .webm 等）は処理しない
 * moov が先頭にあると、ブラウザはファイル全体をダウンロードしなくても
 * 再生開始・シークができるようになる（Range 配信と組み合わせてストリーミング再生が可能）。
 */
export async function optimizeVideo(
  data: Buffer,
  filename: string,
  contentType: string
): Promise<Buffer> {
  if (!isMp4(filename, contentType)) return data;
  if (!(await isFfmpegAvailable())) return data;

  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const tmpInput = path.join(os.tmpdir(), `blog-in-${token}.mp4`);
  const tmpOutput = path.join(os.tmpdir(), `blog-out-${token}.mp4`);

  try {
    await fs.writeFile(tmpInput, data);
    await execFileAsync(
      FFMPEG_BIN,
      ["-y", "-i", tmpInput, "-c", "copy", "-movflags", "+faststart", tmpOutput],
      { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }
    );
    const optimized = await fs.readFile(tmpOutput);
    return optimized.length > 0 ? optimized : data;
  } catch {
    // 変換に失敗してもアップロードは続行（元のファイルをそのまま使う）
    return data;
  } finally {
    await fs.rm(tmpInput, { force: true }).catch(() => {});
    await fs.rm(tmpOutput, { force: true }).catch(() => {});
  }
}
