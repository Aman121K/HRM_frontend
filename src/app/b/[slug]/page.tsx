import { BrandSignIn } from "@/components/auth/sign-in";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BrandSignIn slug={slug.toLowerCase()} />;
}
