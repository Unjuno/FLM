/**
 * React状態管理のヘルパー関数
 * SetやMapの更新パターンを統一します
 */

/**
 * Setに要素を追加した新しいSetを返す
 * @param set - 元のSet
 * @param item - 追加する要素
 * @returns 新しいSet
 */
export function addToSet<T>(set: Set<T>, item: T): Set<T> {
  return new Set(set).add(item);
}

/**
 * Setから要素を削除した新しいSetを返す
 * @param set - 元のSet
 * @param item - 削除する要素
 * @returns 新しいSet
 */
export function removeFromSet<T>(set: Set<T>, item: T): Set<T> {
  const newSet = new Set(set);
  newSet.delete(item);
  return newSet;
}

/**
 * Mapに要素を追加または更新した新しいMapを返す
 * @param map - 元のMap
 * @param key - キー
 * @param value - 値
 * @returns 新しいMap
 */
export function setInMap<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
  const newMap = new Map(map);
  newMap.set(key, value);
  return newMap;
}

/**
 * Mapから要素を削除した新しいMapを返す
 * @param map - 元のMap
 * @param key - 削除するキー
 * @returns 新しいMap
 */
export function removeFromMap<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  const newMap = new Map(map);
  newMap.delete(key);
  return newMap;
}

