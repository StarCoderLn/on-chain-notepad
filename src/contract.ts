import type { Address } from 'viem'

// 已部署合约的地址，从环境变量读取；未配置时使用全零地址占位
export const contractAddress = (import.meta.env.VITE_NOTE_CONTRACT_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as Address
// 是否已经配置了真实的合约地址（未配置时前端应禁用写入操作）
export const isContractConfigured = contractAddress !== '0x0000000000000000000000000000000000000000'

// 与 OnChainNotepad.sol 对应的合约 ABI，供 wagmi 读写合约时使用
export const notepadAbi = [
  {
    type: 'function',
    name: 'createNote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'content', type: 'string' },
    ],
    outputs: [{ name: 'noteId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'updateNote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'title', type: 'string' },
      { name: 'content', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'toggleArchive',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'noteId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getNotesByAuthor',
    stateMutability: 'view',
    inputs: [{ name: 'author', type: 'address' }],
    outputs: [
      {
        name: 'result',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'author', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'content', type: 'string' },
          { name: 'updatedAt', type: 'uint256' },
          { name: 'archived', type: 'bool' },
        ],
      },
    ],
  },
] as const

// 前端使用的笔记数据类型，字段与合约中的 Note 结构体一一对应
export type Note = {
  id: bigint
  author: Address
  title: string
  content: string
  updatedAt: bigint
  archived: boolean
}
