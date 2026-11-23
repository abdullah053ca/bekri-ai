// Ses tanıma (STT) BEKRI model gateway'den: tarayıcının Web Speech API'si iPhone'da güvenilir değil, yalnızca yedek.
// Ölçüm (5 Ekim 2026): /audio/transcriptions BEKRI model gateway'de yok (404). Ses girdili sohbet modelleri arasında
// gemini-2.5-flash 2,7 sn'de birebir doğru yazdı; gemini-2.5-pro 9 sn; gpt-audio-1.5 metni bozdu.
import { API_KEY, BASE_URL, llmRequest, type ChatResponse } from './llm.js';

export const STT_MODEL = process.env.STT_MODEL || 'gemini-2.5-flash';
let transcriptionsEndpoint: boolean | null = null; // ilk denemeden sonra hafızada

/** MediaRecorder MIME türü → BEKRI model gateway input_audio biçimi */
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

  if (transcriptionsEndpoint !== false) {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), `kayit.${format}`);
    form.append('model', STT_MODEL);
    form.append('prompt', 'The audio may contain Arabic (Syrian dialect or Modern Standard Arabic), Turkish, or a natural mix of both. Transcribe the spoken words exactly in the language used.');
    const r = await fetch(`${BASE_URL}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${API_KEY}` }, body: form }).catch(() => null);
    if (r?.ok) {
      transcriptionsEndpoint = true;
      const j: any = await r.json();
      return { text: String(j.text ?? '').trim(), model: STT_MODEL, ms: Date.now() - t0 };
    }
    transcriptionsEndpoint = false;
  }

  const resp = await llmRequest<ChatResponse>('/chat/completions', {
    model: STT_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'input_audio', input_audio: { data: audio.toString('base64'), format } },
          { type: 'text', text: 'Bu ses kaydındaki konuşmayı Arapça (Suriye lehçesi veya فصحى), Türkçe ya da ikisinin karışımı olabilir; duyulduğu dilde kelimesi kelimesine yaz. Sadece duyduğun metni yaz; açıklama veya başlık ekleme. Konuşma yoksa boş bırak.' },
        ],
      },
    ],
  });
  const raw = String(resp.choices?.[0]?.message?.content ?? '').trim();
  // Model bazen {"text": "..."} biçiminde dönüyor
  let text = (/^\{\s*"(?:text|transcript(?:ion)?)"\s*:\s*"([\s\S]*)"\s*\}$/.exec(raw)?.[1] ?? raw).replace(/^["“]|["”]$/g, '').trim();
  // Sessiz kayıtta model bazen kendi talimatını geri döndürüyor ("Türkçeyi kelimesi kelimesine yazıya dök"):
  // bu, kullanıcının sözü değil. Boş say (istemci "Sizi duyamadım" der).
  const f = text.toLocaleLowerCase('tr');
  if (/kelimesi kelimesine|yazıya dök|duyduğun metni|konuşma yok|ses yok|transcribe the spoken|^\W*$/.test(f)) text = '';
  return { text, model: resp.model ?? STT_MODEL, ms: Date.now() - t0 };
}
