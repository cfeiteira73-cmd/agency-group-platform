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

  return {
    title: `${article.title} | Agency Group`,
    description: article.description,
    keywords: article.keywords.join(', '),
    authors: [{ name: article.author }],
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.date,
      authors: [article.author],
      url: `https://www.agencygroup.pt/blog/${article.slug}`,
      siteName: 'Agency Group — Imobiliário de Luxo Portugal',
      locale: article.category === 'Compradores Internacionais' && article.slug.includes('american')
        ? 'en_US'
        : article.slug.includes('franc')
        ? 'fr_FR'
        : 'pt_PT',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
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

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Person',
      name: article.author,
      url: 'https://www.agencygroup.pt/agente/carlos',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Agency Group — Imobiliário de Luxo Portugal',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.agencygroup.pt/og-logo.png',
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
