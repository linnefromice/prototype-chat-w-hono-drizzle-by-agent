import { defineConfig } from 'vitepress'

// https://vitepress.vuejs.org/config/app-configs
export default defineConfig({
  title: 'Prototype Hono Drizzle API',
  description: 'API Documentation and Snapshot Testing Results',
  base: '/prototype-chat-w-hono-drizzle-by-agent/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'API Reference', link: '/api/' },
      { text: 'Snapshots', link: '/snapshots/' },
      { text: 'Guides', link: '/guides/' },
    ],

    sidebar: {
      '/api/': [
        {
          text: 'API Documentation',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Users API', link: '/api/users' },
            { text: 'Conversations API', link: '/api/conversations' },
            { text: 'Messages API', link: '/api/messages' },
          ],
        },
      ],
      '/snapshots/': [
        {
          text: 'Snapshot Testing',
          items: [
            { text: 'Overview', link: '/snapshots/' },
            { text: 'Users Snapshots', link: '/snapshots/users' },
            { text: 'Conversations Snapshots', link: '/snapshots/conversations' },
            { text: 'Messages Snapshots', link: '/snapshots/messages' },
          ],
        },
      ],
      '/guides/': [
        {
          text: 'Guides',
          items: [
            { text: 'GitHub Pages Setup', link: '/guides/GITHUB_PAGES_SETUP' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/linnefromice/prototype-chat-w-hono-drizzle-by-agent' },
    ],

    footer: {
      message: 'Generated with VitePress',
      copyright: 'Copyright © 2024'
    }
  },
})
