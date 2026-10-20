import type { MetadataRoute } from 'next'
import { withBasePath } from '@/lib/base-path'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: '智能错题本',
        short_name: '错题本',
        description: 'AI 驱动的智能错题管理系统，帮助学生高效整理、分析和复习错题',
        // 部署在子路径下时，start_url 与图标路径都需要带上 basePath 前缀
        start_url: withBasePath('/'),
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#f97316',
        orientation: 'portrait',
        icons: [
            {
                src: withBasePath('/icons/icon.png'),
                sizes: 'any',
                type: 'image/png',
            },
        ],
    }
}
