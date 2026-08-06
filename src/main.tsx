import '@rainbow-me/rainbowkit/styles.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { darkTheme, getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import App from './App'
import './styles.css'

// WalletConnect 项目 ID，未配置环境变量时使用演示用的占位 ID
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'
// RainbowKit + wagmi 的钱包连接配置，仅启用 Sepolia 测试网
const config = getDefaultConfig({ appName: 'Noteblock', projectId, chains: [sepolia], ssr: false })

// 钱包连接弹窗中使用的自定义头像（用字母 N 代替默认头像图标）
function NoteblockAvatar({ size }: { size: number }) {
  return (
    <span
      className="grid place-items-center rounded-full bg-accent font-display font-bold leading-none text-accent-fg"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
    >
      N
    </span>
  )
}

// 应用入口：依次包裹 wagmi（钱包状态）、react-query（数据请求缓存）、RainbowKit（连接钱包 UI）
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={new QueryClient()}>
        <RainbowKitProvider
          avatar={NoteblockAvatar}
          theme={darkTheme({
            accentColor: '#d6ff7f',
            accentColorForeground: '#182215',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
