import { resolveContactUrl } from '@/components/explore/home-sidebar';

describe('resolveContactUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_CONTACT_FORM_URL;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CONTACT_FORM_URL = originalEnv;
  });

  it('環境変数が未設定の場合、デフォルトのGoogle Forms URLを返すこと', () => {
    delete process.env.NEXT_PUBLIC_CONTACT_FORM_URL;
    const url = resolveContactUrl();
    expect(url).toBe('https://docs.google.com/forms/d/e/1FAIpQLSfP1E1_dummy_form/viewform');
  });

  it('環境変数が設定されている場合、そのURLを返すこと', () => {
    process.env.NEXT_PUBLIC_CONTACT_FORM_URL = 'https://custom-form-url.example.com';
    const url = resolveContactUrl();
    expect(url).toBe('https://custom-form-url.example.com');
  });
});
