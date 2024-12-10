import MockLoading from "@/components/custom/MockLoading";
import ApiKeysConfigComponent from "./components/ApiKeysConfigComponent";
import PromptTemplate from "./components/PromptTemplate";
import TargetLanguageSetting from "./components/TargetLanguageSetting";
function App() {
  return (
    <>
      <MockLoading />
      <div className="container mx-auto max-w-4xl p-6">
        {/* <Button onClick={handleClick}>Hello wxt + Shadcn</Button> */}
        <ApiKeysConfigComponent />
        <TargetLanguageSetting />
        <PromptTemplate />
      </div>
    </>
  );
}

export default App;
