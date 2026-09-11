// app/messages/page.jsx → 网站路径 "/messages"
import type { Metadata } from "next";
import "../../css/genshin-font.css";
import MessagesView from "../../components/MessagesView";

export const metadata: Metadata = {
  title: "消息 · zero to tech",
  description: "好友消息与系统通知",
};

export default function Page() {
  return <MessagesView />;
}
