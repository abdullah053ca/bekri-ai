// List the local Ollama models available to BEKRI.
import { llmRequest } from './llm.js';

interface ModelList { data?: { id: string }[] }
const result = await llmRequest<ModelList>('/models');
const ids = (result.data ?? []).map(x => x.id).filter(Boolean).sort();
console.log('BEKRI için yerel Ollama modelleri:');
if (!ids.length) {
  console.log('Model bulunamadı. Önce ollama pull qwen2.5:7b çalıştırın.');
} else {
  for (const id of ids) console.log(`  • ${id}`);
}
console.log('\nÖnerilen modeller:');
console.log('  Sohbet + araç kullanımı: qwen2.5:7b');
console.log('  Görsel anlama: qwen2.5vl:3b (VISION_MODEL)');
console.log('  Ses tanıma: whisper.cpp (WHISPER_MODEL_PATH ile yerel model)');
console.log('  Seslendirme: browser (tarayıcı konuşma motoru)');
