// Fully local speech-to-text using whisper.cpp. Audio is written to a temporary file
// and deleted after transcription; no recording is sent to a hosted API.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
export const STT_MODEL = process.env.STT_MODEL || 'whisper.cpp';
const WHISPER_BIN = process.env.WHISPER_CPP_PATH || 'whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL_PATH || '';
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

export function audioFormat(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  return null;
}

export async function transcribe(audio: Buffer, mime: string): Promise<{ text: string; model: string; ms: number }> {
  const t0 = Date.now();
  const format = audioFormat(mime);
  if (!format) throw new Error(`desteklenmeyen ses biçimi: ${mime}`);
  if (!WHISPER_MODEL) {
    throw new Error('Yerel ses tanıma hazır değil. WHISPER_MODEL_PATH değişkenine indirdiğiniz whisper.cpp model dosyasının yolunu yazın.');
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bekri-stt-'));
  const source = path.join(dir, `recording.${format}`);
  const wav = path.join(dir, 'recording.wav');
  try {
    await fs.writeFile(source, audio);
    let input = source;
    if (format !== 'wav') {
      try {
        await execFileAsync(FFMPEG_BIN, ['-y', '-i', source, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
        input = wav;
      } catch {
        throw new Error('Bu ses biçimini yerelde dönüştürmek için FFmpeg kurup FFMPEG_PATH ayarlayın.');
      }
    }

    const { stdout } = await execFileAsync(
      WHISPER_BIN,
      ['-m', WHISPER_MODEL, '-f', input, '-l', 'auto', '-nt', '-np'],
      { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const text = String(stdout || '').trim();
    return { text, model: STT_MODEL, ms: Date.now() - t0 };
  } catch (error: any) {
    if (error?.code === 'ENOENT') throw new Error(`whisper.cpp çalıştırıcısı bulunamadı: ${WHISPER_BIN}. WHISPER_CPP_PATH ayarlayın.`);
    throw error;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
