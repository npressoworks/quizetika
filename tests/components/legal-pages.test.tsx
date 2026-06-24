/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// isomorphic-dompurify (およびその依存関係の ESM) が Jest テスト実行時にエラーを起こすためモック化
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: (html: string) => html,
  },
  sanitize: (html: string) => html,
}));

import TermsPage from '@/app/terms/page';
import PrivacyPage from '@/app/privacy/page';
import * as fs from 'fs/promises';

// Next.js App Router の async サーバーコンポーネントのテスト用ヘルパー
async function renderAsyncComponent(Component: any) {
  const jsx = await Component();
  return render(jsx);
}

describe('Legal Pages', () => {
  describe('TermsPage', () => {
    it('利用規約のMarkdownファイルを正しくロードしてレンダリングすること', async () => {
      await renderAsyncComponent(TermsPage);
      // terms.md に含まれるはずの主要な文言が存在するか検証
      expect(screen.getByText('利用規約')).toBeInTheDocument();
      expect(screen.getByText(/禁止事項/)).toBeInTheDocument();
    });
  });

  describe('PrivacyPage', () => {
    it('プライバシーポリシーのMarkdownファイルを正しくロードしてレンダリングすること', async () => {
      await renderAsyncComponent(PrivacyPage);
      // privacy.md に含まれるはずの主要な文言が存在するか検証
      expect(screen.getByText('プライバシーポリシー')).toBeInTheDocument();
      expect(screen.getByText(/情報の利用目的/)).toBeInTheDocument();
    });
  });
});
