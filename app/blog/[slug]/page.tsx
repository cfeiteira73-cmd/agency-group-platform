import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ARTICLES, getArticle, getRelatedArticles } from './articles'
import BlogArticle from './BlogArticle'

export function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return { title: 'Artigo não encontrado' }

  const ogImageUrl = `https://www.agencygroup.pt/api/og?title=${encodeURIComponent(article.title)}&subtitle=${encodeURIComponent(article.category)}`

  return {
    title: `${article.title} | Agency Group`,
    description: article.description,
    keywords: article.keywords.join(', '),
    authors: [{ name: article.author }],
    robots: { index: true, follow: true },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.date,
      modifiedTime: article.date,
      authors: [article.author],
      url: `https://www.agencygroup.pt/blog/${article.slug}`,
      siteName: 'Agency Group — Imobiliário de Luxo Portugal',
      locale: article.category === 'Compradores Internacionais' && article.slug.includes('american')
        ? 'en_US'
        : article.slug.includes('franc')
        ? 'fr_FR'
        : 'pt_PT',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `https://www.agencygroup.pt/blog/${article.slug}`,
    },
  }
}

export default async function BlogSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()

  const related = getRelatedArticles(article, 4)

  const ogImage = `https://www.agencygroup.pt/api/og?title=${encodeURIComponent(article.title)}&subtitle=${encodeURIComponent(article.category)}`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    image: ogImage,
    author: {
      '@type': 'Organization',
      name: 'Agency Group',
      url: 'https://www.agencygroup.pt',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Agency Group — Imobiliário de Luxo Portugal',
      url: 'https://www.agencygroup.pt',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.agencygroup.pt/og-logo.png',
        width: 200,
        height: 60,
      },
    },
    datePublished: article.date,
    dateModified: article.date,
    url: `https://www.agencygroup.pt/blog/${article.slug}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.agencygroup.pt/blog/${article.slug}`,
    },
    keywords: article.keywords.join(', '),
    inLanguage: article.slug.includes('franc') || article.slug.includes('lisbonne') ? 'fr' : 'pt',
    about: {
      '@type': 'Thing',
      name: 'Imobiliário em Portugal',
    },
    isPartOf: {
      '@type': 'Blog',
      '@id': 'https://www.agencygroup.pt/blog',
      name: 'Agency Group Blog',
      publisher: {
        '@type': 'Organization',
        name: 'Agency Group',
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <BlogArticle article={article} relatedArticles={related} />
    </>
  )
}
