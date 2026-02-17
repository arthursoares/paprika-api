import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';

interface HarEntry {
  request: {
    method: string;
    url: string;
    postData?: { text: string };
  };
  response: {
    status: number;
    content: { text: string; encoding?: string };
  };
}

interface Har {
  log: { entries: HarEntry[] };
}

const UUID_PATTERN = /[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/gi;

function obfuscateUUIDs(text: string, uuidMap: Map<string, string>): string {
  return text.replace(UUID_PATTERN, (match) => {
    const upper = match.toUpperCase();
    if (!uuidMap.has(upper)) {
      const index = uuidMap.size + 1;
      uuidMap.set(upper, `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`);
    }
    return uuidMap.get(upper)!;
  });
}

function obfuscate(text: string, uuidMap: Map<string, string>): string {
  let result = text;
  result = obfuscateUUIDs(result, uuidMap);
  result = result.replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer REDACTED_TOKEN');
  result = result.replace(/Basic [A-Za-z0-9+/=]+/g, 'Basic REDACTED');
  result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, 'user@example.com');
  result = result.replace(/[A-F0-9]{64}/gi, 'REDACTED_HASH'.padEnd(64, '0'));
  return result;
}

function parseMultipart(buffer: Buffer): unknown | null {
  const content = buffer.toString('binary');
  const boundaryMatch = content.match(/--([^\r\n]+)/);
  if (!boundaryMatch) return null;

  const boundary = boundaryMatch[1];
  const parts = content.split(`--${boundary}`);

  for (const part of parts) {
    if (part.includes('name="data"')) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const dataStart = headerEnd + 4;
      const dataEnd = part.lastIndexOf('\r\n');
      const binaryData = part.slice(dataStart, dataEnd);
      const dataBuffer = Buffer.from(binaryData, 'binary');

      try {
        const decompressed = gunzipSync(dataBuffer);
        return JSON.parse(decompressed.toString('utf-8'));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function deriveFixtureName(method: string, path: string): string {
  const parts = path.replace('/api/v1/sync/', '').replace('/api/v2/sync/', '').split('/').filter(Boolean);

  if (parts.length === 0) return 'unknown';

  const resource = parts[0];
  const uid = parts[1];

  if (method === 'GET') {
    return uid ? `${resource}-get` : `${resource}-list`;
  }
  return uid ? `${resource}-sync-${uid.slice(0, 8)}` : `${resource}-sync`;
}

function processHar(harPath: string, outputDir: string): void {
  const har: Har = JSON.parse(readFileSync(harPath, 'utf-8'));
  const uuidMap = new Map<string, string>();

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const paprikaEntries = har.log.entries.filter(
    (e) => e.request.url.includes('paprikaapp.com/api') && !e.request.url.includes('appcenter'),
  );

  console.log(`Processing ${paprikaEntries.length} Paprika API entries...`);

  for (const entry of paprikaEntries) {
    const url = new URL(entry.request.url);

    // Decode request
    let requestBody: unknown = null;
    if (entry.request.postData?.text) {
      const decoded = Buffer.from(entry.request.postData.text, 'base64');
      requestBody = parseMultipart(decoded);
    }

    // Decode response
    let responseBody: unknown = null;
    if (entry.response.content.text) {
      const decoded = Buffer.from(entry.response.content.text, 'base64').toString('utf-8');
      try {
        responseBody = JSON.parse(decoded);
      } catch {
        responseBody = decoded;
      }
    }

    const fixture = {
      request: {
        method: entry.request.method,
        path: url.pathname,
        body: requestBody ? JSON.parse(obfuscate(JSON.stringify(requestBody), uuidMap)) : null,
      },
      response: {
        status: entry.response.status,
        body: responseBody ? JSON.parse(obfuscate(JSON.stringify(responseBody), uuidMap)) : null,
      },
    };

    const name = deriveFixtureName(entry.request.method, url.pathname);
    const outPath = join(outputDir, `${name}.json`);
    writeFileSync(outPath, JSON.stringify(fixture, null, 2));
    console.log(`Wrote: ${outPath}`);
  }
}

// CLI
const [harPath, outputDir] = process.argv.slice(2);
if (!harPath || !outputDir) {
  console.log('Usage: npx tsx scripts/process-fixtures.ts <har-file> <output-dir>');
  process.exit(1);
}
processHar(harPath, outputDir);
