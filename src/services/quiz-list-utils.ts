/**
 * クイズリスト管理のユーティリティ（純粋関数群）
 *
 * Boundary: QuizListService (Task 2.6)
 * Requirements: 5.4, 5.6
 */

import { Quiz, QuizList } from '../types';

/* ==========================================================================
   リストのクイズID並び替え
   ========================================================================== */

/**
 * クイズIDリストを指定した新しい順序に並び替える。
 * ドラッグ＆ドロップによる順序変更をサポートするための純粋関数。
 *
 * @param originalIds 現在のクイズIDリスト
 * @param newOrder 新しい順序のクイズIDリスト
 * @returns 並び替え後のクイズIDリスト（元のリストに存在しないIDは除外）
 */
export function reorderQuizIds(originalIds: string[], newOrder: string[]): string[] {
  const validIds = new Set(originalIds);
  return newOrder.filter((id) => validIds.has(id));
}

/* ==========================================================================
   リストエクスポートパッケージ構築
   ========================================================================== */

/**
 * リストエクスポートパッケージの型
 */
export interface QuizListExportPackage {
  /** エクスポート日時 (ISO 8601) */
  exportedAt: string;
  /** リストのメタデータ */
  list: QuizList;
  /** 作成者が所有するクイズのフルデータ */
  ownedQuizzes: Quiz[];
  /** 外部（他者作成）クイズのIDのみ（フルデータは含まない） */
  externalQuizIds: string[];
}

/**
 * クイズリストのエクスポートパッケージを構築する。
 * 仕様: 作成者自身のクイズはフルデータを含み、他者のクイズはIDのみを参照する。
 *
 * @param list エクスポート対象のリスト
 * @param ownedQuizzes 作成者が所有するクイズオブジェクトの配列
 * @param externalQuizIds 外部クイズのIDの配列
 * @returns QuizListExportPackage
 */
export function buildListExportPackage(
  list: QuizList,
  ownedQuizzes: Quiz[],
  externalQuizIds: string[]
): QuizListExportPackage {
  return {
    exportedAt: new Date().toISOString(),
    list,
    ownedQuizzes,
    externalQuizIds,
  };
}
