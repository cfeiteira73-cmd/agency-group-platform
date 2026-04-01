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
      url: `https://agencygroup.pt/blog/${article.slug}`,
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
      canonical: `https://agencygroup.pt/blog/${article.slug}`,
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

  return <BlogArticle article={article} relatedArticles={related} />
}
