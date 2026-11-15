import { cleanFileName, contentMatches } from './files.service';

describe('uploaded file checks', () => {
  it('accepts files whose first bytes match their extension', () => {
    expect(contentMatches('pdf', Buffer.from('%PDF-1.7 ...'))).toBe(true);
    expect(contentMatches('png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(true);
    expect(contentMatches('xlsx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(contentMatches('csv', Buffer.from('name,score\nSam,4\n'))).toBe(true);
  });

  it('refuses a program renamed to look like a document', () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]); // "MZ", a Windows program
    expect(contentMatches('pdf', exe)).toBe(false);
    expect(contentMatches('docx', exe)).toBe(false);
    expect(contentMatches('txt', exe)).toBe(false);
    expect(contentMatches('exe', exe)).toBe(false);
  });

  it('keeps file names safe to show and to send back', () => {
    expect(cleanFileName('C:\\fakepath\\handover "final".pdf')).toBe('handover final.pdf');
    expect(cleanFileName('../../etc/passwd')).toBe('passwd');
    expect(cleanFileName('\u0000')).toBe('file');
  });
});
