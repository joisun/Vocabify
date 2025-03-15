import { sendMessageWithResponse } from "@/lib/messaging";
import { useEffect } from "react";
import { Layout, NewRecordPanel, RecordsPanel } from "./components/Layout";
import NewRecord from "./components/NewRecord";
import Records from "./components/Records";

function App() {
  useEffect(() => {
    const handleVisibilityChange = () => {
      document.hidden && sendMessageWithResponse('sidePanelClosed', undefined);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Layout>
      <NewRecordPanel>
        <NewRecord />
      </NewRecordPanel>
      <RecordsPanel>
        <Records />
      </RecordsPanel>
    </Layout>
  );
}

export default App;
