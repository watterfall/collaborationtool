import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: '协作论文平台 / Collaboration Tool',
  description:
    'AI-native research paper platform · 思考-写作-验证-发表 一体化工作台',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="zh-Hans">
      <body className="antialiased">{children}</body>
    </html>
  );
}
