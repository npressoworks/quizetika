/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, UnderlineTabsList, UnderlineTabsTrigger, TabsContent } from '@/components/ui/underline-tabs';

function Sample({ initial = 'a' }: { initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <Tabs value={value} onValueChange={(v) => setValue(v as string)}>
      <UnderlineTabsList data-testid="sample-list">
        <UnderlineTabsTrigger value="a">タブA</UnderlineTabsTrigger>
        <UnderlineTabsTrigger value="b">タブB</UnderlineTabsTrigger>
      </UnderlineTabsList>
      <TabsContent value="a">コンテンツA</TabsContent>
      <TabsContent value="b">コンテンツB</TabsContent>
    </Tabs>
  );
}

describe('UnderlineTabsList / UnderlineTabsTrigger', () => {
  it('line バリアントの下線タブとして描画されること', () => {
    render(<Sample />);

    const list = screen.getByTestId('sample-list');
    expect(list).toHaveAttribute('data-variant', 'line');
    expect(list.className).toMatch(/border-b/);

    const tabA = screen.getByRole('tab', { name: 'タブA' });
    expect(tabA.className).toMatch(/data-active:font-bold/);
    expect(tabA.className).toMatch(/min-h-/);
    expect(tabA.className).toMatch(/after:h-\[3px\]/);
    expect(tabA.className).toMatch(/after:bottom-\[1px\]/);
  });

  it('タブを切り替えると選択状態が更新されること', () => {
    render(<Sample />);

    const tabA = screen.getByRole('tab', { name: 'タブA' });
    const tabB = screen.getByRole('tab', { name: 'タブB' });
    expect(tabA).toHaveAttribute('aria-selected', 'true');
    expect(tabB).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(tabB);

    expect(tabB).toHaveAttribute('aria-selected', 'true');
    expect(tabA).toHaveAttribute('aria-selected', 'false');
  });

  it('呼び出し側から渡された className が保持されること（上書きされず併用される）', () => {
    render(
      <Tabs value="a">
        <UnderlineTabsList className="custom-list-class" data-testid="custom-list">
          <UnderlineTabsTrigger value="a" className="custom-trigger-class">
            タブA
          </UnderlineTabsTrigger>
        </UnderlineTabsList>
      </Tabs>
    );

    expect(screen.getByTestId('custom-list').className).toMatch(/custom-list-class/);
    expect(screen.getByRole('tab', { name: 'タブA' }).className).toMatch(/custom-trigger-class/);
  });
});
