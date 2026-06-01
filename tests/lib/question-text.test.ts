import { decodeStoredQuestionText } from '@/lib/question-text';

describe('decodeStoredQuestionText', () => {
  it('returns plain text for non quick-press types', () => {
    expect(decodeStoredQuestionText('**hello**', 'multiple-choice')).toBe('**hello**');
  });

  it('decodes base64 quick-press question text', () => {
    const encoded = btoa(unescape(encodeURIComponent('**早押し**問題')));
    expect(decodeStoredQuestionText(encoded, 'quick-press')).toBe('**早押し**問題');
  });

  it('falls back to raw string when decode fails', () => {
    expect(decodeStoredQuestionText('not-base64', 'quick-press')).toBe('not-base64');
  });
});
