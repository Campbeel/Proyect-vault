import ChatPage from "./chat";
import styles from "./chat.module.css";

export default function Page() {
  return (
    <main className={styles.main}>
      <ChatPage />
    </main>
  );
}