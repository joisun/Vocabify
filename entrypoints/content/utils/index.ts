export const  isSelectionIntersectWithElement = function(
  selection: Selection,
  MARKED_CLASSNAME: string
) {
  const markedWord = document.getElementsByClassName(MARKED_CLASSNAME)[0];
  if (!markedWord) return false;

  // 获取目标元素的边界
  const elementRect = markedWord.getBoundingClientRect();

  // 获取选区的所有矩形
  const selectionRects = selection.getRangeAt(0).getClientRects();

  // 遍历选区的每个矩形，检查是否与目标元素的边界矩形有交集
  for (let i = 0; i < selectionRects.length; i++) {
    const rect = selectionRects[i];

    const isIntersect = !(
      rect.right < elementRect.left ||
      rect.left > elementRect.right ||
      rect.bottom < elementRect.top ||
      rect.top > elementRect.bottom
    );

    if (isIntersect) {
      return true; // 如果有任何交叉，返回true
    }
  }

  return false; // 如果没有交叉，返回false
}
