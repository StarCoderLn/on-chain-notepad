import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  Archive,
  ArrowUpRight,
  Check,
  ChevronLeft,
  FileText,
  LoaderCircle,
  Menu,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { zeroAddress } from 'viem'
import { contractAddress, isContractConfigured, notepadAbi, type Note } from './contract'
import { addTxRecord, getTxHistory, type NoteAction, type TxRecord } from './txHistory'

// 侧边栏筛选类型：全部 / 进行中（未归档）/ 已归档
type Filter = 'all' | 'active' | 'archived'
// 编辑器状态：null 表示未打开；有 id 表示编辑已有笔记，无 id 表示新建笔记
type Editor = { id?: bigint; title: string; content: string } | null

// 生成一个空白的新建笔记编辑器状态
const emptyEditor = (): Editor => ({ title: '', content: '' })
// 拼接 Sepolia 区块浏览器的交易详情链接
const explorerUrl = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`
// 笔记卡片按序号轮换的四种背景色
const cardTones = ['bg-[#151b2d]', 'bg-[#191c31]', 'bg-[#151e2e]', 'bg-[#1b1a2d]']

export default function App() {
  const { address, isConnected, chain } = useAccount()
  const [filter, setFilter] = useState<Filter>('all') // 当前选中的侧边栏筛选项
  const [query, setQuery] = useState('') // 搜索框关键词
  const [editor, setEditor] = useState<Editor>(null) // 当前打开的编辑面板状态
  const [selected, setSelected] = useState<Note | null>(null) // 当前打开的笔记详情
  const [menuOpen, setMenuOpen] = useState(false) // 移动端侧边栏是否展开
  // 当前正在进行的写操作类型，用于交易确认后把 hash 记录到对应笔记的链上历史里
  const [pendingAction, setPendingAction] = useState<NoteAction | null>(null)
  const [pendingNoteId, setPendingNoteId] = useState<bigint | null>(null) // 更新/归档时已知的笔记 id；新建时为 null
  // 读取当前钱包地址名下的所有笔记；未连接钱包或合约未配置时不发起请求
  const { data, isLoading, refetch } = useReadContract({
    address: contractAddress,
    abi: notepadAbi,
    functionName: 'getNotesByAuthor',
    args: [address ?? zeroAddress],
    query: { enabled: Boolean(address && isContractConfigured) },
  })
  // 写合约（创建/更新/归档笔记）的通用 hook
  const { data: hash, isPending, error, writeContract, reset } = useWriteContract()
  // 等待交易上链确认
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const notes = (data as readonly Note[] | undefined) ?? []

  // 交易确认成功后：把这笔交易记录到对应笔记的链上历史里，刷新笔记列表并关闭编辑面板
  useEffect(() => {
    if (!isSuccess || !hash || !address) return
    const record: TxRecord = { hash, action: pendingAction ?? 'update', timestamp: Date.now() }
    if (pendingNoteId != null) {
      // 更新/归档：笔记 id 在发起交易时已知，直接记录
      addTxRecord(address, pendingNoteId, record)
      refetch()
    } else {
      // 新建：合约只在链上返回 noteId，前端需要刷新后从最新笔记列表里找到它（id 最大的那篇）
      refetch().then((result) => {
        const list = (result.data as readonly Note[] | undefined) ?? []
        const newest = list.reduce<Note | null>(
          (max, note) => (!max || note.id > max.id ? note : max),
          null,
        )
        if (newest) addTxRecord(address, newest.id, record)
      })
    }
    setEditor(null)
    setPendingAction(null)
    setPendingNoteId(null)
  }, [isSuccess])
  // 切换钱包地址时，重置详情/编辑面板和写交易状态
  useEffect(() => {
    setSelected(null)
    setEditor(null)
    reset()
  }, [address, reset])
  // 笔记列表更新后，保持详情面板与最新数据同步（若该笔记已被删除/不存在则关闭详情）
  useEffect(() => {
    if (selected) setSelected(notes.find((note) => note.id === selected.id) ?? null)
  }, [notes])

  // 根据当前筛选条件和搜索关键词，计算展示用的笔记列表（按最后更新时间倒序）
  const filteredNotes = useMemo(
    () =>
      notes
        .filter((note) => {
          const matchesFilter =
            filter === 'all' || (filter === 'archived' ? note.archived : !note.archived)
          const term = query.trim().toLowerCase()
          return (
            matchesFilter && (!term || `${note.title} ${note.content}`.toLowerCase().includes(term))
          )
        })
        .sort((a, b) => Number(b.updatedAt - a.updatedAt)),
    [notes, filter, query],
  )

  // 保存笔记：有 id 则调用 updateNote 更新，否则调用 createNote 新建
  const saveNote = () => {
    if (!editor || !editor.title.trim() || !isContractConfigured) return
    setPendingAction(editor.id ? 'update' : 'create')
    setPendingNoteId(editor.id ?? null)
    writeContract({
      address: contractAddress,
      abi: notepadAbi,
      functionName: editor.id ? 'updateNote' : 'createNote',
      args: editor.id
        ? [editor.id, editor.title.trim(), editor.content]
        : [editor.title.trim(), editor.content],
    })
  }

  // 切换笔记的归档状态
  const archiveNote = (note: Note) => {
    setPendingAction('archive')
    setPendingNoteId(note.id)
    writeContract({
      address: contractAddress,
      abi: notepadAbi,
      functionName: 'toggleArchive',
      args: [note.id],
    })
  }
  // 打开编辑面板：传入笔记则编辑该笔记，不传则新建一篇空白笔记
  const openEditor = (note?: Note) => {
    setSelected(null)
    setMenuOpen(false) // 从移动端抽屉里点击"新建笔记"时，顺手收起抽屉
    setEditor(note ? { id: note.id, title: note.title, content: note.content } : emptyEditor())
  }

  // 快捷键 Ctrl+N 新建笔记（不区分系统，统一用 Ctrl）：阻止浏览器默认的"新建窗口"行为
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        if (!isConnected || !isContractConfigured || editor) return
        event.preventDefault()
        openEditor()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConnected, editor])

  return (
    <main className="flex min-h-screen bg-bg">
      {/* 移动端侧边栏展开时的遮罩层，点击可关闭侧边栏 */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[15] hidden bg-black/50 max-[850px]:block"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {/* 左侧边栏：品牌标识 + 新建笔记入口 + 筛选导航（移动端可收起） */}
      <aside
        className={`flex min-h-screen w-[260px] flex-none flex-col border-r border-white/[0.07] bg-panel p-[26px_16px_16px] max-[850px]:fixed max-[850px]:z-20 max-[850px]:transition-transform max-[850px]:duration-200 ${
          menuOpen
            ? 'max-[850px]:translate-x-0 max-[850px]:shadow-[20px_0_40px_#080b14]'
            : 'max-[850px]:-translate-x-full'
        }`}
      >
        <div className="flex h-[42px] items-center gap-[10px] px-[9px] text-[21px] font-bold tracking-[-0.8px]">
          <img className="h-[30px] w-[30px] flex-none" src="/noteblock-mark.svg" alt="Noteblock" />
          <span>Noteblock</span>
          <button
            className="ml-auto hidden max-[850px]:grid max-[850px]:place-items-center text-[#cdd3e0]"
            onClick={() => setMenuOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={20} />
          </button>
        </div>
        <button
          className="mt-[30px] mb-[27px] flex h-[44px] items-center justify-center gap-[8px] whitespace-nowrap rounded-[10px] bg-accent px-[16px] font-bold text-accent-fg transition-transform hover:-translate-y-px hover:bg-accent-hover"
          onClick={() => openEditor()}
          disabled={!isConnected || !isContractConfigured}
        >
          <Plus size={18} />
          新建笔记{' '}
          <kbd className="ml-auto mr-[7px] font-mono text-[13px] font-medium text-[#53613d]">
            Ctrl N
          </kbd>
        </button>
        <nav>
          <p className="mx-[9px] mb-[9px] font-mono text-[10px] font-medium uppercase tracking-[1.15px] text-[#6f7692]">
            你的空间
          </p>
          <button
            className={`flex h-[42px] w-full items-center gap-[11px] whitespace-nowrap rounded-[8px] px-[10px] text-left text-[14px] text-[#aeb4c8] hover:bg-[#1b2134] hover:text-[#e4e7f0] ${
              filter === 'all' ? 'bg-[#20283e] text-white' : ''
            }`}
            onClick={() => setFilter('all')}
          >
            <FileText size={17} />
            所有笔记{' '}
            <em className="ml-auto font-mono text-[11px] not-italic text-[#777f99]">
              {notes.length}
            </em>
          </button>
          <button
            className={`flex h-[42px] w-full items-center gap-[11px] whitespace-nowrap rounded-[8px] px-[10px] text-left text-[14px] text-[#aeb4c8] hover:bg-[#1b2134] hover:text-[#e4e7f0] ${
              filter === 'active' ? 'bg-[#20283e] text-white' : ''
            }`}
            onClick={() => setFilter('active')}
          >
            <Sparkles size={17} />
            进行中{' '}
            <em className="ml-auto font-mono text-[11px] not-italic text-[#777f99]">
              {notes.filter((note) => !note.archived).length}
            </em>
          </button>
          <button
            className={`flex h-[42px] w-full items-center gap-[11px] whitespace-nowrap rounded-[8px] px-[10px] text-left text-[14px] text-[#aeb4c8] hover:bg-[#1b2134] hover:text-[#e4e7f0] ${
              filter === 'archived' ? 'bg-[#20283e] text-white' : ''
            }`}
            onClick={() => setFilter('archived')}
          >
            <Archive size={17} />
            已归档
          </button>
        </nav>
      </aside>
      {/* 右侧主工作区：顶部栏（搜索/新建/钱包）+ 网络提示 + 笔记列表 */}
      <section className="w-[calc(100%-260px)] min-w-0 max-[850px]:w-full">
        <header className="flex min-h-[73px] items-center justify-between border-b border-white/[0.07] px-[42px] max-[850px]:px-[21px]">
          <button
            className="hidden max-[850px]:grid max-[850px]:place-items-center text-[#cdd3e0]"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="flex items-center gap-[9px] whitespace-nowrap text-[13px] text-[#7d849b] max-[850px]:mr-auto max-[850px]:ml-[13px]">
            <span className="max-[560px]:hidden">链上记事本</span>
            <ChevronLeft className="max-[560px]:hidden" size={15} />
            <strong className="font-medium text-[#d9dce7]">
              {filter === 'all' ? '所有笔记' : filter === 'active' ? '进行中' : '已归档'}
            </strong>
          </div>
          <div className="flex items-center gap-[13px]">
            <div className="flex w-[210px] items-center gap-[8px] text-[#68708a] max-[560px]:w-[30px]">
              <Search size={17} />
              <input
                className="w-full border-0 bg-transparent text-[13px] text-[#e8eaf0] outline-none max-[560px]:hidden"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索笔记"
              />
            </div>
            <button
              className="m-0 flex h-[37px] items-center justify-center gap-[8px] whitespace-nowrap rounded-[10px] bg-accent px-[14px] font-bold text-accent-fg transition-transform hover:-translate-y-px hover:bg-accent-hover max-[560px]:w-[39px] max-[560px]:px-0"
              onClick={() => openEditor()}
              disabled={!isConnected || !isContractConfigured}
            >
              <Plus size={18} />
              <span className="max-[560px]:hidden">新建</span>
            </button>
            <WalletMenuButton />
          </div>
        </header>
        {/* 若已连接钱包但当前网络不是 Sepolia（chainId 11155111），提示切换网络 */}
        {chain && chain.id !== 11155111 && (
          <div className="mx-[42px] mt-[24px] -mb-[4px] flex items-center gap-[9px] rounded-[10px] border border-[#ffd58d]/[0.18] bg-[#ffbe61]/[0.07] px-[14px] py-[11px] text-[13px] text-[#ffd58d] max-[850px]:mx-[22px] max-[850px]:mt-[20px] max-[850px]:-mb-[14px]">
            请在钱包中切换到 Sepolia 测试网后再写入笔记。
          </div>
        )}
        <div className="mx-auto max-w-[1140px] px-[42px] py-[62px] max-[850px]:px-[22px] max-[850px]:py-[45px]">
          <div className="mb-[32px] flex items-end justify-between">
            <div>
              <p className="mb-[10px] font-mono text-[10px] font-medium uppercase tracking-[1.15px] text-[#99ae75]">
                {isConnected ? '你的想法，由你掌控' : '私密、可验证、永远属于你'}
              </p>
              <h1 className="m-0 font-display text-[39px] font-semibold tracking-[-0.9px] text-[#f6f5fa] max-[560px]:text-[34px]">
                {isConnected ? '笔记' : '把思考写进区块链'}
              </h1>
            </div>
            <p className="font-mono text-[12px] text-[#737b94]">{filteredNotes.length} 篇</p>
          </div>
          {/* 依次处理：未连接钱包 → 引导页；加载中 → 加载态；无结果 → 空状态；否则渲染笔记卡片网格 */}
          {!isConnected ? (
            <Welcome />
          ) : isLoading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-[#8992aa]">
              <LoaderCircle className="animate-spin" />
              <p>正在读取链上笔记…</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-[#8992aa]">
              <div className="mb-[16px] grid h-[52px] w-[52px] place-items-center rounded-[17px] bg-[#1c2731] text-[#c7eb73]">
                <PenLine />
              </div>
              <h2 className="mb-[8px] font-display text-[22px] font-semibold text-[#e7e8ee]">
                {query ? '没有找到相关笔记' : '从第一篇笔记开始'}
              </h2>
              <p className="mb-[20px] max-w-[360px] text-[14px] leading-[1.6]">
                {query
                  ? '试试使用其他关键词。'
                  : '每一次保存都会在 Sepolia 测试网上留下可验证的印记。'}
              </p>
              {!query && (
                <button
                  className="inline-flex items-center justify-center gap-[8px] whitespace-nowrap rounded-[9px] bg-accent px-[16px] py-[11px] text-[13px] font-bold text-[#152017] transition-transform hover:-translate-y-px hover:bg-accent-hover"
                  disabled={!isContractConfigured}
                  onClick={() => openEditor()}
                >
                  <Plus size={18} />
                  写下第一篇
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[15px] max-[850px]:grid-cols-2 max-[560px]:grid-cols-1">
              {filteredNotes.map((note, index) => (
                <button
                  className={`flex min-h-[206px] flex-col rounded-[13px] border border-white/[0.065] p-[20px] text-left text-[#dce0ec] transition-[transform,border-color,background-color] duration-200 hover:-translate-y-[3px] hover:border-accent/30 hover:bg-[#192034] ${
                    cardTones[index % 4]
                  }`}
                  key={note.id.toString()}
                  onClick={() => setSelected(note)}
                >
                  <div className="flex justify-between text-[#7f88a7]">
                    <span className="font-mono text-[10px] tracking-[0.7px] text-[#8d96b5]">
                      #{note.id.toString().padStart(3, '0')}
                    </span>
                    {note.archived && <Archive size={15} />}
                  </div>
                  <h2 className="mt-[27px] mb-[9px] font-display text-[18px] font-semibold leading-[1.25] text-[#f1f2f7]">
                    {note.title}
                  </h2>
                  <p className="m-0 line-clamp-2 text-[13px] leading-[1.55] text-[#a1a9bf]">
                    {note.content || '这篇笔记还没有正文。'}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-[18px] font-mono text-[10px] text-[#767f9d]">
                    <span>
                      {formatDistanceToNow(new Date(Number(note.updatedAt) * 1000), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                    <span className="inline-flex items-center gap-[5px] text-[#9ead85]">
                      <span className="h-[5px] w-[5px] rounded-full bg-accent" />
                      链上
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      {/* 编辑面板 / 详情面板：以浮层形式按需显示 */}
      {editor && (
        <Editor
          editor={editor}
          setEditor={setEditor}
          saving={isPending || confirming}
          error={error?.message}
          onClose={() => setEditor(null)}
          onSave={saveNote}
        />
      )}
      {selected && (
        <NoteDetail
          note={selected}
          txHistory={address ? getTxHistory(address, selected.id) : []}
          onClose={() => setSelected(null)}
          onEdit={() => openEditor(selected)}
          onArchive={() => archiveNote(selected)}
          saving={isPending || confirming}
        />
      )}
      {/* 交易状态浮条：发送中 / 确认中 / 已成功，点击可跳转区块浏览器查看详情 */}
      {hash && (
        <a
          className="fixed right-[24px] bottom-[24px] left-[24px] z-[12] flex items-center justify-center gap-[8px] whitespace-nowrap rounded-[10px] border border-accent/[0.22] bg-[#1d2b29] px-[16px] py-[13px] text-[13px] text-[#dfeacd] no-underline shadow-[0_15px_40px_rgba(0,0,0,0.35)] hover:bg-[#263832] sm:left-auto sm:justify-start"
          href={explorerUrl(hash)}
          target="_blank"
          rel="noreferrer"
        >
          {confirming ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : isSuccess ? (
            <Check size={17} />
          ) : (
            <LoaderCircle className="animate-spin" size={17} />
          )}{' '}
          {confirming ? '正在确认链上交易…' : isSuccess ? '已成功写入区块链' : '交易已发送'}
          <ArrowUpRight size={15} />
        </a>
      )}
    </main>
  )
}

// 未连接钱包时展示的欢迎/引导页
function Welcome() {
  return (
    <div className="relative mt-[47px] ml-[3%] max-w-[650px] overflow-hidden rounded-[18px] border border-accent/[0.19] bg-[linear-gradient(135deg,#18253a,#12182b_63%)] p-[60px_53px] shadow-[0_20px_80px_rgba(0,0,0,0.18)] max-[850px]:mt-[32px] max-[850px]:ml-0 max-[560px]:p-[38px_30px]">
      <div className="absolute -top-[125px] -right-[90px] h-[250px] w-[250px] bg-[#8ab95a] opacity-[0.24] blur-[80px]" />
      <p className="mb-[10px] font-mono text-[10px] font-medium uppercase tracking-[1.15px] text-[#99ae75]">
        WEB3 NOTEBOOK
      </p>
      <h2 className="relative mb-[18px] font-display text-[42px] leading-[1.1] font-semibold tracking-[-1.4px] text-[#f6f7fa] max-[560px]:text-[34px]">
        想法值得被
        <br />
        <i className="text-accent">永久珍藏。</i>
      </h2>
      <p className="max-w-[430px] text-[14px] leading-[1.7] text-[#adb6c9]">
        连接钱包，开始创建属于你的去中心化笔记。内容直接存储在链上，只有你能修改。
      </p>
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <button
            className="inline-flex items-center justify-center gap-[8px] whitespace-nowrap rounded-[9px] bg-accent px-[16px] py-[11px] text-[13px] font-bold text-[#152017] transition-transform hover:-translate-y-px hover:bg-accent-hover"
            onClick={openConnectModal}
          >
            连接钱包 <ArrowUpRight size={17} />
          </button>
        )}
      </ConnectButton.Custom>
      <div className="mt-[50px] flex gap-[25px] text-[11px] text-[#8c95ab] max-[560px]:mt-[35px] max-[560px]:flex-wrap max-[560px]:gap-[15px]">
        <span className="grid gap-[4px]">
          <b className="font-mono text-[12px] font-medium text-[#e4e7ed]">100%</b> 自主拥有
        </span>
        <span className="grid gap-[4px]">
          <b className="font-mono text-[12px] font-medium text-[#e4e7ed]">Sepolia</b> 测试网络
        </span>
        <span className="grid gap-[4px]">
          <b className="font-mono text-[12px] font-medium text-[#e4e7ed]">链上</b> 永久存储
        </span>
      </div>
    </div>
  )
}

// 顶部栏的钱包按钮：未连接 → 连接钱包；网络不支持 → 提示切换网络；已连接 → 显示账户信息
function WalletMenuButton() {
  const base =
    'inline-flex h-[37px] items-center gap-[7px] whitespace-nowrap rounded-[9px] border px-[13px] text-[12px] font-bold transition-colors duration-200'
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        const connected = mounted && account && chain
        if (!connected)
          return (
            <button
              className={`${base} border-accent/35 bg-accent/[0.06] text-accent hover:border-accent hover:bg-accent/15`}
              onClick={openConnectModal}
            >
              <Wallet size={16} />
              连接钱包
            </button>
          )
        if (chain.unsupported)
          return (
            <button
              className={`${base} border-[#ffd58d]/35 bg-accent/[0.06] text-[#ffd58d] hover:bg-accent/15`}
              onClick={openChainModal}
            >
              切换网络
            </button>
          )
        return (
          <button
            className={`${base} border-white/[0.13] bg-[#1a2133] text-[#d8dde9]`}
            onClick={openAccountModal}
          >
            <span className="h-[7px] w-[7px] rounded-full bg-[#8bdc73] shadow-[0_0_9px_#8bdc73]" />
            {account.displayName}
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}

