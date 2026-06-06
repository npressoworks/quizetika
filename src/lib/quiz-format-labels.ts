/** 出題形式の日本語表示ラベル（エディタ・クイズカード共通） */
export function getFormatLabel(fmt: string): string {
  switch (fmt) {
    case 'mixed':
      return '複合形式';
    case 'multiple-choice':
      return '選択式';
    case 'text-input':
      return '記述式';
    case 'quick-press':
      return '早押し';
    case 'sorting':
      return '並び替え';
    case 'association':
      return '連想';
    case 'lateral-thinking':
      return 'ウミガメのスープ';
    default:
      return fmt;
  }
}

/** 出題形式のアイコン（エディタ・クイズカード共通） */
export function getFormatIcon(fmt: string): string {
  switch (fmt) {
    case 'mixed':
      return '🌀';
    case 'multiple-choice':
      return '📝';
    case 'text-input':
      return '✍️';
    case 'quick-press':
      return '⚡';
    case 'sorting':
      return '↕️';
    case 'association':
      return '💡';
    case 'lateral-thinking':
      return '🐢';
    default:
      return '❓';
  }
}

