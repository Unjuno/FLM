/**
 * 文字列操作のヘルパー関数
 */

/**
 * 文字列が空または空白のみかどうかをチェック
 * @param value - チェックする値
 * @returns 空または空白のみの場合true
 */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return false;
}

/**
 * 文字列が空（null、undefined、空文字列）かどうかをチェック
 * @param value - チェックする値
 * @returns 空の場合true
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value === '';
  }
  return false;
}
