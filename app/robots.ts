import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/portal', '/api/', '/deal/'],
      },
    ],
    sitemap: 'https://agencygroup.pt/sitemap.xml',
    host: 'https://agencygroup.pt',
  }
}
