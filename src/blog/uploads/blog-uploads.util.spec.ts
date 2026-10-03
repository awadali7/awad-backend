import { detectImage, publicUploadsUrl } from './blog-uploads.util';

const padded = (head: number[] | string) => {
  const start =
    typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head);
  return Buffer.concat([start, Buffer.alloc(32)]);
};

describe('detectImage', () => {
  it('recognises each allowed format by its first bytes', () => {
    expect(detectImage(padded([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });
    expect(
      detectImage(padded([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toMatchObject({ extension: 'png' });
    expect(detectImage(padded('GIF89a'))).toMatchObject({ extension: 'gif' });
    expect(
      detectImage(padded('RIFF\u0000\u0000\u0000\u0000WEBP')),
    ).toMatchObject({ extension: 'webp' });
    expect(
      detectImage(padded('\u0000\u0000\u0000\u001cftypavif')),
    ).toMatchObject({ extension: 'avif' });
  });

  it('refuses SVG, HTML and anything it does not recognise', () => {
    expect(
      detectImage(padded('<svg xmlns="http://www.w3.org/2000/svg">')),
    ).toBeNull();
    expect(detectImage(padded('<!doctype html><script>'))).toBeNull();
    expect(detectImage(padded('%PDF-1.7'))).toBeNull();
    expect(detectImage(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('publicUploadsUrl', () => {
  const request = (headers: Record<string, string>, protocol = 'http') => ({
    protocol,
    get: (name: string) => headers[name.toLowerCase()],
  });

  afterEach(() => {
    delete process.env.UPLOADS_PUBLIC_URL;
  });

  it('uses the scheme nginx forwards, so links are https behind the proxy', () => {
    expect(
      publicUploadsUrl(
        request({ host: 'api.awadali.com', 'x-forwarded-proto': 'https' }),
      ),
    ).toBe('https://api.awadali.com/uploads');
  });

  it('falls back to the request itself in local development', () => {
    expect(publicUploadsUrl(request({ host: 'localhost:3001' }))).toBe(
      'http://localhost:3001/uploads',
    );
  });

  it('ignores a forwarded scheme it does not expect', () => {
    expect(
      publicUploadsUrl(
        request({ host: 'localhost:3001', 'x-forwarded-proto': 'javascript' }),
      ),
    ).toBe('http://localhost:3001/uploads');
  });

  it('prefers UPLOADS_PUBLIC_URL when it is set', () => {
    process.env.UPLOADS_PUBLIC_URL = 'https://cdn.awadali.com/uploads/';
    expect(publicUploadsUrl(request({ host: 'localhost:3001' }))).toBe(
      'https://cdn.awadali.com/uploads',
    );
  });
});
