import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCipheriv, createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Client,
  FileInfo,
  FileDownloadInfo,
  LosslessDownloadInfo,
  Track,
  getFileInfoSign,
  DESKTOP_SIGN_KEY,
  DESKTOP_CLIENT,
  FILE_INFO_CODECS,
  FILE_INFO_CODECS_LIST,
  type FetchLike,
} from '../src/index.js';
import { clientWith } from './helpers/http.js';

const NOW_MS = Date.UTC(2026, 10, 25, 12, 0, 0);
const TS = Math.floor(NOW_MS / 1000);
const REF_CODECS = 'flacflac-mp4aac-mp4he-aac-mp4aache-aacmp3';

function expectedSign(message: string, key: string): string {
  return createHmac('sha256', key).update(message, 'utf8').digest('base64').slice(0, -1);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('getFileInfoSign', () => {
  test('uses the desktop key, the id as given and codecs in reference order', () => {
    const sign = getFileInfoSign('123:456', 'lossless', FILE_INFO_CODECS_LIST, 'raw');
    expect(sign.ts).toBe(TS);
    const message = `${TS}123:456losslessflacflac-mp4aac-mp4he-aac-mp4aache-aacmp3raw`;
    expect(sign.value).toBe(expectedSign(message, 'kzqU4XhfCaY6B6JTHODeq5'));
    expect(DESKTOP_SIGN_KEY).toBe('kzqU4XhfCaY6B6JTHODeq5');
    expect(DESKTOP_CLIENT).toBe('YandexMusicDesktopAppWindows/5.95.0');
  });

  test('codec order and join', () => {
    expect([...FILE_INFO_CODECS_LIST]).toEqual(['flac', 'flac-mp4', 'aac-mp4', 'he-aac-mp4', 'aac', 'he-aac', 'mp3']);
    expect(FILE_INFO_CODECS).toBe('flac,flac-mp4,aac-mp4,he-aac-mp4,aac,he-aac,mp3');
  });

  test('defaults pair desktop key with the encraw transport; comma strings are stripped', () => {
    const sign = getFileInfoSign(42);
    expect(sign.value).toBe(expectedSign(`${TS}42lossless${REF_CODECS}encraw`, DESKTOP_SIGN_KEY));
    expect(getFileInfoSign(42, 'hq', 'mp3,aac', 'raw', 'k').value).toBe(expectedSign(`${TS}42hqmp3aacraw`, 'k'));
  });
});

describe('tracksFileInfo / tracksLosslessInfo requests', () => {
  const route = {
    match: '/get-file-info',
    body: { result: { downloadInfo: { trackId: '123', codec: 'flac', transport: 'raw', urls: ['https://cdn/x'] } } },
  };

  test('tracksFileInfo sends desktop header, unchanged id, ordered codecs, raw transport and signature', async () => {
    const { client, calls } = clientWith([route]);
    const info = await client.tracksFileInfo('123:456');
    expect(info).toBeInstanceOf(FileInfo);
    expect(info?.downloadInfo).toBeInstanceOf(LosslessDownloadInfo);
    expect(info?.downloadInfo?.codec).toBe('flac');

    const call = calls[0]!;
    expect(call.headers['X-Yandex-Music-Client']).toBe(DESKTOP_CLIENT);
    const url = new URL(call.url);
    expect(url.pathname.endsWith('/get-file-info')).toBe(true);
    expect(url.searchParams.get('ts')).toBe(String(TS));
    expect(url.searchParams.get('trackId')).toBe('123:456');
    expect(url.searchParams.get('quality')).toBe('lossless');
    expect(url.searchParams.get('codecs')).toBe('flac,flac-mp4,aac-mp4,he-aac-mp4,aac,he-aac,mp3');
    expect(url.searchParams.get('transports')).toBe('raw');
    expect(url.searchParams.get('sign')).toBe(
      expectedSign(`${TS}123:456losslessflacflac-mp4aac-mp4he-aac-mp4aache-aacmp3raw`, DESKTOP_SIGN_KEY),
    );
  });

  test('options override quality, codecs, transport, key and header', async () => {
    const { client, calls } = clientWith([route]);
    await client.tracksFileInfo(7, {
      quality: 'hq',
      codecs: ['mp3', 'aac'],
      transport: 'encraw',
      signKey: 'custom',
      clientHeader: 'Custom/1',
    });
    const call = calls[0]!;
    expect(call.headers['X-Yandex-Music-Client']).toBe('Custom/1');
    const url = new URL(call.url);
    expect(url.searchParams.get('codecs')).toBe('mp3,aac');
    expect(url.searchParams.get('transports')).toBe('encraw');
    expect(url.searchParams.get('sign')).toBe(expectedSign(`${TS}7hqmp3aacencraw`, 'custom'));
  });

  test('tracksLosslessInfo still sends transports=encraw (and the desktop pairing)', async () => {
    const { client, calls } = clientWith([route]);
    const info = await client.tracksLosslessInfo(42);
    expect(info).toBeInstanceOf(LosslessDownloadInfo);
    const call = calls[0]!;
    const url = new URL(call.url);
    expect(url.searchParams.get('transports')).toBe('encraw');
    expect(url.searchParams.get('trackId')).toBe('42');
    expect(call.headers['X-Yandex-Music-Client']).toBe(DESKTOP_CLIENT);
    expect(url.searchParams.get('sign')).toBe(expectedSign(`${TS}42lossless${REF_CODECS}encraw`, DESKTOP_SIGN_KEY));
  });

  test('tracksLosslessInfo accepts a transport override', async () => {
    const { client, calls } = clientWith([route]);
    await client.tracksLosslessInfo(42, 'nq', { transport: 'raw' });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('quality')).toBe('nq');
    expect(url.searchParams.get('transports')).toBe('raw');
  });

  test('Track.getFileInfo delegates with the track id', async () => {
    const { client, calls } = clientWith([route]);
    const track = Track.deJson({ id: '123', albumId: 456, title: 't' }, client)!;
    const info = await track.getFileInfo({ quality: 'nq' });
    expect(info).toBeInstanceOf(FileInfo);
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('trackId')).toBe(track.trackId());
    expect(url.searchParams.get('quality')).toBe('nq');
    expect(url.searchParams.get('transports')).toBe('raw');
  });

  test('FileInfo.deJson returns null for non-objects and FileDownloadInfo aliases the class', () => {
    expect(FileInfo.deJson(null)).toBeNull();
    expect(FileDownloadInfo).toBe(LosslessDownloadInfo);
    expect(FileInfo.deJson({})?.downloadInfo).toBeUndefined();
  });
});

