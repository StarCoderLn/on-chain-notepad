// 记录每篇笔记对应的链上交易历史，保存在浏览器 localStorage 中
// 用途：交易状态浮条只显示"最近一次"交易，切换到下一篇笔记后就找不到了，
// 这里把每次 create/update/archive 的交易 hash 按 笔记 id 持久化下来，方便随时回看

export type NoteAction = 'create' | 'update' | 'archive'
export type TxRecord = { hash: `0x${string}`; action: NoteAction; timestamp: number }

const storageKey = (author: string, noteId: bigint) =>
  `noteblock:tx:${author.toLowerCase()}:${noteId.toString()}`

// 读取某篇笔记（按作者地址 + noteId 定位）的全部历史交易记录，按时间正序排列
export function getTxHistory(author: string, noteId: bigint): TxRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(author, noteId))
    return raw ? (JSON.parse(raw) as TxRecord[]) : []
  } catch {
    return []
  }
}

// 追加一条交易记录
export function addTxRecord(author: string, noteId: bigint, record: TxRecord) {
  try {
    const history = getTxHistory(author, noteId)
    history.push(record)
    localStorage.setItem(storageKey(author, noteId), JSON.stringify(history))
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略，不影响主流程
  }
}
