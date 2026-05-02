/**
 * Kokoro TTS adapter.
 *
 * Supports two modes:
 *  1. HTTP mode  – if KOKORO_URL is set, POST text to the REST API.
 *  2. CLI mode   – if KOKORO_CLI_PATH is set, spawn the binary as a subprocess.
 *
 * Returns raw WAV/PCM data as a Buffer.
 */
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

export async function generateSpeech(req: TTSRequest): Promise<Buffer> {
  const kokoroUrl = process.env.KOKORO_URL;
  const kokuroCli = process.env.KOKORO_CLI_PATH;

  if (kokoroUrl) {
    return httpGenerate(kokoroUrl, req);
  }

  if (kokuroCli) {
    return cliGenerate(kokuroCli, req);
  }

  throw new Error(
    'No TTS provider configured. Set KOKORO_URL or KOKORO_CLI_PATH in .env.',
  );
}

async function httpGenerate(baseUrl: string, req: TTSRequest): Promise<Buffer> {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/audio/speech`;
  const body = {
    input: req.text,
    voice: req.voice ?? 'af_heart',
    speed: req.speed ?? 1.0,
    response_format: 'wav',
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Kokoro HTTP error ${res.status}: ${await res.text()}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function cliGenerate(cliPath: string, req: TTSRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const args = ['--text', req.text, '--voice', req.voice ?? 'af_heart', '--output', '-'];
    const child = spawn(cliPath, args);

    child.stdout.on('data', (d: Buffer) => chunks.push(d));
    child.stderr.on('data', (d: Buffer) => {
      // Log Kokoro stderr but don't fail on it (it's often just progress info)
      process.stderr.write(d);
    });
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Kokoro CLI exited with code ${code}`));
      resolve(Buffer.concat(chunks));
    });
    child.on('error', reject);
  });
}
