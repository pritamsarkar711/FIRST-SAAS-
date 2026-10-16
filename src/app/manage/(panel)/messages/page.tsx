import { MessagesManager } from "@/components/admin/messages-manager";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default function AdminMessagesPage() {
  return <MessagesManager />;
}
