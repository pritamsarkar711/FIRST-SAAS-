import { BlogManager } from "@/components/admin/blog-manager";

export const metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

export default function AdminBlogPage() {
  return <BlogManager />;
}
