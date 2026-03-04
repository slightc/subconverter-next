import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '在线订阅转换器 | Subconverter Next - 一键Vercel私有部署',
  description: '免费在线订阅转换工具，支持SS/SSR/VMess/Trojan/Hysteria2协议，转换为Clash/ClashR/Base64格式。支持Vercel一键部署，无需Docker，提供Web UI界面，自建订阅转换服务。',
  keywords: ['订阅转换', '订阅转换器', 'subconverter', 'Clash订阅', 'VMess转Clash', 'Trojan转Clash', 'SS订阅转换', 'Hysteria2', '在线订阅转换', 'Vercel部署', '代理订阅', '机场订阅转换', 'ClashR', 'subconverter-next'],
  authors: [{ name: 'Subconverter Next', url: 'https://github.com/slightc/subconverter-next' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: '在线订阅转换器 | Subconverter Next - 一键Vercel私有部署',
    description: '免费在线订阅转换工具，支持SS/SSR/VMess/Trojan/Hysteria2协议，转换为Clash/ClashR格式。支持Vercel一键部署，无需Docker，自建订阅转换服务。',
    siteName: 'Subconverter Next',
  },
  twitter: {
    card: 'summary',
    title: '在线订阅转换器 | Subconverter Next',
    description: '免费在线订阅转换工具，支持SS/SSR/VMess/Trojan/Hysteria2协议，转换为Clash/ClashR格式，支持Vercel一键部署。',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
