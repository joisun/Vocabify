import { Layout, NewRecordPanel, RecordsPanel } from "./components/Layout";
import NewRecord from "./components/NewRecord";
import Records from "./components/Records";

function App() {
  return (
    <Layout>
      <NewRecordPanel>
        <NewRecord />
      </NewRecordPanel>
      <RecordsPanel>
        <Records/>
      </RecordsPanel>
    </Layout>
  );
}

export default App;
