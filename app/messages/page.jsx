// app/messages/page.jsx → 网站路径 "/messages"
import "../../css/genshin-font.css";
import MessagesView from "../../components/MessagesView.jsx";

export const metadata = {
  title: "消息 · zero to tech",
  description: "好友消息与系统通知",
};

export default function Page() {
  return <MessagesView />;
}
