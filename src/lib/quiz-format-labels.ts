/** 出題形式の日本語表示ラベル（エディタ・クイズカード共通） */
export function getFormatLabel(fmt: string): string {
  switch (fmt) {
    case 'mixed':
      return '複合形式';
    case 'multiple-choice':
      return '選択式';
    case 'true-false':
      return '〇✕式';
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

/** 出題形式の説明文（ホバー表示・エディタ共通） */
export function getFormatDescription(fmt: string): string {
  switch (fmt) {
    case 'mixed':
      return '選択式・〇✕式・記述式・並び替え・連想を自由に組み合わせ可能';
    case 'multiple-choice':
      return '複数の選択肢から1つの正解を選ぶ定番クイズ';
    case 'true-false':
      return '〇か✕かを選ぶ2択クイズ';
    case 'text-input':
      return 'テキスト入力で正確な正解ワードを記述する問題';
    case 'quick-press':
      return '問題が一文字ずつ表示され、回答ボタンを押して答える';
    case 'sorting':
      return 'バラバラの要素を正しい順番に並び替える形式';
    case 'association':
      return '段階的に開示されるヒントから正解を推測する';
    case 'lateral-thinking':
      return 'AIが真相の判定を行う状況構築型・水平思考';
    default:
      return getFormatLabel(fmt);
  }
}

/** 出題形式のアイコン（エディタ・クイズカード共通） */
export function getFormatIcon(fmt: string): string {
  switch (fmt) {
    case 'mixed':
      return '🌀';
    case 'multiple-choice':
      return '☑️';
    case 'true-false':
      return '⭕';
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

