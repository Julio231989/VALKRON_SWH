/* Valkron — dictado por voz local (Whisper base, en el propio teléfono, sin internet después de la primera descarga).
   Corre en un Worker para no congelar la pantalla. Nada de esto se carga hasta que el usuario activa el dictado
   en Config y el teléfono pasó la evaluación. */
import { pipeline, env } from './transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;                                   // el modelo queda guardado en el teléfono tras la primera descarga
env.backends.onnx.wasm.wasmPaths = new URL('./', import.meta.url).href;   // el motor wasm viene de esta misma carpeta, no de un CDN
env.backends.onnx.wasm.numThreads = 1;                        // GitHub Pages no permite multihilo (sin SharedArrayBuffer)

const MODELO = 'Xenova/whisper-base';
let asr = null;

async function cargar() {
  if (asr) return;
  asr = await pipeline('automatic-speech-recognition', MODELO, {
    quantized: true,
    progress_callback: (p) => self.postMessage({ tipo: 'progreso', p })
  });
}
self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    if (m.cmd === 'cargar') { await cargar(); self.postMessage({ tipo: 'cargado' }); }
    else if (m.cmd === 'calibrar') {
      await cargar();
      // 30 s de ruido suave: mide el trabajo completo de una ventana de Whisper (el oído es el costo dominante).
      const a = new Float32Array(16000 * 30); for (let i = 0; i < a.length; i++) a[i] = (Math.random() - .5) * 0.02;
      const t0 = performance.now();
      await asr(a, { language: 'spanish', task: 'transcribe' });
      self.postMessage({ tipo: 'calibrado', ms: performance.now() - t0, segundos_audio: 30 });
    }
    else if (m.cmd === 'transcribir') {
      await cargar();
      const r = await asr(m.audio, { language: 'spanish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
      self.postMessage({ tipo: 'texto', id: m.id, texto: (r && r.text ? r.text : '').trim() });
    }
  } catch (err) {
    self.postMessage({ tipo: 'error', id: m.id, mensaje: String(err && err.message || err) });
  }
};