describe('download decryption by transport', () => {
  const keyHex = '00112233445566778899aabbccddeeff';
  const plaintext = new TextEncoder().encode('fLaC the rest of a flac frame');

  function encrypt(): Uint8Array {
    const cipher = createCipheriv('aes-128-ctr', Buffer.from(keyHex, 'hex'), Buffer.alloc(16));
    return new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final()]));
  }

  function clientServing(bytes: Uint8Array): Client {
    const fetch: FetchLike = async () => ({
      status: 200,
      arrayBuffer: async () => new Uint8Array(bytes).buffer as ArrayBuffer,
    });
    return new Client({ token: 't', fetch });
  }

  test('raw transport: bytes pass through unchanged even when a key is present', async () => {
    const client = clientServing(plaintext);
    const info = LosslessDownloadInfo.deJson(
      { codec: 'flac', transport: 'raw', key: keyHex, urls: ['https://cdn/x'] },
      client,
    )!;
    expect(info.isEncrypted).toBe(false);
    expect(Array.from(await info.downloadBytes())).toEqual(Array.from(plaintext));
  });

  test('encraw transport: bytes are decrypted', async () => {
    const client = clientServing(encrypt());
    const info = LosslessDownloadInfo.deJson(
      { codec: 'flac', transport: 'encraw', key: keyHex, urls: ['https://cdn/x'] },
      client,
    )!;
    expect(info.isEncrypted).toBe(true);
    expect(Array.from(await info.downloadBytes())).toEqual(Array.from(plaintext));
  });

  test('a key without a transport is treated as encrypted', async () => {
    const client = clientServing(encrypt());
    const info = LosslessDownloadInfo.deJson({ codec: 'flac', key: keyHex, urls: ['https://cdn/x'] }, client)!;
    expect(info.isEncrypted).toBe(true);
    expect(Array.from(await info.downloadBytes())).toEqual(Array.from(plaintext));
  });

  test('download() to a file: raw is written unchanged, encraw is decrypted', async () => {
    vi.useRealTimers();
    const dir = mkdtempSync(join(tmpdir(), 'ym-file-info-'));
    try {
      const rawClient = clientServing(plaintext);
      const rawInfo = LosslessDownloadInfo.deJson(
        { transport: 'raw', key: keyHex, urls: ['https://cdn/x'] },
        rawClient,
      )!;
      const rawPath = join(dir, 'raw.bin');
      await rawInfo.download(rawPath);
      expect(Array.from(readFileSync(rawPath))).toEqual(Array.from(plaintext));

      const encClient = clientServing(encrypt());
      const encInfo = LosslessDownloadInfo.deJson(
        { transport: 'encraw', key: keyHex, urls: ['https://cdn/x'] },
        encClient,
      )!;
      const encPath = join(dir, 'enc.bin');
      await encInfo.download(encPath);
      expect(Array.from(readFileSync(encPath))).toEqual(Array.from(plaintext));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