// 新建/编辑笔记的浮层面板：包含标题输入、正文输入和保存按钮
function Editor({
  editor,
  setEditor,
  saving,
  error,
  onClose,
  onSave,
}: {
  editor: NonNullable<Editor>
  setEditor: (value: Editor) => void
  saving: boolean
  error?: string
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-[25] grid place-items-center bg-[#05070e]/[0.68] p-[25px] backdrop-blur-[8px] max-[560px]:p-[12px]">
      <section className="w-[min(100%,690px)] max-h-[calc(100vh-50px)] overflow-y-auto rounded-[18px] border border-white/10 bg-panel-3 p-[30px] shadow-[0_30px_90px_rgba(0,0,0,0.45)] max-[560px]:p-[23px]">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-[10px] font-mono text-[10px] font-medium uppercase tracking-[1.15px] text-[#99ae75]">
              {editor.id ? `编辑 #${editor.id}` : '新的链上记录'}
            </p>
            <h2 className="m-0 font-display text-[25px] font-semibold">
              {editor.id ? '修改笔记' : '写下此刻'}
            </h2>
          </div>
          <button
            className="grid h-[34px] w-[34px] place-items-center rounded-[8px] bg-[#222a3e] text-[#aeb7cc]"
            onClick={onClose}
            aria-label="关闭"
          >
            <X />
          </button>
        </div>
        <label className="mt-[26px] grid gap-[8px] text-[12px] text-[#aeb7c8]">
          标题
          <input
            className="w-full rounded-[9px] border border-[#2c354b] bg-[#111729] p-[13px] text-[#edf0f5] outline-none focus:border-[#b9e86b]"
            autoFocus
            value={editor.title}
            maxLength={120}
            onChange={(event) => setEditor({ ...editor, title: event.target.value })}
            placeholder="给这个想法起个名字"
          />
        </label>
        <label className="mt-[26px] grid gap-[8px] text-[12px] text-[#aeb7c8]">
          正文
          <textarea
            className="min-h-[220px] w-full resize-y rounded-[9px] border border-[#2c354b] bg-[#111729] p-[13px] leading-[1.65] text-[#edf0f5] outline-none focus:border-[#b9e86b]"
            value={editor.content}
            maxLength={5000}
            onChange={(event) => setEditor({ ...editor, content: event.target.value })}
            placeholder="在这里自由书写…"
          />
        </label>
        <div className="mt-[20px] flex min-h-[48px] items-center gap-[13px] font-mono text-[11px] text-[#74809c]">
          <span>{editor.content.length}/5000</span>
          {error && <span className="font-sans text-[#ff9f9f]">{error}</span>}
          <button
            className="ml-auto inline-flex items-center justify-center gap-[8px] whitespace-nowrap rounded-[9px] bg-accent px-[16px] py-[11px] text-[13px] font-bold text-[#152017] transition-transform hover:-translate-y-px hover:bg-accent-hover"
            disabled={!editor.title.trim() || saving}
            onClick={onSave}
          >
            {saving && <LoaderCircle className="animate-spin" size={17} />}
            {saving ? '等待确认…' : '写入链上'}
          </button>
        </div>
      </section>
    </div>
  )
}

// 各类链上操作在"链上记录"列表里显示的中文标签
const actionLabel: Record<NoteAction, string> = {
  create: '创建笔记',
  update: '更新笔记',
  archive: '归档/恢复',
}

// 笔记详情浮层面板：展示完整正文、编辑/归档入口，以及这篇笔记的历史链上交易记录
function NoteDetail({
  note,
  txHistory,
  onClose,
  onEdit,
  onArchive,
  saving,
}: {
  note: Note
  txHistory: TxRecord[]
  onClose: () => void
  onEdit: () => void
  onArchive: () => void
  saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-[25] grid place-items-center bg-[#05070e]/[0.68] p-[25px] backdrop-blur-[8px] max-[560px]:p-[12px]">
      <article className="w-[min(100%,610px)] max-h-[calc(100vh-50px)] overflow-y-auto rounded-[18px] border border-white/10 bg-panel-3 p-[30px] shadow-[0_30px_90px_rgba(0,0,0,0.45)] max-[560px]:p-[23px]">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[10px] tracking-[0.7px] text-[#8d96b5]">
            ON-CHAIN #{note.id.toString().padStart(3, '0')}
          </span>
          <button
            className="grid h-[34px] w-[34px] place-items-center rounded-[8px] bg-[#222a3e] text-[#aeb7cc]"
            onClick={onClose}
            aria-label="关闭"
          >
            <X />
          </button>
        </div>
        <h1 className="mt-[38px] mb-[10px] font-display text-[31px] leading-[1.18] font-semibold text-[#f1f2f6]">
          {note.title}
        </h1>
        <div className="flex items-center gap-[16px] font-mono text-[11px] text-[#8490aa]">
          <span>
            最后更新{' '}
            {formatDistanceToNow(new Date(Number(note.updatedAt) * 1000), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
          <span className="inline-flex items-center gap-[5px] text-[#9ead85]">
            <span className="h-[5px] w-[5px] rounded-full bg-accent" />
            Sepolia
          </span>
        </div>
        <p className="my-[35px] min-h-[180px] whitespace-pre-wrap text-[15px] leading-[1.8] text-[#c4cada]">
          {note.content || '这篇笔记还没有正文。'}
        </p>
        <div className="flex flex-wrap justify-end gap-[10px]">
          <button
            className="inline-flex items-center gap-[8px] whitespace-nowrap rounded-[9px] bg-[#222a3e] px-[15px] py-[11px] text-[#b9c0d2]"
            onClick={onArchive}
            disabled={saving}
          >
            <Archive size={16} />
            {note.archived ? '恢复笔记' : '归档笔记'}
          </button>
          <button
            className="inline-flex items-center justify-center gap-[8px] whitespace-nowrap rounded-[9px] bg-accent px-[16px] py-[11px] text-[13px] font-bold text-[#152017] transition-transform hover:-translate-y-px hover:bg-accent-hover"
            onClick={onEdit}
          >
            <PenLine size={16} />
            编辑笔记
          </button>
        </div>
        {/* 这篇笔记历史上产生过的每一笔链上交易，点击可跳转 Sepolia Etherscan 查看详情 */}
        <div className="mt-[30px] border-t border-white/[0.08] pt-[22px]">
          <p className="mx-[9px] mb-[9px] font-mono text-[10px] font-medium uppercase tracking-[1.15px] text-[#6f7692]">
            链上记录
          </p>
          {txHistory.length === 0 ? (
            <p className="m-0 text-[12px] leading-[1.6] text-[#767f9d]">
              这台设备上还没有本篇笔记的交易记录（可能是在其他设备/浏览器创建的）。
            </p>
          ) : (
            [...txHistory].reverse().map((record) => (
              <a
                key={record.hash}
                className="mb-[6px] flex items-center gap-[10px] rounded-[9px] bg-[#111729] px-[12px] py-[10px] text-[13px] text-[#c4cada] no-underline transition-colors duration-150 hover:bg-[#182036]"
                href={explorerUrl(record.hash)}
                target="_blank"
                rel="noreferrer"
              >
                <span>{actionLabel[record.action]}</span>
                <span className="ml-auto font-mono text-[11px] text-[#767f9d]">
                  {format(new Date(record.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                </span>
                <ArrowUpRight size={14} />
              </a>
            ))
          )}
        </div>
      </article>
    </div>
  )
}
