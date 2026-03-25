const CELL_DATA_VERSION = 1;
const CELL_DATA_FLAG_HAS_METADATA = 0x01;

function strip0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function assertHexLength(value: string, expectedLength: number, label: string): string {
  const normalized = strip0x(value).toLowerCase();
  if (normalized.length !== expectedLength) {
    throw new Error(`${label} must be ${expectedLength / 2} bytes.`);
  }
  if (!/^[0-9a-f]+$/.test(normalized)) {
    throw new Error(`${label} must be hex-encoded.`);
  }
  return normalized;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Bytes(data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return new Uint8Array(digest);
}

export async function sha256Hex(data: string): Promise<string> {
  return bytesToHex(await sha256Bytes(data));
}

export async function sha256TruncatedHex(data: string, length = 20): Promise<string> {
  return bytesToHex((await sha256Bytes(data)).slice(0, length));
}

export async function buildIssuerAnchorArgs(recordId: string, issuerAddress: string): Promise<`0x${string}`> {
  const recordHash = await sha256TruncatedHex(recordId);
  const issuerHash = await sha256TruncatedHex(issuerAddress);
  return `0x${recordHash}${issuerHash}`;
}

export async function buildUniqueArtifactArgs(
  recordId: string,
  ownerAddress: string,
  typeIdHex = '0'.repeat(40)
): Promise<`0x${string}`> {
  const normalizedTypeId = assertHexLength(typeIdHex, 40, 'type_id');
  const recordHash = await sha256TruncatedHex(recordId);
  const ownerHash = await sha256TruncatedHex(ownerAddress);
  return `0x${normalizedTypeId}${recordHash}${ownerHash}`;
}

export async function buildHashedCellData(
  content: Record<string, unknown>,
  version = CELL_DATA_VERSION,
  flags = CELL_DATA_FLAG_HAS_METADATA
): Promise<`0x${string}`> {
  const contentHash = await sha256Hex(JSON.stringify(content));
  const versionHex = version.toString(16).padStart(2, '0');
  const flagsHex = flags.toString(16).padStart(2, '0');
  return `0x${versionHex}${flagsHex}${contentHash}`;
}
