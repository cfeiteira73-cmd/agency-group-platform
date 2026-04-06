import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/portal/',
          '/api/',
          '/_next/',
          '/admin/',
          '/deal/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/portal/', '/api/', '/deal/'],
        crawlDelay: 1,
      },
    ],
    sitemap: 'https://www.agencygroup.pt/sitemap.xml',
    host: 'https://www.agencygroup.pt',
  }
}
