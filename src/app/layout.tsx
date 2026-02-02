export const metadata = {
  title: '在线订阅转换器 一键私有部署',
  description: '支持vercel一键部署/Serverless部署, 无需docker, 支持SS、SSR、VMess、Trojan、Hysteria2协议, 支持Clash、ClashR、Mixed (Base64)格式, 支持远程配置, 支持规则生成, 支持规则加载, 支持Web UI, 自建订阅转换, 订阅转换搭建',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
