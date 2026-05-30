import { Metadata } from 'next';
import { getQuiz } from '@/services/quiz';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const defaultTitle = 'Quizeum クイズ | Quizeum';
  const defaultDesc = 'Quizeum でクイズに挑戦しよう！';
  const defaultImg = 'https://quizeum.vercel.app/og-image.png';

  const defaultMeta: Metadata = {
    title: defaultTitle,
    description: defaultDesc,
    openGraph: {
      title: defaultTitle,
      description: defaultDesc,
      type: 'article',
      url: 'https://quizeum.vercel.app',
      images: [
        {
          url: defaultImg,
          width: 1200,
          height: 630,
          alt: 'Quizeum',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: defaultDesc,
      images: [defaultImg],
    },
  };

  try {
    const resolvedParams = await params;
    const quizId = resolvedParams.id;
    const quiz = await getQuiz(quizId);
    
    if (!quiz) {
      return defaultMeta;
    }

    const title = `${quiz.title} | Quizeum`;
    const description = quiz.description || defaultDesc;
    const imageUrl = quiz.thumbnailUrl || defaultImg;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `https://quizeum.vercel.app/quiz/${quizId}`,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: quiz.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (e) {
    console.error('generateMetadata error:', e);
    return defaultMeta;
  }
}

export default function QuizDetailLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
