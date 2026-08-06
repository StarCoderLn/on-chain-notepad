# Noteblock · 链上记事本

一个使用 React、wagmi、RainbowKit 与 Solidity 编写的 Sepolia 链上记事本。笔记正文直接保存到合约中，可新建、编辑、归档和按内容检索。

系统架构图：[中文版](https://claude.ai/code/artifact/6549c0f0-775a-4715-8a97-ffe7eed27941) · [English](https://claude.ai/code/artifact/98c559a7-5a05-4cb3-9af5-1de740309583)

线上访问：[on-chain-notepad.pages.dev](https://on-chain-notepad.pages.dev)

合约地址：[`0xa66D0f8150b862Db4e51BE4671615CBb55475D43`](https://sepolia.etherscan.io/address/0xa66D0f8150b862Db4e51BE4671615CBb55475D43#code)（Sepolia，已开源验证）

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm dev
```

在 `.env` 设置 `VITE_WALLETCONNECT_PROJECT_ID`，才能在生产环境使用 WalletConnect。

## 本地验证

```bash
pnpm build
pnpm contract:compile
pnpm contract:test
```

合约编译会自动生成 `typechain-types/` 中的 ethers v6 类型。

## 部署合约到 Sepolia

1. 在 `.env` 填写 `SEPOLIA_RPC_URL`、`PRIVATE_KEY` 和 `ETHERSCAN_API_KEY`。
2. 执行 `pnpm contract:compile` 确认合约可编译；TypeChain 会自动生成 `typechain-types/` 中的 ethers v6 类型。
3. 执行 `pnpm contract:deploy`，记录输出的合约地址。
4. 将地址写入 `.env` 的 `VITE_NOTE_CONTRACT_ADDRESS` 和 `NOTE_CONTRACT_ADDRESS`。
5. 执行 `pnpm contract:verify` 在 [Sepolia Etherscan](https://sepolia.etherscan.io/) 开源验证合约。
6. 重启 Vite 服务，连接 Sepolia 钱包即可读写笔记。

> 链上存储有公开性和 Gas 成本。请勿写入私密信息；生产产品应考虑将加密内容存至去中心化存储，仅将内容哈希写入链上。
