type SchoolPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return [];
}

export default async function SchoolPage({ params }: SchoolPageProps) {
  const { slug } = await params;

  return (
    <main>
      <h1>{slug.replaceAll("-", " ")}</h1>
      <p>Public school profile content will be hydrated from the API.</p>
    </main>
  );
}
