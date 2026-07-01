import { Suspense } from "react";
import { DocumentChat } from "@/components/chat/document-chat";

export default function ChatPage() {
  return (
    <Suspense>
      <DocumentChat />
    </Suspense>
  );
}
